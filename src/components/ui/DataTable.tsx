"use client";

/**
 * Client-side table: sort, search and paginate rows already in memory.
 * Clickable rows open with Enter too, and say so to screen readers.
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/cn";
import type { GlossaryKey } from "@/lib/glossary";
import { InfoHint } from "./InfoHint";
import { Pagination, SearchInput } from "./Controls";
import { EmptyState, SkeletonRows } from "./States";

export interface ColumnDef<T> {
  key: string;
  header: string;
  term?: GlossaryKey;
  sortable?: boolean;
  width?: string;
  align?: "left" | "right";
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
  rowLabel?: (row: T) => string;
  emptyTitle?: string;
  emptyMessage?: React.ReactNode;
  loading?: boolean;
  /** Filters or buttons shown next to the search box. */
  toolbar?: React.ReactNode;
  noun?: string;
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
  rowLabel,
  emptyTitle = "Nothing to show",
  emptyMessage,
  loading = false,
  toolbar,
  noun = "rows",
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const valueOf = (col: ColumnDef<T> | undefined, row: T, key: string) =>
    col?.getValue ? col.getValue(row) : (row as Record<string, unknown>)[key];

  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter((row) =>
      columns.some((col) =>
        String(valueOf(col, row, col.key) ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, query, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    return [...filtered].sort((a, b) => {
      const av = valueOf(col, a, sortKey) as string | number | null | undefined;
      const bv = valueOf(col, b, sortKey) as string | number | null | undefined;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, totalPages);
  const paged = sorted.slice((current - 1) * pageSize, current * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {(searchable || toolbar) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {toolbar ?? <span />}
          {searchable && (
            <SearchInput
              value={query}
              onChange={(v) => {
                setQuery(v);
                setPage(1);
              }}
              placeholder={searchPlaceholder}
            />
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/70">
                {columns.map((col) => {
                  const sorted = sortKey === col.key;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={sorted ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                      className={cn(
                        "px-4 py-3 text-[12.5px] font-medium whitespace-nowrap text-muted",
                        col.align === "right" ? "text-right" : "text-left",
                      )}
                      style={{ width: col.width }}
                    >
                      <span className={cn("inline-flex items-center gap-1", col.align === "right" && "justify-end")}>
                        {col.sortable ? (
                          <button
                            type="button"
                            onClick={() => handleSort(col.key)}
                            className="inline-flex items-center gap-1 transition-colors hover:text-ink"
                          >
                            {col.header}
                            {sorted ? (
                              sortDir === "asc" ? (
                                <ChevronUp size={13} className="text-gold-ink" />
                              ) : (
                                <ChevronDown size={13} className="text-gold-ink" />
                              )
                            ) : (
                              <ChevronsUpDown size={12} className="opacity-50" />
                            )}
                          </button>
                        ) : (
                          col.header
                        )}
                        {col.term && <InfoHint label={col.header} term={col.term} />}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows rows={Math.min(pageSize, 8)} cols={columns.length} />
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>
                    <EmptyState title={query ? "No matches" : emptyTitle}>
                      {query ? `Nothing matches “${query}”. Try a shorter search.` : emptyMessage}
                    </EmptyState>
                  </td>
                </tr>
              ) : (
                paged.map((row) => (
                  <tr
                    key={getRowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                    tabIndex={onRowClick ? 0 : undefined}
                    aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
                    className={cn(
                      "border-b border-line transition-colors last:border-0",
                      onRowClick && "cursor-pointer hover:bg-surface-2/70 focus-visible:bg-surface-2/70",
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn("px-4 py-3 align-middle text-ink", col.align === "right" && "text-right")}
                      >
                        {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && sorted.length > 0 && (
        <Pagination page={current} pageSize={pageSize} total={sorted.length} onPage={setPage} noun={noun} />
      )}
    </div>
  );
}
