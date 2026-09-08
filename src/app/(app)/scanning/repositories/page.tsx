"use client";

import { useState, useEffect } from "react";
import type { Repository } from "@/fixtures/types";
import { StatusPill } from "@/components/ui/Pill";
import {
  Search, Plus, ExternalLink, GitBranch,
  Calendar, Cpu, Globe, Play, RefreshCw, Link2
} from "lucide-react";
import { formatRelativeTime, formatDate, truncateHash } from "@/lib/format";

const GITHUB_APP_SLUG = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG ?? "ecdat-atlas";

const criticality_colors: Record<string, string> = {
  Critical: "#F0516B",
  High: "#F79552",
  Medium: "#F2C14E",
  Low: "#3FCF8E",
};

function ConnectBanner() {
  return (
    <div
      className="flex items-center justify-between gap-6 rounded-xl p-5"
      style={{
        background: "linear-gradient(135deg, rgba(47,91,255,0.12) 0%, rgba(139,92,246,0.12) 100%)",
        border: "1px solid rgba(47,91,255,0.3)",
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: "rgba(47,91,255,0.2)" }}
        >
          <Link2 size={20} style={{ color: "var(--color-accent)" }} />
        </div>
        <div>
          <p className="font-semibold text-sm" style={{ color: "var(--color-ink)" }}>
            Connect GitHub Repositories
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
            Install the GitHub App to grant access to repositories and start automatic scanning on every push.
          </p>
        </div>
      </div>
      <a
        href={`https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold flex-shrink-0"
        style={{
          backgroundColor: "var(--color-accent)",
          color: "#fff",
          textDecoration: "none",
        }}
      >
        <Link2 size={14} />
        Install GitHub App
        <ExternalLink size={12} />
      </a>
    </div>
  );
}

export default function RepositoriesPage() {
  const [query, setQuery] = useState("");
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState<Record<string, boolean>>({});

  const load = () => {
    setLoading(true);
    fetch("/api/repositories")
      .then((r) => r.json())
      .then((data) => setRepos(Array.isArray(data) ? data : []))
      .catch(() => setRepos([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const triggerScan = async (repoId: string) => {
    setScanning((s) => ({ ...s, [repoId]: true }));
    try {
      const res = await fetch(`/api/repositories/${repoId}/scan`, { method: "POST" });
      if (res.ok) {
        // Refresh list after a short delay so status updates
        setTimeout(load, 1000);
      }
    } catch {
      // ignore
    } finally {
      setTimeout(() => setScanning((s) => ({ ...s, [repoId]: false })), 2000);
    }
  };

  const filtered = repos.filter((r) =>
    r.fullName.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
          Agents List ({repos.length})
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-ink-muted)",
            }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <a
            href={`https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: "var(--color-accent)",
              color: "#fff",
              textDecoration: "none",
            }}
          >
            <Plus size={14} />
            Add Repository
          </a>
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
              placeholder="Search by agent name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "var(--color-ink)", caretColor: "var(--color-accent)" }}
            />
          </div>
        </div>
      </div>

      {/* Connect banner (always visible as a shortcut) */}
      <ConnectBanner />

      {/* Loading state */}
      {loading && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl animate-pulse"
              style={{
                height: "180px",
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            />
          ))}
        </div>
      )}

      {/* Cards grid */}
      {!loading && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {filtered.map((repo) => (
            <div
              key={repo.id}
              className="rounded-xl p-5 flex flex-col gap-3"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--color-accent)";
                e.currentTarget.style.boxShadow =
                  "0 0 0 1px rgba(47,91,255,0.2), 0 8px 24px rgba(0,0,0,0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-sm font-semibold truncate"
                  style={{ color: "var(--color-ink)" }}
                >
                  {repo.name}
                </span>
                <div className="flex items-center gap-1.5">
                  {repo.lastScanStatus && <StatusPill status={repo.lastScanStatus} />}
                </div>
              </div>

              <div
                className="flex flex-col gap-2 text-xs"
                style={{ color: "var(--color-ink-muted)" }}
              >
                <div className="flex items-center gap-2">
                  <Globe size={12} style={{ color: "var(--color-ink-faint)", flexShrink: 0 }} />
                  <span className="truncate">{repo.fullName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <GitBranch size={12} style={{ color: "var(--color-ink-faint)", flexShrink: 0 }} />
                  <span>{repo.defaultBranch}</span>
                  <span style={{ color: "var(--color-ink-faint)" }}>·</span>
                  <span className="font-mono">{truncateHash(repo.lastCommitSha)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: "var(--color-ink-faint)" }}>Lang:</span>
                  <span>{repo.language}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={12} style={{ color: "var(--color-ink-faint)", flexShrink: 0 }} />
                  <span>Added {formatDate(repo.connectedAt, "MMM d, yyyy")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Cpu size={12} style={{ color: "var(--color-ink-faint)", flexShrink: 0 }} />
                  <span>
                    {repo.lastScanAt
                      ? `Last scan ${formatRelativeTime(repo.lastScanAt)}`
                      : "Not yet scanned"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-1.5 text-xs">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: criticality_colors[repo.criticality] ?? "#888",
                    }}
                  />
                  <span style={{ color: "var(--color-ink-faint)" }}>
                    {repo.criticality}
                  </span>
                </div>
                <button
                  onClick={() => triggerScan(repo.id)}
                  disabled={scanning[repo.id]}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs disabled:opacity-50"
                  style={{
                    backgroundColor: "rgba(47,91,255,0.1)",
                    color: "var(--color-accent)",
                    border: "1px solid rgba(47,91,255,0.2)",
                    transition: "all 0.15s",
                  }}
                >
                  <Play size={11} fill="currentColor" />
                  {scanning[repo.id] ? "Queuing…" : "Scan now"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-3">
          <Link2 size={36} style={{ color: "var(--color-ink-faint)" }} />
          <p style={{ color: "var(--color-ink-muted)" }}>
            No repositories found.{" "}
            <a
              href={`https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--color-accent)" }}
            >
              Install the GitHub App
            </a>{" "}
            to add your first repository.
          </p>
        </div>
      )}

      <div
        className="text-center py-2"
        style={{ color: "var(--color-ink-faint)", fontSize: "12px" }}
      >
        Showing {filtered.length} of {repos.length} repositories
      </div>
    </div>
  );
}
