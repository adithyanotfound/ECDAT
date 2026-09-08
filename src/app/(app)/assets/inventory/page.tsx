"use client";

import { useState, useEffect, useCallback } from "react";
import type { InventoryAsset } from "@/fixtures/types";
import { formatRelativeTime } from "@/lib/format";
import { CheckCircle2, XCircle, Grid3x3, Filter, Search, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 10;

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAssets, setTotalAssets] = useState(0);
  const [classifiedAssets, setClassifiedAssets] = useState(0);
  const [monitoredAssets, setMonitoredAssets] = useState(0);
  const [newAssets, setNewAssets] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchPage = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const url = new URL("/api/inventory", window.location.origin);
      url.searchParams.set("page", String(p));
      url.searchParams.set("pageSize", String(PAGE_SIZE));
      if (q) url.searchParams.set("search", q);
      const res = await fetch(url.toString());
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setTotalAssets(data.totalAssets ?? 0);
      setClassifiedAssets(data.classifiedAssets ?? 0);
      setMonitoredAssets(data.monitoredAssets ?? 0);
      setNewAssets(data.newAssets ?? 0);
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

  const kpiCards = [
    { label: "Total Assets", value: totalAssets, sub: "Discovered in basic scan.", color: "var(--color-accent)" },
    { label: "Classified Assets", value: classifiedAssets, sub: "Verified in deep scan.", color: "var(--color-stat-teal)" },
    { label: "Monitored Assets", value: monitoredAssets, sub: "Assets being monitored.", color: "var(--color-stat-amber)" },
    { label: "New Assets", value: newAssets, sub: "Discovered in last 7 days.", color: "var(--color-stat-orange)" },
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
        <h1 className="text-xl font-bold" style={{ color: "var(--color-ink)" }}>
          Asset Inventory
          <span className="ml-2 text-sm font-normal" style={{ color: "var(--color-ink-faint)" }}>
            ({total} total)
          </span>
        </h1>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", width: "220px" }}
          >
            <Search size={14} style={{ color: "var(--color-ink-faint)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "var(--color-ink)" }}
            />
          </div>
          <button
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
            style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-ink-muted)" }}
          >
            <Filter size={13} /> Filter
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
        <table className="w-full">
          <thead>
            <tr>
              {["Asset ID", "Last Discovered", "IP/Hostname", "Ports", "Service Tag", "Classified", "Deep Discovery", "Last Scanned"].map((h) => (
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
                        <div className="rounded animate-pulse" style={{ height: "14px", width: "80px", backgroundColor: "var(--color-surface-2)" }} />
                      </td>
                    ))}
                  </tr>
                ))
              : items.map((asset) => (
                  <tr
                    key={asset.id}
                    style={{ backgroundColor: "var(--color-surface)", transition: "background-color 0.1s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-surface-2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--color-surface)")}
                  >
                    <td style={tdStyle}>
                      <span className="font-medium" style={{ color: "var(--color-accent)" }}>{asset.assetId}</span>
                    </td>
                    <td style={tdStyle}>
                      <span className="text-xs tabular-nums" style={{ color: "var(--color-ink-muted)" }}>
                        {new Date(asset.lastDiscovered).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: false })}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span className="font-mono text-xs" style={{ color: "var(--color-ink)" }}>{asset.ipHostname}</span>
                    </td>
                    <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums" }}>
                      <span className="text-xs" style={{ color: "var(--color-ink-muted)" }}>{asset.ports}</span>
                    </td>
                    <td style={tdStyle}><span style={{ color: "var(--color-ink)" }}>{asset.serviceTag}</span></td>
                    <td style={tdStyle}>
                      {asset.classified
                        ? <CheckCircle2 size={16} style={{ color: "var(--color-safe)" }} />
                        : <XCircle size={16} style={{ color: "var(--color-border)" }} />}
                    </td>
                    <td style={tdStyle}>
                      <Grid3x3 size={16} style={{ color: asset.deepDiscovery ? "var(--color-accent)" : "var(--color-border)" }} />
                    </td>
                    <td style={tdStyle}>
                      <span className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
                        {formatRelativeTime(asset.lastScanned)}
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
