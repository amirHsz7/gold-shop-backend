import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorize-roles.middleware.js";

const router = Router();

router.get("/me", authMiddleware, (_req, res) => {
  const auth = res.locals.auth as {
    userId: string;
    role: "CUSTOMER" | "ADMIN";
  };

  res.status(200).json({
    status: "success",
    data: {
      userId: auth.userId,
      role: auth.role,
    },
  });
});

router.get(
  "/admin-test",
  authMiddleware,
  authorizeRoles("ADMIN"),
  (_req, res) => {
    res.status(200).json({
      status: "success",
      message: "دسترسی ادمین تأیید شد.",
    });
  },
);

export default router;