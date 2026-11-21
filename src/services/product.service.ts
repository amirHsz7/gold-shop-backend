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
  metaTitle: true,
  metaDescription: true,
  minWeight: true,
  maxWeight: true,
  minPrice: true,
  maxPrice: true,
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
      price: true,
      originalPrice: true,
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

// کلید عکس‌ها را به آدرس تبدیل می‌کند، قیمت‌ها را عدد می‌کند و موجودی کل را حساب می‌کند
const toPublicProduct = (
  { images, variants, minPrice, maxPrice, ...product }: ProductRow,
  rating = emptyRating,
) => {
  const totalStock = variants.reduce((sum, variant) => sum + variant.stock, 0);

  return {
    ...product,
    minPrice: minPrice?.toNumber() ?? null,
    maxPrice: maxPrice?.toNumber() ?? null,
    variants: variants.map(({ price, originalPrice, ...variant }) => ({
      ...variant,
      price: price?.toNumber() ?? null,
      originalPrice: originalPrice?.toNumber() ?? null,
    })),
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

// محصولاتی که قیمت ندارند آخر لیست می‌روند
const orderByMap = {
  newest: [{ createdAt: "desc" }],
  price_asc: [
    { minPrice: { sort: "asc", nulls: "last" } },
    { createdAt: "desc" },
  ],
  price_desc: [
    { minPrice: { sort: "desc", nulls: "last" } },
    { createdAt: "desc" },
  ],
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
    inStock,
    minPrice,
    maxPrice,
    minWeight,
    maxWeight,
    sort,
  } = query;

  // شرط‌های وزن و موجودی باید روی یک وزن واحد با هم اعمال شوند
  const variantFilter: Prisma.ProductVariantWhereInput = {
    isActive: true,
    ...(inStock && { stock: { gt: 0 } }),
    ...((minWeight !== undefined || maxWeight !== undefined) && {
      weight: {
        ...(minWeight !== undefined && { gte: minWeight }),
        ...(maxWeight !== undefined && { lte: maxWeight }),
      },
    }),
  };

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    deletedAt: null,
    // محصول بدون وزن فعال (و مطابق فیلتر وزن/موجودی) نمایش داده نمی‌شود
    variants: { some: variantFilter },
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
    // بازه‌ی قیمت محصول با بازه‌ی خواسته‌شده هم‌پوشانی داشته باشد
    ...(minPrice !== undefined && { maxPrice: { gte: minPrice } }),
    ...(maxPrice !== undefined && { minPrice: { lte: maxPrice } }),
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

// کمترین و بیشترین وزن و قیمت؛ برای ریل اسلایدرهای فیلتر
export const getProductFilterOptions = async () => {
  const [weightRange, priceRange] = await Promise.all([
    prisma.productVariant.aggregate({
      where: {
        isActive: true,
        product: { isActive: true, deletedAt: null, category: { isActive: true } },
      },
      _min: { weight: true },
      _max: { weight: true },
    }),
    // قیمت محصولات از ستون‌های کش‌شده؛ اگر قیمت طلا ثبت نشده باشد null است
    prisma.product.aggregate({
      where: {
        isActive: true,
        deletedAt: null,
        category: { isActive: true },
        variants: { some: { isActive: true } },
      },
      _min: { minPrice: true },
      _max: { maxPrice: true },
    }),
  ]);

  const minWeight = weightRange._min.weight?.toNumber();
  const maxWeight = weightRange._max.weight?.toNumber();
  const minPrice = priceRange._min.minPrice?.toNumber();
  const maxPrice = priceRange._max.maxPrice?.toNumber();

  return {
    weight:
      minWeight === undefined || maxWeight === undefined
        ? null
        : { min: minWeight, max: maxWeight },
    price:
      minPrice === undefined || maxPrice === undefined
        ? null
        : { min: minPrice, max: maxPrice },
  };
};