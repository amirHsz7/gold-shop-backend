import { z } from "zod";

export const createPaymentSchema = z.object({
  orderId: z.string().trim().min(1, "شناسه سفارش معتبر نیست."),
});

export type CreatePaymentInput = z.infer<
  typeof createPaymentSchema
>;