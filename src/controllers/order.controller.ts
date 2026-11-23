import type { RequestHandler } from "express";
import { createOrder } from "../services/order.service.js";

const userIdOf = (res: Parameters<RequestHandler>[1]) =>
  res.locals.auth.userId as string;

export const createOrderController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const idempotencyKey = req.get("Idempotency-Key");

    if (!idempotencyKey) {
      res.status(400).json({
        status: "error",
        message: "کلید یکتای درخواست ارسال نشده است.",
      });
      return;
    }

    const order = await createOrder({
    userId: userIdOf(res),
    idempotencyKey,
    input: req.body,
    });

    const data = {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    totalAmount: order.totalAmount.toString(),
    shippingCost: order.shippingCost.toString(),
    freeShipping: order.freeShipping,
    totalWeight: order.totalWeight.toString(),
    reservationExpiresAt: order.reservationExpiresAt,
    items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        productSlug: item.productSlug,
        imageKey: item.imageKey,
        weight: item.weight.toString(),
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        originalUnitPrice: item.originalUnitPrice.toString(),
        discountPercent: item.discountPercent.toString(),
    })),
    };

    res.set("Cache-Control", "no-store");

    res.status(201).json({
        status: "success",
        data,
    });
  } catch (error) {
    next(error);
  }
};