import type { RequestHandler, Response } from "express";
import {
  createCollection,
  deleteCollection,
  deleteCollectionImage,
  getCollectionForAdmin,
  listCollectionsForAdmin,
  setCollectionImage,
  updateCollection,
} from "../services/admin-collection.service.js";

const errors = {
  NOT_FOUND: { code: 404, message: "کالکشن پیدا نشد" },
  SLUG_TAKEN: { code: 409, message: "این اسلاگ قبلاً استفاده شده است" },
  INVALID_IMAGE: { code: 400, message: "فایل ارسالی یک تصویر معتبر نیست" },
} as const;

const sendError = (res: Response, reason: keyof typeof errors) => {
  const error = errors[reason];

  res.status(error.code).json({ status: "error", message: error.message });
};

export const listAdminCollections: RequestHandler = async (
  _req,
  res,
  next,
) => {
  try {
    const collections = await listCollectionsForAdmin();

    res.status(200).json({ status: "success", data: collections });
  } catch (error) {
    next(error);
  }
};

export const getAdminCollection: RequestHandler = async (req, res, next) => {
  try {
    const collection = await getCollectionForAdmin(String(req.params.id));

    if (!collection) return sendError(res, "NOT_FOUND");

    res.status(200).json({ status: "success", data: collection });
  } catch (error) {
    next(error);
  }
};

export const createAdminCollection: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const result = await createCollection(req.body);

    if (!result.ok) return sendError(res, result.reason);

    res.status(201).json({
      status: "success",
      message: "کالکشن با موفقیت ساخته شد",
      data: result.collection,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminCollection: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const result = await updateCollection(String(req.params.id), req.body);

    if (!result.ok) return sendError(res, result.reason);

    res.status(200).json({
      status: "success",
      message: "کالکشن با موفقیت ویرایش شد",
      data: result.collection,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAdminCollection: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const result = await deleteCollection(String(req.params.id));

    if (!result.ok) return sendError(res, result.reason);

    res.status(200).json({
      status: "success",
      message: "کالکشن حذف شد",
      data: { detachedProducts: result.detachedProducts },
    });
  } catch (error) {
    next(error);
  }
};

export const setAdminCollectionImage: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    if (!req.file) {
      res
        .status(400)
        .json({ status: "error", message: "تصویری ارسال نشده است" });
      return;
    }

    const result = await setCollectionImage(
      String(req.params.id),
      req.file.buffer,
    );

    if (!result.ok) return sendError(res, result.reason);

    res.status(200).json({
      status: "success",
      message: "تصویر کالکشن ثبت شد",
      data: result.image,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAdminCollectionImage: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const found = await deleteCollectionImage(String(req.params.id));

    if (!found) return sendError(res, "NOT_FOUND");

    res.status(200).json({ status: "success", message: "تصویر حذف شد" });
  } catch (error) {
    next(error);
  }
};