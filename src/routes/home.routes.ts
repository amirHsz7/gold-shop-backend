import { Router } from "express";
import { getHomePage } from "../controllers/home.controller.js";

const router = Router();

router.get("/", getHomePage);

export default router;