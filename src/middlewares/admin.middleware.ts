import type { RequestHandler } from "express";
import { isAdminRole } from "../utils/roles.js";

// باید بعد از authMiddleware استفاده شود
export const adminMiddleware: RequestHandler = (_req, res, next) => {
  if (!isAdminRole(res.locals.auth?.role)) {
    res.status(403).json({
      status: "error",
      message: "شما به این بخش دسترسی ندارید.",
    });
    return;
  }

  next();
};