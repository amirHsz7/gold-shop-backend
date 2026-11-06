import { z } from "zod";

export const createCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(3, "متن نظر باید حداقل ۳ کاراکتر باشد")
    .max(1000, "متن نظر نمی‌تواند بیشتر از ۱۰۰۰ کاراکتر باشد"),

  // اگر پاسخ به یک نظر است، شناسه‌ی همان نظر
  parentId: z.string().trim().min(1).optional(),

  // امتیاز اختیاری، فقط برای نظر اصلی
  rating: z
    .number()
    .int("امتیاز باید عدد صحیح باشد")
    .min(1, "امتیاز باید بین ۱ تا ۵ باشد")
    .max(5, "امتیاز باید بین ۱ تا ۵ باشد")
    .optional(),
});

export const listCommentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;