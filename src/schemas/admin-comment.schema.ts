import { z } from "zod";

const booleanQuery = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const listAdminCommentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  type: z.enum(["root", "reply"]).optional(),
  productId: z.string().trim().min(1).optional(),
  showOnHome: booleanQuery.optional(),
  search: z.string().trim().min(1).max(100).optional(), // متن نظر، نام یا موبایل
});

export const updateCommentSchema = z
  .object({
    status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
    showOnHome: z.boolean().optional(),
  })
  .refine(
    (value) => value.status !== undefined || value.showOnHome !== undefined,
    "حداقل یک فیلد برای ویرایش لازم است",
  );

export const adminReplySchema = z.object({
  body: z
    .string()
    .trim()
    .min(3, "متن پاسخ باید حداقل ۳ کاراکتر باشد")
    .max(1000, "متن پاسخ نمی‌تواند بیشتر از ۱۰۰۰ کاراکتر باشد"),
});

export type ListAdminCommentsQuery = z.infer<typeof listAdminCommentsQuerySchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type AdminReplyInput = z.infer<typeof adminReplySchema>;