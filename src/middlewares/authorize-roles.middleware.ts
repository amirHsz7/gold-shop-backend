import type { RequestHandler } from "express";
import type { UserRole } from "../generated/prisma/client.js";

export function authorizeRoles(
  ...allowedRoles: UserRole[]
): RequestHandler {
  return (_req, res, next) => {
    const auth = res.locals.auth as
      | { userId: string; role: UserRole }
      | undefined;

    if (!auth) {
      res.status(401).json({
        status: "error",
        message: "ابتدا وارد حساب کاربری شوید.",
      });
      return;
    }

    if (!allowedRoles.includes(auth.role)) {
      res.status(403).json({
        status: "error",
        message: "شما اجازه دسترسی به این بخش را ندارید.",
      });
      return;
    }

    next();
  };
}