import type { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { storage } from "../lib/storage.js";
import type { HomeSectionType, Prisma } from "../generated/prisma/client.js";
import {
  MAX_BANNER_ITEMS,
  MAX_BANNER_SECTIONS,
  MAX_PRODUCT_SECTIONS,
  MAX_SLIDER_ITEMS,
  isSingletonType,
} from "../lib/home-singletons.js";
import {
  bannersSectionConfigSchema,
  listSectionConfigSchema,
  productsSectionConfigSchema,
  sliderSectionConfigSchema,
} from "../schemas/home.schema.js";
import type {
  CreateSectionInput,
  HomeItemInput,
  UpdateSectionInput,
} from "../schemas/admin-home.schema.js";
import { deleteImage, saveImage } from "./image.service.js";
import { listProducts } from "./product.service.js";
import { getShopInfo } from "./shop-info.service.js";

type FieldError = { field: string; message: string };

const DESKTOP_WIDTH = 1920;
const MOBILE_WIDTH = 1000;

// فقط این دو نوع آیتم تصویری دارند
const ITEM_LIMITS: Partial<Record<HomeSectionType, number>> = {
  SLIDER: MAX_SLIDER_ITEMS,
  BANNERS: MAX_BANNER_ITEMS,
};

// تنظیمات هر نوع بخش (نظرات و نقشه تنظیمات ندارند)
const CONFIG_SCHEMAS: Partial<Record<HomeSectionType, z.ZodType>> = {
  SLIDER: sliderSectionConfigSchema,
  BANNERS: bannersSectionConfigSchema,
  PRODUCTS: productsSectionConfigSchema,
  CATEGORIES: listSectionConfigSchema,
  COLLECTIONS: listSectionConfigSchema,
};

// ───────── ابزارها ─────────

const parseSectionConfig = (type: HomeSectionType, raw: unknown) => {
  const schema = CONFIG_SCHEMAS[type];

  if (!schema) return { ok: true as const, config: undefined };

  const parsed = schema.safeParse(raw ?? {});

  if (!parsed.success) {
    const errors: FieldError[] = parsed.error.issues.map((issue) => ({
      field: ["config", ...issue.path.map(String)].join("."),
      message: issue.message,
    }));

    return { ok: false as const, errors };
  }

  return {
    ok: true as const,
    config: parsed.data as Prisma.InputJsonObject,
  };
};

// اسلاگ دسته و کالکشنِ بخش محصولات باید وجود داشته باشد
const checkProductsConfig = async (config: unknown) => {
  const { category, collection } = (config ?? {}) as {
    category?: string;
    collection?: string;
  };

  if (category) {
    const found = await prisma.category.findUnique({
      where: { slug: category },
      select: { id: true },
    });

    if (!found) return "CATEGORY_NOT_FOUND" as const;
  }

  if (collection) {
    const found = await prisma.collection.findUnique({
      where: { slug: collection },
      select: { id: true },
    });

    if (!found) return "COLLECTION_NOT_FOUND" as const;
  }

  return null;
};

const sameIds = (current: string[], next: string[]) => {
  if (current.length !== next.length) return false;

  const currentSet = new Set(current);

  return new Set(next).size === next.length && next.every((id) => currentSet.has(id));
};

const isItemLive = (
  item: { isActive: boolean; startsAt: Date | null; endsAt: Date | null },
  now: Date,
) =>
  item.isActive
  && (!item.startsAt || item.startsAt <= now)
  && (!item.endsAt || item.endsAt >= now);

// ───────── لیست و وضعیت نمایش ─────────

type Visibility = { visible: boolean; reason: string | null };

const VISIBLE: Visibility = { visible: true, reason: null };

const hidden = (reason: string): Visibility => ({ visible: false, reason });

export const listSectionsForAdmin = async () => {
  const now = new Date();

  const [sections, rootCategories, collections, testimonials, shopInfo]
    = await Promise.all([
      prisma.homeSection.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          type: true,
          title: true,
          subtitle: true,
          config: true,
          isActive: true,
          sortOrder: true,
          items: {
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
              isActive: true,
              startsAt: true,
              endsAt: true,
              sortOrder: true,
            },
          },
        },
      }),
      prisma.category.count({ where: { isActive: true, parentId: null } }),
      prisma.collection.count({ where: { isActive: true } }),
      prisma.comment.count({
        where: {
          showOnHome: true,
          status: "APPROVED",
          parentId: null,
          product: { isActive: true, deletedAt: null },
        },
      }),
      getShopInfo(),
    ]);

  type SectionRow = (typeof sections)[number];

  const visibilityFor = async (section: SectionRow): Promise<Visibility> => {
    if (!section.isActive) return hidden("این بخش خاموش است");

    switch (section.type) {
      case "SLIDER":
        return section.items.some((item) => isItemLive(item, now))
          ? VISIBLE
          : hidden("اسلاید فعالی وجود ندارد (غیرفعال یا خارج از بازه‌ی زمانی)");

      case "BANNERS":
        return section.items.some((item) => isItemLive(item, now))
          ? VISIBLE
          : hidden("بنر فعالی وجود ندارد (غیرفعال یا خارج از بازه‌ی زمانی)");

      case "PRODUCTS": {
        const config = productsSectionConfigSchema.safeParse(
          section.config ?? {},
        );

        if (!config.success) return hidden("تنظیمات این بخش معتبر نیست");

        const { source, category, collection } = config.data;

        const result = await listProducts({
          page: 1,
          limit: 1,
          category,
          collection,
          featured: source === "featured" ? true : undefined,
          hasDiscount: source === "discount" ? true : undefined,
          sort: source === "discount" ? "discount" : "newest",
        });

        return result.items.length > 0
          ? VISIBLE
          : hidden("محصولی با این تنظیمات پیدا نشد");
      }

      case "CATEGORIES":
        return rootCategories > 0 ? VISIBLE : hidden("دسته‌بندی فعالی وجود ندارد");

      case "COLLECTIONS":
        return collections > 0 ? VISIBLE : hidden("کالکشن فعالی وجود ندارد");

      case "TESTIMONIALS":
        return testimonials > 0
          ? VISIBLE
          : hidden("نظری برای نمایش در صفحه‌ی اصلی انتخاب نشده است");

      case "MAP":
        return shopInfo.latitude !== null && shopInfo.longitude !== null
          ? VISIBLE
          : hidden("مختصات فروشگاه ثبت نشده است");

      default:
        return hidden("نوع بخش نامعتبر است");
    }
  };

  const items = await Promise.all(
    sections.map(async (section) => {
      const visibility = await visibilityFor(section);
      const itemLimit = ITEM_LIMITS[section.type];

      return {
        id: section.id,
        type: section.type,
        title: section.title,
        subtitle: section.subtitle,
        config: section.config,
        isActive: section.isActive,
        isSingleton: isSingletonType(section.type),
        sortOrder: section.sortOrder,
        visibility,
        ...(itemLimit !== undefined && {
          itemLimit,
          items: section.items.map(({ imageKey, mobileImageKey, ...item }) => ({
            ...item,
            imageUrl: storage.getUrl(imageKey),
            mobileImageUrl: mobileImageKey
              ? storage.getUrl(mobileImageKey)
              : null,
            isLive: isItemLive(item, now),
          })),
        }),
      };
    }),
  );

  const countOf = (type: HomeSectionType) =>
    sections.filter((section) => section.type === type).length;

  return {
    sections: items,
    limits: {
      productSections: { used: countOf("PRODUCTS"), max: MAX_PRODUCT_SECTIONS },
      bannerSections: { used: countOf("BANNERS"), max: MAX_BANNER_SECTIONS },
    },
  };
};

// ───────── ساخت بخش ─────────

type SectionResult =
  | { ok: true; section: { id: string } }
  | {
      ok: false;
      reason:
        | "NOT_FOUND"
        | "SECTION_LIMIT_REACHED"
        | "CATEGORY_NOT_FOUND"
        | "COLLECTION_NOT_FOUND";
    }
  | { ok: false; reason: "INVALID_CONFIG"; errors: FieldError[] };

export const createSection = async (
  input: CreateSectionInput,
): Promise<SectionResult> => {
  const max
    = input.type === "PRODUCTS" ? MAX_PRODUCT_SECTIONS : MAX_BANNER_SECTIONS;

  const used = await prisma.homeSection.count({ where: { type: input.type } });

  if (used >= max) return { ok: false, reason: "SECTION_LIMIT_REACHED" };

  const parsed = parseSectionConfig(input.type, input.config);

  if (!parsed.ok) {
    return { ok: false, reason: "INVALID_CONFIG", errors: parsed.errors };
  }

  if (input.type === "PRODUCTS") {
    const reason = await checkProductsConfig(parsed.config);

    if (reason) return { ok: false, reason };
  }

  const last = await prisma.homeSection.aggregate({
    _max: { sortOrder: true },
  });

  const section = await prisma.homeSection.create({
    data: {
      type: input.type,
      title: input.title ?? null,
      subtitle: input.subtitle ?? null,
      config: parsed.config,
      isActive: input.isActive ?? true,
      sortOrder: (last._max.sortOrder ?? 0) + 1,
    },
    select: { id: true },
  });

  return { ok: true, section };
};

// ───────── ویرایش بخش ─────────

export const updateSection = async (
  id: string,
  input: UpdateSectionInput,
): Promise<SectionResult> => {
  const existing = await prisma.homeSection.findUnique({
    where: { id },
    select: { type: true, isActive: true },
  });

  if (!existing) return { ok: false, reason: "NOT_FOUND" };

  const parsed = parseSectionConfig(existing.type, input.config);

  if (!parsed.ok) {
    return { ok: false, reason: "INVALID_CONFIG", errors: parsed.errors };
  }

  if (existing.type === "PRODUCTS") {
    const reason = await checkProductsConfig(parsed.config);

    if (reason) return { ok: false, reason };
  }

  await prisma.homeSection.update({
    where: { id },
    data: {
      title: input.title ?? null,
      subtitle: input.subtitle ?? null,
      isActive: input.isActive ?? existing.isActive,
      config: parsed.config, // undefined یعنی بدون تغییر (نظرات و نقشه)
    },
  });

  return { ok: true, section: { id } };
};

export const setSectionActive = async (id: string, isActive: boolean) => {
  const result = await prisma.homeSection.updateMany({
    where: { id },
    data: { isActive },
  });

  return result.count > 0;
};

// ───────── حذف بخش ─────────

export const deleteSection = async (id: string) => {
  const section = await prisma.homeSection.findUnique({
    where: { id },
    select: {
      type: true,
      items: { select: { imageKey: true, mobileImageKey: true } },
    },
  });

  if (!section) return "NOT_FOUND" as const;

  // بخش‌های تکی ثابت‌اند و فقط خاموش می‌شوند
  if (isSingletonType(section.type)) return "SINGLETON" as const;

  await prisma.homeSection.delete({ where: { id } });

  for (const item of section.items) {
    await deleteImage(item.imageKey);

    if (item.mobileImageKey) await deleteImage(item.mobileImageKey);
  }

  return "OK" as const;
};

// ───────── ترتیب ─────────

export const reorderSections = async (ids: string[]) => {
  const current = await prisma.homeSection.findMany({ select: { id: true } });

  if (!sameIds(current.map((section) => section.id), ids)) return false;

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.homeSection.update({
        where: { id },
        data: { sortOrder: index + 1 },
      }),
    ),
  );

  return true;
};

export const reorderItems = async (sectionId: string, ids: string[]) => {
  const section = await prisma.homeSection.findUnique({
    where: { id: sectionId },
    select: { items: { select: { id: true } } },
  });

  if (!section) return "NOT_FOUND" as const;

  if (!sameIds(section.items.map((item) => item.id), ids)) {
    return "MISMATCH" as const;
  }

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.homeSectionItem.update({
        where: { id },
        data: { sortOrder: index + 1 },
      }),
    ),
  );

  return "OK" as const;
};

// ───────── آیتم‌ها (اسلاید و بنر) ─────────

type ItemResult =
  | { ok: true; item: { id: string } }
  | {
      ok: false;
      reason:
        | "NOT_FOUND"
        | "ITEM_NOT_FOUND"
        | "NOT_IMAGE_SECTION"
        | "ITEM_LIMIT_REACHED"
        | "INVALID_IMAGE";
    };

type SavedImage = { key: string; url: string };

// ذخیره‌ی تصویر و حذف تصویر قبلی در صورت شکست مرحله‌ی بعد
const saveHomeImage = (file: Buffer, maxWidth: number) =>
  saveImage(file, { folder: "home", maxWidth });

const removeSaved = async (...images: (SavedImage | null)[]) => {
  for (const image of images) {
    if (image) await deleteImage(image.key);
  }
};

const itemFields = (input: HomeItemInput) => ({
  title: input.title ?? null,
  subtitle: input.subtitle ?? null,
  buttonText: input.buttonText ?? null,
  alt: input.alt ?? null,
  linkUrl: input.linkUrl ?? null,
  startsAt: input.startsAt ?? null,
  endsAt: input.endsAt ?? null,
});

export const createItem = async (
  sectionId: string,
  input: HomeItemInput,
  files: { image: Buffer; mobileImage?: Buffer },
): Promise<ItemResult> => {
  const section = await prisma.homeSection.findUnique({
    where: { id: sectionId },
    select: { type: true, _count: { select: { items: true } } },
  });

  if (!section) return { ok: false, reason: "NOT_FOUND" };

  const max = ITEM_LIMITS[section.type];

  if (max === undefined) return { ok: false, reason: "NOT_IMAGE_SECTION" };
  if (section._count.items >= max) {
    return { ok: false, reason: "ITEM_LIMIT_REACHED" };
  }

  let desktop: SavedImage;
  let mobile: SavedImage | null = null;

  try {
    desktop = await saveHomeImage(files.image, DESKTOP_WIDTH);
  }
  catch {
    return { ok: false, reason: "INVALID_IMAGE" };
  }

  if (files.mobileImage) {
    try {
      mobile = await saveHomeImage(files.mobileImage, MOBILE_WIDTH);
    }
    catch {
      await removeSaved(desktop);
      return { ok: false, reason: "INVALID_IMAGE" };
    }
  }

  const last = await prisma.homeSectionItem.aggregate({
    where: { sectionId },
    _max: { sortOrder: true },
  });

  try {
    const item = await prisma.homeSectionItem.create({
      data: {
        sectionId,
        imageKey: desktop.key,
        mobileImageKey: mobile?.key ?? null,
        isActive: input.isActive ?? true,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
        ...itemFields(input),
      },
      select: { id: true },
    });

    return { ok: true, item };
  }
  catch (error) {
    await removeSaved(desktop, mobile);
    throw error;
  }
};

export const updateItem = async (
  sectionId: string,
  itemId: string,
  input: HomeItemInput,
  files: { image?: Buffer; mobileImage?: Buffer },
): Promise<ItemResult> => {
  const existing = await prisma.homeSectionItem.findFirst({
    where: { id: itemId, sectionId },
    select: { imageKey: true, mobileImageKey: true, isActive: true },
  });

  if (!existing) return { ok: false, reason: "ITEM_NOT_FOUND" };

  let desktop: SavedImage | null = null;
  let mobile: SavedImage | null = null;

  try {
    if (files.image) desktop = await saveHomeImage(files.image, DESKTOP_WIDTH);
  }
  catch {
    return { ok: false, reason: "INVALID_IMAGE" };
  }

  try {
    if (files.mobileImage) {
      mobile = await saveHomeImage(files.mobileImage, MOBILE_WIDTH);
    }
  }
  catch {
    await removeSaved(desktop);
    return { ok: false, reason: "INVALID_IMAGE" };
  }

  const removeMobile = input.removeMobileImage === true && !mobile;

  try {
    await prisma.homeSectionItem.update({
      where: { id: itemId },
      data: {
        isActive: input.isActive ?? existing.isActive,
        ...(desktop && { imageKey: desktop.key }),
        ...(mobile && { mobileImageKey: mobile.key }),
        ...(removeMobile && { mobileImageKey: null }),
        ...itemFields(input),
      },
    });
  }
  catch (error) {
    await removeSaved(desktop, mobile);
    throw error;
  }

  // تصویرهای جایگزین‌شده بعد از موفقیت پاک می‌شوند
  if (desktop) await deleteImage(existing.imageKey);

  if ((mobile || removeMobile) && existing.mobileImageKey) {
    await deleteImage(existing.mobileImageKey);
  }

  return { ok: true, item: { id: itemId } };
};

export const deleteItem = async (sectionId: string, itemId: string) => {
  const item = await prisma.homeSectionItem.findFirst({
    where: { id: itemId, sectionId },
    select: { imageKey: true, mobileImageKey: true },
  });

  if (!item) return false;

  await prisma.homeSectionItem.delete({ where: { id: itemId } });

  await deleteImage(item.imageKey);

  if (item.mobileImageKey) await deleteImage(item.mobileImageKey);

  return true;
};