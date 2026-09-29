/**
 * Route-handler guards. Every API route that reads or changes a user's data
 * goes through one of these, so "who is asking" and "do they own it" are
 * answered the same way everywhere.
 *
 * The proxy (src/proxy.ts) already turns away requests without a valid
 * session, but handlers check again: the proxy can be misconfigured, and a
 * valid session alone never grants access to another user's repository.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { requireSession, type SessionPayload } from "./session";

export const unauthorized = () => NextResponse.json({ error: "Please sign in again." }, { status: 401 });
export const notFound = (what = "Not found") => NextResponse.json({ error: what }, { status: 404 });

/** The signed-in user, or a ready-made 401 response. */
export async function sessionOr401(): Promise<SessionPayload | NextResponse> {
  try {
    return await requireSession();
  } catch {
    return unauthorized();
  }
}

/** True when an error came from a missing or invalid session. */
export function isAuthError(err: unknown): boolean {
  return err instanceof Error && err.message === "Unauthorized";
}

/**
 * Loads a repository only if the signed-in user owns it. Returns 404 (not 403)
 * for someone else's repository, so ids can't be probed for existence.
 */
export async function ownedRepositoryOr404(session: SessionPayload, id: string) {
  const repo = await prisma.repository.findFirst({ where: { id, owner: session.login } });
  return repo ?? notFound("Repository not found");
}

/** Loads a scan only if its repository belongs to the signed-in user. */
export async function ownedScanOr404(session: SessionPayload, id: string) {
  const scan = await prisma.scan.findFirst({
    where: { id, repository: { owner: session.login } },
    select: { id: true, repositoryId: true },
  });
  return scan ?? notFound("Scan not found");
}

/**
 * Reads ?page and ?pageSize, clamped to sane bounds so a crafted query can't
 * ask the database for an unbounded page.
 */
export function paging(params: URLSearchParams, defaultSize = 10, maxSize = 100) {
  const page = Math.max(1, Math.floor(Number(params.get("page")) || 1));
  const size = Math.floor(Number(params.get("pageSize")) || defaultSize);
  return { page, pageSize: Math.min(Math.max(1, size), maxSize) };
}

/** A value safe to put inside a Content-Disposition filename. */
export function safeFilename(name: string): string {
  return (
    name
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "export"
  );
}
