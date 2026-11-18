import type { RequestHandler } from "express";
import {
  getPricingSettings,
  savePricingSettings,
} from "../services/pricing-settings.service.js";

// عمومی: فرانت برای محاسبه‌ی قیمت نمایشی لازم دارد (updatedAt را بیرون نمی‌دهیم)
export const getPublicPricingSettings: RequestHandler = async (_req, res, next) => {
  try {
    const { sellerProfitPercent, vatPercent } = await getPricingSettings();

    res.status(200).json({
      status: "success",
      data: { sellerProfitPercent, vatPercent },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminPricingSettings: RequestHandler = async (_req, res, next) => {
  try {
    const settings = await getPricingSettings();

    res.status(200).json({ status: "success", data: settings });
  } catch (error) {
    next(error);
  }
};

export const updateAdminPricingSettings: RequestHandler = async (req, res, next) => {
  try {
    await savePricingSettings(req.body);

    const settings = await getPricingSettings();

    res.status(200).json({
      status: "success",
      message: "تنظیمات قیمت‌گذاری ذخیره شد",
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};