import { z } from "zod";

const booleanQuery = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const listProductsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    category: z.string().trim().min(1).optional(), // slug دسته‌بندی
    collection: z.string().trim().min(1).optional(), // slug کالکشن
    search: z.string().trim().min(1).max(100).optional(),
    featured: booleanQuery.optional(),
    hasDiscount: booleanQuery.optional(),
    inStock: booleanQuery.optional(),
    // قیمت به تومان
    minPrice: z.coerce.number().int().min(0).optional(),
    maxPrice: z.coerce.number().int().min(0).optional(),
    // وزن به گرم
    minWeight: z.coerce.number().min(0).optional(),
    maxWeight: z.coerce.number().min(0).optional(),
    sort: z
      .enum([
        "newest",
        "price_asc",
        "price_desc",
        "weight_asc",
        "weight_desc",
        "discount",
      ])
      .default("newest"),
  })
  .refine(
    (query) =>
      query.minPrice === undefined ||
      query.maxPrice === undefined ||
      query.minPrice <= query.maxPrice,
    { message: "حداقل قیمت نمی‌تواند از حداکثر بیشتر باشد", path: ["minPrice"] },
  )
  .refine(
    (query) =>
      query.minWeight === undefined ||
      query.maxWeight === undefined ||
      query.minWeight <= query.maxWeight,
    { message: "حداقل وزن نمی‌تواند از حداکثر بیشتر باشد", path: ["minWeight"] },
  );

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;