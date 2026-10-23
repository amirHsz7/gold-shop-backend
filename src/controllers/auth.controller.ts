
import type { RequestHandler } from "express";
import { requestOtp, verifyOtp } from "../services/auth.service.js";
import { signAccessToken } from "../utils/jwt.js";

export const register: RequestHandler = async (req, res, next) => {
  try {
    const { fullName, mobile } = req.body;

    const result = await requestOtp({
      mobile,
      fullName,
      purpose: "REGISTER",
    });

    res.status(200).json({
      status: "success",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const { mobile } = req.body;

    const result = await requestOtp({
      mobile,
      purpose: "LOGIN",
    });

    res.status(200).json({
      status: "success",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyOtpController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const result = await verifyOtp(req.body);

    const accessToken = await signAccessToken({
      userId: result.user.id,
      role: result.user.role,
    });

    res.status(200).json({
      status: "success",
      message: "کد تأیید با موفقیت تأیید شد.",
      data: {
        user: result.user,
        accessToken,
        tokenType: "Bearer",
      },
    });
  } catch (error) {
    next(error);
  }
};