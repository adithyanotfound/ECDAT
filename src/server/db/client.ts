/**
 * Prisma 7 singleton client — uses @prisma/adapter-pg (plain TCP over the pooler).
 * For Next.js dev hot-reload, the instance is stored on globalThis to avoid
 * spawning a new pool on every module re-evaluation.
 *
 * Import path: src/generated/prisma/client (required by Prisma 7's explicit output).
 * Run `npx prisma generate` after any schema change.
 */
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local and restart the dev server."
    );
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["warn", "error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
