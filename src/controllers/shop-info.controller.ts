import type { RequestHandler } from "express";
import {
  getShopInfo,
  getShopInfoForAdmin,
  saveShopInfo,
} from "../services/shop-info.service.js";

export const getPublicShopInfo: RequestHandler = async (_req, res, next) => {
  try {
    const info = await getShopInfo();

    res.status(200).json({ status: "success", data: info });
  } catch (error) {
    next(error);
  }
};

export const getAdminShopInfo: RequestHandler = async (_req, res, next) => {
  try {
    const info = await getShopInfoForAdmin();

    res.status(200).json({ status: "success", data: info });
  } catch (error) {
    next(error);
  }
};

export const updateAdminShopInfo: RequestHandler = async (req, res, next) => {
  try {
    await saveShopInfo(req.body);

    const info = await getShopInfoForAdmin();

    res.status(200).json({
      status: "success",
      message: "اطلاعات فروشگاه ذخیره شد",
      data: info,
    });
  } catch (error) {
    next(error);
  }
};