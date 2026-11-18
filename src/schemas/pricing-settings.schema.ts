import { z } from "zod";

// درصد بین ۰ تا ۱۰۰ با حداکثر دو رقم اعشار
const percent = (label: string) =>
  z
    .number({ error: `${label} باید عدد باشد` })
    .min(0, `${label} نمی‌تواند منفی باشد`)
    .max(100, `${label} نمی‌تواند بیشتر از ۱۰۰ باشد`)
    .refine(
      (value) => Math.round(value * 100) / 100 === value,
      `${label} حداکثر دو رقم اعشار دارد`,
    );

export const pricingSettingsSchema = z.object({
  sellerProfitPercent: percent("درصد سود فروشنده"),
  vatPercent: percent("درصد مالیات بر ارزش افزوده"),
});

export type PricingSettingsInput = z.infer<typeof pricingSettingsSchema>;