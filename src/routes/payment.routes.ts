import { Router } from "express";

import {
  completeMockPaymentController,
  createPaymentController,
} from "../controllers/payment.controller.js";

import { validate } from "../middlewares/validate.middleware.js";

import {
  createPaymentSchema,
  mockPaymentCallbackSchema,
} from "../schemas/payment.schema.js";

const router = Router();

// ایجاد Payment برای سفارش
router.post(
  "/",
  validate(createPaymentSchema),
  createPaymentController,
);

// تکمیل پرداخت آزمایشی
router.post(
  "/mock/:authority/complete",
  validate(mockPaymentCallbackSchema),
  completeMockPaymentController,
);

export default router;