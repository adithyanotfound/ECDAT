"use client";

/**
 * Interactive parts of a repository's page: the Scan now button and the scan
 * history rows that open the live log.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Terminal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/Pill";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import { ScanLogDrawer } from "@/components/scans/ScanLogDrawer";
import { formatRelativeTime, isCommitSha, truncateHash } from "@/lib/format";

export function ScanNowButton({ repositoryId, disabled }: { repositoryId: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const run = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/repositories/${repositoryId}/scan`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "The scan couldn't start.");
      setToast({
        id: Date.now(),
        tone: "success",
        title: data.alreadyRunning ? "A scan is already running" : "Scan started",
        body: "Its log appears in the history below.",
      });
      router.refresh();
    } catch (err) {
      setToast({
        id: Date.now(),
        tone: "error",
        title: "Scan didn't start",
        body: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="primary" onClick={run} disabled={busy || disabled}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
        {busy ? "Starting…" : "Scan now"}
      </Button>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}

export interface ScanRow {
  id: string;
  status: string;
  trigger: string;
  commitSha: string;
  createdAt: string;
  durationMs: number | null;
  filesScanned: number | null;
}

export function ScanHistory({ scans }: { scans: ScanRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (scans.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-[13.5px] text-muted">
        No scans yet. Press Scan now to run the first one.
      </p>
    );
  }
  return (
    <>
      <ul className="divide-y divide-line">
        {scans.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
            <StatusPill status={s.status} />
            <span className="text-[13.5px] text-ink-2">
              {s.trigger.charAt(0) + s.trigger.slice(1).toLowerCase()} scan
              <span className="text-muted"> · {formatRelativeTime(s.createdAt)}</span>
            </span>
            {isCommitSha(s.commitSha) && (
              <span className="hidden font-mono text-xs text-muted sm:inline">{truncateHash(s.commitSha)}</span>
            )}
            <span className="num hidden text-xs text-muted md:inline">
              {s.filesScanned != null && `${s.filesScanned.toLocaleString()} files`}
              {s.durationMs != null && ` · ${(s.durationMs / 1000).toFixed(1)}s`}
            </span>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setOpen(s.id)}>
              <Terminal size={13} /> Log & changes
            </Button>
          </li>
        ))}
      </ul>
      <ScanLogDrawer scanId={open} onClose={() => setOpen(null)} />
    </>
  );
}
