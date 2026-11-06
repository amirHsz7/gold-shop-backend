import { prisma } from "../lib/prisma.js";
import { storage } from "../lib/storage.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { ListProductsQuery } from "../schemas/product.schema.js";
import { getRatingsByProductIds } from "./comment.service.js";

const publicProductSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  minWeight: true,
  maxWeight: true,
  discountPercent: true,
  isFeatured: true,
  createdAt: true,
  // دسته همراه با والدش (برای breadcrumb)
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      parent: { select: { id: true, name: true, slug: true } },
    },
  },
  collection: { select: { id: true, name: true, slug: true } },
  // وزن‌های مختلف محصول، هرکدام با موجودی خودش
  variants: {
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { weight: "asc" }],
    select: {
      id: true,
      label: true,
      sku: true,
      weight: true,
      fee: true,
      feeAmount: true,
      stock: true,
    },
  },
  images: {
    select: { id: true, key: true, alt: true },
    orderBy: { sortOrder: "asc" },
  },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{
  select: typeof publicProductSelect;
}>;

const emptyRating = { average: 0, count: 0 };

// کلید عکس‌ها را به آدرس تبدیل می‌کند و موجودی کل را حساب می‌کند
const toPublicProduct = (
  { images, ...product }: ProductRow,
  rating = emptyRating,
) => {
  const totalStock = product.variants.reduce(
    (sum, variant) => sum + variant.stock,
    0,
  );

  return {
    ...product,
    totalStock,
    inStock: totalStock > 0,
    rating,
    images: images.map((image) => ({
      id: image.id,
      alt: image.alt,
      url: storage.getUrl(image.key),
    })),
  };
};

// مرتب‌سازی وزن بر اساس کمترین و بیشترین وزن variantها
const orderByMap = {
  newest: [{ createdAt: "desc" }],
  weight_asc: [{ minWeight: "asc" }, { createdAt: "desc" }],
  weight_desc: [{ maxWeight: "desc" }, { createdAt: "desc" }],
  discount: [{ discountPercent: "desc" }, { createdAt: "desc" }],
} satisfies Record<
  ListProductsQuery["sort"],
  Prisma.ProductOrderByWithRelationInput[]
>;

export const listProducts = async (query: ListProductsQuery) => {
  const {
    page,
    limit,
    category,
    collection,
    search,
    featured,
    hasDiscount,
    sort,
  } = query;

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    deletedAt: null,
    // محصول بدون variant فعال نمایش داده نمی‌شود
    variants: { some: { isActive: true } },
    // اگر دسته‌ی والد انتخاب شود، محصولات زیردسته‌هایش هم می‌آیند
    category: {
      isActive: true,
      ...(category && {
        OR: [{ slug: category }, { parent: { slug: category } }],
      }),
    },
    ...(collection && { collection: { isActive: true, slug: collection } }),
    ...(featured !== undefined && { isFeatured: featured }),
    ...(hasDiscount && { discountPercent: { gt: 0 } }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      select: publicProductSelect,
      orderBy: orderByMap[sort],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  const ratings = await getRatingsByProductIds(
    products.map((product) => product.id),
  );

  return {
    items: products.map((product) =>
      toPublicProduct(product, ratings.get(product.id)),
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getProductBySlug = async (slug: string) => {
  const product = await prisma.product.findFirst({
    where: {
      slug,
      isActive: true,
      deletedAt: null,
      variants: { some: { isActive: true } },
      category: { isActive: true },
    },
    select: publicProductSelect,
  });

  if (!product) return null;

  const ratings = await getRatingsByProductIds([product.id]);

  return toPublicProduct(product, ratings.get(product.id));
};

// لیست دسته‌ها به‌صورت درختی (دسته‌ی اصلی ← زیردسته‌ها)
export const listCategories = async () => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      imageKey: true,
      _count: {
        select: { products: { where: { isActive: true, deletedAt: null } } },
      },
    },
  });

  const nodes = categories.map(({ imageKey, _count, ...category }) => ({
    ...category,
    imageUrl: imageKey ? storage.getUrl(imageKey) : null,
    productCount: _count.products,
  }));

  // فقط دسته‌های اصلی در سطح اول می‌آیند و زیردسته‌ها داخل children
  return nodes
    .filter((node) => !node.parentId)
    .map((root) => {
      const children = nodes.filter((node) => node.parentId === root.id);

      return {
        ...root,
        children,
        totalProductCount:
          root.productCount +
          children.reduce((sum, child) => sum + child.productCount, 0),
      };
    });
};

export const listCollections = async () => {
  const collections = await prisma.collection.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageKey: true,
      _count: {
        select: { products: { where: { isActive: true, deletedAt: null } } },
      },
    },
  });

  return collections.map(({ imageKey, _count, ...collection }) => ({
    ...collection,
    imageUrl: imageKey ? storage.getUrl(imageKey) : null,
    productCount: _count.products,
  }));
};