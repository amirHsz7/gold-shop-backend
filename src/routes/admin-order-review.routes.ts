import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middlewares/validate.middleware.js";
import { preparePaidOrder } from "../services/prepare-paid-order.service.js";
import { AppError } from "../utils/app-error.js";

const router = Router({ mergeParams: true });

const paymentIdField = z.string().trim().min(1);

const approveSchema = z.object({
  paymentId: paymentIdField,
}).strict();

const requestRefundSchema = z.object({
  paymentId: paymentIdField,
  reason: z.string().trim().min(1).max(500),
}).strict();

const completeRefundSchema = z.object({
  paymentId: paymentIdField,
  refundRefId: z.string().trim().min(1).max(100),
}).strict();

type ReviewAction =
  | { type: "approve"; paymentId: string }
  | { type: "requestRefund"; paymentId: string; reason: string }
  | { type: "completeRefund"; paymentId: string; refundRefId: string };

async function reviewOrder(
  orderId: string,
  actorId: string,
  action: ReviewAction,
) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`
      SELECT "id"
      FROM "Order"
      WHERE "id" = ${orderId}
      FOR UPDATE
    `;

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        payments: { where: { status: "SUCCESS" } },
        reservations: { orderBy: { variantId: "asc" } },
        items: {
          select: {
            variantId: true,
            productName: true,
            weight: true,
            quantity: true,
          },
        },
      },
    });

    if (!order) throw new AppError("سفارش پیدا نشد.", 404);

    const payment = order.payments.find(item => item.id === action.paymentId);
    if (!payment) {
      throw new AppError("پرداخت موفق موردنظر برای این سفارش پیدا نشد.", 409);
    }

    const now = new Date();
    const audit = (name: string, details: Record<string, string>) =>
      tx.auditLog.create({
        data: {
          action: name,
          actorId,
          targetUserId: order.userId,
          details: { orderId, paymentId: payment.id, ...details },
        },
      });

    // ثبت رسید بانکی برای بازپرداخت انتخاب‌شده
    if (action.type === "completeRefund") {
      if (order.status !== "CANCELLED" || !payment.refundRequestedAt) {
        throw new AppError("ابتدا بازپرداخت همین تراکنش را انتخاب کنید.", 409);
      }

      if (order.refundedAt) {
        if (payment.refundRefId !== action.refundRefId) {
          throw new AppError("این بازپرداخت قبلاً با کد دیگری ثبت شده است.", 409);
        }
        return { status: order.status, refundedAt: order.refundedAt };
      }

      if (!order.refundPending || payment.refundRefId || order.payments.length !== 1) {
        throw new AppError("وضعیت مالی سفارش نیاز به بررسی جداگانه دارد.", 409);
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: { refundRefId: action.refundRefId },
      });

      await tx.order.update({
        where: { id: orderId },
        data: { refundPending: false, refundedAt: now },
      });

      await audit("ORDER_REFUND_COMPLETED", { refundRefId: action.refundRefId });
      return { status: "CANCELLED", refundedAt: now };
    }

    // پاسخ یکسان به تکرار درخواست بازپرداخت
    if (
      action.type === "requestRefund" &&
      order.status === "CANCELLED" &&
      payment.refundRequestedAt
    ) {
      if (order.cancelReason !== action.reason) {
        throw new AppError("درخواست بازپرداخت قبلاً با علت دیگری ثبت شده است.", 409);
      }
      return { status: order.status, refundedAt: order.refundedAt };
    }

    // ممکن است پاسخ تأیید اول قطع شده و ادمین دوباره درخواست داده باشد.
    if (
      action.type === "approve" &&
      order.stockCommittedAt &&
      (order.status === "PREPARING" || order.status === "SHIPPED")
    ) {
      const previousApproval = await tx.auditLog.findFirst({
        where: {
          action: "ORDER_REVIEW_APPROVED",
          details: { path: ["paymentId"], equals: payment.id },
        },
        select: { id: true },
      });

      if (previousApproval) {
        return { status: order.status, refundedAt: null };
      }
    }

    const paidAt = payment.paidAt;
    const eligible =
      order.status === "NEEDS_REVIEW" &&
      order.refundPending &&
      !order.refundedAt &&
      !order.cancelledAt &&
      !order.stockCommittedAt &&
      !!order.stockReleasedAt &&
      !!order.reservationExpiresAt &&
      !!paidAt &&
      paidAt >= order.reservationExpiresAt &&
      order.payments.length === 1 &&
      payment.amount.equals(order.totalAmount) &&
      !payment.refundRequestedAt &&
      !payment.refundRefId &&
      ["RESERVATION_EXPIRED", "ORDER_NOT_PAYABLE"].includes(payment.failureReason ?? "") &&
      order.reservations.length > 0 &&
      order.reservations.every(row => row.status === "RELEASED");

    if (!eligible || !paidAt) {
      throw new AppError("این سفارش شرایط تصمیم‌گیری برای پرداخت دیررس را ندارد.", 409);
    }

    if (action.type === "requestRefund") {
      await tx.payment.update({
        where: { id: payment.id },
        data: { refundRequestedAt: now },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          cancelledById: actorId,
          cancelReason: action.reason,
          refundPending: true,
        },
      });

      await audit("ORDER_REFUND_REQUESTED", { reason: action.reason });
      return { status: "CANCELLED", refundedAt: null };
    }

    if (order.items.length !== order.reservations.length) {
      throw new AppError("اقلام سفارش با رزروهای ثبت‌شده تطابق ندارند.", 409);
    }

    // رزروها از ابتدا بر اساس variantId مرتب شده‌اند.
    for (const row of order.reservations) {
      const item = order.items.find(line => line.variantId === row.variantId);
      if (!item || item.quantity !== row.quantity || row.quantity <= 0) {
        throw new AppError("تعداد یا مشخصات کالای رزروشده معتبر نیست.", 409);
      }

      const updated = await tx.$executeRaw`
        UPDATE "ProductVariant"
        SET "stock" = "stock" - ${row.quantity}, "updatedAt" = NOW()
        WHERE "id" = ${row.variantId}
          AND "isActive" = true
          AND "stock" - "reservedStock" >= ${row.quantity}
      `;

      if (updated !== 1) {
        throw new AppError(
          `تأمین ${item.productName} با وزن ${item.weight.toString()} گرم ممکن نیست.`,
          409,
        );
      }
    }

    await preparePaidOrder(tx, order, paidAt, now);
    await audit("ORDER_REVIEW_APPROVED", {});
    return { status: "PREPARING", refundedAt: null };
  });
}

router.post("/approve", validate(approveSchema), async (req, res) => {
  const data = await reviewOrder(String(req.params.id), res.locals.auth.userId, {
    type: "approve",
    paymentId: req.body.paymentId,
  });
  res.set("Cache-Control", "no-store").json({ status: "success", data });
});

router.post("/refund/request", validate(requestRefundSchema), async (req, res) => {
  const data = await reviewOrder(String(req.params.id), res.locals.auth.userId, {
    type: "requestRefund",
    paymentId: req.body.paymentId,
    reason: req.body.reason,
  });
  res.set("Cache-Control", "no-store").json({ status: "success", data });
});

router.post("/refund/complete", validate(completeRefundSchema), async (req, res) => {
  const data = await reviewOrder(String(req.params.id), res.locals.auth.userId, {
    type: "completeRefund",
    paymentId: req.body.paymentId,
    refundRefId: req.body.refundRefId,
  });
  res.set("Cache-Control", "no-store").json({ status: "success", data });
});

export default router;