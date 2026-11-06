import { z } from "zod";
import { mobileSchema } from "./auth.schema.js";

export const createContactSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "نام کامل باید حداقل ۳ کاراکتر باشد")
    .max(100, "نام کامل نمی‌تواند بیشتر از ۱۰۰ کاراکتر باشد"),

  mobile: mobileSchema,

  email: z.string().trim().email("ایمیل معتبر نیست").optional(),

  subject: z
    .string()
    .trim()
    .min(3, "موضوع باید حداقل ۳ کاراکتر باشد")
    .max(150, "موضوع نمی‌تواند بیشتر از ۱۵۰ کاراکتر باشد"),

  message: z
    .string()
    .trim()
    .min(10, "پیام باید حداقل ۱۰ کاراکتر باشد")
    .max(2000, "پیام نمی‌تواند بیشتر از ۲۰۰۰ کاراکتر باشد"),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;