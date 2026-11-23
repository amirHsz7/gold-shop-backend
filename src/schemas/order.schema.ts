import { z } from "zod";

export const createOrderSchema = z.object({
  addressId: z
    .string()
    .trim()
    .min(1, "آدرس را انتخاب کنید"),

  recipientName: z
    .string()
    .trim()
    .min(3, "نام گیرنده باید حداقل ۳ کاراکتر باشد")
    .max(100, "نام گیرنده نمی‌تواند بیشتر از ۱۰۰ کاراکتر باشد"),

  recipientMobile: z
    .string()
    .trim()
    .regex(/^09\d{9}$/, "شماره موبایل گیرنده معتبر نیست"),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;