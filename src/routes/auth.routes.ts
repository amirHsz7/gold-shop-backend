import { Router } from "express";
import { validate } from "../middlewares/validate.middleware.js";
import {
  otpRequestIpLimiter,
  otpRequestMobileLimiter,
  otpVerifyIpLimiter,
} from "../middlewares/auth-rate-limit.middleware.js";
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
} from "../schemas/auth.schema.js";
import {
  register,
  login,
  verifyOtpController,
} from "../controllers/auth.controller.js";

const router = Router();

// Register
router.post(
  "/register",
  otpRequestIpLimiter,
  validate(registerSchema),
  otpRequestMobileLimiter,
  register,
);

// Login
router.post(
  "/login",
  otpRequestIpLimiter,
  validate(loginSchema),
  otpRequestMobileLimiter,
  login,
);

// Verify OTP
router.post(
  "/verify-otp",
  otpVerifyIpLimiter,
  validate(verifyOtpSchema),
  verifyOtpController,
);

export default router;