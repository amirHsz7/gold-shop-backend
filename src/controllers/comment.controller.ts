import type { RequestHandler } from "express";
import {
  createComment,
  listProductComments,
} from "../services/comment.service.js";

export const getProductComments: RequestHandler = async (req, res, next) => {
  try {
    const result = await listProductComments(
      String(req.params.slug),
      res.locals.query,
    );

    if (!result) {
      res.status(404).json({ status: "error", message: "محصول پیدا نشد" });
      return;
    }

    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
};

export const createProductComment: RequestHandler = async (req, res, next) => {
  try {
    // این مقدار را middleware احراز هویت باید ست کند (توضیحش پایین‌تر هست)
    const userId = res.locals.auth?.userId as string | undefined;
    
    if (!userId) {
      res.status(401).json({ status: "error", message: "ابتدا وارد شوید" });
      return;
    }

    const result = await createComment(
      userId,
      String(req.params.slug),
      req.body,
    );

    if (!result.ok) {
      const errors = {
        PRODUCT_NOT_FOUND: { code: 404, message: "محصول پیدا نشد" },
        PARENT_NOT_FOUND: {
          code: 400,
          message: "نظری که می‌خواهید به آن پاسخ دهید معتبر نیست",
        },
        RATING_ON_REPLY: {
          code: 400,
          message: "برای پاسخ نمی‌توان امتیاز ثبت کرد",
        },
        ALREADY_RATED: {
          code: 409,
          message: "شما قبلاً برای این محصول امتیاز ثبت کرده‌اید",
        },
      } as const;

      const error = errors[result.reason];

      res.status(error.code).json({ status: "error", message: error.message });
      return;
    }

    const isPending = result.comment.status === "PENDING";

    res.status(201).json({
      status: "success",
      message: isPending
        ? "نظر شما ثبت شد و پس از تأیید نمایش داده می‌شود"
        : "نظر شما ثبت شد",
      data: result.comment,
    });
  } catch (error) {
    next(error);
  }
};