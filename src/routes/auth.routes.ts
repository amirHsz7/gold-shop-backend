
import { Router } from "express";
import { validate } from "../middlewares/validate.middleware.js";
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
  validate(registerSchema),
  register,
);

// Login
router.post(
  "/login",
  validate(loginSchema),
  login,
);

// Verify OTP - Controller will be added later
router.post(
  "/verify-otp",
  validate(verifyOtpSchema),
  verifyOtpController,
);

export default router;
