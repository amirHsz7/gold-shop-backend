import { prisma } from "../lib/prisma.js";
import { calcVariantPrice, type PricingConfig } from "../lib/pricing.js";

// اگر قیمت طلا هنوز ثبت نشده باشد null برمی‌گرداند و قیمت‌ها null می‌شوند
export const getPricingConfig = async (): Promise<PricingConfig | null> => {
  const row = await prisma.pricingSetting.findUnique({ where: { id: "main" } });

  if (!row?.goldPricePerGram || row.goldPricePerGram <= 0) return null;

  return {
    goldPricePerGram: row.goldPricePerGram,
    sellerProfitPercent: row.sellerProfitPercent.toNumber(),
    vatPercent: row.vatPercent.toNumber(),
    discountBase: row.discountBase,
    feeAmountInRial: row.feeAmountInRial,
    roundTo: row.roundTo,
  };
};

export const recalculateProductPrices = async (
  productId: string,
  givenConfig?: PricingConfig | null,
) => {
  const config =
    givenConfig === undefined ? await getPricingConfig() : givenConfig;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      discountPercent: true,
      variants: {
        where: { isActive: true },
        select: { id: true, weight: true, fee: true, feeAmount: true, stock: true ,reservedStock: true,},
      },
    },
  });

  if (!product) return;

  const discount = product.discountPercent.toNumber();

  const priced = product.variants.map((variant) => ({
    id: variant.id,
    availableStock: variant.stock - variant.reservedStock,
    ...(config
      ? calcVariantPrice(
          {
            weight: variant.weight.toNumber(),
            fee: variant.fee.toNumber(),
            feeAmount: variant.feeAmount.toNumber(),
          },
          config,
          discount,
        )
      : { price: null, originalPrice: null }),
  }));

  // فقط Variantهایی که موجودی قابل فروش دارند در بازه قیمت شرکت می‌کنند
  const candidates = priced
    .filter((variant) => variant.availableStock > 0)
    .map((variant) => variant.price)
    .filter((price): price is number => price !== null);

  await prisma.$transaction([
    ...priced.map((variant) =>
      prisma.productVariant.update({
        where: { id: variant.id },
        data: { price: variant.price, originalPrice: variant.originalPrice },
      }),
    ),
    prisma.product.update({
      where: { id: productId },
      data: {
        minPrice: candidates.length ? Math.min(...candidates) : null,
        maxPrice: candidates.length ? Math.max(...candidates) : null,
      },
    }),
  ]);
};

// وقتی قیمت طلا یا درصدها عوض شد
export const recalculateAllPrices = async () => {
  const config = await getPricingConfig();

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });

  for (const product of products) {
    await recalculateProductPrices(product.id, config);
  }
};