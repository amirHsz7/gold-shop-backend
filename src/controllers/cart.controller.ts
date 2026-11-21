import type { RequestHandler } from "express";
import {
  addCartItem,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from "../services/cart.service.js";

const userIdOf = (res: Parameters<RequestHandler>[1]) =>
  res.locals.auth.userId as string;

export const getCartController: RequestHandler = async (_req, res, next) => {
  try {
    const data = await getCart(userIdOf(res));

    // قیمت زنده است؛ نباید کش شود
    res.set("Cache-Control", "no-store");
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const addCartItemController: RequestHandler = async (req, res, next) => {
  try {
    const { variantId, quantity } = req.body;
    const data = await addCartItem(userIdOf(res), variantId, quantity);

    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const updateCartItemController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const data = await updateCartItem(
      userIdOf(res),
      String(req.params.variantId),
      req.body.quantity,
    );

    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const removeCartItemController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const data = await removeCartItem(
      userIdOf(res),
      String(req.params.variantId),
    );

    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const clearCartController: RequestHandler = async (_req, res, next) => {
  try {
    const data = await clearCart(userIdOf(res));

    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};