/**
 * AWS source adapter — downloads source code from AWS CodeCommit
 * into a temp directory with the same `Checkout` interface as `tarball.ts`.
 *
 * When a CodeCommit repo cannot be fetched (or credentials lack CodeCommit
 * access), the checkout returns an empty directory so the engine still runs
 * KMS/ACM scans rather than aborting entirely.
 *
 * Also supports S3-backed source archives: if the repository `name` matches
 * the pattern `s3://<bucket>/<key>`, the adapter downloads that object and
 * unpacks it as a .tar.gz.
 *
 * Uses @aws-sdk/client-codecommit and @aws-sdk/client-s3 v3 — latest modular SDK.
 */
import {
  CodeCommitClient,
  GetRepositoryCommand,
  GetFolderCommand,
  GetFileCommand,
} from "@aws-sdk/client-codecommit";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { createGunzip } from "zlib";
import { extract } from "tar-stream";
import { Readable } from "stream";
import type { Checkout } from "@/server/github/tarball";
import type { AwsCredentials } from "./kms";
import { safeJoin } from "@/server/security/paths";

const MAX_ARCHIVE_BYTES = 200 * 1024 * 1024; // same ceiling as GitHub tarballs

// Recursively walk a CodeCommit folder and download all files into destDir.
async function downloadFolder(
  client: CodeCommitClient,
  repoName: string,
  folderPath: string,
  destDir: string,
  commitSpecifier: string,
  log: (level: "INFO" | "WARN", msg: string) => void
): Promise<number> {
  let filesWritten = 0;

  const folder = await client.send(
    new GetFolderCommand({ repositoryName: repoName, folderPath, commitSpecifier })
  );

  // Recurse into sub-folders
  for (const sub of folder.subFolders ?? []) {
    if (!sub.absolutePath) continue;
    try {
      filesWritten += await downloadFolder(client, repoName, sub.absolutePath, destDir, commitSpecifier, log);
    } catch (err) {
      log("WARN", `[AWS CodeCommit] Skipping subfolder ${sub.absolutePath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Download files in this folder
  for (const f of folder.files ?? []) {
    if (!f.absolutePath) continue;
    try {
      const fileResp = await client.send(
        new GetFileCommand({ repositoryName: repoName, filePath: f.absolutePath, commitSpecifier })
      );
      if (fileResp.fileContent) {
        const destPath = safeJoin(destDir, f.absolutePath);
        if (!destPath) {
          log("WARN", `[AWS CodeCommit] Skipping unsafe path ${f.absolutePath}`);
          continue;
        }
        await mkdir(dirname(destPath), { recursive: true });
        await writeFile(destPath, Buffer.from(fileResp.fileContent));
        filesWritten++;
      }
    } catch (err) {
      log("WARN", `[AWS CodeCommit] Skipping file ${f.absolutePath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return filesWritten;
}

/**
 * Downloads a CodeCommit repository's default branch into a temp directory.
 */
export async function checkoutCodeCommit(
  creds: AwsCredentials,
  repoName: string,
  ref: string,
  log: (level: "INFO" | "WARN" | "ERROR", msg: string) => void
): Promise<Checkout> {
  const client = new CodeCommitClient({
    region: creds.region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
    },
  });

  const dir = await mkdtemp(join(tmpdir(), "ecdat-aws-"));
  const commitSpecifier = ref || "HEAD";

  try {
    // Verify repo exists — if it doesn't, we log a warning and return an empty dir
    // so KMS/ACM scans still run successfully.
    await client.send(new GetRepositoryCommand({ repositoryName: repoName }));
    log("INFO", `[AWS CodeCommit] Downloading ${repoName}@${commitSpecifier} to ${dir}`);
    const count = await downloadFolder(client, repoName, "/", dir, commitSpecifier, log);
    log("INFO", `[AWS CodeCommit] Downloaded ${count} files`);
  } catch (err) {
    // Don't abort — KMS/ACM scans still have value even if code checkout fails
    log("WARN", `[AWS CodeCommit] Repo not found or checkout failed (${err instanceof Error ? err.message : String(err)}) — continuing with KMS/ACM scan only`);
  }

  return {
    dir,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

/**
 * Downloads an S3 object (expected to be a .tar.gz archive) and extracts it.
 * Key format: `s3://<bucket>/<prefix...>` or just `<bucket>/<key>`.
 */
export async function checkoutS3(
  creds: AwsCredentials,
  s3Uri: string,
  log: (level: "INFO" | "WARN" | "ERROR", msg: string) => void
): Promise<Checkout> {
  const dir = await mkdtemp(join(tmpdir(), "ecdat-s3-"));

  try {
    const cleaned = s3Uri.replace(/^s3:\/\//, "");
    const slashIdx = cleaned.indexOf("/");
    const bucket = slashIdx === -1 ? cleaned : cleaned.slice(0, slashIdx);
    const key = slashIdx === -1 ? "" : cleaned.slice(slashIdx + 1);

    log("INFO", `[AWS S3] Downloading s3://${bucket}/${key}`);

    const client = new S3Client({
      region: creds.region,
      credentials: {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
      },
    });

    const resp = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!resp.Body) throw new Error("Empty response body from S3");

    // Collect bytes
    const chunks: Buffer[] = [];
    let received = 0;
    for await (const chunk of resp.Body as AsyncIterable<Uint8Array>) {
      received += chunk.byteLength;
      if (received > MAX_ARCHIVE_BYTES) throw new Error(`S3 archive exceeds ${MAX_ARCHIVE_BYTES} bytes`);
      chunks.push(Buffer.from(chunk as Uint8Array));
    }
    const buffer = Buffer.concat(chunks);

    // Untar
    await new Promise<void>((resolve, reject) => {
      const ex = extract();
      ex.on("entry", (header, stream, next) => {
        if (header.type !== "file") { stream.resume(); next(); return; }
        const dest = safeJoin(dir, header.name);
        if (!dest) {
          log("WARN", `[AWS S3] Skipping unsafe archive entry ${header.name}`);
          stream.resume();
          next();
          return;
        }
        const chunks2: Buffer[] = [];
        stream.on("data", (c: unknown) => chunks2.push(Buffer.from(c as Uint8Array)));
        stream.on("end", async () => {
          try {
            await mkdir(dirname(dest), { recursive: true });
            await writeFile(dest, Buffer.concat(chunks2));
            next();
          } catch (err) {
            next(err as Error);
          }
        });
        stream.on("error", next);
      });
      ex.on("finish", resolve);
      ex.on("error", reject);
      Readable.from(buffer).pipe(createGunzip()).pipe(ex);
    });

    log("INFO", `[AWS S3] Extracted archive to ${dir}`);
  } catch (err) {
    log("WARN", `[AWS S3] Checkout failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    dir,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

/**
 * Main entry: routes to CodeCommit or S3 based on the repository `name` field.
 * If `name` starts with `s3://`, it's an S3 archive. Otherwise it's a CodeCommit repo name.
 */
export async function checkoutAws(
  creds: AwsCredentials,
  repoName: string,
  ref: string,
  log: (level: "INFO" | "WARN" | "ERROR", msg: string) => void
): Promise<Checkout> {
  if (repoName.startsWith("s3://") || repoName.startsWith("s3:")) {
    return checkoutS3(creds, repoName, log);
  }
  return checkoutCodeCommit(creds, repoName, ref, log);
}
