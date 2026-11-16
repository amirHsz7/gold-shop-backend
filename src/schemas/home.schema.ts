import { z } from "zod";

export const productsSectionConfigSchema = z.object({
  source: z.enum(["featured", "newest", "discount"]).default("newest"),
  limit: z
    .number()
    .int("تعداد باید عدد صحیح باشد")
    .min(1, "تعداد باید بین ۱ تا ۲۴ باشد")
    .max(24, "تعداد باید بین ۱ تا ۲۴ باشد")
    .default(8),
  category: z.string().trim().min(1).optional(), // slug دسته‌بندی
  collection: z.string().trim().min(1).optional(), // slug کالکشن
});

export const listSectionConfigSchema = z.object({
  limit: z
    .number()
    .int("تعداد باید عدد صحیح باشد")
    .min(1, "تعداد باید بین ۱ تا ۲۴ باشد")
    .max(24, "تعداد باید بین ۱ تا ۲۴ باشد")
    .default(12),
});

export const bannersSectionConfigSchema = z.object({
  columns: z
    .number()
    .int("تعداد ستون باید عدد صحیح باشد")
    .min(1, "تعداد ستون باید بین ۱ تا ۴ باشد")
    .max(4, "تعداد ستون باید بین ۱ تا ۴ باشد")
    .default(2),
});

export const sliderSectionConfigSchema = z.object({
  // ۰ یعنی بدون پخش خودکار
  autoplayMs: z
    .number()
    .int("زمان باید عدد صحیح باشد")
    .min(0, "زمان پخش خودکار باید بین ۰ تا ۳۰۰۰۰ میلی‌ثانیه باشد")
    .max(30000, "زمان پخش خودکار باید بین ۰ تا ۳۰۰۰۰ میلی‌ثانیه باشد")
    .default(5000),
});

export const DEFAULT_BANNER_COLUMNS = 2;
export const DEFAULT_SLIDER_AUTOPLAY_MS = 5000;