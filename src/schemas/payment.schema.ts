import { z } from "zod";

export const createPaymentSchema = z.object({
  orderId: z.string().trim().min(1, "شناسه سفارش معتبر نیست."),
});

export const mockPaymentCallbackSchema = z.object({
  outcome: z.enum(["success", "failed"]),
});

export type CreatePaymentInput = z.infer<
  typeof createPaymentSchema
>;

export type MockPaymentCallbackInput = z.infer<
  typeof mockPaymentCallbackSchema
>;