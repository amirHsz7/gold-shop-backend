import type { RequestHandler } from "express";
import { getHome } from "../services/home.service.js";

export const getHomePage: RequestHandler = async (_req, res, next) => {
  try {
    const data = await getHome();

    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};