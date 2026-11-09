import { prisma } from "../lib/prisma.js";
import { storage } from "../lib/storage.js";
import type { Prisma } from "../generated/prisma/client.js";
import {
  deleteImage as deleteStoredImage,
  saveImage,
} from "./image.service.js";
import type {
  CreateProductInput,
  ListAdminProductsQuery,
  UpdateProductInput,
} from "../schemas/admin-product.schema.js";

const MAX_IMAGES_PER_PRODUCT = 10;

type Fail<Reason extends string> = { ok: false; reason: Reason };

const isUniqueViolation = (error: unknown) =>
  (error as { code?: string } | null)?.code === "P2002";

// کمترین و بیشترین وزن بین وزن‌های فعال (برای مرتب‌سازی بر اساس وزن)
const getWeightRange = (variants: { weight: number; isActive: boolean }[]) => {
  const weights = variants
    .filter((variant) => variant.isActive)
    .map((variant) => variant.weight);

  return weights.length > 0
    ? { minWeight: Math.min(...weights), maxWeight: Math.max(...weights) }
    : { minWeight: 0, maxWeight: 0 };
};

// ───────── خواندن برای فرم ویرایش ─────────

const adminProductSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  categoryId: true,
  collectionId: true,
  discountPercent: true,
  isFeatured: true,
  isActive: true,
  minWeight: true,
  maxWeight: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  collection: { select: { id: true, name: true } },
  // برای ادمین همه‌ی وزن‌ها (حتی غیرفعال) نمایش داده می‌شود
  variants: {
    orderBy: [{ sortOrder: "asc" }, { weight: "asc" }],
    select: {
      id: true,
      label: true,
      sku: true,
      weight: true,
      fee: true,
      feeAmount: true,
      stock: true,
      isActive: true,
    },
  },
  images: {
    orderBy: { sortOrder: "asc" },
    select: { id: true, key: true, alt: true },
  },
} satisfies Prisma.ProductSelect;

// اعداد به‌صورت number برمی‌گردند تا همین خروجی مستقیم در PUT قابل ارسال باشد
export const getProductForAdmin = async (id: string) => {
  const product = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    select: adminProductSelect,
  });

  if (!product) return null;

  const { images, variants, ...rest } = product;

  return {
    ...rest,
    minWeight: rest.minWeight.toNumber(),
    maxWeight: rest.maxWeight.toNumber(),
    discountPercent: rest.discountPercent.toNumber(),
    variants: variants.map((variant) => ({
      ...variant,
      weight: variant.weight.toNumber(),
      fee: variant.fee.toNumber(),
      feeAmount: variant.feeAmount.toNumber(),
    })),
    images: images.map(({ key, ...image }) => ({
      ...image,
      url: storage.getUrl(key),
    })),
  };
};

// ───────── لیست محصولات برای ادمین ─────────

const adminListOrderBy = {
  newest: [{ createdAt: "desc" }],
  oldest: [{ createdAt: "asc" }],
  name: [{ name: "asc" }],
  updated: [{ updatedAt: "desc" }],
} satisfies Record<
  ListAdminProductsQuery["sort"],
  Prisma.ProductOrderByWithRelationInput[]
>;

export const listProductsForAdmin = async (query: ListAdminProductsQuery) => {
  const {
    page,
    limit,
    search,
    categoryId,
    collectionId,
    status,
    stock,
    hasDiscount,
    sort,
  } = query;

  const and: Prisma.ProductWhereInput[] = [];

  // اگر دسته‌ی والد انتخاب شود، محصولات زیردسته‌هایش هم می‌آیند
  if (categoryId) {
    and.push({ OR: [{ categoryId }, { category: { parentId: categoryId } }] });
  }

  if (search) {
    and.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        {
          variants: {
            some: { sku: { contains: search, mode: "insensitive" } },
          },
        },
      ],
    });
  }

  const hasAvailableStock: Prisma.ProductWhereInput = {
    variants: { some: { isActive: true, stock: { gt: 0 } } },
  };

  if (stock === "in") and.push(hasAvailableStock);
  if (stock === "out") and.push({ NOT: hasAvailableStock });

  // برخلاف API عمومی، محصول غیرفعال و بدون وزن فعال هم نمایش داده می‌شود
  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(collectionId && { collectionId }),
    ...(status && { isActive: status === "active" }),
    ...(hasDiscount && { discountPercent: { gt: 0 } }),
    ...(and.length > 0 && { AND: and }),
  };

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: adminListOrderBy[sort],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        isFeatured: true,
        discountPercent: true,
        minWeight: true,
        maxWeight: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { id: true, name: true } },
        collection: { select: { id: true, name: true } },
        variants: { select: { stock: true, isActive: true } },
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1,
          select: { key: true },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: products.map(({ variants, images, ...product }) => {
      const activeVariants = variants.filter((variant) => variant.isActive);
      const totalStock = activeVariants.reduce(
        (sum, variant) => sum + variant.stock,
        0,
      );

      return {
        ...product,
        discountPercent: product.discountPercent.toNumber(),
        minWeight: product.minWeight.toNumber(),
        maxWeight: product.maxWeight.toNumber(),
        variantCount: variants.length,
        activeVariantCount: activeVariants.length,
        totalStock,
        inStock: totalStock > 0,
        imageUrl: images[0] ? storage.getUrl(images[0].key) : null,
      };
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ───────── ساخت محصول ─────────

type CreateProductResult =
  | { ok: true; product: { id: string; slug: string } }
  | Fail<
      "CATEGORY_NOT_FOUND" | "COLLECTION_NOT_FOUND" | "SLUG_TAKEN" | "SKU_TAKEN"
    >;

export const createProduct = async (
  input: CreateProductInput,
): Promise<CreateProductResult> => {
  const { variants, collectionId, description, ...productData } = input;

  const category = await prisma.category.findFirst({
    where: { id: productData.categoryId, isActive: true },
    select: { id: true },
  });

  if (!category) return { ok: false, reason: "CATEGORY_NOT_FOUND" };

  if (collectionId) {
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, isActive: true },
      select: { id: true },
    });

    if (!collection) return { ok: false, reason: "COLLECTION_NOT_FOUND" };
  }

  const slugOwner = await prisma.product.findUnique({
    where: { slug: productData.slug },
    select: { id: true },
  });

  if (slugOwner) return { ok: false, reason: "SLUG_TAKEN" };

  const skus = variants
    .map((variant) => variant.sku)
    .filter((sku): sku is string => Boolean(sku));

  if (skus.length > 0) {
    const skuOwner = await prisma.productVariant.findFirst({
      where: { sku: { in: skus } },
      select: { id: true },
    });

    if (skuOwner) return { ok: false, reason: "SKU_TAKEN" };
  }

  try {
    const product = await prisma.product.create({
      data: {
        ...productData,
        description: description ?? null,
        collectionId: collectionId ?? null,
        ...getWeightRange(variants),
        variants: {
          create: variants.map((variant, index) => ({
            label: variant.label ?? null,
            sku: variant.sku ?? null,
            weight: variant.weight,
            fee: variant.fee,
            feeAmount: variant.feeAmount,
            stock: variant.stock,
            isActive: variant.isActive,
            sortOrder: index,
          })),
        },
      },
      select: { id: true, slug: true },
    });

    return { ok: true, product };
  } catch (error) {
    // اگر بین چک و ساخت، درخواست دیگری همان slug یا sku را گرفته باشد
    if (isUniqueViolation(error)) return { ok: false, reason: "SLUG_TAKEN" };

    throw error;
  }
};

// ───────── ویرایش کامل محصول ─────────

type UpdateProductResult =
  | { ok: true; product: { id: string; slug: string } }
  | Fail<
      | "PRODUCT_NOT_FOUND"
      | "CATEGORY_NOT_FOUND"
      | "COLLECTION_NOT_FOUND"
      | "SLUG_TAKEN"
      | "SKU_TAKEN"
      | "VARIANT_NOT_FOUND"
      | "CONFLICT"
    >;

export const updateProduct = async (
  id: string,
  input: UpdateProductInput,
): Promise<UpdateProductResult> => {
  const { variants, collectionId, description, ...productData } = input;

  const existing = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, variants: { select: { id: true } } },
  });

  if (!existing) return { ok: false, reason: "PRODUCT_NOT_FOUND" };

  const category = await prisma.category.findFirst({
    where: { id: productData.categoryId, isActive: true },
    select: { id: true },
  });

  if (!category) return { ok: false, reason: "CATEGORY_NOT_FOUND" };

  if (collectionId) {
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, isActive: true },
      select: { id: true },
    });

    if (!collection) return { ok: false, reason: "COLLECTION_NOT_FOUND" };
  }

  const slugOwner = await prisma.product.findUnique({
    where: { slug: productData.slug },
    select: { id: true },
  });

  if (slugOwner && slugOwner.id !== id) {
    return { ok: false, reason: "SLUG_TAKEN" };
  }

  // وزن‌هایی که id دارند باید مال همین محصول باشند
  const ownedIds = new Set(existing.variants.map((variant) => variant.id));

  if (variants.some((variant) => variant.id && !ownedIds.has(variant.id))) {
    return { ok: false, reason: "VARIANT_NOT_FOUND" };
  }

  // sku وزن‌های محصولات دیگر
  const skus = variants
    .map((variant) => variant.sku)
    .filter((sku): sku is string => Boolean(sku));

  if (skus.length > 0) {
    const skuOwner = await prisma.productVariant.findFirst({
      where: { sku: { in: skus }, productId: { not: id } },
      select: { id: true },
    });

    if (skuOwner) return { ok: false, reason: "SKU_TAKEN" };
  }

  const keepIds = variants.flatMap((variant) =>
    variant.id ? [variant.id] : [],
  );

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...productData,
          description: description ?? null,
          collectionId: collectionId ?? null,
          ...getWeightRange(variants),
        },
      });

      // وزن‌هایی که در لیست جدید نیستند حذف می‌شوند
      await tx.productVariant.deleteMany({
        where: { productId: id, id: { notIn: keepIds } },
      });

      for (const [index, variant] of variants.entries()) {
        const data = {
          label: variant.label ?? null,
          sku: variant.sku ?? null,
          weight: variant.weight,
          fee: variant.fee,
          feeAmount: variant.feeAmount,
          stock: variant.stock,
          isActive: variant.isActive,
          sortOrder: index,
        };

        if (variant.id) {
          await tx.productVariant.update({ where: { id: variant.id }, data });
        } else {
          await tx.productVariant.create({ data: { productId: id, ...data } });
        }
      }
    });

    return { ok: true, product: { id, slug: productData.slug } };
  } catch (error) {
    // مثلاً جابه‌جا کردن هم‌زمان وزن یا sku بین دو وزن
    if (isUniqueViolation(error)) return { ok: false, reason: "CONFLICT" };

    throw error;
  }
};

// ───────── حذف نرم محصول ─────────

export const softDeleteProduct = async (id: string) => {
  const result = await prisma.product.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  return result.count > 0;
};

// ───────── عکس‌ها ─────────

type AddImageResult =
  | { ok: true; image: { id: string; url: string } }
  | Fail<"PRODUCT_NOT_FOUND" | "TOO_MANY_IMAGES" | "INVALID_IMAGE">;

export const addProductImage = async (
  productId: string,
  file: Buffer,
  alt?: string,
): Promise<AddImageResult> => {
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: { id: true },
  });

  if (!product) return { ok: false, reason: "PRODUCT_NOT_FOUND" };

  const count = await prisma.productImage.count({ where: { productId } });

  if (count >= MAX_IMAGES_PER_PRODUCT) {
    return { ok: false, reason: "TOO_MANY_IMAGES" };
  }

  let saved: { key: string; url: string };

  try {
    saved = await saveImage(file, { folder: "products" });
  } catch {
    return { ok: false, reason: "INVALID_IMAGE" };
  }

  try {
    const image = await prisma.productImage.create({
      data: { productId, key: saved.key, alt: alt ?? null, sortOrder: count },
      select: { id: true },
    });

    return { ok: true, image: { id: image.id, url: saved.url } };
  } catch (error) {
    // اگر ثبت در دیتابیس شکست خورد، فایل یتیم روی دیسک نماند
    await deleteStoredImage(saved.key);
    throw error;
  }
};

export const deleteProductImage = async (
  productId: string,
  imageId: string,
) => {
  const image = await prisma.productImage.findFirst({
    where: { id: imageId, productId },
    select: { id: true, key: true },
  });

  if (!image) return false;

  await prisma.productImage.delete({ where: { id: image.id } });
  await deleteStoredImage(image.key);

  return true;
};