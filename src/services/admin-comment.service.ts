import { prisma } from "../lib/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { MAX_HOME_TESTIMONIALS } from "../lib/home-singletons.js";
import type {
  AdminReplyInput,
  ListAdminCommentsQuery,
  UpdateCommentInput,
} from "../schemas/admin-comment.schema.js";

type Fail<Reason extends string> = { ok: false; reason: Reason };

const EXCERPT_LENGTH = 80;

const excerpt = (text: string) =>
  text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH)}…` : text;

// ───────── لیست ─────────

export const listCommentsForAdmin = async (query: ListAdminCommentsQuery) => {
  const { page, limit, status, type, productId, showOnHome, search } = query;

  const where: Prisma.CommentWhereInput = {
    ...(status && { status }),
    ...(type === "root" && { parentId: null }),
    ...(type === "reply" && { parentId: { not: null } }),
    ...(productId && { productId }),
    ...(showOnHome !== undefined && { showOnHome }),
    ...(search && {
      OR: [
        { body: { contains: search, mode: "insensitive" } },
        { user: { fullName: { contains: search, mode: "insensitive" } } },
        { user: { mobile: { contains: search } } },
      ],
    }),
  };

  const [comments, total] = await prisma.$transaction([
    prisma.comment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        body: true,
        rating: true,
        status: true,
        showOnHome: true,
        parentId: true,
        createdAt: true,
        user: { select: { id: true, fullName: true, mobile: true, role: true } },
        product: { select: { id: true, name: true, slug: true } },
        parent: { select: { id: true, body: true } },
        _count: { select: { replies: true } },
      },
    }),
    prisma.comment.count({ where }),
  ]);

  // تعداد کل هر وضعیت (برای نشان روی تب‌ها)، مستقل از فیلتر فعلی
  const groups = await prisma.comment.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };

  for (const group of groups) counts[group.status] = group._count._all;

  const homeSelected = await prisma.comment.count({
    where: { showOnHome: true },
  });

  return {
    items: comments.map(({ parent, _count, ...comment }) => ({
      ...comment,
      isReply: comment.parentId !== null,
      parent: parent ? { id: parent.id, excerpt: excerpt(parent.body) } : null,
      replyCount: _count.replies,
    })),
    counts,
    home: { selected: homeSelected, max: MAX_HOME_TESTIMONIALS },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ───────── تغییر وضعیت و علامت صفحه‌ی اصلی ─────────

type UpdateCommentResult =
  | { ok: true; comment: { id: string; status: string; showOnHome: boolean } }
  | Fail<
      | "NOT_FOUND"
      | "SHOW_ON_HOME_ROOT_ONLY"
      | "SHOW_ON_HOME_NOT_APPROVED"
      | "SHOW_ON_HOME_LIMIT"
    >;

export const updateComment = async (
  id: string,
  input: UpdateCommentInput,
): Promise<UpdateCommentResult> => {
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, parentId: true, status: true, showOnHome: true },
  });

  if (!comment) return { ok: false, reason: "NOT_FOUND" };

  const nextStatus = input.status ?? comment.status;

  // نظری که تأییدشده نیست نمی‌تواند در صفحه‌ی اصلی بماند
  let nextShowOnHome =
    nextStatus === "APPROVED"
      ? (input.showOnHome ?? comment.showOnHome)
      : false;

  if (input.showOnHome === true) {
    if (comment.parentId) {
      return { ok: false, reason: "SHOW_ON_HOME_ROOT_ONLY" };
    }

    if (nextStatus !== "APPROVED") {
      return { ok: false, reason: "SHOW_ON_HOME_NOT_APPROVED" };
    }

    if (!comment.showOnHome) {
      const selected = await prisma.comment.count({
        where: { showOnHome: true },
      });

      if (selected >= MAX_HOME_TESTIMONIALS) {
        return { ok: false, reason: "SHOW_ON_HOME_LIMIT" };
      }
    }
  }

  // پاسخ‌ها هیچ‌وقت علامت صفحه‌ی اصلی نمی‌گیرند
  if (comment.parentId) nextShowOnHome = false;

  const updated = await prisma.comment.update({
    where: { id },
    data: { status: nextStatus, showOnHome: nextShowOnHome },
    select: { id: true, status: true, showOnHome: true },
  });

  return { ok: true, comment: updated };
};

// ───────── پاسخ ادمین ─────────

type ReplyResult =
  | { ok: true; comment: { id: string } }
  | Fail<"NOT_FOUND" | "PARENT_IS_REPLY" | "PARENT_NOT_APPROVED">;

export const replyAsAdmin = async (
  adminId: string,
  parentId: string,
  { body }: AdminReplyInput,
): Promise<ReplyResult> => {
  const parent = await prisma.comment.findUnique({
    where: { id: parentId },
    select: { id: true, productId: true, parentId: true, status: true },
  });

  if (!parent) return { ok: false, reason: "NOT_FOUND" };
  if (parent.parentId) return { ok: false, reason: "PARENT_IS_REPLY" };
  if (parent.status !== "APPROVED") {
    return { ok: false, reason: "PARENT_NOT_APPROVED" };
  }

  const reply = await prisma.comment.create({
    data: {
      body,
      productId: parent.productId,
      userId: adminId,
      parentId: parent.id,
      status: "APPROVED", // پاسخ ادمین مستقیم نمایش داده می‌شود
    },
    select: { id: true },
  });

  return { ok: true, comment: reply };
};

// ───────── حذف ─────────

// پاسخ‌های یک نظر هم با حذف آن پاک می‌شوند (onDelete: Cascade)
export const deleteComment = async (id: string) => {
  const result = await prisma.comment.deleteMany({ where: { id } });

  return result.count > 0;
};