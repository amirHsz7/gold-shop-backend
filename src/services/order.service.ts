
import { createHash } from "node:crypto";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { calcVariantPrice } from "../lib/pricing.js";
import { AppError } from "../utils/app-error.js";

const RESERVATION_TTL_MS = 15 * 60 * 1000;
const MAX_CART_QUANTITY = 99;

export interface CheckoutInput {
  addressId: string;
  recipientName: string;
  recipientMobile: string;
}

interface CreateOrderParams {
  userId: string;
  idempotencyKey: string;
  input: CheckoutInput;
}

const normalizeCheckoutInput = (input: CheckoutInput) => ({
  addressId: input.addressId.trim(),
  recipientName: input.recipientName.trim(),
  recipientMobile: input.recipientMobile.trim(),
});

const createRequestHash = (
  userId: string,
  input: CheckoutInput,
) => {
  const payload = JSON.stringify({
    userId,
    ...normalizeCheckoutInput(input),
  });

  return createHash("sha256").update(payload).digest("hex");
};

const round3 = (value: number) =>
  Math.round(value * 1000) / 1000;

const assertSafeMoney = (value: number) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new AppError("مبلغ سفارش از محدوده مجاز خارج است.", 400);
  }
};

const getExistingOrder = async (
  userId: string,
  idempotencyKey: string,
  requestHash: string,
) => {
  const order = await prisma.order.findUnique({
    where: {
      userId_idempotencyKey: {
        userId,
        idempotencyKey,
      },
    },
    include: {
      items: true,
    },
  });

  if (!order) return null;

  if (order.requestHash !== requestHash) {
    throw new AppError(
      "این کلید قبلاً برای درخواست دیگری استفاده شده است.",
      409,
    );
  }

  return order;
};

const isPrismaError = (
  error: unknown,
  code: string,
): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === code;

export const createOrder = async ({
  userId,
  idempotencyKey,
  input,
}: CreateOrderParams) => {
  const normalizedInput = normalizeCheckoutInput(input);

  if (
    !idempotencyKey ||
    idempotencyKey.length > 100
  ) {
    throw new AppError("کلید درخواست معتبر نیست.", 400);
  }

  if (
    normalizedInput.recipientName.length < 3 ||
    normalizedInput.recipientName.length > 100
  ) {
    throw new AppError("نام گیرنده معتبر نیست.", 400);
  }

  if (!/^09\d{9}$/.test(normalizedInput.recipientMobile)) {
    throw new AppError("شماره موبایل گیرنده معتبر نیست.", 400);
  }

  const requestHash = createRequestHash(userId, normalizedInput);

  // درخواست تکراری قبل از ورود به Transaction
  const existing = await getExistingOrder(
    userId,
    idempotencyKey,
    requestHash,
  );

  if (existing) return existing;

  // در خطاهای Serialization، Transaction دوباره اجرا می‌شود.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          // بررسی مجدد کلید داخل Transaction
          const duplicate = await tx.order.findUnique({
            where: {
              userId_idempotencyKey: {
                userId,
                idempotencyKey,
              },
            },
            include: {
              items: true,
            },
          });

          if (duplicate) {
            if (duplicate.requestHash !== requestHash) {
              throw new AppError(
                "این کلید قبلاً برای درخواست دیگری استفاده شده است.",
                409,
              );
            }

            return duplicate;
          }

          // بررسی مالکیت آدرس
          const address = await tx.address.findFirst({
            where: {
              id: normalizedInput.addressId,
              userId,
            },
            select: {
              province: true,
              city: true,
              address: true,
              postalCode: true,
            },
          });

          if (!address) {
            throw new AppError("آدرس انتخاب‌شده پیدا نشد.", 404);
          }

          // تنظیمات قیمت در همان Transaction خوانده می‌شوند
          const setting = await tx.pricingSetting.findUnique({
            where: { id: "main" },
          });

          if (
            !setting ||
            !setting.goldPricePerGram ||
            setting.goldPricePerGram <= 0
          ) {
            throw new AppError(
              "قیمت طلا در حال حاضر در دسترس نیست.",
              409,
            );
          }

          if (setting.roundTo <= 0) {
            throw new AppError("تنظیمات قیمت‌گذاری معتبر نیست.", 500);
          }

          // پیدا کردن سبد خرید
          const cart = await tx.cart.findUnique({
            where: { userId },
            select: { id: true },
          });

          if (!cart) {
            throw new AppError("سبد خرید شما خالی است.", 409);
          }

          // ابتدا شناسه وزن‌ها را می‌گیریم
          const cartLines = await tx.cartItem.findMany({
            where: { cartId: cart.id },
            select: {
              variantId: true,
            },
          });

          if (cartLines.length === 0) {
            throw new AppError("سبد خرید شما خالی است.", 409);
          }

          const variantIds = [
            ...new Set(cartLines.map((item) => item.variantId)),
          ].sort();

          // قفل‌کردن Variantها با ترتیب ثابت برای کاهش Deadlock
          for (const variantId of variantIds) {
            await tx.$queryRaw`
              SELECT "id"
              FROM "ProductVariant"
              WHERE "id" = ${variantId}
              FOR UPDATE
            `;
          }

          // خواندن مجدد سبد پس از قفل‌ها
          const rows = await tx.cartItem.findMany({
            where: { cartId: cart.id },
            orderBy: { variantId: "asc" },
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
                        select: { key: true },
                      },
                    },
                  },
                },
              },
            },
          });

          if (rows.length === 0) {
            throw new AppError("سبد خرید شما خالی است.", 409);
          }

          if (
            rows.length !== cartLines.length ||
            rows.some((row) => !variantIds.includes(row.variantId))
          ) {
            throw new AppError(
              "سبد خرید تغییر کرده است. لطفاً دوباره تلاش کنید.",
              409,
            );
          }

          const config = {
            goldPricePerGram: setting.goldPricePerGram,
            sellerProfitPercent: setting.sellerProfitPercent.toNumber(),
            vatPercent: setting.vatPercent.toNumber(),
            discountBase: setting.discountBase,
            feeAmountInRial: setting.feeAmountInRial,
            roundTo: setting.roundTo,
          };

          let itemsTotal = 0;
          let discountTotal = 0;
          let totalWeight = 0;

          const orderItems = rows.map((row) => {
            const { variant } = row;
            const { product } = variant;

            if (
              !variant.isActive ||
              !product.isActive ||
              product.deletedAt !== null
            ) {
              throw new AppError(
                `محصول «${product.name}» دیگر قابل خرید نیست.`,
                409,
              );
            }

            if (
              row.quantity < 1 ||
              row.quantity > MAX_CART_QUANTITY
            ) {
              throw new AppError("تعداد محصول در سبد خرید معتبر نیست.", 409);
            }

            const availableStock =
              variant.stock - variant.reservedStock;

            if (availableStock < row.quantity) {
              throw new AppError(
                `موجودی وزن انتخاب‌شده از محصول «${product.name}» کافی نیست.`,
                409,
              );
            }

            const weight = variant.weight.toNumber();
            const prices = calcVariantPrice(
              {
                weight,
                fee: variant.fee.toNumber(),
                feeAmount: variant.feeAmount.toNumber(),
              },
              config,
              product.discountPercent.toNumber(),
            );

            assertSafeMoney(prices.price);
            assertSafeMoney(prices.originalPrice);

            const lineOriginalTotal =
              prices.originalPrice * row.quantity;

            const linePayableTotal =
              prices.price * row.quantity;

            assertSafeMoney(lineOriginalTotal);
            assertSafeMoney(linePayableTotal);

            itemsTotal += lineOriginalTotal;
            discountTotal +=
              lineOriginalTotal - linePayableTotal;

            totalWeight += weight * row.quantity;

            return {
              variantId: variant.id,
              productName: product.name,
              productSlug: product.slug,
              imageKey: product.images[0]?.key ?? null,
              karat: 18,
              weight,
              quantity: row.quantity,
              unitPrice: prices.price,
              originalUnitPrice: prices.originalPrice,
              discountPercent: product.discountPercent,
            };
          });

          totalWeight = round3(totalWeight);

          const freeShippingMinWeight =
            setting.freeShippingMinWeight?.toNumber() ?? null;

          const freeShipping =
            freeShippingMinWeight !== null &&
            totalWeight >= freeShippingMinWeight;

          const shippingCost =
            freeShipping ? 0 : setting.shippingCost;

          const subtotal = itemsTotal - discountTotal;
          const totalAmount = subtotal + shippingCost;

          assertSafeMoney(itemsTotal);
          assertSafeMoney(discountTotal);
          assertSafeMoney(shippingCost);
          assertSafeMoney(totalAmount);

          const now = new Date();
          const reservationExpiresAt = new Date(
            now.getTime() + RESERVATION_TTL_MS,
          );

          // ایجاد سفارش
          const order = await tx.order.create({
            data: {
              userId,
              idempotencyKey,
              requestHash,

              status: "PENDING_PAYMENT",

              recipientName: normalizedInput.recipientName,
              recipientMobile: normalizedInput.recipientMobile,

              province: address.province,
              city: address.city,
              address: address.address,
              postalCode: address.postalCode,

              itemsTotal,
              discountTotal,
              shippingCost,
              totalAmount,
              freeShipping,
              totalWeight,

              goldPricePerGram: setting.goldPricePerGram,
              priceVersion: setting.priceVersion,

              reservationExpiresAt,

              items: {
                create: orderItems,
              },
            },
            include: {
              items: true,
            },
          });

          // رزرو اتمیک موجودی
          for (const row of rows) {
            const quantity = row.quantity;

            const updated = await tx.$executeRaw`
              UPDATE "ProductVariant"
              SET
                "reservedStock" = "reservedStock" + ${quantity},
                "updatedAt" = NOW()
              WHERE
                "id" = ${row.variantId}
                AND ("stock" - "reservedStock") >= ${quantity}
            `;

            if (updated !== 1) {
              throw new AppError(
                "موجودی یکی از محصولات تغییر کرده است. لطفاً دوباره تلاش کنید.",
                409,
              );
            }

            await tx.stockReservation.create({
              data: {
                orderId: order.id,
                variantId: row.variantId,
                quantity,
                status: "ACTIVE",
              },
            });
          }

          // پاک‌کردن سبد فقط پس از موفقیت کامل ایجاد سفارش و رزروها
          await tx.cartItem.deleteMany({
            where: { cartId: cart.id },
          });

          return order;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 15000,
        },
      );
    } catch (error) {
      // کلید ممکن است توسط درخواست هم‌زمان دیگری ثبت شده باشد
      if (isPrismaError(error, "P2002")) {
        const duplicate = await getExistingOrder(
          userId,
          idempotencyKey,
          requestHash,
        );

        if (duplicate) return duplicate;

        throw error;
      }

      // Serialization failure
      if (isPrismaError(error, "P2034") && attempt < 3) {
        continue;
      }

      throw error;
    }
  }

  throw new AppError(
    "ثبت سفارش به دلیل تداخل درخواست‌ها انجام نشد. دوباره تلاش کنید.",
    409,
  );
};
