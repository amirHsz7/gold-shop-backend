import "dotenv/config";
import { disconnectDatabase } from "../src/lib/prisma.js";
import { ensureHomeSections } from "./home-sections.js";

ensureHomeSections()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);