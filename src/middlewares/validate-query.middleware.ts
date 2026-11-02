import type { RequestHandler } from "express";
import type { ZodType } from "zod";

export function validateQuery(schema: ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      res.status(400).json({
        status: "error",
        message: "پارامترهای درخواست معتبر نیست",
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });

      return;
    }

    res.locals.query = result.data;
    next();
  };
}