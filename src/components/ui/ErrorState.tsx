"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorStateProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}

/** Shared body for every route-segment error.tsx (IMPLEMENTATION_PLAN.md §Phase 5 "Hardening"). */
export function ErrorState({ error, reset, title = "Something went wrong" }: ErrorStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-xl p-12 text-center"
      style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <AlertTriangle size={32} style={{ color: "var(--color-critical)" }} />
      <div>
        <p className="text-lg font-semibold" style={{ color: "var(--color-ink)" }}>{title}</p>
        <p className="text-sm mt-1" style={{ color: "var(--color-ink-muted)" }}>
          {error.message || "An unexpected error occurred while loading this page."}
        </p>
        {error.digest && (
          <p className="text-xs mt-1 font-mono" style={{ color: "var(--color-ink-faint)" }}>
            Ref: {error.digest}
          </p>
        )}
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
        style={{ backgroundColor: "var(--color-accent)", color: "#fff" }}
      >
        <RotateCcw size={14} /> Try again
      </button>
    </div>
  );
}
