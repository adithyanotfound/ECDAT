/**
 * GET  /api/repositories         — list the signed-in user's repositories
 * POST /api/repositories         — add a public GitHub repository or an AWS data source
 *
 * POST body (JSON), GitHub:
 * { sourceType: "GITHUB"; fullName: "owner/repo"; defaultBranch?: string }
 *
 * POST body (JSON), AWS:
 * {
 *   sourceType?:     "AWS";
 *   accessKeyId:     string;  // AWS Access Key ID
 *   secretAccessKey: string;  // AWS Secret Access Key (encrypted at rest)
 *   region:          string;  // e.g. "us-east-1"
 *   name:            string;  // CodeCommit repo name OR s3://<bucket>/<key>
 *   defaultBranch?:  string;  // default "main"
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { getRepositories } from "@/server/db/scanning";
import { encryptSecret } from "@/server/aws/credentials";
import { branchExists, lookupPublicRepo } from "@/server/github/publicRepo";
import { isAuthError, sessionOr401, unauthorized } from "@/server/auth/guard";
import { repositories as fixtureRepos } from "@/fixtures/repositories";

// Branch names: letters, digits and . _ / - (no "..", no leading dash), as git allows in practice.
const BRANCH = z
  .string()
  .max(128)
  .regex(/^(?!-)(?!.*\.\.)[A-Za-z0-9._/-]+$/, "Use a valid branch name, for example main.");

const AwsRepoSchema = z.object({
  sourceType: z.literal("AWS").optional(),
  accessKeyId: z.string().min(16).max(128),
  secretAccessKey: z.string().min(20).max(512),
  region: z.string().regex(/^[a-z]{2}(-gov)?-[a-z]+-\d$/, "Use an AWS region code, for example us-east-1."),
  name: z.string().min(1).max(512),
  defaultBranch: BRANCH.optional().default("main"),
});

const GithubRepoSchema = z.object({
  sourceType: z.literal("GITHUB"),
  // owner/repo exactly as GitHub allows them
  fullName: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/,
      "Use the owner/name form, for example octocat/hello-world.",
    ),
  // Optional: when left out, the repository's own default branch is used.
  defaultBranch: BRANCH.optional(),
});

export async function GET() {
  try {
    const data = await getRepositories();
    return NextResponse.json(data);
  } catch (err) {
    if (isAuthError(err)) return unauthorized();
    // Database unreachable: show the sample data so the UI still renders.
    return NextResponse.json(fixtureRepos);
  }
}

export async function POST(req: NextRequest) {
  const session = await sessionOr401();
  if (session instanceof NextResponse) return session;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sourceType = (body as { sourceType?: unknown } | null)?.sourceType;

  if (sourceType === "GITHUB") {
    const parsed = GithubRepoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed", issues: parsed.error.issues },
        { status: 422 },
      );
    }
    const [ownerName, repoName] = parsed.data.fullName.split("/") as [string, string];

    // Check with GitHub first: the repository must exist and be public (private
    // ones need the GitHub App), and the branch must be one it really has. If
    // GitHub can't be asked right now (rate limit), fall back to what was typed.
    const lookup = await lookupPublicRepo(ownerName, repoName);
    if (lookup.status === "not_found" || (lookup.status === "ok" && lookup.isPrivate)) {
      return NextResponse.json(
        {
          error: `We couldn't find ${parsed.data.fullName} on GitHub. Check the spelling. Private repositories need the GitHub App instead.`,
        },
        { status: 422 },
      );
    }
    const fullName = lookup.status === "ok" ? lookup.fullName : parsed.data.fullName;
    let defaultBranch = parsed.data.defaultBranch;
    if (lookup.status === "ok") {
      if (!defaultBranch) {
        defaultBranch = lookup.defaultBranch;
      } else if (
        defaultBranch !== lookup.defaultBranch &&
        (await branchExists(ownerName, repoName, defaultBranch)) === false
      ) {
        return NextResponse.json(
          {
            error: `${fullName} has no branch called "${defaultBranch}". Its default branch is "${lookup.defaultBranch}"; leave the branch empty to use it.`,
          },
          { status: 422 },
        );
      }
    }
    defaultBranch ??= "main";

    // Repository names are unique across the whole database. Only reveal the
    // existing record's id when it belongs to the person asking.
    const existing = await prisma.repository.findUnique({ where: { fullName } });
    if (existing) {
      return NextResponse.json(
        existing.owner === session.login
          ? { error: `You've already added ${fullName}.`, repositoryId: existing.id }
          : { error: `${fullName} is already connected by another account.` },
        { status: 409 },
      );
    }

    try {
      const repo = await prisma.repository.create({
        data: {
          sourceType: "GITHUB",
          fullName,
          owner: session.login,
          name: fullName.split("/")[1] || fullName,
          defaultBranch,
          ...(lookup.status === "ok" && lookup.language ? { language: lookup.language } : {}),
          scanEnabled: true,
        },
      });
      return NextResponse.json(repo, { status: 201 });
    } catch (err) {
      console.error("[github-repo] create error:", err instanceof Error ? err.message : String(err));
      return NextResponse.json({ error: "Failed to add the repository" }, { status: 500 });
    }
  }

  // AWS flow
  const parsed = AwsRepoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const { accessKeyId, secretAccessKey, region, name, defaultBranch } = parsed.data;

  // Encrypt the secret key before persisting
  let encryptedSecret: string;
  try {
    encryptedSecret = encryptSecret(secretAccessKey);
  } catch (err) {
    console.error("[aws-repo] encryption error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "The server can't store AWS keys safely yet. Set CREDENTIAL_ENCRYPTION_KEY and restart." },
      { status: 500 },
    );
  }

  // Build a unique fullName for the AWS source: aws/<region>/<name>
  const fullName = `aws/${region}/${name}`;

  const existing = await prisma.repository.findUnique({ where: { fullName } });
  if (existing) {
    return NextResponse.json(
      existing.owner === session.login
        ? { error: `You've already connected ${fullName}.`, repositoryId: existing.id }
        : { error: `${fullName} is already connected by another account.` },
      { status: 409 },
    );
  }

  try {
    const repo = await prisma.repository.create({
      data: {
        sourceType: "AWS",
        fullName,
        // Owner is the session login so owner-scoped queries include this source
        owner: session.login,
        name,
        defaultBranch,
        awsAccessKey: accessKeyId,
        awsSecretKey: encryptedSecret,
        awsRegion: region,
        scanEnabled: true,
        language: "AWS",
        isPrivate: true,
      },
    });

    return NextResponse.json(
      {
        id: repo.id,
        fullName: repo.fullName,
        sourceType: repo.sourceType,
        region,
        name,
        defaultBranch: repo.defaultBranch,
        createdAt: repo.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[aws-repo] create error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to create AWS data source" }, { status: 500 });
  }
}
