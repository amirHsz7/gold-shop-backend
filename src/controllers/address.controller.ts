import type { RequestHandler } from "express";
import {
  createAddress,
  deleteAddress,
  listAddresses,
  updateAddress,
} from "../services/address.service.js";

const userIdOf = (res: Parameters<RequestHandler>[1]) =>
  res.locals.auth.userId as string;

export const listAddressesController: RequestHandler = async (
  _req,
  res,
  next,
) => {
  try {
    const data = await listAddresses(userIdOf(res));
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const createAddressController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const data = await createAddress(userIdOf(res), req.body);
    res.status(201).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const updateAddressController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const data = await updateAddress(
      userIdOf(res),
      String(req.params.id),
      req.body,
    );
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const deleteAddressController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    await deleteAddress(userIdOf(res), String(req.params.id));
    res.status(200).json({ status: "success", message: "آدرس حذف شد." });
  } catch (error) {
    next(error);
  }
};