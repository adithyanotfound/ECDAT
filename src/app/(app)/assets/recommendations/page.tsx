"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";

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

const PAGE_SIZE = 10;

function EffortBadge({ effort }: { effort: "HIGH" | "MEDIUM" | "LOW" }) {
  const colors = {
    HIGH: { c: "#F0516B", bg: "rgba(240,81,107,0.12)", border: "rgba(240,81,107,0.4)" },
    MEDIUM: { c: "#F2C14E", bg: "rgba(242,193,78,0.12)", border: "rgba(242,193,78,0.4)" },
    LOW: { c: "#3FCF8E", bg: "rgba(63,207,142,0.12)", border: "rgba(63,207,142,0.4)" },
  };
  const style = colors[effort] || colors.MEDIUM;

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-semibold"
      style={{
        color: style.c,
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
      }}
    >
      {effort}
    </span>
  );
}

export default function RecommendationsPage() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, high: 0, medium: 0, low: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchPage = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const url = new URL("/api/recommendations", window.location.origin);
      url.searchParams.set("page", String(p));
      url.searchParams.set("pageSize", String(PAGE_SIZE));
      url.searchParams.set("sort", "effort");
      if (q) url.searchParams.set("search", q);
      const res = await fetch(url.toString());
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setStats(data.stats ?? { total: 0, high: 0, medium: 0, low: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPage(page, search); }, [page, fetchPage]);
  useEffect(() => {
    const id = setTimeout(() => { setPage(1); fetchPage(1, search); }, 300);
    return () => clearTimeout(id);
  }, [search, fetchPage]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "10px 14px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--color-ink-muted)",
    backgroundColor: "var(--color-thead)",
    borderBottom: "1px solid var(--color-border)",
    whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    padding: "12px 14px",
    fontSize: "13px",
    borderBottom: "1px solid var(--color-border)",
    verticalAlign: "top",
  };

  const kpiCards = [
    { label: "Total Recommendations", value: stats.total, sub: "Across all repositories", color: "var(--color-accent)" },
    { label: "High Effort", value: stats.high, sub: "Requires significant refactoring", color: "var(--color-critical)" },
    { label: "Medium Effort", value: stats.medium, sub: "Standard migration path", color: "var(--color-moderate)" },
    { label: "Low Effort", value: stats.low, sub: "Drop-in or config change", color: "var(--color-safe)" },
  ];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* KPI tiles */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl p-4"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderLeft: `3px solid ${card.color}`,
            }}
          >
            <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: "var(--color-ink-muted)" }}>
              {card.label}
            </p>
            <p className="text-3xl font-bold tabular-nums" style={{ color: "var(--color-ink)" }}>
              {loading ? "—" : card.value}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-ink-faint)" }}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--color-ink)" }}>
          <Lightbulb size={24} style={{ color: "var(--color-accent)" }} />
          Remediation Recommendations
          <span className="ml-2 text-sm font-normal" style={{ color: "var(--color-ink-faint)" }}>
            ({total} total)
          </span>
        </h1>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", width: "240px" }}
          >
            <Search size={14} style={{ color: "var(--color-ink-faint)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search recommendations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "var(--color-ink)" }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
        <table className="w-full">
          <thead>
            <tr>
              {["Algorithm", "Migration Target", "Standard", "Effort", "Impact", "Repository"].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} style={tdStyle}>
                        <div className="rounded animate-pulse" style={{ height: "14px", width: "80px", backgroundColor: "var(--color-surface-2)" }} />
                      </td>
                    ))}
                  </tr>
                ))
              : items.map((rec) => (
                  <tr
                    key={rec.id}
                    style={{ backgroundColor: "var(--color-surface)", transition: "background-color 0.1s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-surface-2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--color-surface)")}
                  >
                    <td style={tdStyle}>
                      <span className="font-medium text-sm" style={{ color: "var(--color-critical)" }}>{rec.fromAlgorithm}</span>
                    </td>
                    <td style={tdStyle}>
                      <span className="font-semibold text-sm" style={{ color: "var(--color-safe)" }}>{rec.toAlgorithm}</span>
                      {rec.notes && (
                        <p className="text-xs mt-1" style={{ color: "var(--color-ink-muted)", maxWidth: "240px" }}>
                          {rec.notes}
                        </p>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <span className="text-xs" style={{ color: "var(--color-ink)" }}>{rec.standard ?? "—"}</span>
                    </td>
                    <td style={tdStyle}>
                      <EffortBadge effort={rec.effort} />
                    </td>
                    <td style={tdStyle}>
                      <div className="flex flex-col gap-1 text-xs" style={{ color: "var(--color-ink-muted)" }}>
                        <div><span style={{ color: "var(--color-ink-faint)" }}>Latency:</span> {rec.latencyImpact ?? "Unknown"}</div>
                        <div><span style={{ color: "var(--color-ink-faint)" }}>Size:</span> {rec.sizeImpact ?? "Unknown"}</div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span className="text-xs" style={{ color: "var(--color-accent)" }}>{rec.repositoryFullName}</span>
                    </td>
                  </tr>
                ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm" style={{ color: "var(--color-ink-faint)" }}>
                  No recommendations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
          Showing {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of {total} rows
        </p>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm disabled:opacity-40"
            style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-ink-muted)" }}>
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="text-xs" style={{ color: "var(--color-ink-muted)" }}>{page} / {totalPages || 1}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm disabled:opacity-40"
            style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-ink-muted)" }}>
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
