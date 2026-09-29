"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "./Button";

interface ErrorStateProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}

/** Shared body for every route-segment error.tsx (IMPLEMENTATION_PLAN.md §Phase 5 "Hardening"). */
export function ErrorState({ error, reset, title = "Something went wrong" }: ErrorStateProps) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-line bg-surface p-12 text-center shadow-card">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-critical-tint text-critical-ink">
        <AlertTriangle size={22} />
      </span>
      <div>
        <p className="text-lg font-semibold text-ink">{title}</p>
        <p className="mt-1 text-sm text-muted">
          {error.message || "This page couldn't load. Nothing was changed; try again in a moment."}
        </p>
        {error.digest && <p className="mt-2 font-mono text-xs text-faint">Reference: {error.digest}</p>}
      </div>
      <Button variant="primary" onClick={reset}>
        <RotateCcw size={14} /> Try again
      </Button>
    </div>
  );
}
