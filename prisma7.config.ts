import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    // Use the direct (non-pooled) URL for CLI operations (prisma migrate).
    // At runtime the app uses DATABASE_URL (pooled); CLI ops use DIRECT_URL.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"]!,
  },
});
