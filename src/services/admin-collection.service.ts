import { prisma } from "../lib/prisma.js";
import { storage } from "../lib/storage.js";
import {
  deleteImage as deleteStoredImage,
  saveImage,
} from "./image.service.js";
import type { CollectionInput } from "../schemas/admin-collection.schema.js";

type Fail<Reason extends string> = { ok: false; reason: Reason };

const isUniqueViolation = (error: unknown) =>
  (error as { code?: string } | null)?.code === "P2002";

// ───────── خواندن ─────────

// لیست همه‌ی کالکشن‌ها (شامل غیرفعال‌ها) برای پنل ادمین
export const listCollectionsForAdmin = async () => {
  const collections = await prisma.collection.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      sortOrder: true,
      isActive: true,
      imageKey: true,
      _count: { select: { products: { where: { deletedAt: null } } } },
    },
  });

  return collections.map(({ imageKey, _count, ...collection }) => ({
    ...collection,
    imageUrl: imageKey ? storage.getUrl(imageKey) : null,
    productCount: _count.products,
  }));
};

export const getCollectionForAdmin = async (id: string) => {
  const collection = await prisma.collection.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      sortOrder: true,
      isActive: true,
      imageKey: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { products: { where: { deletedAt: null } } } },
    },
  });

  if (!collection) return null;

  const { imageKey, _count, ...rest } = collection;

  return {
    ...rest,
    imageUrl: imageKey ? storage.getUrl(imageKey) : null,
    productCount: _count.products,
  };
};

// ───────── ساخت ─────────

type CreateCollectionResult =
  | { ok: true; collection: { id: string; slug: string } }
  | Fail<"SLUG_TAKEN">;

export const createCollection = async (
  input: CollectionInput,
): Promise<CreateCollectionResult> => {
  const { description, ...data } = input;

  const slugOwner = await prisma.collection.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });

  if (slugOwner) return { ok: false, reason: "SLUG_TAKEN" };

  try {
    const collection = await prisma.collection.create({
      data: { ...data, description: description ?? null },
      select: { id: true, slug: true },
    });

    return { ok: true, collection };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "SLUG_TAKEN" };

    throw error;
  }
};

// ───────── ویرایش کامل ─────────

type UpdateCollectionResult =
  | { ok: true; collection: { id: string; slug: string } }
  | Fail<"NOT_FOUND" | "SLUG_TAKEN">;

export const updateCollection = async (
  id: string,
  input: CollectionInput,
): Promise<UpdateCollectionResult> => {
  const { description, ...data } = input;

  const existing = await prisma.collection.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) return { ok: false, reason: "NOT_FOUND" };

  const slugOwner = await prisma.collection.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });

  if (slugOwner && slugOwner.id !== id) {
    return { ok: false, reason: "SLUG_TAKEN" };
  }

  try {
    await prisma.collection.update({
      where: { id },
      data: { ...data, description: description ?? null },
    });

    return { ok: true, collection: { id, slug: data.slug } };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "SLUG_TAKEN" };

    throw error;
  }
};

// ───────── حذف ─────────

type DeleteCollectionResult =
  | { ok: true; detachedProducts: number }
  | Fail<"NOT_FOUND">;

export const deleteCollection = async (
  id: string,
): Promise<DeleteCollectionResult> => {
  const collection = await prisma.collection.findUnique({
    where: { id },
    select: {
      id: true,
      imageKey: true,
      _count: { select: { products: { where: { deletedAt: null } } } },
    },
  });

  if (!collection) return { ok: false, reason: "NOT_FOUND" };

  // محصولات این کالکشن حذف نمی‌شوند و فقط collectionId آن‌ها خالی می‌شود
  await prisma.collection.delete({ where: { id } });

  if (collection.imageKey) await deleteStoredImage(collection.imageKey);

  return { ok: true, detachedProducts: collection._count.products };
};

// ───────── عکس ─────────

type SetImageResult =
  | { ok: true; image: { url: string } }
  | Fail<"NOT_FOUND" | "INVALID_IMAGE">;

export const setCollectionImage = async (
  id: string,
  file: Buffer,
): Promise<SetImageResult> => {
  const collection = await prisma.collection.findUnique({
    where: { id },
    select: { id: true, imageKey: true },
  });

  if (!collection) return { ok: false, reason: "NOT_FOUND" };

  let saved: { key: string; url: string };

  try {
    saved = await saveImage(file, { folder: "collections", maxWidth: 1200 });
  } catch {
    return { ok: false, reason: "INVALID_IMAGE" };
  }

  try {
    await prisma.collection.update({
      where: { id },
      data: { imageKey: saved.key },
    });
  } catch (error) {
    // اگر ثبت در دیتابیس شکست خورد، فایل یتیم روی دیسک نماند
    await deleteStoredImage(saved.key);
    throw error;
  }

  // عکس قبلی بعد از موفقیت پاک می‌شود
  if (collection.imageKey) await deleteStoredImage(collection.imageKey);

  return { ok: true, image: { url: saved.url } };
};

export const deleteCollectionImage = async (id: string) => {
  const collection = await prisma.collection.findUnique({
    where: { id },
    select: { id: true, imageKey: true },
  });

  if (!collection) return false;

  if (collection.imageKey) {
    await prisma.collection.update({ where: { id }, data: { imageKey: null } });
    await deleteStoredImage(collection.imageKey);
  }

  return true;
};