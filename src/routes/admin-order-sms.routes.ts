import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middlewares/validate.middleware.js";
import { ADMIN_ROLES } from "../utils/roles.js";

const router = Router();

const fields = {
  id: true,
  fullName: true,
  mobile: true,
  role: true,
  receivesOrderSms: true,
};

const settings = z.object({
  receivesOrderSms: z.boolean(),
}).strict();

router.get("/", async (_req, res) => {
  const data = await prisma.user.findMany({
    where: { role: { in: ADMIN_ROLES } },
    select: fields,
    orderBy: [{ fullName: "asc" }, { id: "asc" }],
  });

  res.set("Cache-Control", "no-store").json({ data });
});

router.patch("/:id", validate(settings), async (req, res) => {
  const result = await prisma.user.updateMany({
    where: {
      id: String(req.params.id),
      role: { in: ADMIN_ROLES },
    },
    data: {
      receivesOrderSms: req.body.receivesOrderSms,
    },
  });

  if (!result.count) {
    res.status(404).json({ message: "حساب مدیریتی پیدا نشد." });
    return;
  }

  res.status(204).end();
});

export default router;