
import app from "./app.js";
import { disconnectDatabase } from "./lib/prisma.js";

const PORT = Number(process.env.PORT) || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

let isShuttingDown = false;

function shutdown() {
  if (isShuttingDown) return;

  isShuttingDown = true;
  console.log("Shutting down server...");

  server.close(async (error) => {
    console.log("HTTP server close callback executed");

    if (error) {
      console.error("Error closing server:", error);
      process.exitCode = 1;
    }

    try {
      console.log("Closing database connections...");

      await disconnectDatabase();

      console.log("Database connections closed");
    } catch (dbError) {
      console.error("Error closing database:", dbError);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
