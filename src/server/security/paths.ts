/**
 * Guards against "zip slip": an archive entry named `../../etc/cron.d/x` (or an
 * absolute path) would otherwise be written outside the scan's temp folder.
 * Every file taken from a tarball, S3 archive or CodeCommit listing goes
 * through here before touching the disk.
 */
import { resolve, sep } from "path";

/** Joins `rel` under `root`, or returns null when the result would escape `root`. */
export function safeJoin(root: string, rel: string): string | null {
  if (!rel || rel.includes("\0")) return null;
  const base = resolve(root);
  // Treat the entry as relative even if it starts with a slash or drive letter.
  const cleaned = rel.replace(/^([A-Za-z]:)?[\\/]+/, "");
  const dest = resolve(base, cleaned);
  return dest.startsWith(base + sep) ? dest : null;
}
