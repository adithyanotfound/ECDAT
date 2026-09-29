"use client";

/**
 * Recommendations: what to replace, with what, and how much work it is.
 * Each row reads as "from → to" first; expanding it shows the standard,
 * the performance and size impact, and notes.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Gauge, HardDrive, Lightbulb, X } from "lucide-react";
import { PageHeader } from "@/components/ui/Card";
import { FilterChips, Pagination, SearchInput } from "@/components/ui/Controls";
import { Badge, EffortPill } from "@/components/ui/Pill";
import { EmptyState, Notice, SkeletonBlock } from "@/components/ui/States";
import { StatCard } from "@/components/ui/StatCard";
import { EFFORT } from "@/lib/tones";
import { cn } from "@/lib/cn";

interface Recommendation {
  id: string;
  repositoryId: string;
  repositoryFullName: string;
  fromAlgorithm: string;
  toAlgorithm: string;
  standard: string | null;
  effort: "HIGH" | "MEDIUM" | "LOW";
  latencyImpact: string | null;
  sizeImpact: string | null;
  notes: string | null;
}

type Effort = Recommendation["effort"];
const PAGE_SIZE = 10;

export default function RecommendationsPage() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, high: 0, medium: 0, low: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [effort, setEffort] = useState<Effort | "">("");
  const [repositoryId, setRepositoryId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reading the URL once on mount */
    const p = new URLSearchParams(window.location.search);
    setRepositoryId(p.get("repositoryId"));
    const q = p.get("search") ?? "";
    setSearch(q);
    setDebounced(q);
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

  // The request for the current filters. Loading is derived by comparing it with the
  // last request that finished, so the effect below never sets state synchronously.
  const url = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sort: "effort" });
    if (debounced) p.set("search", debounced);
    if (effort) p.set("effort", effort);
    if (repositoryId) p.set("repositoryId", repositoryId);
    return `/api/recommendations?${p}`;
  }, [page, debounced, effort, repositoryId]);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const loading = !ready || loadedUrl !== url;

  useEffect(() => {
    if (!ready) return;
    // Ignore a response that arrives after the filters have changed again.
    let current = true;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (!current) return;
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setStats(data.stats ?? { total: 0, high: 0, medium: 0, low: 0 });
      })
      .catch(() => current && setItems([]))
      .finally(() => current && setLoadedUrl(url));
    return () => {
      current = false;
    };
  }, [ready, url]);

  const pick = (e: Effort | "") => {
    setEffort(e);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Understand & fix"
        title="Recommendations"
        description="What to replace each weak algorithm with, the standard behind it, and roughly how much work the change is. Start with the low-effort ones: they're quick wins."
      />

      {repositoryId && (
        <Notice
          tone="gold"
          action={
            <Link
              href="/assets/recommendations"
              onClick={() => setRepositoryId(null)}
              className="inline-flex items-center gap-1 font-semibold hover:underline"
            >
              <X size={14} /> Show all
            </Link>
          }
        >
          Showing recommendations for <b>{items[0]?.repositoryFullName ?? "one repository"}</b>.
        </Notice>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="All recommendations"
          value={stats.total}
          subtitle="Across the repositories shown"
          term="recommendation"
          tone="gold"
        />
        <StatCard title="Low effort" value={stats.low} subtitle={EFFORT.LOW.plain} term="effort" tone="safe" />
        <StatCard
          title="Medium effort"
          value={stats.medium}
          subtitle={EFFORT.MEDIUM.plain}
          term="effort"
          tone="moderate"
        />
        <StatCard title="High effort" value={stats.high} subtitle={EFFORT.HIGH.plain} term="effort" tone="critical" />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          label="Effort"
          value={effort}
          onChange={pick}
          allLabel="Any effort"
          allCount={stats.total}
          options={[
            { value: "LOW", label: "Low effort", tone: "safe", count: stats.low },
            { value: "MEDIUM", label: "Medium", tone: "moderate", count: stats.medium },
            { value: "HIGH", label: "High", tone: "critical", count: stats.high },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Search algorithm or repository" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonBlock key={i} className="h-14" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Lightbulb size={22} />}
            title={debounced || effort ? "Nothing matches" : "No recommendations yet"}
          >
            {debounced || effort
              ? "Try another search or effort level."
              : "Recommendations appear once a scan finds cryptography worth replacing."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((rec) => {
              const expanded = open === rec.id;
              return (
                <li key={rec.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : rec.id)}
                    aria-expanded={expanded}
                    className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 text-left transition-colors hover:bg-surface-2/50"
                  >
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
                      <span className="rounded-lg bg-critical-tint px-2.5 py-1 font-mono text-[13px] font-medium text-critical-ink">
                        {rec.fromAlgorithm}
                      </span>
                      <ArrowRight size={16} className="text-faint" />
                      <span className="rounded-lg bg-safe-tint px-2.5 py-1 font-mono text-[13px] font-medium text-safe-ink">
                        {rec.toAlgorithm}
                      </span>
                      {rec.standard && <Badge dot={false}>{rec.standard}</Badge>}
                    </span>
                    <span className="hidden max-w-[240px] truncate text-[13px] text-muted md:block">
                      {rec.repositoryFullName}
                    </span>
                    <EffortPill effort={rec.effort} />
                    <ChevronDown
                      size={17}
                      className={cn("text-muted transition-transform", expanded && "rotate-180")}
                    />
                  </button>
                  {expanded && (
                    <div className="grid gap-4 border-t border-line bg-surface-2/40 px-5 py-4 animate-fade-in md:grid-cols-3">
                      <Impact icon={<Gauge size={15} />} label="Speed impact" value={rec.latencyImpact} />
                      <Impact icon={<HardDrive size={15} />} label="Size impact" value={rec.sizeImpact} />
                      <div>
                        <p className="text-[12.5px] font-semibold text-ink-2">How much work</p>
                        <p className="mt-1 text-[13.5px] text-ink-2">{EFFORT[rec.effort]?.plain}</p>
                      </div>
                      {rec.notes && (
                        <p className="text-[13.5px] leading-relaxed text-ink-2 md:col-span-3">
                          <b className="font-semibold text-ink">Notes: </b>
                          {rec.notes}
                        </p>
                      )}
                      <p className="text-[13px] md:col-span-3">
                        <Link
                          href={`/scanning/repositories/${rec.repositoryId}`}
                          className="font-medium text-gold-ink hover:underline"
                        >
                          Open {rec.repositoryFullName} →
                        </Link>
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} noun="recommendations" />
    </div>
  );
}

function Impact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2">
        {icon} {label}
      </p>
      <p className="mt-1 text-[13.5px] text-ink-2">{value ?? "Not measured"}</p>
    </div>
  );
}
