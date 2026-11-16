import { prisma } from "../lib/prisma.js";
import { storage } from "../lib/storage.js";
import type { Prisma } from "../generated/prisma/client.js";
import { MAX_HOME_TESTIMONIALS } from "../lib/home-singletons.js";
import {
  DEFAULT_BANNER_COLUMNS,
  DEFAULT_SLIDER_AUTOPLAY_MS,
  bannersSectionConfigSchema,
  listSectionConfigSchema,
  productsSectionConfigSchema,
  sliderSectionConfigSchema,
} from "../schemas/home.schema.js";
import {
  listCategories,
  listCollections,
  listProducts,
} from "./product.service.js";
import { getShopInfo } from "./shop-info.service.js";

// فقط آیتم‌های فعال و داخل بازه‌ی زمانی نمایش
const activeItemsWhere = (date: Date): Prisma.HomeSectionItemWhereInput => ({
  isActive: true,
  AND: [
    { OR: [{ startsAt: null }, { startsAt: { lte: date } }] },
    { OR: [{ endsAt: null }, { endsAt: { gte: date } }] },
  ],
});

// برای حریم خصوصی فقط اسم کوچک نویسنده‌ی نظر نمایش داده می‌شود
const firstName = (fullName: string) =>
  fullName.trim().split(/\s+/)[0] ?? fullName;

export const getHome = async () => {
  const date = new Date();

  const sections = await prisma.homeSection.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      type: true,
      title: true,
      subtitle: true,
      config: true,
      items: {
        where: activeItemsWhere(date),
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          imageKey: true,
          mobileImageKey: true,
          alt: true,
          title: true,
          subtitle: true,
          buttonText: true,
          linkUrl: true,
        },
      },
    },
  });

  type SectionRow = (typeof sections)[number];
  type ImageItem = SectionRow["items"][number];

  const toImageItems = (items: ImageItem[]) =>
    items.map(({ imageKey, mobileImageKey, ...item }) => ({
      ...item,
      imageUrl: storage.getUrl(imageKey),
      mobileImageUrl: mobileImageKey ? storage.getUrl(mobileImageKey) : null,
    }));

  const resolveSection = async (section: SectionRow) => {
    const base = {
      id: section.id,
      type: section.type,
      title: section.title,
      subtitle: section.subtitle,
    };

    switch (section.type) {
      case "SLIDER": {
        // بخش بدون آیتم فعال نمایش داده نمی‌شود
        if (section.items.length === 0) return null;

        const config = sliderSectionConfigSchema.safeParse(
          section.config ?? {},
        );

        return {
          ...base,
          autoplayMs: config.success
            ? config.data.autoplayMs
            : DEFAULT_SLIDER_AUTOPLAY_MS,
          items: toImageItems(section.items),
        };
      }

      case "BANNERS": {
        if (section.items.length === 0) return null;

        const config = bannersSectionConfigSchema.safeParse(
          section.config ?? {},
        );

        return {
          ...base,
          columns: config.success ? config.data.columns : DEFAULT_BANNER_COLUMNS,
          items: toImageItems(section.items),
        };
      }

      case "PRODUCTS": {
        const config = productsSectionConfigSchema.safeParse(
          section.config ?? {},
        );
        if (!config.success) return null;

        const { source, limit, category, collection } = config.data;

        const result = await listProducts({
          page: 1,
          limit,
          category,
          collection,
          featured: source === "featured" ? true : undefined,
          hasDiscount: source === "discount" ? true : undefined,
          sort: source === "discount" ? "discount" : "newest",
        });

        if (result.items.length === 0) return null

        // پارامترهای لینک «مشاهده همه» برای صفحه‌ی محصولات
        const viewAll: Record<string, string> = {}

        if (source === "featured") viewAll.featured = "true"

        if (source === "discount") {
          viewAll.hasDiscount = "true"
          viewAll.sort = "discount"
        }

        if (category) viewAll.category = category
        if (collection) viewAll.collection = collection

        return { ...base, source, viewAll, items: result.items }
      }

      case "CATEGORIES": {
        const config = listSectionConfigSchema.safeParse(section.config ?? {});
        if (!config.success) return null;

        const categories = await listCategories();
        if (categories.length === 0) return null;

        return { ...base, items: categories.slice(0, config.data.limit) };
      }

      case "COLLECTIONS": {
        const config = listSectionConfigSchema.safeParse(section.config ?? {});
        if (!config.success) return null;

        const collections = await listCollections();
        if (collections.length === 0) return null;

        return { ...base, items: collections.slice(0, config.data.limit) };
      }

      case "TESTIMONIALS": {
        // فقط نظر اصلیِ تأییدشده‌ای که ادمین دستی انتخاب کرده
        const comments = await prisma.comment.findMany({
          where: {
            showOnHome: true,
            status: "APPROVED",
            parentId: null,
            product: { isActive: true, deletedAt: null },
          },
          orderBy: { createdAt: "desc" },
          take: MAX_HOME_TESTIMONIALS,
          select: {
            id: true,
            body: true,
            rating: true,
            createdAt: true,
            user: { select: { fullName: true } },
            product: { select: { id: true, name: true, slug: true } },
          },
        });

        if (comments.length === 0) return null;

        return {
          ...base,
          items: comments.map(({ user, ...comment }) => ({
            ...comment,
            author: { name: firstName(user.fullName) },
          })),
        };
      }

      case "MAP": {
        const info = await getShopInfo();

        // بدون مختصات، نقشه‌ای برای نمایش وجود ندارد
        if (info.latitude === null || info.longitude === null) return null;

        return {
          ...base,
          location: { latitude: info.latitude, longitude: info.longitude },
          address: info.address,
          phones: info.phones,
          workingHours: info.workingHours,
        };
      }

      default:
        return null;
    }
  };

  const resolved = await Promise.all(sections.map(resolveSection));

  return {
    sections: resolved.filter(
      (section): section is NonNullable<typeof section> => section !== null,
    ),
  };
};