"use client";

/**
 * "+ Generate Report" — Phase 5, Step 7.
 *
 * A report is the output of a scan, not its own concept: this reuses the
 * existing repository list (GET /api/repositories) and the existing manual
 * scan trigger (POST /api/repositories/{id}/scan, already used by the
 * Repositories page's "Scan now" button) rather than inventing a
 * POST /api/reports/generate endpoint. The Reports list itself picks up the
 * new report automatically once that scan completes and its CBOM is ready.
 */
import { useState, useEffect, useRef } from "react";
import type { Repository } from "@/fixtures/types";
import { ChevronDown } from "lucide-react";

export function GenerateReportButton() {
  const [open, setOpen] = useState(false);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(false);
  const [queuedFor, setQueuedFor] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || repos.length > 0) return;
    fetch("/api/repositories")
      .then((r) => r.json())
      .then((data) => setRepos(Array.isArray(data) ? data : []))
      .catch(() => setRepos([]));
  }, [open, repos.length]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const triggerScan = async (repo: Repository) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/repositories/${repo.id}/scan`, { method: "POST" });
      if (res.ok) {
        setQueuedFor(repo.fullName);
        setOpen(false);
      }
    } catch {
      // ignore — button stays available to retry
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5"
        style={{ backgroundColor: "var(--color-accent)", color: "#fff" }}
      >
        + Generate Report
        <ChevronDown size={14} />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 rounded-lg overflow-hidden z-10"
          style={{
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            minWidth: "260px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          <p
            className="text-xs px-3 py-2"
            style={{ color: "var(--color-ink-faint)", borderBottom: "1px solid var(--color-border)" }}
          >
            Scan a repository to generate its report
          </p>
          {repos.length === 0 && (
            <p className="text-xs px-3 py-3" style={{ color: "var(--color-ink-muted)" }}>
              No connected repositories.
            </p>
          )}
          {repos.map((repo) => (
            <button
              key={repo.id}
              disabled={loading}
              onClick={() => triggerScan(repo)}
              className="w-full text-left text-xs px-3 py-2 disabled:opacity-50"
              style={{ color: "var(--color-ink)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-row)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              {repo.fullName}
            </button>
          ))}
        </div>
      )}

      {queuedFor && (
        <p className="absolute right-0 mt-1 text-xs whitespace-nowrap" style={{ color: "var(--color-safe)" }}>
          Scan queued for {queuedFor} — its report will appear here once complete.
        </p>
      )}
    </div>
  );
}
