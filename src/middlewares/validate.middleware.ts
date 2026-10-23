
import type { RequestHandler } from "express";
import type { ZodType } from "zod";

export function validate(schema: ZodType): RequestHandler {
  return (req, res, next) => {
    const body = req.body ?? {};
    const result = schema.safeParse(body);

    if (!result.success) {
      res.status(400).json({
        status: "error",
        message: "اطلاعات واردشده معتبر نیست.",
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });

      return;
    }

    req.body = result.data;
    next();
  };
}
