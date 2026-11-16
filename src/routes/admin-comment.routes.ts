import { Router } from "express";
import { validate } from "../middlewares/validate.middleware.js";
import { validateQuery } from "../middlewares/validate-query.middleware.js";
import {
  adminReplySchema,
  listAdminCommentsQuerySchema,
  updateCommentSchema,
} from "../schemas/admin-comment.schema.js";
import {
  deleteAdminComment,
  listAdminComments,
  replyAdminComment,
  updateAdminComment,
} from "../controllers/admin-comment.controller.js";

const router = Router();

router.get("/", validateQuery(listAdminCommentsQuerySchema), listAdminComments);
router.patch("/:id", validate(updateCommentSchema), updateAdminComment);
router.post("/:id/reply", validate(adminReplySchema), replyAdminComment);
router.delete("/:id", deleteAdminComment);

export default router;