import { prisma } from "../lib/prisma.js";
import type { PricingSettingsInput } from "../schemas/pricing-settings.schema.js";

const PRICING_SETTINGS_ID = "main";

// تا وقتی ادمین چیزی ذخیره نکرده، این مقدارها استفاده می‌شود
const DEFAULT_PRICING = { sellerProfitPercent: 7, vatPercent: 10 };

const select = {
  sellerProfitPercent: true,
  vatPercent: true,
  updatedAt: true,
} as const;

export const getPricingSettings = async () => {
  const row = await prisma.pricingSetting.findUnique({
    where: { id: PRICING_SETTINGS_ID },
    select,
  });

  if (!row) return { ...DEFAULT_PRICING, updatedAt: null };

  return {
    sellerProfitPercent: row.sellerProfitPercent.toNumber(),
    vatPercent: row.vatPercent.toNumber(),
    updatedAt: row.updatedAt,
  };
};

export const savePricingSettings = async (input: PricingSettingsInput) => {
  await prisma.pricingSetting.upsert({
    where: { id: PRICING_SETTINGS_ID },
    create: { id: PRICING_SETTINGS_ID, ...input },
    update: input,
  });
};