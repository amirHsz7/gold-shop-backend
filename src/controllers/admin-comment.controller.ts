import type { RequestHandler, Response } from "express";
import { MAX_HOME_TESTIMONIALS } from "../lib/home-singletons.js";
import {
  deleteComment,
  listCommentsForAdmin,
  replyAsAdmin,
  updateComment,
} from "../services/admin-comment.service.js";

const errors = {
  NOT_FOUND: { code: 404, message: "نظر پیدا نشد" },
  SHOW_ON_HOME_ROOT_ONLY: {
    code: 400,
    message: "فقط نظر اصلی (نه پاسخ) را می‌توان در صفحه‌ی اصلی نمایش داد",
  },
  SHOW_ON_HOME_NOT_APPROVED: {
    code: 400,
    message: "فقط نظر تأییدشده را می‌توان در صفحه‌ی اصلی نمایش داد",
  },
  SHOW_ON_HOME_LIMIT: {
    code: 409,
    message: `حداکثر ${MAX_HOME_TESTIMONIALS} نظر را می‌توان هم‌زمان در صفحه‌ی اصلی نمایش داد`,
  },
  PARENT_IS_REPLY: { code: 400, message: "به پاسخ نمی‌توان پاسخ داد" },
  PARENT_NOT_APPROVED: {
    code: 400,
    message: "ابتدا نظر را تأیید کنید، سپس پاسخ دهید",
  },
} as const;

const sendError = (res: Response, reason: keyof typeof errors) => {
  const error = errors[reason];

  res.status(error.code).json({ status: "error", message: error.message });
};

export const listAdminComments: RequestHandler = async (_req, res, next) => {
  try {
    const result = await listCommentsForAdmin(res.locals.query);

    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
};

export const updateAdminComment: RequestHandler = async (req, res, next) => {
  try {
    const result = await updateComment(String(req.params.id), req.body);

    if (!result.ok) return sendError(res, result.reason);

    res.status(200).json({
      status: "success",
      message: "نظر به‌روزرسانی شد",
      data: result.comment,
    });
  } catch (error) {
    next(error);
  }
};

export const replyAdminComment: RequestHandler = async (req, res, next) => {
  try {
    const adminId = res.locals.auth?.userId as string | undefined;

    if (!adminId) {
      res.status(401).json({ status: "error", message: "ابتدا وارد شوید" });
      return;
    }

    const result = await replyAsAdmin(adminId, String(req.params.id), req.body);

    if (!result.ok) return sendError(res, result.reason);

    res.status(201).json({
      status: "success",
      message: "پاسخ ثبت شد",
      data: result.comment,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAdminComment: RequestHandler = async (req, res, next) => {
  try {
    const deleted = await deleteComment(String(req.params.id));

    if (!deleted) return sendError(res, "NOT_FOUND");

    res.status(200).json({ status: "success", message: "نظر حذف شد" });
  } catch (error) {
    next(error);
  }
};