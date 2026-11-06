import { prisma } from "../lib/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import type {
  CreateCommentInput,
  ListCommentsQuery,
} from "../schemas/comment.schema.js";

const commentSelect = {
  id: true,
  body: true,
  rating: true,
  createdAt: true,
  user: { select: { fullName: true, role: true } },
} satisfies Prisma.CommentSelect;

type CommentRow = Prisma.CommentGetPayload<{ select: typeof commentSelect }>;

const round1 = (value: number) => Math.round(value * 10) / 10;

// موبایل کاربر هیچ‌وقت بیرون نمی‌رود؛ فقط نام و اینکه ادمین است یا نه
const toPublicComment = ({ user, ...comment }: CommentRow) => ({
  ...comment,
  author: { name: user.fullName, isAdmin: user.role === "ADMIN" },
});

// میانگین، تعداد و توزیع امتیازها (فقط نظرهای تأییدشده)
const getRatingSummary = async (productId: string) => {
  const groups = await prisma.comment.groupBy({
    by: ["rating"],
    where: { productId, status: "APPROVED", rating: { not: null } },
    _count: { _all: true },
  });

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let count = 0;
  let sum = 0;

  for (const group of groups) {
    if (group.rating === null) continue;

    distribution[group.rating] = group._count._all;
    count += group._count._all;
    sum += group.rating * group._count._all;
  }

  return {
    average: count > 0 ? round1(sum / count) : 0,
    count,
    distribution,
  };
};

// میانگین و تعداد امتیاز چند محصول با یک کوئری (برای لیست محصولات)
export const getRatingsByProductIds = async (productIds: string[]) => {
  const ratings = new Map<string, { average: number; count: number }>();

  if (productIds.length === 0) return ratings;

  const groups = await prisma.comment.groupBy({
    by: ["productId"],
    where: {
      productId: { in: productIds },
      status: "APPROVED",
      rating: { not: null },
    },
    _avg: { rating: true },
    _count: { rating: true },
  });

  for (const group of groups) {
    ratings.set(group.productId, {
      average: round1(group._avg.rating ?? 0),
      count: group._count.rating,
    });
  }

  return ratings;
};

export const listProductComments = async (
  slug: string,
  { page, limit }: ListCommentsQuery,
) => {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true, deletedAt: null },
    select: { id: true },
  });

  if (!product) return null;

  const where: Prisma.CommentWhereInput = {
    productId: product.id,
    parentId: null, // فقط نظرهای اصلی؛ پاسخ‌ها زیر هر نظر می‌آیند
    status: "APPROVED",
  };

  const [comments, total] = await prisma.$transaction([
    prisma.comment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        ...commentSelect,
        replies: {
          where: { status: "APPROVED" },
          orderBy: { createdAt: "asc" },
          select: commentSelect,
        },
      },
    }),
    prisma.comment.count({ where }),
  ]);

  const summary = await getRatingSummary(product.id);

  return {
    summary,
    items: comments.map(({ replies, ...comment }) => ({
      ...toPublicComment(comment),
      replies: replies.map(toPublicComment),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

type CreateCommentResult =
  | { ok: true; comment: { id: string; status: "PENDING" | "APPROVED" } }
  | {
      ok: false;
      reason:
        | "PRODUCT_NOT_FOUND"
        | "PARENT_NOT_FOUND"
        | "RATING_ON_REPLY"
        | "ALREADY_RATED";
    };

export const createComment = async (
  userId: string,
  slug: string,
  { body, parentId, rating }: CreateCommentInput,
): Promise<CreateCommentResult> => {
  // امتیاز فقط برای نظر اصلی مجاز است
  if (rating !== undefined && parentId) {
    return { ok: false, reason: "RATING_ON_REPLY" };
  }

  const product = await prisma.product.findFirst({
    where: { slug, isActive: true, deletedAt: null },
    select: { id: true },
  });

  if (!product) return { ok: false, reason: "PRODUCT_NOT_FOUND" };

  if (parentId) {
    // والد باید: همین محصول، نظر اصلی (نه پاسخ)، و تأییدشده باشد
    const parent = await prisma.comment.findFirst({
      where: {
        id: parentId,
        productId: product.id,
        parentId: null,
        status: "APPROVED",
      },
      select: { id: true },
    });

    if (!parent) return { ok: false, reason: "PARENT_NOT_FOUND" };
  }

  if (rating !== undefined) {
    // هر کاربر برای هر محصول فقط یک نظر امتیازدار (نظر ردشده حساب نمی‌شود)
    const existing = await prisma.comment.findFirst({
      where: {
        productId: product.id,
        userId,
        parentId: null,
        rating: { not: null },
        status: { in: ["PENDING", "APPROVED"] },
      },
      select: { id: true },
    });

    if (existing) return { ok: false, reason: "ALREADY_RATED" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  const comment = await prisma.comment.create({
    data: {
      body,
      rating: rating ?? null,
      productId: product.id,
      userId,
      parentId: parentId ?? null,
      // نظر ادمین مستقیم تأیید می‌شود
      status: user?.role === "ADMIN" ? "APPROVED" : "PENDING",
    },
    select: { id: true, status: true },
  });

  return {
    ok: true,
    comment: {
      id: comment.id,
      status: comment.status === "APPROVED" ? "APPROVED" : "PENDING",
    },
  };
};