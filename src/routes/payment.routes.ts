import { Router } from "express";
import { createPaymentController } from "../controllers/payment.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createPaymentSchema } from "../schemas/payment.schema.js";

const router = Router();

router.post(
  "/",
  validate(createPaymentSchema),
  createPaymentController,
);

export default router;