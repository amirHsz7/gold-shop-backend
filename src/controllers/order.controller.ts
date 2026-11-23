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

    const data = await createOrder({
      userId: userIdOf(res),
      idempotencyKey,
      input: req.body,
    });

    res.set("Cache-Control", "no-store");
    res.status(201).json({
      status: "success",
      data,
    });
  } catch (error) {
    next(error);
  }
};