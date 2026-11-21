import type { RequestHandler } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { prisma } from "../lib/prisma.js";

export const authMiddleware: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      res.status(401).json({
        status: "error",
        message: "برای دسترسی به این بخش باید وارد حساب شوید.",
      });
      return;
    }

    const token = authorization.slice("Bearer ".length);
    const payload = await verifyAccessToken(token);

    if (!payload) {
      res.status(401).json({
        status: "error",
        message: "توکن نامعتبر یا منقضی شده است.",
      });
      return;
    }

    // نقش را از دیتابیس می‌خوانیم، نه از توکن؛ تا تغییر نقش یا حذف کاربر
    // همان لحظه اعمال شود و توکن قدیمی دسترسی ادمین باقی نگذارد.
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true },
    });

    if (!user) {
      res.status(401).json({
        status: "error",
        message: "توکن نامعتبر یا منقضی شده است.",
      });
      return;
    }

    res.locals.auth = { userId: user.id, role: user.role };

    next();
  } catch (error) {
    next(error);
  }
};