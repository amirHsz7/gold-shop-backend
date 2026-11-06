import "dotenv/config";
import { prisma, disconnectDatabase } from "../src/lib/prisma.js";
import { syncProductWeightRange } from "../src/services/variant.service.js";

const categoryTree = [
  {
    name: "دستبند",
    slug: "bracelet",
    children: [
      { name: "دستبند زنجیری", slug: "bracelet-chain" },
      { name: "النگو", slug: "bangle" },
    ],
  },
  {
    name: "گردنبند",
    slug: "necklace",
    children: [
      { name: "گردنبند زنجیری", slug: "necklace-chain" },
      { name: "آویز", slug: "pendant" },
    ],
  },
  {
    name: "انگشتر",
    slug: "ring",
    children: [{ name: "حلقه ازدواج", slug: "wedding-ring" }],
  },
  { name: "گوشواره", slug: "earring", children: [] },
];

const collections = [
  { name: "بهار", slug: "spring", isActive: true },
  { name: "عروس", slug: "bride", isActive: true },
  { name: "روزمره", slug: "daily", isActive: true },
  { name: "کالکشن قدیمی", slug: "old-collection", isActive: false },
];

type SeedVariant = {
  weight: number;
  fee: number; // درصد اجرت
  feeAmount: number; // اجرت ریالی
  stock?: number;
  label?: string;
};

type SeedProduct = {
  name: string;
  slug: string;
  category: string; // slug دسته
  collection?: string; // slug کالکشن (اختیاری)
  // اولین وزن محصول
  weight: number;
  fee: number;
  feeAmount: number;
  stock?: number;
  // وزن‌های دیگر همین محصول
  extraVariants?: SeedVariant[];
  discountPercent?: number;
  isFeatured?: boolean;
  isActive?: boolean;
  deleted?: boolean;
};

const products: SeedProduct[] = [
  { name: "دستبند زنجیری کلاسیک", slug: "classic-chain-bracelet", category: "bracelet-chain", collection: "daily", weight: 4.2, fee: 7, feeAmount: 0, isFeatured: true },
  { name: "دستبند زنجیری ظریف", slug: "delicate-chain-bracelet", category: "bracelet-chain", collection: "spring", weight: 2.8, fee: 8, feeAmount: 0, discountPercent: 10 },
  { name: "دستبند چرم و طلا", slug: "leather-gold-bracelet", category: "bracelet-chain", weight: 3.5, fee: 0, feeAmount: 1500000 },
  { name: "النگو ساده", slug: "plain-bangle", category: "bangle", collection: "bride", weight: 12.6, fee: 6, feeAmount: 0, isFeatured: true },
  { name: "النگو طرح‌دار", slug: "patterned-bangle", category: "bangle", collection: "bride", weight: 15.3, fee: 7.5, feeAmount: 0, discountPercent: 15 },
  { name: "النگوی کارتیه", slug: "cartier-bangle", category: "bangle", collection: "daily", weight: 9.8, fee: 0, feeAmount: 3200000 },
  { name: "گردنبند زنجیر ایتالیایی", slug: "italian-chain-necklace", category: "necklace-chain", collection: "daily", weight: 6.4, fee: 7, feeAmount: 0 },
  { name: "گردنبند زنجیر رولو", slug: "rolo-chain-necklace", category: "necklace-chain", collection: "spring", weight: 5.1, fee: 6.5, feeAmount: 0, discountPercent: 5 },
  { name: "آویز قلب", slug: "heart-pendant", category: "pendant", collection: "spring", weight: 1.9, fee: 9, feeAmount: 0, discountPercent: 20, isFeatured: true },
  { name: "آویز نام", slug: "name-pendant", category: "pendant", weight: 2.3, fee: 0, feeAmount: 1800000 },
  { name: "آویز چشم نظر", slug: "evil-eye-pendant", category: "pendant", collection: "daily", weight: 1.2, fee: 10, feeAmount: 0 },
  { name: "حلقه ازدواج کلاسیک", slug: "classic-wedding-ring", category: "wedding-ring", collection: "bride", weight: 3.9, fee: 8, feeAmount: 0, isFeatured: true },
  { name: "حلقه ازدواج طرح‌دار", slug: "patterned-wedding-ring", category: "wedding-ring", collection: "bride", weight: 4.6, fee: 0, feeAmount: 2400000, discountPercent: 10 },
  // محصول مستقیم روی دسته‌ی اصلی، با چند وزن
  {
    name: "انگشتر نگین‌دار",
    slug: "gemstone-ring",
    category: "ring",
    collection: "spring",
    weight: 4.1,
    fee: 9,
    feeAmount: 500000,
    extraVariants: [
      { weight: 4.8, fee: 9, feeAmount: 600000, label: "سایز ۱۲" },
      { weight: 5.5, fee: 8, feeAmount: 700000, label: "سایز ۱۴" },
    ],
  },
  { name: "انگشتر مردانه", slug: "mens-ring", category: "ring", weight: 7.2, fee: 7, feeAmount: 0 },
  // مثال تو: ۱۰ عدد با ۴ وزن مختلف
  {
    name: "انگشتر کارتیه",
    slug: "cartier-ring",
    category: "ring",
    collection: "daily",
    weight: 2.56,
    fee: 7,
    feeAmount: 0,
    stock: 4,
    isFeatured: true,
    extraVariants: [
      { weight: 2.54, fee: 7, feeAmount: 0, stock: 1 },
      { weight: 2.63, fee: 7, feeAmount: 0, stock: 1 },
      { weight: 2.5, fee: 7, feeAmount: 0, stock: 4 },
    ],
  },
  { name: "گوشواره حلقه‌ای", slug: "hoop-earrings", category: "earring", collection: "daily", weight: 2.6, fee: 8, feeAmount: 0 },
  { name: "گوشواره میخی", slug: "stud-earrings", category: "earring", weight: 0.9, fee: 0, feeAmount: 900000, discountPercent: 25 },
  // این دو نباید توی API عمومی دیده بشن
  { name: "دستبند غیرفعال", slug: "inactive-bracelet", category: "bracelet-chain", weight: 3.0, fee: 7, feeAmount: 0, isActive: false },
  { name: "گردنبند حذف‌شده", slug: "deleted-necklace", category: "necklace-chain", weight: 5.0, fee: 7, feeAmount: 0, deleted: true },
];

async function main() {
  const categoryIds = new Map<string, string>();
  const collectionIds = new Map<string, string>();

  // دسته‌ها: اول والد، بعد زیردسته‌ها
  for (const [index, parent] of categoryTree.entries()) {
    const parentRow = await prisma.category.upsert({
      where: { slug: parent.slug },
      update: { name: parent.name, sortOrder: index + 1, isActive: true, parentId: null },
      create: { name: parent.name, slug: parent.slug, sortOrder: index + 1 },
    });
    categoryIds.set(parent.slug, parentRow.id);

    for (const [childIndex, child] of parent.children.entries()) {
      const childRow = await prisma.category.upsert({
        where: { slug: child.slug },
        update: { name: child.name, sortOrder: childIndex + 1, isActive: true, parentId: parentRow.id },
        create: { name: child.name, slug: child.slug, sortOrder: childIndex + 1, parentId: parentRow.id },
      });
      categoryIds.set(child.slug, childRow.id);
    }
  }

  // کالکشن‌ها
  for (const [index, item] of collections.entries()) {
    const row = await prisma.collection.upsert({
      where: { slug: item.slug },
      update: { name: item.name, sortOrder: index + 1, isActive: item.isActive },
      create: { name: item.name, slug: item.slug, sortOrder: index + 1, isActive: item.isActive },
    });
    collectionIds.set(item.slug, row.id);
  }

  // محصولات و وزن‌هایشان
  for (const [index, item] of products.entries()) {
    const data = {
      name: item.name,
      description: `${item.name} با طراحی مدرن و کیفیت بالا، ساخته‌شده از طلای ۱۸ عیار.`,
      categoryId: categoryIds.get(item.category)!,
      collectionId: item.collection ? collectionIds.get(item.collection)! : null,
      discountPercent: item.discountPercent ?? 0,
      isFeatured: item.isFeatured ?? false,
      isActive: item.isActive ?? true,
      deletedAt: item.deleted ? new Date() : null,
    };

    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: data,
      create: { slug: item.slug, ...data },
    });

    // variantها هر بار از نو ساخته می‌شوند
    await prisma.productVariant.deleteMany({ where: { productId: product.id } });

    const variants: SeedVariant[] = [
      { weight: item.weight, fee: item.fee, feeAmount: item.feeAmount, stock: item.stock },
      ...(item.extraVariants ?? []),
    ];

    await prisma.productVariant.createMany({
      data: variants.map((variant, variantIndex) => ({
        productId: product.id,
        sku: `GS-${String(index + 1).padStart(4, "0")}-${variantIndex + 1}`,
        label: variant.label,
        weight: variant.weight,
        fee: variant.fee,
        feeAmount: variant.feeAmount,
        stock: variant.stock ?? 3,
        sortOrder: variantIndex,
      })),
    });

    await syncProductWeightRange(product.id);
  }

  // صفحه‌ی اصلی: هر بار از نو ساخته می‌شود (فقط بخش‌های home پاک می‌شوند)
  await prisma.homeSection.deleteMany();

  await prisma.homeSection.create({
    data: {
      type: "SLIDER",
      sortOrder: 1,
      items: {
        create: [
          { imageKey: "home/slide-1.webp", title: "کالکشن بهار", subtitle: "طلای ۱۸ عیار با طراحی مدرن", buttonText: "مشاهده", linkUrl: "/products?collection=spring", sortOrder: 1 },
          { imageKey: "home/slide-2.webp", title: "تخفیف ویژه", buttonText: "مشاهده تخفیف‌ها", linkUrl: "/products?hasDiscount=true", sortOrder: 2 },
        ],
      },
    },
  });

  await prisma.homeSection.create({
    data: { type: "CATEGORIES", title: "دسته‌بندی‌ها", sortOrder: 2, config: { limit: 6 } },
  });

  await prisma.homeSection.create({
    data: { type: "PRODUCTS", title: "محصولات ویژه", sortOrder: 3, config: { source: "featured", limit: 8 } },
  });

  await prisma.homeSection.create({
    data: {
      type: "BANNERS",
      sortOrder: 4,
      items: {
        create: [
          { imageKey: "home/banner-1.webp", title: "ست عروس", linkUrl: "/products?collection=bride", sortOrder: 1 },
          { imageKey: "home/banner-2.webp", title: "هدیه‌های ویژه", linkUrl: "/products?category=pendant", sortOrder: 2 },
        ],
      },
    },
  });

  await prisma.homeSection.create({
    data: { type: "PRODUCTS", title: "پیشنهاد ویژه", subtitle: "محصولات دارای تخفیف", sortOrder: 5, config: { source: "discount", limit: 8 } },
  });

  await prisma.homeSection.create({
    data: { type: "COLLECTIONS", title: "کالکشن‌ها", sortOrder: 6 },
  });

  await prisma.homeSection.create({
    data: { type: "PRODUCTS", title: "جدیدترین‌ها", sortOrder: 7, config: { source: "newest", limit: 8 } },
  });

  // ادمین (فقط اگر ADMIN_MOBILE توی .env تنظیم شده باشد)
  const adminMobile = process.env.ADMIN_MOBILE;

  if (adminMobile) {
    await prisma.user.upsert({
      where: { mobile: adminMobile },
      update: { role: "ADMIN" },
      create: { mobile: adminMobile, fullName: "ادمین", role: "ADMIN" },
    });
  }

  console.log(
    `Seed done: ${categoryIds.size} categories, ${collectionIds.size} collections, ${products.length} products`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);