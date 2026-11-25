
import app from "./app.js";
import { disconnectDatabase } from "./lib/prisma.js";
import { processExpiredReservations } from "./services/reservation-expiration.service.js";
let expirationWorkerPromise: Promise<void> | undefined;
const PORT = Number(process.env.PORT) || 3000;
const WORKER_INTERVAL_MS = 30_000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // اجرای اولیه Worker پس از آماده‌شدن سرور
  void runExpirationWorker();

  // اجرای دوره‌ای هر ۳۰ ثانیه
  expirationWorkerInterval = setInterval(() => {
    void runExpirationWorker();
  }, WORKER_INTERVAL_MS);
});

let expirationWorkerInterval: ReturnType<typeof setInterval> | undefined;
let isExpirationWorkerRunning = false;
let isShuttingDown = false;

function runExpirationWorker(): Promise<void> {
  // جلوگیری از اجرای هم‌زمان چند نسخه از Worker در همین Process
  if (isExpirationWorkerRunning || isShuttingDown) {
    return Promise.resolve();
  }

  isExpirationWorkerRunning = true;

  expirationWorkerPromise = (async () => {
    try {
      const result = await processExpiredReservations();

      if (result.scanned > 0) {
        console.log("[Reservation Worker]", result);
      }
    } catch (error) {
      console.error("[Reservation Worker] Execution failed:", error);
    } finally {
      isExpirationWorkerRunning = false;
      expirationWorkerPromise = undefined;
    }
  })();

  return expirationWorkerPromise;
}

async function shutdown() {
  if (isShuttingDown) return;

  isShuttingDown = true;
  console.log("Shutting down server...");

  // جلوگیری از اجرای مجدد Worker هنگام خاموش‌شدن
  if (expirationWorkerInterval) {
    clearInterval(expirationWorkerInterval);
    expirationWorkerInterval = undefined;
  }

  server.close(async (error) => {
    console.log("HTTP server close callback executed");

    if (error) {
      console.error("Error closing server:", error);
      process.exitCode = 1;
    }
    // منتظر پایان Worker فعال می‌مانیم.
    if (expirationWorkerPromise) {
      console.log("Waiting for reservation worker to finish...");
      await expirationWorkerPromise;
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
