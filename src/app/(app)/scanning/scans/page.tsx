"use client";

import { useState, useEffect, useCallback } from "react";
import type { Scan } from "@/fixtures/types";
import { StatusPill } from "@/components/ui/Pill";
import { formatRelativeTime, truncateHash } from "@/lib/format";
import { Search, ChevronLeft, ChevronRight, Terminal } from "lucide-react";
import { ScanLogDrawer } from "@/components/scans/ScanLogDrawer";

const PAGE_SIZE = 10;

function StatusTag({ text }: { text: string }) {
  const color =
    text === "Completed"
      ? "#3FCF8E"
      : text === "Running"
      ? "#5AA9F5"
      : text === "Failed"
      ? "#F0516B"
      : "var(--color-ink-muted)";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full"
      style={{
        color,
        backgroundColor: `${color}1a`,
        border: `1px solid ${color}44`,
      }}
    >
      {text}
    </span>
  );
}

export default function ScansPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (p: number, q: string) => {
      setLoading(true);
      try {
        const url = new URL("/api/scans", window.location.origin);
        url.searchParams.set("page", String(p));
        url.searchParams.set("pageSize", String(PAGE_SIZE));
        if (q) url.searchParams.set("search", q);
        const res = await fetch(url.toString());
        const data = await res.json();
        setScans(data.items ?? []);
        setTotal(data.total ?? 0);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchPage(page, search);
  }, [page, fetchPage]);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => {
      setPage(1);
      fetchPage(1, search);
    }, 300);
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
          Scans
          <span
            className="ml-2 text-sm font-normal"
            style={{ color: "var(--color-ink-faint)" }}
          >
            ({total} total)
          </span>
        </h1>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              width: "220px",
            }}
          >
            <Search size={14} style={{ color: "var(--color-ink-faint)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search scans..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "var(--color-ink)" }}
            />
          </div>
          <button
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "var(--color-accent)", color: "#fff" }}
          >
            + New Scan
          </button>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--color-border)" }}
      >
        <table className="w-full">
          <thead>
            <tr>
              {["Repository", "Trigger", "Status", "Commit", "Ref", "Files", "Duration", "Started", "Profile", ""].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} style={tdStyle}>
                        <div
                          className="rounded animate-pulse"
                          style={{
                            height: "14px",
                            width: j === 0 ? "140px" : "60px",
                            backgroundColor: "var(--color-surface-2)",
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : scans.map((scan) => (
                  <tr
                    key={scan.id}
                    style={{
                      backgroundColor: "var(--color-surface)",
                      transition: "background-color 0.1s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        "var(--color-surface-2)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        "var(--color-surface)")
                    }
                  >
                    <td style={tdStyle}>
                      <span className="font-medium" style={{ color: "var(--color-ink)" }}>
                        {scan.repositoryFullName}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: "var(--color-surface-2)",
                          color: "var(--color-ink-muted)",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        {scan.trigger}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <StatusPill status={scan.status} />
                    </td>
                    <td style={tdStyle}>
                      <span className="font-mono text-xs" style={{ color: "var(--color-ink-faint)" }}>
                        {truncateHash(scan.commitSha)}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span className="text-xs truncate" style={{ color: "var(--color-ink-muted)", maxWidth: "120px", display: "block" }}>
                        {scan.ref.replace("refs/heads/", "")}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums", color: "var(--color-ink-muted)" }}>
                      {scan.filesScanned ?? "—"}
                    </td>
                    <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums", color: "var(--color-ink-muted)" }}>
                      {scan.durationMs ? `${(scan.durationMs / 1000).toFixed(1)}s` : "—"}
                    </td>
                    <td style={tdStyle}>
                      <span className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
                        {formatRelativeTime(scan.startedAt)}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span className="text-xs" style={{ color: "var(--color-ink-muted)" }}>
                        {scan.profileName}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <button
                        onClick={() => setSelectedScanId(scan.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                        style={{
                          color: "var(--color-accent)",
                          backgroundColor: "rgba(47,91,255,0.08)",
                          border: "1px solid rgba(47,91,255,0.2)",
                        }}
                      >
                        <Terminal size={11} /> Logs
                      </button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
          Showing {Math.min((page - 1) * PAGE_SIZE + 1, total)}–
          {Math.min(page * PAGE_SIZE, total)} of {total} scans
        </p>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm disabled:opacity-40"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-ink-muted)",
            }}
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="text-xs" style={{ color: "var(--color-ink-muted)" }}>
            {page} / {totalPages || 1}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm disabled:opacity-40"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-ink-muted)",
            }}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Live log drawer */}
      <ScanLogDrawer
        scanId={selectedScanId}
        onClose={() => setSelectedScanId(null)}
      />
    </div>
  );
}
