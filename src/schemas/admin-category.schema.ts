import { z } from "zod";
import { idSchema, slugSchema } from "./admin-product.schema.js";

// برای ساخت و ویرایش کامل (PUT) از یک schema استفاده می‌شود
export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "نام دسته‌بندی باید حداقل ۲ کاراکتر باشد")
    .max(100, "نام دسته‌بندی نمی‌تواند بیشتر از ۱۰۰ کاراکتر باشد"),

  slug: slugSchema,

  // دسته‌ی والد (null یا ندادن یعنی دسته‌ی اصلی)
  parentId: idSchema.nullable().optional(),

  sortOrder: z
    .number()
    .int("ترتیب باید عدد صحیح باشد")
    .min(0, "ترتیب نمی‌تواند منفی باشد")
    .max(100000, "ترتیب نامعتبر است")
    .default(0),

  isActive: z.boolean().default(true),
});

export type CategoryInput = z.infer<typeof categorySchema>;