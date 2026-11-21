import { Router } from "express";
import { validate } from "../middlewares/validate.middleware.js";
import { addressSchema } from "../schemas/address.schema.js";
import {
  createAddressController,
  deleteAddressController,
  listAddressesController,
  updateAddressController,
} from "../controllers/address.controller.js";

const router = Router();

router.get("/", listAddressesController);
router.post("/", validate(addressSchema), createAddressController);
router.patch("/:id", validate(addressSchema), updateAddressController);
router.delete("/:id", deleteAddressController);

export default router;