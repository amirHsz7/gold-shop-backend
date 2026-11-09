
import "dotenv/config";
import express from "express";
import healthRoutes from "./routes/health.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { notFoundHandler } from "./middlewares/not-found.middleware.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";

import { storage } from "./lib/storage.js";
import { uploadSingleImage } from "./middlewares/upload.middleware.js";

import { saveImage } from "./services/image.service.js";
import productRoutes from "./routes/product.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import collectionRoutes from "./routes/collection.routes.js";
import homeRoutes from "./routes/home.routes.js";
import { authMiddleware } from "./middlewares/auth.middleware.js";
import { adminMiddleware } from "./middlewares/admin.middleware.js";

// admin
import adminProductRoutes from "./routes/admin-product.routes.js";
import adminCategoryRoutes from "./routes/admin-category.routes.js";
import adminCollectionRoutes from "./routes/admin-collection.routes.js";

const app = express();

app.use(express.json());

app.use(
  "/uploads",
  express.static(storage.root, { maxAge: "30d", immutable: true }),
);

app.use("/health", healthRoutes);

app.use("/auth", authRoutes);

app.use("/users", userRoutes);

app.use("/products", productRoutes);

app.use("/categories", categoryRoutes);

app.use("/collections", collectionRoutes);

app.use("/home", homeRoutes);

// panel admin APIs

app.use(
  "/admin/products",
  authMiddleware,
  adminMiddleware,
  adminProductRoutes,
);

app.use(
  "/admin/categories",
  authMiddleware,
  adminMiddleware,
  adminCategoryRoutes,
);


app.use(
  "/admin/collections",
  authMiddleware,
  adminMiddleware,
  adminCollectionRoutes,
);

app.post("/_test-upload", uploadSingleImage("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ status: "error", message: "تصویری ارسال نشده" });
      return;
    }
    const result = await saveImage(req.file.buffer, { folder: "test" });
    res.json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
});

// Handle unknown routes
app.use(notFoundHandler);

// Error handling middleware must be registered last.
app.use(errorHandler);

export default app;
