import type { RequestHandler } from "express";
import {
  getProductBySlug,
  listCategories,
  listCollections,
  listProducts,
} from "../services/product.service.js";

export const getProducts: RequestHandler = async (_req, res, next) => {
  try {
    const result = await listProducts(res.locals.query);

    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
};

export const getProduct: RequestHandler = async (req, res, next) => {
  try {
    const product = await getProductBySlug(String(req.params.slug));

    if (!product) {
      res.status(404).json({ status: "error", message: "محصول پیدا نشد" });
      return;
    }

    res.status(200).json({ status: "success", data: product });
  } catch (error) {
    next(error);
  }
};

export const getCategories: RequestHandler = async (_req, res, next) => {
  try {
    const categories = await listCategories();

    res.status(200).json({ status: "success", data: categories });
  } catch (error) {
    next(error);
  }
};

export const getCollections: RequestHandler = async (_req, res, next) => {
  try {
    const collections = await listCollections();

    res.status(200).json({ status: "success", data: collections });
  } catch (error) {
    next(error);
  }
};