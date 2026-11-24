import type { RequestHandler } from "express";
import { createPaymentForOrder } from "../services/payment.service.js";

const userIdOf = (res: Parameters<RequestHandler>[1]) =>
  res.locals.auth.userId as string;

export const createPaymentController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const { orderId } = req.body;

    const payment = await createPaymentForOrder({
      userId: userIdOf(res),
      orderId,
    });

    res.set("Cache-Control", "no-store");

    res.status(201).json({
      status: "success",
      data: {
        id: payment.id,
        orderId: payment.orderId,
        amount: payment.amount.toString(),
        status: payment.status,
        gateway: payment.gateway,
        checkoutUrl: payment.checkoutUrl,
        expiresAt: payment.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
};