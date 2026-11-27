import { prisma } from "../lib/prisma.js";
import { releaseOrderReservation } from "./release-reservation.service.js";

type ExpirationResult = "EXPIRED" | "NEEDS_REVIEW" | "NOT_ELIGIBLE";

const expireOrderReservation = async (
  orderId: string,
  expirationCutoff: Date,
): Promise<ExpirationResult> => {
  return prisma.$transaction(async (tx) => {
    // مثل callback پرداخت، ابتدا سفارش را قفل می‌کنیم.
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

    // ممکن است بعد از انتخاب این سفارش توسط worker،
    // callback پرداخت زودتر قفل را گرفته و سفارش را پردازش کرده باشد.
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

    const successfulPayment = await tx.payment.findFirst({
      where: {
        orderId: order.id,
        status: "SUCCESS",
      },
      select: { id: true },
    });

    const released = await releaseOrderReservation(tx, order.id, new Date());

    const status = released && !successfulPayment
      ? "EXPIRED"
      : "NEEDS_REVIEW";

    await tx.order.update({
      where: { id: order.id },
      data: {
        status,
        ...(successfulPayment && { refundPending: true }),
      },
    });

    return status;
  });
};

export const processExpiredReservations = async () => {
  const expirationCutoff = new Date();

  const candidates = await prisma.order.findMany({
    where: {
      status: "PENDING_PAYMENT",
      reservationExpiresAt: { lte: expirationCutoff },
      stockReleasedAt: null,
      stockCommittedAt: null,
    },
    select: { id: true },
    orderBy: { reservationExpiresAt: "asc" },
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
      const result = await expireOrderReservation(candidate.id, expirationCutoff);

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