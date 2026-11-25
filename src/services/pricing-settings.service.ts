import { prisma } from "../lib/prisma.js";
import type { PricingSettingsInput } from "../schemas/pricing-settings.schema.js";
import { recalculateAllPrices } from "./price.service.js";

const PRICING_SETTINGS_ID = "main";

const DEFAULT_PRICING = {
  sellerProfitPercent: 7,
  vatPercent: 10,
  goldPricePerGram: null as number | null,
  goldPriceUpdatedAt: null as Date | null,
  updatedAt: null as Date | null,
  goldPriceStatus: "UNAVAILABLE" as const,
};

export const getPricingSettings = async () => {
  const row = await prisma.pricingSetting.findUnique({
    where: { id: PRICING_SETTINGS_ID },
  });

  if (!row) return DEFAULT_PRICING;

  return {
    sellerProfitPercent: row.sellerProfitPercent.toNumber(),
    vatPercent: row.vatPercent.toNumber(),
    goldPricePerGram: row.goldPricePerGram,
    goldPriceStatus: row.goldPriceStatus,
    goldPriceUpdatedAt: row.goldPriceUpdatedAt,
    updatedAt: row.updatedAt,
  };
};

export const savePricingSettings = async (input: PricingSettingsInput) => {
  const current = await prisma.pricingSetting.findUnique({
    where: { id: PRICING_SETTINGS_ID },
    select: { goldPricePerGram: true },
  });

  const goldChanged =
    input.goldPricePerGram !== undefined &&
    input.goldPricePerGram !== current?.goldPricePerGram;

  const data = {
    sellerProfitPercent: input.sellerProfitPercent,
    vatPercent: input.vatPercent,
    ...(goldChanged && {
      goldPricePerGram: input.goldPricePerGram,
      goldPriceSource: "manual",
      goldPriceUpdatedAt: new Date(),
    }),
  };

  await prisma.pricingSetting.upsert({
    where: { id: PRICING_SETTINGS_ID },
    create: { id: PRICING_SETTINGS_ID, ...data },
    update: data,
  });

  // با هر تغییر تنظیمات، قیمت همه‌ی محصولات دوباره حساب می‌شود
  await recalculateAllPrices();
};