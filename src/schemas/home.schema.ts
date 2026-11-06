import { z } from "zod";

export const productsSectionConfigSchema = z.object({
  source: z.enum(["featured", "newest", "discount"]).default("newest"),
  limit: z.number().int().min(1).max(24).default(8),
  category: z.string().optional(),
  collection: z.string().optional(),
});

export const listSectionConfigSchema = z.object({
  limit: z.number().int().min(1).max(24).default(12),
});