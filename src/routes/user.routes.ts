import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorize-roles.middleware.js";

const router = Router();

router.get("/me", authMiddleware, async (_req, res, next) => {
  try {
    const auth = res.locals.auth as {
      userId: string;
      role: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN";
    };

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { fullName: true, mobile: true },
    });

    res.status(200).json({
      status: "success",
      data: {
        userId: auth.userId,
        role: auth.role,
        fullName: user?.fullName ?? "",
        mobile: user?.mobile ?? "",
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get(
  "/admin-test",
  authMiddleware,
  authorizeRoles("ADMIN", "SUPER_ADMIN"),
  (_req, res) => {
    res.status(200).json({
      status: "success",
      message: "دسترسی ادمین تأیید شد.",
    });
  },
);

export default router;