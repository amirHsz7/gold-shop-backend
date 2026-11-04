import { prisma } from "../lib/prisma.js";
import { storage } from "../lib/storage.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { ListProductsQuery } from "../schemas/product.schema.js";

const publicProductSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  description: true,
  weight: true,
  fee: true,
  feeAmount: true,
  discountPercent: true, // جدید: تخفیف
  stock: true,
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
  images: {
    select: { id: true, key: true, alt: true },
    orderBy: { sortOrder: "asc" },
  },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{
  select: typeof publicProductSelect;
}>;

// کلید عکس‌ها را به آدرس تبدیل می‌کند
const toPublicProduct = ({ images, ...product }: ProductRow) => ({
  ...product,
  images: images.map((image) => ({
    id: image.id,
    alt: image.alt,
    url: storage.getUrl(image.key),
  })),
});

// جدید: تخفیف. هر مقدار یک آرایه است تا بشود چند فیلد را با هم مرتب کرد
const orderByMap = {
  newest: [{ createdAt: "desc" }],
  weight_asc: [{ weight: "asc" }, { createdAt: "desc" }],
  weight_desc: [{ weight: "desc" }, { createdAt: "desc" }],
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
    hasDiscount, // جدید: تخفیف
    sort,
  } = query;

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    deletedAt: null,
    // اگر دسته‌ی والد انتخاب شود، محصولات زیردسته‌هایش هم می‌آیند
    category: {
      isActive: true,
      ...(category && {
        OR: [{ slug: category }, { parent: { slug: category } }],
      }),
    },
    ...(collection && { collection: { isActive: true, slug: collection } }),
    ...(featured !== undefined && { isFeatured: featured }),
    ...(hasDiscount && { discountPercent: { gt: 0 } }), // جدید: تخفیف
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

  return {
    items: products.map(toPublicProduct),
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
      category: { isActive: true },
    },
    select: publicProductSelect,
  });

  return product ? toPublicProduct(product) : null;
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