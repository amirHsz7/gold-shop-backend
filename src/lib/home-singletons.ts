import type { HomeSectionType } from "../generated/prisma/client.js";

// بخش‌هایی که همیشه فقط یکی هستند و ادمین فقط روشن، خاموش و جابه‌جایشان می‌کند
export const SINGLETON_SECTION_TYPES = [
  "SLIDER",
  "CATEGORIES",
  "COLLECTIONS",
  "TESTIMONIALS",
  "MAP",
] as const satisfies readonly HomeSectionType[];

export type SingletonSectionType = (typeof SINGLETON_SECTION_TYPES)[number];

export const SINGLETON_DEFAULT_TITLES: Record<
  SingletonSectionType,
  string | null
> = {
  SLIDER: null,
  CATEGORIES: "دسته‌بندی‌ها",
  COLLECTIONS: "کالکشن‌ها",
  TESTIMONIALS: "نظرات مشتریان",
  MAP: "آدرس فروشگاه",
};

export const isSingletonType = (type: string): type is SingletonSectionType =>
  (SINGLETON_SECTION_TYPES as readonly string[]).includes(type);

// حداکثر تعداد نظری که برای بخش «نظرات مشتریان» صفحه‌ی اصلی انتخاب می‌شود
export const MAX_HOME_TESTIMONIALS = 12;

// سقف تعداد بخش‌های چندتایی
export const MAX_PRODUCT_SECTIONS = 10;
export const MAX_BANNER_SECTIONS = 6;

// سقف تعداد آیتم در هر بخش
export const MAX_SLIDER_ITEMS = 10;
export const MAX_BANNER_ITEMS = 6;