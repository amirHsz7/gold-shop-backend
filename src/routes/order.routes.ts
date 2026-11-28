import { Router } from "express";
import { createOrderController } from "../controllers/order.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createOrderSchema } from "../schemas/order.schema.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { z } from "zod";
import { validateQuery } from "../middlewares/validate-query.middleware.js";

const router = Router();

const listMyOrdersQuery = z.object({
  page: z.string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().max(2_147_483_647))
    .default(1),

  limit: z.string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().max(100))
    .default(20),
}).strict();

router.get("/", validateQuery(listMyOrdersQuery), async (_req, res) => {
  const { page, limit } = res.locals.query as z.infer<typeof listMyOrdersQuery>;
  const where = { userId: res.locals.auth.userId as string };

  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { orderNumber: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        paidAt: true,
        shippedAt: true,
        trackingCode: true,
        refundPending: true,
        refundedAt: true,
      },
    }),
    prisma.order.count({ where }),
  ], { isolationLevel: "RepeatableRead" });

  const items = orders.map(order => ({
    ...order,
    canViewInvoice:
      order.paidAt !== null &&
      (order.status === "PREPARING" || order.status === "SHIPPED"),
  }));

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

router.post(
  "/",
  validate(createOrderSchema),
  createOrderController,
);

router.get("/:id/invoice", async (req, res) => {
  res.set("Cache-Control", "private, no-store");

  const invoice = await prisma.order.findFirst({
    where: {
      id: req.params.id,
      userId: res.locals.auth.userId,
      status: { in: ["PREPARING", "SHIPPED"] },
      paidAt: { not: null },
    },
    select: {
      orderNumber: true,
      paidAt: true,
      recipientName: true,
      recipientMobile: true,
      province: true,
      city: true,
      address: true,
      postalCode: true,
      goldPricePerGram: true,
      totalWeight: true,
      itemsTotal: true,
      discountTotal: true,
      shippingCost: true,
      totalAmount: true,
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
          discountPercent: true,
          breakdown: true,
        },
      },
    },
  });

  if (!invoice) {
    throw new AppError("فاکتور در دسترس نیست.", 404);
  }

  res.json({ status: "success", data: invoice });
});

export default router;