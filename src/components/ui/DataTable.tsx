"use client";

import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  render?: (row: T) => React.ReactNode;
  getValue?: (row: T) => string | number;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  pageSize = 10,
  searchable = false,
  searchPlaceholder = "Search…",
  getRowKey,
  onRowClick,
  emptyMessage = "No data found.",
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  // Filter
  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = col.getValue ? col.getValue(row) : (row as Record<string, unknown>)[col.key];
        return String(val ?? "").toLowerCase().includes(q);
      })
    );
  }, [data, query, columns]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    return [...filtered].sort((a, b) => {
      const av = col?.getValue ? col.getValue(a) : (a as Record<string, unknown>)[sortKey];
      const bv = col?.getValue ? col.getValue(b) : (b as Record<string, unknown>)[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, columns]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey)
      return <ChevronsUpDown size={12} style={{ color: "var(--color-ink-faint)", opacity: 0.6 }} />;
    return sortDir === "asc" ? (
      <ChevronUp size={12} style={{ color: "var(--color-accent)" }} />
    ) : (
      <ChevronDown size={12} style={{ color: "var(--color-accent)" }} />
    );
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Search bar */}
      {searchable && (
        <div className="flex items-center">
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{
              backgroundColor: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              width: "260px",
            }}
          >
            <Search size={14} style={{ color: "var(--color-ink-faint)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "var(--color-ink)", caretColor: "var(--color-accent)" }}
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ backgroundColor: "var(--color-thead)" }}>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide"
                    style={{
                      color: "var(--color-ink-muted)",
                      width: col.width,
                      whiteSpace: "nowrap",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    {col.sortable ? (
                      <button
                        onClick={() => handleSort(col.key)}
                        className="flex items-center gap-1.5 cursor-pointer hover:text-inherit transition-colors"
                        style={{ color: "inherit" }}
                      >
                        {col.header}
                        <SortIcon colKey={col.key} />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="text-center py-12 text-sm"
                    style={{ color: "var(--color-ink-faint)" }}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                paged.map((row) => (
                  <tr
                    key={getRowKey(row)}
                    onClick={() => onRowClick?.(row)}
                    className="transition-colors"
                    style={{
                      borderBottom: "1px solid var(--color-border)",
                      cursor: onRowClick ? "pointer" : "default",
                    }}
                    onMouseEnter={(e) => {
                      if (onRowClick) e.currentTarget.style.backgroundColor = "var(--color-row)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className="px-4 py-3"
                        style={{ color: "var(--color-ink)", verticalAlign: "middle" }}
                      >
                        {col.render
                          ? col.render(row)
                          : String((row as Record<string, unknown>)[col.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      {sorted.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
            Showing {Math.min((page - 1) * pageSize + 1, sorted.length)}–
            {Math.min(page * pageSize, sorted.length)} of {sorted.length} rows.
          </span>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-md transition-colors disabled:opacity-40"
                style={{ color: "var(--color-ink-muted)" }}
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let num = i + 1;
                if (totalPages > 5) {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  num = start + i;
                }
                return (
                  <button
                    key={num}
                    onClick={() => setPage(num)}
                    className="w-7 h-7 rounded-md text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: page === num ? "var(--color-accent)" : "transparent",
                      color: page === num ? "#fff" : "var(--color-ink-muted)",
                    }}
                  >
                    {num}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-md transition-colors disabled:opacity-40"
                style={{ color: "var(--color-ink-muted)" }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
