import type { RequestHandler } from "express";

// باید بعد از authMiddleware استفاده شود
export const adminMiddleware: RequestHandler = (_req, res, next) => {
  if (res.locals.auth?.role !== "ADMIN") {
    res.status(403).json({
      status: "error",
      message: "شما به این بخش دسترسی ندارید.",
    });
    return;
  }

  next();
};