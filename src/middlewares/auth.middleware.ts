import type { RequestHandler } from "express";
import { verifyAccessToken } from "../utils/jwt.js";

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

    res.locals.auth = payload;

    next();
  } catch (error) {
    next(error);
  }
};