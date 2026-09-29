"use client";

/**
 * Scans: every scan, newest first. Filter by result, then open one to watch
 * its log live or see what changed since the one before. Opening
 * /scanning/scans?scan=<id> jumps straight to that scan.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Cpu } from "lucide-react";
import type { Scan, ScanStatus } from "@/fixtures/types";
import { PageHeader } from "@/components/ui/Card";
import { FilterChips, Pagination, SearchInput } from "@/components/ui/Controls";
import { Badge, StatusPill } from "@/components/ui/Pill";
import { EmptyState, SkeletonRows } from "@/components/ui/States";
import { InfoHint } from "@/components/ui/InfoHint";
import { ScanLogDrawer } from "@/components/scans/ScanLogDrawer";
import { formatRelativeTime, isCommitSha, truncateHash } from "@/lib/format";

const PAGE_SIZE = 12;

const TRIGGER: Record<string, string> = { INITIAL: "First scan", PUSH: "New push", MANUAL: "Scan now" };

export default function ScansPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<ScanStatus | "">("");
  const [selected, setSelected] = useState<Scan | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The request for the current filters. Loading is derived by comparing it with the
  // last request that finished, so the effect below never sets state synchronously.
  const url = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (debounced) p.set("search", debounced);
    if (status) p.set("status", status);
    return `/api/scans?${p}`;
  }, [page, debounced, status]);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const loading = loadedUrl !== url;

  useEffect(() => {
    // Ignore a response that arrives after the filters have changed again.
    let current = true;
    const load = (background: boolean) =>
      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          if (!current) return;
          setScans(data.items ?? []);
          setTotal(data.total ?? 0);
        })
        .catch(() => {
          // A failed background refresh keeps the rows already shown.
          if (current && !background) setScans([]);
        })
        .finally(() => current && setLoadedUrl(url));
    load(false);
    // Keep running scans fresh without flashing the table.
    const id = setInterval(() => load(true), 5000);
    return () => {
      current = false;
      clearInterval(id);
    };
  }, [url]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // ?scan=<id> opens that scan's drawer once.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("scan");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL once on mount
    if (id) setSelectedId(id);
  }, []);

  const open = (s: Scan) => {
    setSelected(s);
    setSelectedId(s.id);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Connect & scan"
        title="Scans"
        description="Each scan reads a repository or AWS account from top to bottom and records the cryptography it finds. Open one to follow it live or see what changed."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          label="Result"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: "Running", label: "Running", tone: "low" },
            { value: "Queued", label: "Waiting", tone: "neutral" },
            { value: "Completed", label: "Completed", tone: "safe" },
            { value: "Failed", label: "Failed", tone: "critical" },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Search by repository" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/70 text-left text-[12.5px] text-muted">
                <th scope="col" className="px-4 py-3 font-medium">
                  Repository
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Result
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="inline-flex items-center gap-1">
                    Started by <InfoHint label="Started by" term="trigger" />
                  </span>
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Commit
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Files
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Took
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  When
                </th>
                <th scope="col" className="w-8 px-4 py-3">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows rows={8} cols={8} />
              ) : scans.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      icon={<Cpu size={22} />}
                      title={debounced || status ? "No matching scans" : "No scans yet"}
                    >
                      {debounced || status
                        ? "Try a different filter or search."
                        : "Scans start by themselves when you add a repository. You can also press Scan now on the Repositories page."}
                    </EmptyState>
                  </td>
                </tr>
              ) : (
                scans.map((scan) => (
                  <tr
                    key={scan.id}
                    tabIndex={0}
                    onClick={() => open(scan)}
                    onKeyDown={(e) => e.key === "Enter" && open(scan)}
                    aria-label={`Open scan of ${scan.repositoryFullName}`}
                    className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface-2/60 focus-visible:bg-surface-2/60"
                  >
                    <td className="max-w-[280px] px-4 py-3.5">
                      <p className="truncate font-medium text-ink">{scan.repositoryFullName}</p>
                      <p className="truncate text-xs text-muted">{scan.ref.replace("refs/heads/", "")}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusPill status={scan.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge dot={false}>{TRIGGER[scan.trigger] ?? scan.trigger}</Badge>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-muted">
                      {isCommitSha(scan.commitSha) ? truncateHash(scan.commitSha) : "–"}
                    </td>
                    <td className="num px-4 py-3.5 text-right text-ink-2">
                      {scan.filesScanned?.toLocaleString() ?? "–"}
                    </td>
                    <td className="num px-4 py-3.5 text-right text-ink-2">
                      {scan.durationMs ? `${(scan.durationMs / 1000).toFixed(1)}s` : "–"}
                    </td>
                    <td className="px-4 py-3.5 text-[13px] whitespace-nowrap text-muted">
                      {formatRelativeTime(scan.startedAt)}
                    </td>
                    <td className="px-4 py-3.5 text-faint">
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} noun="scans" />

      <ScanLogDrawer
        scanId={selectedId}
        title={selected ? selected.repositoryFullName : "Scan details"}
        onClose={() => {
          setSelected(null);
          setSelectedId(null);
        }}
      />
    </div>
  );
}
