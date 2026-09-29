"use client";

/**
 * Vulnerabilities: specific problems to fix. Counts first, then the list
 * filtered by severity and status, then a drawer per finding with what it
 * means and where it is. /assets/vulnerabilities?repositoryId=… narrows to
 * one repository (linked from that repository's page).
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertOctagon, AlertTriangle, ChevronRight, CircleDot, Download, FolderGit2, X } from "lucide-react";
import type { Finding, Severity } from "@/fixtures/types";
import { PageHeader } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { FilterChips, Pagination, SearchInput } from "@/components/ui/Controls";
import { Badge, SeverityPill } from "@/components/ui/Pill";
import { EmptyState, Notice, SkeletonRows } from "@/components/ui/States";
import { StatCard } from "@/components/ui/StatCard";
import { Drawer } from "@/components/ui/Drawer";
import { InfoHint } from "@/components/ui/InfoHint";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { SEVERITY_TONE, type Tone } from "@/lib/tones";

const PAGE_SIZE = 12;
const SEVERITIES: Severity[] = ["Critical", "High", "Moderate", "Low"];
const STATUS_TONE: Record<Finding["status"], Tone> = { Open: "critical", Mitigated: "safe", Accepted: "neutral" };
const STATUS_TEXT: Record<Finding["status"], string> = {
  Open: "Still present in the latest scan.",
  Mitigated: "No longer found: it was fixed or removed.",
  Accepted: "Someone decided to live with this risk.",
};
const URGENCY: Record<Severity, string> = {
  Critical: "Fix this as soon as possible; it's exploitable or already broken.",
  High: "Fix this soon; it weakens your security today or once quantum computers arrive.",
  Moderate: "Plan a fix with your next round of upgrades.",
  Low: "Worth knowing about; fix it when you're working nearby.",
  Compliant: "Nothing to fix.",
};

export default function VulnerabilitiesPage() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ open: 0, critical: 0, high: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [status, setStatus] = useState<Finding["status"] | "">("Open");
  const [repositoryId, setRepositoryId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Finding | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reading the URL once on mount */
    const p = new URLSearchParams(window.location.search);
    setRepositoryId(p.get("repositoryId"));
    if (p.get("search")) setSearch(p.get("search") ?? "");
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchPage = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    try {
      const url = new URL("/api/findings", window.location.origin);
      url.searchParams.set("page", String(page));
      url.searchParams.set("pageSize", String(PAGE_SIZE));
      if (debounced) url.searchParams.set("search", debounced);
      if (severity) url.searchParams.set("severity", severity);
      if (status) url.searchParams.set("status", status);
      if (repositoryId) url.searchParams.set("repositoryId", repositoryId);
      const data = await (await fetch(url.toString())).json();
      setFindings(data.items ?? []);
      setTotal(data.total ?? 0);
      setCounts({ open: data.openCount ?? 0, critical: data.criticalCount ?? 0, high: data.highCount ?? 0 });
    } catch {
      setFindings([]);
    } finally {
      setLoading(false);
    }
  }, [ready, page, debounced, severity, status, repositoryId]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  const repoName = repositoryId ? (findings[0]?.repositoryFullName ?? "one repository") : null;
  const exportHref = `/api/findings/export${repositoryId ? `?repositoryId=${encodeURIComponent(repositoryId)}` : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Understand & fix"
        title="Vulnerabilities"
        description="Specific problems found in your code and cloud: weak algorithms, expiring certificates, keys left in files. Each one points to where it was found."
        actions={
          <a href={exportHref} className={buttonClass("secondary")}>
            <Download size={16} /> Export CSV
          </a>
        }
      />

      {repositoryId && (
        <Notice
          tone="gold"
          action={
            <Link
              href="/assets/vulnerabilities"
              onClick={() => setRepositoryId(null)}
              className="inline-flex items-center gap-1 font-semibold hover:underline"
            >
              <X size={14} /> Show all
            </Link>
          }
        >
          Showing only <b>{repoName}</b>.
        </Notice>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Open problems"
          value={counts.open}
          subtitle="Still present in the latest scans"
          term="finding"
          tone="gold"
          icon={<CircleDot size={16} />}
        />
        <StatCard
          title="Critical"
          value={counts.critical}
          subtitle="Fix as soon as possible"
          term="severity"
          tone="critical"
          icon={<AlertOctagon size={16} />}
        />
        <StatCard
          title="High"
          value={counts.high}
          subtitle="Fix soon"
          term="severity"
          tone="high"
          icon={<AlertTriangle size={16} />}
        />
      </section>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2.5">
          <FilterChips
            label="Severity"
            value={severity}
            onChange={(v) => {
              setSeverity(v);
              setPage(1);
            }}
            allLabel="Any severity"
            options={SEVERITIES.map((s) => ({ value: s, label: s, tone: SEVERITY_TONE[s] }))}
          />
          <FilterChips
            label="Status"
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            allLabel="Any status"
            options={[
              { value: "Open", label: "Open", tone: "critical" },
              { value: "Mitigated", label: "Fixed", tone: "safe" },
              { value: "Accepted", label: "Accepted", tone: "neutral" },
            ]}
          />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search title, rule or detail" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/70 text-left text-[12.5px] text-muted">
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="inline-flex items-center gap-1">
                    Severity <InfoHint label="Severity" term="severity" />
                  </span>
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Problem
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Repository
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Last seen
                </th>
                <th scope="col" className="w-8 px-4 py-3">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows rows={8} cols={6} />
              ) : findings.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={<AlertTriangle size={22} />}
                      title={severity || status || debounced ? "Nothing matches" : "No problems found"}
                    >
                      {severity || status || debounced
                        ? "Try another filter. Fixed problems are under Status → Fixed."
                        : "Either nothing has been scanned yet, or the scans came back clean."}
                    </EmptyState>
                  </td>
                </tr>
              ) : (
                findings.map((f) => (
                  <tr
                    key={f.id}
                    tabIndex={0}
                    onClick={() => setSelected(f)}
                    onKeyDown={(e) => e.key === "Enter" && setSelected(f)}
                    aria-label={`Open ${f.title}`}
                    className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface-2/60 focus-visible:bg-surface-2/60"
                  >
                    <td className="px-4 py-3.5">
                      <SeverityPill severity={f.severity} />
                    </td>
                    <td className="max-w-[440px] px-4 py-3.5">
                      <p className="font-medium text-ink">{f.title}</p>
                      <p className="truncate text-xs text-muted" title={f.detail}>
                        {f.affectedComponent !== "Unknown" ? `${f.affectedComponent} · ` : ""}
                        {f.detail}
                      </p>
                    </td>
                    <td className="max-w-[220px] px-4 py-3.5">
                      <span className="block truncate text-[13px] text-ink-2">{f.repositoryFullName}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge tone={STATUS_TONE[f.status]}>{f.status === "Mitigated" ? "Fixed" : f.status}</Badge>
                    </td>
                    <td className="px-4 py-3.5 text-[13px] whitespace-nowrap text-muted">
                      {formatRelativeTime(f.lastSeenAt)}
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

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} noun="problems" />

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title ?? ""}
        eyebrow={
          selected && (
            <>
              <SeverityPill severity={selected.severity} />
              <Badge tone={STATUS_TONE[selected.status]}>
                {selected.status === "Mitigated" ? "Fixed" : selected.status}
              </Badge>
              <Badge dot={false} className="font-mono">
                {selected.code}
              </Badge>
            </>
          )
        }
        subtitle={selected?.repositoryFullName}
        footer={
          selected && (
            <Link
              href={`/scanning/repositories/${selected.repositoryId}`}
              className={buttonClass("primary", "md", "w-full")}
            >
              <FolderGit2 size={16} /> Open this repository
            </Link>
          )
        }
      >
        {selected && (
          <div className="flex flex-col gap-5 p-6">
            <div className="rounded-xl bg-surface-2/70 p-4">
              <p className="text-xs font-semibold tracking-[0.12em] text-gold-ink uppercase">How urgent</p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{URGENCY[selected.severity]}</p>
            </div>
            <section>
              <h3 className="text-[14px] font-semibold text-ink">What we found</h3>
              <p className="mt-1 text-[13.5px] leading-relaxed whitespace-pre-line text-ink-2">{selected.detail}</p>
            </section>
            <dl className="divide-y divide-line rounded-xl border border-line text-[13.5px]">
              {[
                [
                  "Where",
                  selected.filePath ? (
                    <span className="font-mono text-[12.5px] break-all">{selected.filePath}</span>
                  ) : (
                    "–"
                  ),
                ],
                ["Affects", selected.affectedComponent],
                ["Status", STATUS_TEXT[selected.status]],
                ["First seen", formatDate(selected.firstSeenAt, "d MMM yyyy")],
                ["Last seen", formatDate(selected.lastSeenAt, "d MMM yyyy, HH:mm")],
                [
                  "Rule",
                  <span key="r" className="font-mono text-[12.5px]">
                    {selected.code}
                  </span>,
                ],
              ].map(([k, v]) => (
                <div key={k as string} className="grid grid-cols-[110px_1fr] gap-4 px-4 py-2.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="min-w-0 text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <Link
              href={`/assets/recommendations?repositoryId=${encodeURIComponent(selected.repositoryId)}`}
              className="text-[13.5px] font-medium text-gold-ink hover:underline"
            >
              See the recommended replacements for this repository →
            </Link>
          </div>
        )}
      </Drawer>
    </div>
  );
}
