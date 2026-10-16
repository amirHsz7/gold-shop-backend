import "dotenv/config";
import express from "express";
import { prisma } from "./lib/prisma.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("Database connection failed:", error);

    res.status(500).json({
      status: "error",
      database: "disconnected",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});