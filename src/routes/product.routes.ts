import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { validateQuery } from "../middlewares/validate-query.middleware.js";
import { listProductsQuerySchema } from "../schemas/product.schema.js";
import {
  createCommentSchema,
  listCommentsQuerySchema,
} from "../schemas/comment.schema.js";
import { getProduct, getProducts } from "../controllers/product.controller.js";
import {
  createProductComment,
  getProductComments,
} from "../controllers/comment.controller.js";

const router = Router();

const commentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "تعداد درخواست‌ها زیاد است. لطفاً بعداً تلاش کنید",
  },
});

router.get("/", validateQuery(listProductsQuerySchema), getProducts);
router.get("/:slug", getProduct);

router.get(
  "/:slug/comments",
  validateQuery(listCommentsQuerySchema),
  getProductComments,
);

router.post(
  "/:slug/comments",
  authMiddleware,
  commentLimiter,
  validate(createCommentSchema),
  createProductComment,
);

export default router;