import { prisma } from "../lib/prisma.js";
import { storage } from "../lib/storage.js";
import { calcVariantPrice } from "../lib/pricing.js";
import { getPricingConfig } from "./price.service.js";
import { AppError } from "../utils/app-error.js";
import { Prisma } from "../generated/prisma/client.js";

const MAX_LINES = 30;
const MAX_QUANTITY = 99;

type CartIssue = "UNAVAILABLE" | "OUT_OF_STOCK" | "QUANTITY_EXCEEDS_STOCK";

const round3 = (value: number) => Math.round(value * 1000) / 1000;

const lockCart = async (
  tx: Prisma.TransactionClient,
  cartId: string,
) => {
  await tx.$queryRaw`
    SELECT "id"
    FROM "Cart"
    WHERE "id" = ${cartId}
    FOR UPDATE
  `;
};

export const getCart = async (userId: string) => {
  const [rows, config, setting] = await Promise.all([
    prisma.cartItem.findMany({
      where: { cart: { userId } },
      orderBy: { createdAt: "asc" },
      include: {
        variant: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                discountPercent: true,
                isActive: true,
                deletedAt: true,
                images: {
                  orderBy: { sortOrder: "asc" },
                  take: 1,
                  select: { key: true, alt: true },
                },
              },
            },
          },
        },
      },
    }),
    getPricingConfig(),
    prisma.pricingSetting.findUnique({
      where: { id: "main" },
      select: {
        priceVersion: true,
        shippingCost: true,
        freeShippingMinWeight: true,
      },
    }),
  ]);

  const shippingBase = setting?.shippingCost ?? 0;
  const freeMinWeight = setting?.freeShippingMinWeight?.toNumber() ?? null;

  let itemsTotal = 0;
  let discountTotal = 0;
  let totalWeight = 0;
  let payableLines = 0;

  const items = rows.map((row) => {
    const { variant } = row;
    const { product } = variant;

    const listed =
      variant.isActive && product.isActive && product.deletedAt === null;

    let issue: CartIssue | null = null;
    const availableStock = Math.max(
      0,
      variant.stock - variant.reservedStock,
    );

    if (!listed) issue = "UNAVAILABLE";
    else if (availableStock <= 0) issue = "OUT_OF_STOCK";
    else if (row.quantity > availableStock) {
      issue = "QUANTITY_EXCEEDS_STOCK";
    }

    const effectiveQuantity =
      issue === "UNAVAILABLE" || issue === "OUT_OF_STOCK"
        ? 0
        : Math.min(row.quantity, availableStock);

    const weight = variant.weight.toNumber();

    const prices = config
      ? calcVariantPrice(
          {
            weight,
            fee: variant.fee.toNumber(),
            feeAmount: variant.feeAmount.toNumber(),
          },
          config,
          product.discountPercent.toNumber(),
        )
      : null;

    if (prices && effectiveQuantity > 0) {
      itemsTotal += prices.originalPrice * effectiveQuantity;
      discountTotal += (prices.originalPrice - prices.price) * effectiveQuantity;
      totalWeight += weight * effectiveQuantity;
      payableLines += 1;
    }

    const image = product.images[0];

    return {
      variantId: variant.id,
      productId: product.id,
      name: product.name,
      slug: product.slug,
      imageUrl: image ? storage.getUrl(image.key) : null,
      imageAlt: image?.alt ?? null,
      weight,
      karat: 18,
      stock: availableStock,
      quantity: row.quantity,
      effectiveQuantity,
      unitPrice: prices?.price ?? null,
      unitOriginalPrice: prices?.originalPrice ?? null,
      lineTotal: prices ? prices.price * effectiveQuantity : null,
      issue,
    };
  });

  totalWeight = round3(totalWeight);

  const pricesAvailable = config !== null;
  const subtotal = itemsTotal - discountTotal;

  const freeShipping =
    payableLines > 0 && freeMinWeight !== null && totalWeight >= freeMinWeight;

  const shippingCost =
    payableLines === 0 || freeShipping ? 0 : shippingBase;

  const summary = pricesAvailable
    ? {
        itemsTotal,
        discountTotal,
        subtotal,
        shippingCost,
        freeShipping,
        totalWeight,
        totalAmount: subtotal + shippingCost,
        // چند گرم دیگر تا ارسال رایگان؛ null یعنی ارسال رایگان خاموش است
        freeShippingRemainingWeight:
          freeMinWeight === null
            ? null
            : round3(Math.max(0, freeMinWeight - totalWeight)),
        freeShippingMinWeight: freeMinWeight,
      }
    : null;

  return {
    items,
    summary,
    pricesAvailable,
    hasIssues: items.some((item) => item.issue !== null),
    priceVersion: setting?.priceVersion ?? 1,
    updatedAt: new Date().toISOString(),
  };
};

export const addCartItem = async (
  userId: string,
  variantId: string,
  quantity: number,
) => {
  const cart = await prisma.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await lockCart(tx, cart.id);

    const variant = await tx.productVariant.findUnique({
      where: { id: variantId },
      select: {
        stock: true,
        reservedStock: true,
        isActive: true,
        product: {
          select: { isActive: true, deletedAt: true },
        },
      },
    });

    if (
      !variant ||
      !variant.isActive ||
      !variant.product.isActive ||
      variant.product.deletedAt !== null
    ) {
      throw new AppError("این محصول در دسترس نیست.", 404);
    }

    const availableStock = variant.stock - variant.reservedStock;

    if (availableStock <= 0) {
      throw new AppError("این وزن در حال حاضر ناموجود است.", 409);
    }

    const key = {
      cartId_variantId: {
        cartId: cart.id,
        variantId,
      },
    };

    const existing = await tx.cartItem.findUnique({
      where: key,
      select: { quantity: true },
    });

    if (!existing) {
      const lines = await tx.cartItem.count({
        where: { cartId: cart.id },
      });

      if (lines >= MAX_LINES) {
        throw new AppError(
          "تعداد محصولات سبد خرید به حداکثر رسیده است.",
          409,
        );
      }
    }

    const next = Math.min(
      (existing?.quantity ?? 0) + quantity,
      availableStock,
      MAX_QUANTITY,
    );

    await tx.cartItem.upsert({
      where: key,
      update: { quantity: next },
      create: {
        cartId: cart.id,
        variantId,
        quantity: next,
      },
    });
  });

  return getCart(userId);
};

export const updateCartItem = async (
  userId: string,
  variantId: string,
  quantity: number,
) => {
  await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!cart) {
      throw new AppError("سبد خرید شما پیدا نشد.", 404);
    }

    await lockCart(tx, cart.id);

    const item = await tx.cartItem.findUnique({
      where: {
        cartId_variantId: {
          cartId: cart.id,
          variantId,
        },
      },
      include: {
        variant: {
          include: {
            product: {
              select: {
                isActive: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      throw new AppError("این محصول در سبد خرید شما نیست.", 404);
    }

    const { variant } = item;

    if (
      !variant.isActive ||
      !variant.product.isActive ||
      variant.product.deletedAt !== null
    ) {
      throw new AppError("این محصول دیگر در دسترس نیست.", 409);
    }

    const availableStock = variant.stock - variant.reservedStock;

    if (availableStock <= 0) {
      throw new AppError("این وزن در حال حاضر ناموجود است.", 409);
    }

    await tx.cartItem.update({
      where: { id: item.id },
      data: {
        quantity: Math.min(quantity, availableStock, MAX_QUANTITY),
      },
    });
  });

  return getCart(userId);
};

export const removeCartItem = async (
  userId: string,
  variantId: string,
) => {
  await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!cart) return;

    await lockCart(tx, cart.id);

    await tx.cartItem.deleteMany({
      where: {
        cartId: cart.id,
        variantId,
      },
    });
  });

  return getCart(userId);
};

export const clearCart = async (userId: string) => {
  await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!cart) return;

    await lockCart(tx, cart.id);

    await tx.cartItem.deleteMany({
      where: { cartId: cart.id },
    });
  });

  return getCart(userId);
};