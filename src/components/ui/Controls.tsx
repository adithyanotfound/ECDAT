"use client";

/**
 * Search box, filter chips and pagination: the controls that sit above and
 * below every table, styled the same everywhere.
 */
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { TONE, type Tone } from "@/lib/tones";

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}) {
  return (
    <label
      className={cn(
        "flex h-9.5 w-full items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 transition-colors focus-within:border-gold sm:w-64",
        className,
      )}
    >
      <Search size={15} className="shrink-0 text-faint" />
      <input
        type="search"
        aria-label={label ?? placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="text-faint hover:text-ink"
        >
          <X size={14} />
        </button>
      )}
    </label>
  );
}

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
  tone?: Tone;
}

/** A row of toggle chips; `value` "" means "all". */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  allLabel = "All",
  allCount,
  label,
}: {
  options: ChipOption<T>[];
  value: T | "";
  onChange: (v: T | "") => void;
  allLabel?: string;
  allCount?: number;
  label: string;
}) {
  const chip = (on: boolean) =>
    cn(
      "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors",
      on ? "border-charcoal bg-charcoal text-white" : "border-line-strong bg-surface text-ink-2 hover:border-faint",
    );
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <button type="button" aria-pressed={value === ""} onClick={() => onChange("")} className={chip(value === "")}>
        {allLabel}
        {allCount !== undefined && <span className="num opacity-70">{allCount}</span>}
      </button>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? "" : o.value)}
            className={chip(on)}
          >
            {o.tone && <span className="size-2 rounded-full" style={{ backgroundColor: TONE[o.tone].fill }} />}
            {o.label}
            {o.count !== undefined && <span className="num opacity-70">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  noun = "rows",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  noun?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
      <p className="num">{total === 0 ? `No ${noun}` : `Showing ${from}–${to} of ${total.toLocaleString()} ${noun}`}</p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="flex size-8 items-center justify-center rounded-lg border border-line-strong bg-surface text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="num px-2 font-medium text-ink-2">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="flex size-8 items-center justify-center rounded-lg border border-line-strong bg-surface text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

/** Labelled form input used in dialogs. */
export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "h-10 w-full rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-gold";
