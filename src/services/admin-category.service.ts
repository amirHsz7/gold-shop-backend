import { prisma } from "../lib/prisma.js";
import { storage } from "../lib/storage.js";
import {
  deleteImage as deleteStoredImage,
  saveImage,
} from "./image.service.js";
import type { CategoryInput } from "../schemas/admin-category.schema.js";

type Fail<Reason extends string> = { ok: false; reason: Reason };

const isUniqueViolation = (error: unknown) =>
  (error as { code?: string } | null)?.code === "P2002";

const isForeignKeyViolation = (error: unknown) =>
  (error as { code?: string } | null)?.code === "P2003";

// بررسی اینکه دسته‌ی والد معتبر است
const checkParent = async (parentId: string, isActive: boolean) => {
  const parent = await prisma.category.findUnique({
    where: { id: parentId },
    select: { parentId: true, isActive: true },
  });

  if (!parent) return "PARENT_NOT_FOUND" as const;
  // فقط تا دو سطح: والد خودش نباید زیردسته باشد
  if (parent.parentId) return "PARENT_IS_CHILD" as const;
  // زیردسته‌ی فعال زیر والد غیرفعال معنی ندارد
  if (!parent.isActive && isActive) return "PARENT_INACTIVE" as const;

  return null;
};

// ───────── خواندن ─────────

// درخت همه‌ی دسته‌ها (شامل غیرفعال‌ها) برای پنل ادمین
export const listCategoriesForAdmin = async () => {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      sortOrder: true,
      isActive: true,
      imageKey: true,
      _count: { select: { products: { where: { deletedAt: null } } } },
    },
  });

  const nodes = categories.map(({ imageKey, _count, ...category }) => ({
    ...category,
    imageUrl: imageKey ? storage.getUrl(imageKey) : null,
    productCount: _count.products,
  }));

  return nodes
    .filter((node) => !node.parentId)
    .map((root) => ({
      ...root,
      children: nodes.filter((node) => node.parentId === root.id),
    }));
};

export const getCategoryForAdmin = async (id: string) => {
  const category = await prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      sortOrder: true,
      isActive: true,
      imageKey: true,
      createdAt: true,
      updatedAt: true,
      parent: { select: { id: true, name: true } },
      _count: {
        select: {
          children: true,
          products: { where: { deletedAt: null } },
        },
      },
    },
  });

  if (!category) return null;

  const { imageKey, _count, ...rest } = category;

  return {
    ...rest,
    imageUrl: imageKey ? storage.getUrl(imageKey) : null,
    childrenCount: _count.children,
    productCount: _count.products,
  };
};

// ───────── ساخت ─────────

type CreateCategoryResult =
  | { ok: true; category: { id: string; slug: string } }
  | Fail<
      | "SLUG_TAKEN"
      | "PARENT_NOT_FOUND"
      | "PARENT_IS_CHILD"
      | "PARENT_INACTIVE"
    >;

export const createCategory = async (
  input: CategoryInput,
): Promise<CreateCategoryResult> => {
  const { parentId, ...data } = input;

  if (parentId) {
    const reason = await checkParent(parentId, data.isActive);

    if (reason) return { ok: false, reason };
  }

  const slugOwner = await prisma.category.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });

  if (slugOwner) return { ok: false, reason: "SLUG_TAKEN" };

  try {
    const category = await prisma.category.create({
      data: { ...data, parentId: parentId ?? null },
      select: { id: true, slug: true },
    });

    return { ok: true, category };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "SLUG_TAKEN" };

    throw error;
  }
};

// ───────── ویرایش کامل ─────────

type UpdateCategoryResult =
  | { ok: true; category: { id: string; slug: string } }
  | Fail<
      | "NOT_FOUND"
      | "SLUG_TAKEN"
      | "PARENT_NOT_FOUND"
      | "PARENT_IS_SELF"
      | "PARENT_IS_CHILD"
      | "PARENT_INACTIVE"
      | "HAS_CHILDREN_CANNOT_NEST"
    >;

export const updateCategory = async (
  id: string,
  input: CategoryInput,
): Promise<UpdateCategoryResult> => {
  const { parentId, ...data } = input;

  const existing = await prisma.category.findUnique({
    where: { id },
    select: { id: true, _count: { select: { children: true } } },
  });

  if (!existing) return { ok: false, reason: "NOT_FOUND" };

  if (parentId) {
    if (parentId === id) return { ok: false, reason: "PARENT_IS_SELF" };

    // دسته‌ای که زیردسته دارد نمی‌تواند خودش زیردسته شود
    if (existing._count.children > 0) {
      return { ok: false, reason: "HAS_CHILDREN_CANNOT_NEST" };
    }

    const reason = await checkParent(parentId, data.isActive);

    if (reason) return { ok: false, reason };
  }

  const slugOwner = await prisma.category.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });

  if (slugOwner && slugOwner.id !== id) {
    return { ok: false, reason: "SLUG_TAKEN" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.category.update({
        where: { id },
        data: { ...data, parentId: parentId ?? null },
      });

      // غیرفعال کردن دسته، زیردسته‌هایش را هم غیرفعال می‌کند
      if (!data.isActive) {
        await tx.category.updateMany({
          where: { parentId: id },
          data: { isActive: false },
        });
      }
    });

    return { ok: true, category: { id, slug: data.slug } };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "SLUG_TAKEN" };

    throw error;
  }
};

// ───────── حذف ─────────

type DeleteCategoryResult =
  | { ok: true }
  | Fail<"NOT_FOUND" | "HAS_CHILDREN" | "HAS_PRODUCTS">;

export const deleteCategory = async (
  id: string,
): Promise<DeleteCategoryResult> => {
  const category = await prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
      imageKey: true,
      // محصول حذف‌شده هم حساب می‌شود، چون هنوز به دسته وصل است
      _count: { select: { children: true, products: true } },
    },
  });

  if (!category) return { ok: false, reason: "NOT_FOUND" };
  if (category._count.children > 0) return { ok: false, reason: "HAS_CHILDREN" };
  if (category._count.products > 0) return { ok: false, reason: "HAS_PRODUCTS" };

  try {
    await prisma.category.delete({ where: { id } });
  } catch (error) {
    // اگر هم‌زمان محصولی به این دسته وصل شد
    if (isForeignKeyViolation(error)) {
      return { ok: false, reason: "HAS_PRODUCTS" };
    }

    throw error;
  }

  if (category.imageKey) await deleteStoredImage(category.imageKey);

  return { ok: true };
};

// ───────── عکس ─────────

type SetImageResult =
  | { ok: true; image: { url: string } }
  | Fail<"NOT_FOUND" | "INVALID_IMAGE">;

export const setCategoryImage = async (
  id: string,
  file: Buffer,
): Promise<SetImageResult> => {
  const category = await prisma.category.findUnique({
    where: { id },
    select: { id: true, imageKey: true },
  });

  if (!category) return { ok: false, reason: "NOT_FOUND" };

  let saved: { key: string; url: string };

  try {
    saved = await saveImage(file, { folder: "categories", maxWidth: 1000 });
  } catch {
    return { ok: false, reason: "INVALID_IMAGE" };
  }

  try {
    await prisma.category.update({
      where: { id },
      data: { imageKey: saved.key },
    });
  } catch (error) {
    // اگر ثبت در دیتابیس شکست خورد، فایل یتیم روی دیسک نماند
    await deleteStoredImage(saved.key);
    throw error;
  }

  // عکس قبلی بعد از موفقیت پاک می‌شود
  if (category.imageKey) await deleteStoredImage(category.imageKey);

  return { ok: true, image: { url: saved.url } };
};

export const deleteCategoryImage = async (id: string) => {
  const category = await prisma.category.findUnique({
    where: { id },
    select: { id: true, imageKey: true },
  });

  if (!category) return false;

  if (category.imageKey) {
    await prisma.category.update({ where: { id }, data: { imageKey: null } });
    await deleteStoredImage(category.imageKey);
  }

  return true;
};