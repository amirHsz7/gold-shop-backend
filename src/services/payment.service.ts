import { prisma } from "../lib/prisma.js";
import { MockPaymentProvider } from "../payments/mock-payment.provider.js";
import { AppError } from "../utils/app-error.js";

const CALLBACK_GRACE_PERIOD_MS = 5 * 60 * 1000;

const paymentProvider = new MockPaymentProvider();

interface CreatePaymentParams {
  userId: string;
  orderId: string;
}

export const createPaymentForOrder = async ({
  userId,
  orderId,
}: CreatePaymentParams) => {
  const payment = await prisma.$transaction(async (tx) => {
    // قفل سفارش برای جلوگیری از ساخت هم‌زمان چند Payment
    await tx.$queryRaw`
      SELECT "id"
      FROM "Order"
      WHERE "id" = ${orderId}
      FOR UPDATE
    `;

    const order = await tx.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
    });

    if (!order) {
      throw new AppError("سفارش موردنظر پیدا نشد.", 404);
    }

    if (order.status !== "PENDING_PAYMENT") {
      throw new AppError(
        "این سفارش در وضعیت قابل پرداخت نیست.",
        409,
      );
    }

    const now = new Date();

    if (
      !order.reservationExpiresAt ||
      order.reservationExpiresAt <= now ||
      order.stockReleasedAt ||
      order.stockCommittedAt
    ) {
      throw new AppError(
        "مهلت پرداخت سفارش به پایان رسیده است.",
        409,
      );
    }

    // اطمینان از فعال بودن تمام رزروهای سفارش
    const reservations = await tx.stockReservation.findMany({
      where: {
        orderId: order.id,
      },
      select: {
        status: true,
      },
    });

    if (
      reservations.length === 0 ||
      reservations.some((item) => item.status !== "ACTIVE")
    ) {
      throw new AppError(
        "رزرو موجودی سفارش معتبر نیست.",
        409,
      );
    }

    // بررسی نشست پرداخت قبلی
    const existingPayment = await tx.payment.findFirst({
      where: {
        orderId: order.id,
        gateway: paymentProvider.name,
        status: "PENDING",
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (existingPayment) {
      // نشست قبلی آماده استفاده است
      if (
        existingPayment.authority &&
        existingPayment.checkoutUrl
      ) {
        return existingPayment;
      }

      // ساخت نشست قبلی هنوز تکمیل نشده است
      throw new AppError(
        "درخواست پرداخت قبلی هنوز در حال پردازش است. کمی بعد دوباره تلاش کنید.",
        409,
      );
    }

    // ایجاد رکورد اولیه پیش از ارتباط با درگاه
    return tx.payment.create({
      data: {
        orderId: order.id,
        gateway: paymentProvider.name,
        amount: order.totalAmount,
        status: "PENDING",
        expiresAt: order.reservationExpiresAt,
      },
    });
  });

  // اگر نشست قبلاً ساخته شده، همان را برمی‌گردانیم
  if (payment.authority && payment.checkoutUrl) {
    return payment;
  }

  try {
    // ساخت نشست پرداخت خارج از Transaction دیتابیس
    const session = await paymentProvider.createPaymentSession({
      paymentId: payment.id,
      amount: payment.amount.toString(),
      expiresAt: payment.expiresAt,
    });

    if (!session.authority || !session.checkoutUrl) {
      throw new AppError(
        "درگاه پرداخت اطلاعات نشست معتبری برنگرداند.",
        502,
      );
    }

    // ذخیره اطلاعات دریافتی از Provider
    return await prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        authority: session.authority,
        checkoutUrl: session.checkoutUrl,
      },
    });
  } catch (error) {
    // نشست ناموفق نباید به‌عنوان پرداخت فعال باقی بماند
    await prisma.payment.updateMany({
      where: {
        id: payment.id,
        status: "PENDING",
      },
      data: {
        status: "FAILED",
        failureReason: "SESSION_CREATION_FAILED",
      },
    });

    throw error;
  }
};

interface ProcessPaymentCallbackParams {
  authority: string;
  payload: unknown;
  userId: string;
}

export const processPaymentCallback = async ({
  authority,
  payload,
  userId,
}: ProcessPaymentCallbackParams) => {
  // ابتدا Payment را با شناسه درگاه پیدا می‌کنیم.
  const initialPayment = await prisma.payment.findFirst({
    where: {
      gateway: paymentProvider.name,
      authority,
    },
    select: {
      id: true,
      orderId: true,
    },
  });

  if (!initialPayment) {
    throw new AppError("تراکنش پرداخت پیدا نشد.", 404);
  }

  // تأیید نتیجه توسط Provider؛ خارج از تراکنش دیتابیس
  const verification = await paymentProvider.verifyPayment({
    authority,
    payload,
  });

  return prisma.$transaction(async (tx) => {
    // ترتیب قفل‌گذاری: ابتدا Order
    await tx.$queryRaw`
      SELECT "id"
      FROM "Order"
      WHERE "id" = ${initialPayment.orderId}
      FOR UPDATE
    `;

    // سپس Payment
    await tx.$queryRaw`
      SELECT "id"
      FROM "Payment"
      WHERE "id" = ${initialPayment.id}
      FOR UPDATE
    `;

    const payment = await tx.payment.findUnique({
      where: {
        id: initialPayment.id,
      },
    });

    const order = await tx.order.findUnique({
      where: {
        id: initialPayment.orderId,
      },
    });

    if (!payment || !order) {
      throw new AppError("اطلاعات سفارش یا پرداخت پیدا نشد.", 404);
    }

    if (order.userId !== userId) {
      throw new AppError("تراکنش پرداخت پیدا نشد.", 404);
    }

    // پرداخت موفق قبلی نباید دوباره پردازش شود.
    if (payment.status === "SUCCESS") {
      return {
        outcome: "ALREADY_PROCESSED" as const,
        orderId: order.id,
      };
    }

    const now = new Date();

    // نتیجه ناموفق تأییدشده از طرف Provider
    if (!verification.success) {
      await tx.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: "FAILED",
          failureReason:
            verification.failureReason ?? "PAYMENT_FAILED",
        },
      });

      // سفارش تا پایان مهلت رزرو همچنان قابل پرداخت مجدد است.
      return {
        outcome: "PAYMENT_FAILED" as const,
        orderId: order.id,
      };
    }

    // از اینجا به بعد Provider موفقیت پرداخت را تأیید کرده است.
    // حتی اگر سفارش منقضی شده باشد، موفقیت واقعی پرداخت را ثبت می‌کنیم.
    const markForReview = async (reason: string) => {
      await tx.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: "SUCCESS",
          refId: verification.refId,
          cardPan: verification.cardPan,
          failureReason: reason,
          paidAt: now,
        },
      });

      await tx.order.update({
        where: {
          id: order.id,
        },
        data: {
          status: "NEEDS_REVIEW",
          refundPending: true,
        },
      });

      return {
        outcome: "NEEDS_REVIEW" as const,
        orderId: order.id,
        reason,
      };
    };

    // سفارش قبلاً پرداخت، لغو یا منقضی شده است.
    // در این شرایط نباید موجودی را دوباره تغییر دهیم.
    if (
      order.status !== "PENDING_PAYMENT" ||
      order.stockReleasedAt ||
      order.stockCommittedAt
    ) {
      return markForReview("ORDER_NOT_PAYABLE");
    }

    // موفقیت پرداخت بعد از پایان مهلت رزرو
    const reservationDeadline = order.reservationExpiresAt
    ? order.reservationExpiresAt.getTime() + CALLBACK_GRACE_PERIOD_MS
    : null;

    if (
      reservationDeadline === null ||
      now.getTime() > reservationDeadline
    ) {
      return markForReview("RESERVATION_EXPIRED");
    }

    // تمام رزروهای سفارش باید ACTIVE باشند.
    const reservations = await tx.stockReservation.findMany({
      where: {
        orderId: order.id,
      },
      select: {
        id: true,
        variantId: true,
        quantity: true,
        status: true,
      },
      orderBy: {
        variantId: "asc",
      },
    });

    if (
      reservations.length === 0 ||
      reservations.some((item) => item.status !== "ACTIVE")
    ) {
      return markForReview("RESERVATION_NOT_ACTIVE");
    }

    // قفل‌کردن Variantها با ترتیب ثابت برای کاهش احتمال Deadlock
    const variantIds = [
      ...new Set(reservations.map((item) => item.variantId)),
    ].sort();

    for (const variantId of variantIds) {
      await tx.$queryRaw`
        SELECT "id"
        FROM "ProductVariant"
        WHERE "id" = ${variantId}
        FOR UPDATE
      `;
    }

    const variants = await tx.productVariant.findMany({
      where: {
        id: {
          in: variantIds,
        },
      },
      select: {
        id: true,
        stock: true,
        reservedStock: true,
      },
    });

    const variantMap = new Map(
      variants.map((variant) => [variant.id, variant]),
    );

    // قبل از هر تغییری، اعتبار تمام موجودی‌ها را بررسی می‌کنیم.
    for (const reservation of reservations) {
      const variant = variantMap.get(reservation.variantId);

      if (
        !variant ||
        variant.stock < reservation.quantity ||
        variant.reservedStock < reservation.quantity
      ) {
        return markForReview("STOCK_RESERVATION_MISMATCH");
      }
    }

    // انتقال موجودی رزروشده به موجودی فروش‌رفته
    for (const reservation of reservations) {
      const result = await tx.productVariant.updateMany({
        where: {
          id: reservation.variantId,
          stock: {
            gte: reservation.quantity,
          },
          reservedStock: {
            gte: reservation.quantity,
          },
        },
        data: {
          stock: {
            decrement: reservation.quantity,
          },
          reservedStock: {
            decrement: reservation.quantity,
          },
        },
      });

      if (result.count !== 1) {
        throw new AppError(
          "انتقال موجودی سفارش با خطا مواجه شد.",
          409,
        );
      }
    }

    // رزروها به وضعیت COMMITTED تغییر می‌کنند.
    const committedReservations = await tx.stockReservation.updateMany({
      where: {
        orderId: order.id,
        status: "ACTIVE",
      },
      data: {
        status: "COMMITTED",
      },
    });

    if (committedReservations.count !== reservations.length) {
      throw new AppError(
        "تغییر وضعیت رزروهای موجودی با خطا مواجه شد.",
        409,
      );
    }
    // ثبت موفقیت پرداخت
    await tx.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        status: "SUCCESS",
        refId: verification.refId,
        cardPan: verification.cardPan,
        failureReason: null,
        paidAt: now,
      },
    });

    // انتقال سفارش به مرحله آماده‌سازی
    await tx.order.update({
      where: {
        id: order.id,
      },
      data: {
        status: "PREPARING",
        stockCommittedAt: now,
        paidAt: now,
      },
    });

    return {
      outcome: "PAYMENT_SUCCESS" as const,
      orderId: order.id,
    };
  });
};