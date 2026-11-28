import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middlewares/validate.middleware.js";
import { AppError } from "../utils/app-error.js";
import { OrderStatus } from "../generated/prisma/client.js";
import { validateQuery } from "../middlewares/validate-query.middleware.js";
import adminOrderReviewRoutes from "./admin-order-review.routes.js";

const router = Router();
router.use("/:id", adminOrderReviewRoutes);

const positiveIntQuery = z.string().trim()
  .transform(value => value
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))))
  .pipe(z.string().regex(/^\d+$/))
  .transform(Number)
  .pipe(z.number().int().min(1).max(2_147_483_647));

const listOrdersQuery = z.object({
  page: positiveIntQuery.default(1),
  limit: positiveIntQuery.pipe(z.number().max(100)).default(20),
  status: z.enum(OrderStatus).optional(),
  orderNumber: positiveIntQuery.optional(),
});

router.get("/", validateQuery(listOrdersQuery), async (_req, res) => {
  const { page, limit, status, orderNumber } =
    res.locals.query as z.infer<typeof listOrdersQuery>;

  const where = {
    ...(status && { status }),
    ...(orderNumber && { orderNumber }),
  };

  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { orderNumber: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        recipientName: true,
        totalAmount: true,
        totalWeight: true,
        createdAt: true,
        paidAt: true,
        shippedAt: true,
      },
    }),
    prisma.order.count({ where }),
  ], { isolationLevel: "RepeatableRead" });

  res.set("Cache-Control", "private, no-store").json({
    status: "success",
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

router.get("/:id", async (req, res) => {
  res.set("Cache-Control", "private, no-store");

  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      user: {
        select: { fullName: true, mobile: true },
      },
      recipientName: true,
      recipientMobile: true,
      province: true,
      city: true,
      address: true,
      postalCode: true,

      totalWeight: true,
      goldPricePerGram: true,
      itemsTotal: true,
      discountTotal: true,
      shippingCost: true,
      totalAmount: true,

      paidAt: true,
      shippedAt: true,
      trackingCode: true,
      reservationExpiresAt: true,
      stockCommittedAt: true,
      stockReleasedAt: true,
      cancelledAt: true,
      cancelReason: true,
      refundPending: true,
      refundedAt: true,

      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          productName: true,
          karat: true,
          weight: true,
          quantity: true,
          originalUnitPrice: true,
          unitPrice: true,
        },
      },

      payments: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          gateway: true,
          amount: true,
          status: true,
          refId: true,
          refundRequestedAt: true,
          refundRefId: true,
          failureReason: true,
          createdAt: true,
          paidAt: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError("سفارش پیدا نشد.", 404);
  }

  res.json({ status: "success", data: order });
});

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