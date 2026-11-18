export type PricingConfig = {
  goldPricePerGram: number;
  sellerProfitPercent: number;
  vatPercent: number;
  discountBase: "TOTAL" | "FEE";
  feeAmountInRial: boolean;
  roundTo: number;
};

export type PriceableVariant = {
  weight: number;
  fee: number; // درصد اجرت از وزن
  feeAmount: number; // اجرت ثابت
};

// همه‌ی مبالغ تومان
export const calcVariantPrice = (
  variant: PriceableVariant,
  config: PricingConfig,
  discountPercent = 0,
) => {
  const feeAmount = config.feeAmountInRial
    ? variant.feeAmount / 10
    : variant.feeAmount;

  const round = (value: number) =>
    Math.round(value / config.roundTo) * config.roundTo;

  const raw = variant.weight * config.goldPricePerGram;

  // feeFactor: کسری از اجرت که اعمال می‌شود (برای تخفیف روی اجرت)
  const build = (feeFactor: number) => {
    const fee = ((raw * variant.fee) / 100 + feeAmount) * feeFactor;
    const profit = ((raw + fee) * config.sellerProfitPercent) / 100;
    const vat = ((fee + profit) * config.vatPercent) / 100;

    return raw + fee + profit + vat;
  };

  const original = build(1);
  const rate = Math.min(Math.max(discountPercent, 0), 100) / 100;

  const discounted =
    config.discountBase === "FEE" ? build(1 - rate) : original * (1 - rate);

  return { price: round(discounted), originalPrice: round(original) };
};