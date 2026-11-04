import { z } from "zod";

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  category: z.string().trim().min(1).optional(),   // slug دسته‌بندی
  collection: z.string().trim().min(1).optional(), // slug کالکشن
  search: z.string().trim().min(1).max(100).optional(),
  featured: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  hasDiscount: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  sort: z
    .enum(["newest", "weight_asc", "weight_desc", "discount"])
    .default("newest"),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;