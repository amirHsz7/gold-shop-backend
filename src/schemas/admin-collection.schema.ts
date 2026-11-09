import { z } from "zod";
import { slugSchema } from "./admin-product.schema.js";

// برای ساخت و ویرایش کامل (PUT) از یک schema استفاده می‌شود
export const collectionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "نام کالکشن باید حداقل ۲ کاراکتر باشد")
    .max(100, "نام کالکشن نمی‌تواند بیشتر از ۱۰۰ کاراکتر باشد"),

  slug: slugSchema,

  description: z
    .string()
    .trim()
    .max(2000, "توضیحات نمی‌تواند بیشتر از ۲۰۰۰ کاراکتر باشد")
    .nullable()
    .optional(),

  sortOrder: z
    .number()
    .int("ترتیب باید عدد صحیح باشد")
    .min(0, "ترتیب نمی‌تواند منفی باشد")
    .max(100000, "ترتیب نامعتبر است")
    .default(0),

  isActive: z.boolean().default(true),
});

export type CollectionInput = z.infer<typeof collectionSchema>;