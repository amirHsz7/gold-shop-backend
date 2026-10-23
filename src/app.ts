
import "dotenv/config";
import express from "express";
import healthRoutes from "./routes/health.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { notFoundHandler } from "./middlewares/not-found.middleware.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";

const app = express();

app.use(express.json());

app.use("/health", healthRoutes);

app.use("/auth", authRoutes);

app.use("/users", userRoutes);

// Handle unknown routes
app.use(notFoundHandler);

// Error handling middleware must be registered last.
app.use(errorHandler);

export default app;
