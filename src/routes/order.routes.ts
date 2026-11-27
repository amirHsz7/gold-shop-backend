import { Router } from "express";
import { createOrderController } from "../controllers/order.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createOrderSchema } from "../schemas/order.schema.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";

const router = Router();

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