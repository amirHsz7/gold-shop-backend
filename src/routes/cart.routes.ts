import { Router } from "express";
import { validate } from "../middlewares/validate.middleware.js";
import {
  addCartItemSchema,
  updateCartItemSchema,
} from "../schemas/cart.schema.js";
import {
  addCartItemController,
  clearCartController,
  getCartController,
  removeCartItemController,
  updateCartItemController,
} from "../controllers/cart.controller.js";

const router = Router();

router.get("/", getCartController);
router.post("/items", validate(addCartItemSchema), addCartItemController);
router.patch(
  "/items/:variantId",
  validate(updateCartItemSchema),
  updateCartItemController,
);
router.delete("/items/:variantId", removeCartItemController);
router.delete("/", clearCartController);

export default router;