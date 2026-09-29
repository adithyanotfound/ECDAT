/**
 * Prisma 7 singleton client — uses @prisma/adapter-pg (plain TCP over the pooler).
 * For Next.js dev hot-reload, the instance is stored on globalThis to avoid
 * spawning a new pool on every module re-evaluation.
 *
 * Import path: src/generated/prisma/client (required by Prisma 7's explicit output).
 * Run `npx prisma generate` after any schema change.
 *
 * Construction is lazy (behind a Proxy) so importing this module never throws
 * — Next's build-time "Collecting page data" step imports every route module
 * without invoking it, and `next build` must succeed with no DATABASE_URL set
 * (IMPLEMENTATION_PLAN.md §Phase 5 "CI running ... next build"). The clear
 * "DATABASE_URL is not set" error still fires, just on first real query
 * instead of on import.
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

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
