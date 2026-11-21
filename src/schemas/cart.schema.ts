import { z } from "zod";

const quantity = z
  .number("تعداد باید عدد باشد")
  .int("تعداد باید عدد صحیح باشد")
  .min(1, "تعداد باید حداقل ۱ باشد")
  .max(99, "تعداد نمی‌تواند بیشتر از ۹۹ باشد");

export const addCartItemSchema = z.object({
  variantId: z.string().trim().min(1, "وزن انتخاب نشده است"),
  quantity: quantity.default(1),
});

export const updateCartItemSchema = z.object({
  quantity,
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;