import type { RequestHandler } from "express";

export const superAdminMiddleware: RequestHandler = (_req, res, next) => {
  if (res.locals.auth?.role !== "SUPER_ADMIN") {
    res.status(403).json({
      status: "error",
      message: "فقط مدیر ارشد به این بخش دسترسی دارد.",
    });
    return;
  }

  next();
};