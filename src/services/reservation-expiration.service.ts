
import { prisma } from "../lib/prisma.js";

const CALLBACK_GRACE_PERIOD_MS = 5 * 60 * 1000;

type ExpirationResult =
  | "EXPIRED"
  | "ALREADY_PROCESSED"
  | "NEEDS_REVIEW"
  | "NOT_ELIGIBLE";

const expireOrderReservation = async (
  orderId: string,
  expirationCutoff: Date,
): Promise<ExpirationResult> => {
  return prisma.$transaction(async (tx) => {
    // ابتدا سفارش را قفل می‌کنیم.
    // Callback پرداخت نیز باید همین ترتیب قفل‌گذاری را رعایت کند.
    await tx.$queryRaw`
      SELECT "id"
      FROM "Order"
      WHERE "id" = ${orderId}
      FOR UPDATE
    `;

    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        reservationExpiresAt: true,
        stockReleasedAt: true,
        stockCommittedAt: true,
      },
    });

    if (
      !order ||
      order.status !== "PENDING_PAYMENT" ||
      order.stockReleasedAt ||
      order.stockCommittedAt ||
      !order.reservationExpiresAt ||
      order.reservationExpiresAt > expirationCutoff
    ) {
      return "NOT_ELIGIBLE";
    }

    // اگر پرداخت موفق ثبت شده باشد، نباید رزرو را آزاد کنیم.
    const successfulPayment = await tx.payment.findFirst({
      where: {
        orderId: order.id,
        status: "SUCCESS",
      },
      select: {
        id: true,
      },
    });

    if (successfulPayment) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "NEEDS_REVIEW",
          refundPending: true,
        },
      });

      return "NEEDS_REVIEW";
    }

    // تمام پرداخت‌های در انتظار را منقضی می‌کنیم.
    await tx.payment.updateMany({
      where: {
        orderId: order.id,
        status: "PENDING",
      },
      data: {
        status: "EXPIRED",
        failureReason: "RESERVATION_EXPIRED",
      },
    });

    const reservations = await tx.stockReservation.findMany({
      where: {
        orderId: order.id,
      },
      orderBy: {
        variantId: "asc",
      },
      select: {
        id: true,
        variantId: true,
        quantity: true,
        status: true,
      },
    });

    // وضعیت غیرمنتظره رزروها نیازمند بررسی است.
    if (
      reservations.length === 0 ||
      reservations.some((item) => item.status !== "ACTIVE")
    ) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "NEEDS_REVIEW",
        },
      });

      return "NEEDS_REVIEW";
    }

    const variantIds = [
      ...new Set(reservations.map((item) => item.variantId)),
    ].sort();

    // قفل Variantها با ترتیب ثابت
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
        reservedStock: true,
      },
    });

    const variantMap = new Map(
      variants.map((variant) => [variant.id, variant]),
    );

    // پیش از هر تغییری، تمام رزروها را اعتبارسنجی می‌کنیم.
    for (const reservation of reservations) {
      const variant = variantMap.get(reservation.variantId);

      if (
        !variant ||
        variant.reservedStock < reservation.quantity
      ) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "NEEDS_REVIEW",
          },
        });

        return "NEEDS_REVIEW";
      }
    }

    // آزادسازی موجودی رزروشده
    for (const reservation of reservations) {
      const result = await tx.productVariant.updateMany({
        where: {
          id: reservation.variantId,
          reservedStock: {
            gte: reservation.quantity,
          },
        },
        data: {
          reservedStock: {
            decrement: reservation.quantity,
          },
        },
      });

      if (result.count !== 1) {
        throw new Error(
          `Failed to release reservation for variant ${reservation.variantId}`,
        );
      }
    }

    // تغییر وضعیت تمام رزروها
    const releasedReservations = await tx.stockReservation.updateMany({
      where: {
        orderId: order.id,
        status: "ACTIVE",
      },
      data: {
        status: "RELEASED",
      },
    });

    if (releasedReservations.count !== reservations.length) {
      throw new Error(
        `Reservation count mismatch for order ${order.id}`,
      );
    }

    // انقضای سفارش و ثبت زمان آزادسازی
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "EXPIRED",
        stockReleasedAt: new Date(),
      },
    });

    return "EXPIRED";
  });
};

export const processExpiredReservations = async () => {
  const now = new Date();

  // سفارش فقط پس از ۱۵ دقیقه مهلت پرداخت
  // به‌علاوه ۵ دقیقه مهلت اطمینان بررسی می‌شود.
  const expirationCutoff = new Date(
    now.getTime() - CALLBACK_GRACE_PERIOD_MS,
  );

  const candidates = await prisma.order.findMany({
    where: {
      status: "PENDING_PAYMENT",
      reservationExpiresAt: {
        lte: expirationCutoff,
      },
      stockReleasedAt: null,
      stockCommittedAt: null,
      reservations: {
        some: {
          status: "ACTIVE",
        },
      },
    },
    select: {
      id: true,
    },
    orderBy: {
      reservationExpiresAt: "asc",
    },
    take: 100,
  });

  const results = {
    scanned: candidates.length,
    expired: 0,
    needsReview: 0,
    skipped: 0,
    failed: 0,
  };

  for (const candidate of candidates) {
    try {
      const result = await expireOrderReservation(
        candidate.id,
        expirationCutoff,
      );

      if (result === "EXPIRED") {
        results.expired++;
      } else if (result === "NEEDS_REVIEW") {
        results.needsReview++;
      } else {
        results.skipped++;
      }
    } catch (error) {
      results.failed++;
      console.error(
        `Failed to expire reservation for order ${candidate.id}:`,
        error,
      );
    }
  }

  return results;
};
