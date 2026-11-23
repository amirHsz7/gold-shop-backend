
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
  fee: number;
  feeAmount: number;
};

type PriceBreakdown = {
  goldAmount: number;
  feeAmount: number;
  sellerProfitAmount: number;
  vatAmount: number;
  total: number;
};

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

  const goldAmount =
    variant.weight * config.goldPricePerGram;

  const build = (feeFactor: number): PriceBreakdown => {
    const fee =
      ((goldAmount * variant.fee) / 100 + feeAmount) *
      feeFactor;

    const profit =
      ((goldAmount + fee) * config.sellerProfitPercent) / 100;

    const vat =
      ((fee + profit) * config.vatPercent) / 100;

    return {
      goldAmount,
      feeAmount: fee,
      sellerProfitAmount: profit,
      vatAmount: vat,
      total: goldAmount + fee + profit + vat,
    };
  };

  const original = build(1);

  const normalizedDiscount = Math.min(
    Math.max(discountPercent, 0),
    100,
  );

  const discountRate = normalizedDiscount / 100;

  const discounted =
    config.discountBase === "FEE"
      ? build(1 - discountRate)
      : {
          goldAmount: original.goldAmount * (1 - discountRate),
          feeAmount: original.feeAmount * (1 - discountRate),
          sellerProfitAmount:
            original.sellerProfitAmount * (1 - discountRate),
          vatAmount: original.vatAmount * (1 - discountRate),
          total: original.total * (1 - discountRate),
        };

  const originalPrice = round(original.total);
  const price = round(discounted.total);

  return {
    price,
    originalPrice,

    breakdown: {
      discountPercent: normalizedDiscount,
      discountBase: config.discountBase,

      original: {
        goldAmount: original.goldAmount,
        feeAmount: original.feeAmount,
        sellerProfitAmount: original.sellerProfitAmount,
        vatAmount: original.vatAmount,
        total: original.total,
      },

      discounted: {
        goldAmount: discounted.goldAmount,
        feeAmount: discounted.feeAmount,
        sellerProfitAmount: discounted.sellerProfitAmount,
        vatAmount: discounted.vatAmount,
        total: discounted.total,
      },

      discountAmount: original.total - discounted.total,

      originalPrice,
      finalPrice: price,

      roundingAdjustment: price - discounted.total,
    },
  };
};
