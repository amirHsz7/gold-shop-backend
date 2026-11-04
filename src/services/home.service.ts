import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { storage } from "../lib/storage.js";
import type { Prisma } from "../generated/prisma/client.js";
import {
  listCategories,
  listCollections,
  listProducts,
} from "./product.service.js";

const productsConfigSchema = z.object({
  source: z.enum(["featured", "newest", "discount"]).default("newest"),
  limit: z.number().int().min(1).max(24).default(8),
  category: z.string().optional(),
  collection: z.string().optional(),
});

const listConfigSchema = z.object({
  limit: z.number().int().min(1).max(24).default(12),
});

// فقط آیتم‌های فعال و داخل بازه‌ی زمانی نمایش
const activeItemsWhere = (date: Date): Prisma.HomeSectionItemWhereInput => ({
  isActive: true,
  AND: [
    { OR: [{ startsAt: null }, { startsAt: { lte: date } }] },
    { OR: [{ endsAt: null }, { endsAt: { gte: date } }] },
  ],
});

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

  const resolveSection = async (section: SectionRow) => {
    const base = {
      id: section.id,
      type: section.type,
      title: section.title,
      subtitle: section.subtitle,
    };

    switch (section.type) {
      case "SLIDER":
      case "BANNERS": {
        // بخش بدون آیتم فعال نمایش داده نمی‌شود
        if (section.items.length === 0) return null;

        return {
          ...base,
          items: section.items.map(({ imageKey, mobileImageKey, ...item }) => ({
            ...item,
            imageUrl: storage.getUrl(imageKey),
            mobileImageUrl: mobileImageKey
              ? storage.getUrl(mobileImageKey)
              : null,
          })),
        };
      }

      case "PRODUCTS": {
        const config = productsConfigSchema.safeParse(section.config ?? {});
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

        if (result.items.length === 0) return null;

        return { ...base, items: result.items };
      }

      case "CATEGORIES": {
        const config = listConfigSchema.safeParse(section.config ?? {});
        if (!config.success) return null;

        const categories = await listCategories();
        if (categories.length === 0) return null;

        return { ...base, items: categories.slice(0, config.data.limit) };
      }

      case "COLLECTIONS": {
        const config = listConfigSchema.safeParse(section.config ?? {});
        if (!config.success) return null;

        const collections = await listCollections();
        if (collections.length === 0) return null;

        return { ...base, items: collections.slice(0, config.data.limit) };
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