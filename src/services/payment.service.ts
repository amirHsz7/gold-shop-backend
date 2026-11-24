import { prisma } from "../lib/prisma.js";
import { MockPaymentProvider } from "../payments/mock-payment.provider.js";
import { AppError } from "../utils/app-error.js";

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