import { z } from "zod";

// ───────── بخش‌ها ─────────

const titleSchema = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `حداکثر ${max} کاراکتر مجاز است`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const configSchema = z.record(z.string(), z.unknown()).optional();

export const createSectionSchema = z.object({
  type: z.enum(["PRODUCTS", "BANNERS"]),
  title: titleSchema(120),
  subtitle: titleSchema(200),
  isActive: z.boolean().optional(),
  config: configSchema,
});

// ویرایش کامل: عنوان یا زیرعنوانی که نفرستی خالی می‌شود
export const updateSectionSchema = z.object({
  title: titleSchema(120),
  subtitle: titleSchema(200),
  isActive: z.boolean().optional(), // ندادن یعنی بدون تغییر
  config: configSchema,
});

export const toggleSectionSchema = z.object({
  isActive: z.boolean(),
});

export const orderSchema = z.object({
  ids: z
    .array(z.string().trim().min(1))
    .min(1, "لیست شناسه‌ها خالی است")
    .max(100, "لیست شناسه‌ها خیلی بلند است"),
});

// ───────── آیتم‌ها (فرم multipart: همه‌ی مقدارها رشته‌اند) ─────────

const textField = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `حداکثر ${max} کاراکتر مجاز است`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const booleanField = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();

const dateField = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || !Number.isNaN(Date.parse(value)),
    "تاریخ معتبر نیست",
  )
  .transform((value) => (value === "" ? null : new Date(value)))
  .nullable()
  .optional();

// مسیر داخلی (/products...) یا آدرس کامل http(s)
const linkField = z
  .string()
  .trim()
  .max(500, "حداکثر ۵۰۰ کاراکتر مجاز است")
  .refine(
    (value) =>
      value === ""
      || /^\/(?!\/)\S*$/.test(value)
      || /^https?:\/\/\S+$/i.test(value),
    "لینک باید مسیر داخلی (مثل /products) یا آدرس کامل با http باشد",
  )
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

export const homeItemSchema = z
  .object({
    title: textField(120),
    subtitle: textField(200),
    buttonText: textField(40),
    alt: textField(200),
    linkUrl: linkField,
    isActive: booleanField, // ندادن: در ساخت فعال، در ویرایش بدون تغییر
    startsAt: dateField,
    endsAt: dateField,
    removeMobileImage: booleanField,
  })
  .refine(
    (value) => !value.startsAt || !value.endsAt || value.endsAt > value.startsAt,
    { message: "پایان نمایش باید بعد از شروع باشد", path: ["endsAt"] },
  );

export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
export type HomeItemInput = z.infer<typeof homeItemSchema>;