
import { z } from "zod";

export const mobileSchema = z
  .string()
  .trim()
  .regex(/^09\d{9}$/, "شماره موبایل باید ۱۱ رقم و با 09 شروع شود");

export const requestOtpSchema = z.object({
  mobile: mobileSchema,
});

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "نام کامل باید حداقل ۳ کاراکتر باشد")
    .max(100, "نام کامل نمی‌تواند بیشتر از ۱۰۰ کاراکتر باشد"),

  mobile: mobileSchema,
});

export const loginSchema = z.object({
  mobile: mobileSchema,
});

export const verifyOtpSchema = z.object({
  mobile: mobileSchema,

  code: z
    .string()
    .regex(/^\d{6}$/, "کد تأیید باید ۶ رقم باشد"),

  purpose: z.enum(["REGISTER", "LOGIN"]),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
