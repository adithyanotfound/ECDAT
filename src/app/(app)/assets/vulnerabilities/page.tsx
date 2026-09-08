"use client";

import { useState, useEffect, useCallback } from "react";
import type { Finding } from "@/fixtures/types";
import { SeverityPill } from "@/components/ui/Pill";
import { formatRelativeTime } from "@/lib/format";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 10;

export default function VulnerabilitiesPage() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [total, setTotal] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const [highCount, setHighCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchPage = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const url = new URL("/api/findings", window.location.origin);
      url.searchParams.set("page", String(p));
      url.searchParams.set("pageSize", String(PAGE_SIZE));
      if (q) url.searchParams.set("search", q);
      const res = await fetch(url.toString());
      const data = await res.json();
      setFindings(data.items ?? []);
      setTotal(data.total ?? 0);
      setOpenCount(data.openCount ?? 0);
      setCriticalCount(data.criticalCount ?? 0);
      setHighCount(data.highCount ?? 0);
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
    padding: "10px 14px",
    fontSize: "13px",
    borderBottom: "1px solid var(--color-border)",
    verticalAlign: "middle",
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* KPI tiles */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {[
          { label: "Open Vulnerabilities", value: openCount, color: "var(--color-critical)" },
          { label: "Critical Findings", value: criticalCount, color: "var(--color-high)" },
          { label: "High Severity", value: highCount, color: "var(--color-moderate)" },
        ].map((card) => (
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
            <p className="text-3xl font-bold tabular-nums" style={{ color: card.color }}>
              {loading ? "—" : card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
          Vulnerabilities
          <span className="ml-2 text-sm font-normal" style={{ color: "var(--color-ink-faint)" }}>
            ({total} total)
          </span>
        </h1>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              width: "240px",
            }}
          >
            <Search size={14} style={{ color: "var(--color-ink-faint)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search vulnerabilities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "var(--color-ink)" }}
            />
          </div>
          <button
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-ink-muted)",
            }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
        <table className="w-full">
          <thead>
            <tr>
              {["ID", "Severity", "Title", "Detail", "Component", "Repository", "Status", "Last Seen"].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} style={tdStyle}>
                        <div className="rounded animate-pulse" style={{ height: "14px", width: j === 2 ? "160px" : "70px", backgroundColor: "var(--color-surface-2)" }} />
                      </td>
                    ))}
                  </tr>
                ))
              : findings.map((f) => (
                  <tr
                    key={f.id}
                    style={{ backgroundColor: "var(--color-surface)", transition: "background-color 0.1s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-surface-2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--color-surface)")}
                  >
                    <td style={tdStyle}>
                      <span className="font-mono text-xs" style={{ color: "var(--color-ink)" }}>{f.code}</span>
                    </td>
                    <td style={tdStyle}><SeverityPill severity={f.severity} /></td>
                    <td style={tdStyle}>
                      <span style={{ color: "var(--color-ink)" }}>{f.title}</span>
                    </td>
                    <td style={{ ...tdStyle, maxWidth: "260px" }}>
                      <span className="text-xs" style={{ color: "var(--color-ink-muted)" }}>{f.detail}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: "var(--color-ink-muted)" }}>{f.affectedComponent}</span>
                    </td>
                    <td style={tdStyle}>
                      <span className="text-xs" style={{ color: "var(--color-accent)" }}>{f.repositoryFullName}</span>
                    </td>
                    <td style={tdStyle}>
                      {(() => {
                        const c = f.status === "Open" ? "#F0516B" : f.status === "Mitigated" ? "#3FCF8E" : "#5AA9F5";
                        return (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: c, backgroundColor: `${c}22`, border: `1px solid ${c}44` }}>
                            {f.status}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={tdStyle}>
                      <span className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
                        {formatRelativeTime(f.lastSeenAt)}
                      </span>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
          Showing {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of {total}
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
