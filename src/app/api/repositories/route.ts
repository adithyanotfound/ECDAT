/**
 * GET  /api/repositories         — list all repositories
 * POST /api/repositories         — create an AWS data source
 *
 * POST body (JSON):
 * {
 *   accessKeyId:     string;  // AWS Access Key ID
 *   secretAccessKey: string;  // AWS Secret Access Key (encrypted at rest)
 *   region:          string;  // e.g. "us-east-1"
 *   name:            string;  // CodeCommit repo name OR s3://<bucket>/<key>
 *   displayName?:    string;  // optional human label
 *   defaultBranch?:  string;  // default "main"
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { getRepositories } from "@/server/db/scanning";
import { encryptSecret } from "@/server/aws/credentials";
import { requireSession } from "@/server/auth/session";
import { repositories as fixtureRepos } from "@/fixtures/repositories";

const AwsRepoSchema = z.object({
  accessKeyId: z.string().min(16).max(128),
  secretAccessKey: z.string().min(20).max(512),
  region: z.string().min(1).max(64),
  name: z.string().min(1).max(512),
  defaultBranch: z.string().max(128).optional().default("main"),
});

export async function GET() {
  try {
    const data = await getRepositories();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(fixtureRepos);
  }
}

export async function POST(req: NextRequest) {
  // Authenticate — AWS repos are scoped to the logged-in user just like GitHub repos
  let session: Awaited<ReturnType<typeof requireSession>>;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AwsRepoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const { accessKeyId, secretAccessKey, region, name, defaultBranch } = parsed.data;

  // Encrypt the secret key before persisting
  let encryptedSecret: string;
  try {
    encryptedSecret = encryptSecret(secretAccessKey);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Credential encryption failed. Make sure CREDENTIAL_ENCRYPTION_KEY is set in your environment.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }

  // Build a unique fullName for the AWS source:
  // Format: aws/<region>/<name>
  const fullName = `aws/${region}/${name}`;

  // Check for duplicate
  const existing = await prisma.repository.findUnique({ where: { fullName } });
  if (existing) {
    return NextResponse.json(
      { error: `AWS data source '${fullName}' already exists`, repositoryId: existing.id },
      { status: 409 }
    );
  }

  try {
    const repo = await prisma.repository.create({
      data: {
        sourceType: "AWS",
        fullName,
        // Store owner as the session login so existing owner-scoped DB queries include this repo
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
      { status: 201 }
    );
  } catch (err) {
    console.error("[aws-repo] create error:", err);
    return NextResponse.json({ error: "Failed to create AWS data source" }, { status: 500 });
  }
}
