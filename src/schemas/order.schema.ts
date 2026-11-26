import { z } from "zod";
import { shippingAddressSchema } from "./address.schema.js";

export const createOrderSchema = z
  .object({
    addressId: z
      .string()
      .trim()
      .min(1, "آدرس را انتخاب کنید")
      .optional(),

    shippingAddress: shippingAddressSchema.optional(),

    recipientName: z
      .string()
      .trim()
      .min(3, "نام گیرنده باید حداقل ۳ کاراکتر باشد")
      .max(100, "نام گیرنده نمی‌تواند بیشتر از ۱۰۰ کاراکتر باشد"),

    recipientMobile: z
      .string()
      .trim()
      .regex(/^09\d{9}$/, "شماره موبایل گیرنده معتبر نیست"),

    expectedTotalAmount: z.number().int().nonnegative(),
  })
  .refine(
    (input) => Boolean(input.addressId) !== Boolean(input.shippingAddress),
    {
      path: ["shippingAddress"],
      message: "یک آدرس ذخیره‌شده یا آدرس ارسال سفارش را مشخص کنید.",
    },
  );

export type CreateOrderInput = z.infer<typeof createOrderSchema>;