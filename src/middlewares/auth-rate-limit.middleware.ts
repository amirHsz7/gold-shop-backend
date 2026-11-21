import rateLimit from "express-rate-limit";
import type { Request } from "express";

function tooMany(message: string) {
  return { status: "error", message };
}

// کلید محدودیت بر اساس شماره موبایل (قبل از این باید validate اجرا شده باشد)
function mobileKey(req: Request): string {
  const mobile = (req.body as { mobile?: unknown } | undefined)?.mobile;
  return typeof mobile === "string" ? mobile : "no-mobile";
}

// درخواست ارسال کد (ثبت‌نام و ورود): هر IP در ۱۵ دقیقه ۱۰ بار
export const otpRequestIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany("تعداد درخواست‌های ارسال کد زیاد است. لطفاً بعداً تلاش کنید."),
});

// درخواست ارسال کد: هر شماره در ۲۴ ساعت ۱۰ بار
export const otpRequestMobileLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: mobileKey,
  message: tooMany("تعداد درخواست کد برای این شماره امروز به سقف رسیده است."),
});

// بررسی کد: هر IP در ۱۵ دقیقه ۳۰ بار
export const otpVerifyIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany("تعداد تلاش‌ها زیاد است. لطفاً بعداً تلاش کنید."),
});