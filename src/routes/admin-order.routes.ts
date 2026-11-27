import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middlewares/validate.middleware.js";
import { AppError } from "../utils/app-error.js";

const router = Router();

const shipSchema = z.object({
  trackingCode: z.string().trim().min(1),
}).strict();

router.patch("/:id/ship", validate(shipSchema), async (req, res) => {
  const id = String(req.params.id);
  const { trackingCode } = req.body as z.infer<typeof shipSchema>;

  const data = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id, status: "PREPARING" },
      data: {
        status: "SHIPPED",
        shippedAt: new Date(),
        trackingCode,
      },
    });

    const order = await tx.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        trackingCode: true,
        shippedAt: true,
        user: { select: { mobile: true } },
      },
    });

    if (!order) {
      throw new AppError("سفارش پیدا نشد.", 404);
    }

    const { user, ...shipment } = order;

    if (updated.count === 0) {
      if (order.status === "SHIPPED" && order.trackingCode === trackingCode) {
        return shipment;
      }

      throw new AppError(
        "ثبت ارسال با وضعیت فعلی سفارش یا کد رهگیری آن سازگار نیست.",
        409,
      );
    }

    await tx.smsLog.create({
      data: {
        orderId: id,
        type: "ORDER_SHIPPED_CUSTOMER",
        recipient: user.mobile,
        text: `سفارش ${order.orderNumber} برای شما ارسال شد.`,
      },
    });

    return shipment;
  });

  res.json({ status: "success", data });
});

export default router;