import type { RequestHandler } from "express";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    status: "error",
    message: `مسیر ${req.originalUrl} پیدا نشد.`,
  });
};