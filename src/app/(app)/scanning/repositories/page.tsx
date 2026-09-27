"use client";

import { useState, useEffect } from "react";
import type { Repository } from "@/fixtures/types";
import { StatusPill } from "@/components/ui/Pill";
import { AddRepoModal } from "@/components/ui/AddRepoModal";
import { Search, Plus, ExternalLink, RefreshCw, Play, Link2, GitBranch } from "lucide-react";
import { formatRelativeTime, truncateHash } from "@/lib/format";

const GITHUB_APP_SLUG = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG ?? "ecdat-atlas";

const CRITICALITY_COLORS: Record<string, string> = {
  Critical: "#F0516B",
  High:     "#F79552",
  Medium:   "#F2C14E",
  Low:      "#3FCF8E",
};

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

export default function RepositoriesPage() {
  const [query, setQuery] = useState("");
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  const load = async () => {
    try {
      const r = await fetch("/api/repositories");
      const data = await r.json();
      setRepos(Array.isArray(data) ? data : []);
    } catch {
      setRepos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const triggerScan = async (repoId: string) => {
    setScanning((s) => ({ ...s, [repoId]: true }));
    try {
      const res = await fetch(`/api/repositories/${repoId}/scan`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        alert(`Scan queued!\nScan ID: ${data.scanId}\n\nGo to the 'Scans' tab to view live logs.`);
        load();
      }
    } catch {
      // ignore
    } finally {
      setScanning((s) => ({ ...s, [repoId]: false }));
    }
  };

  const filtered = repos.filter((r) =>
    r.fullName.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--color-ink)" }}>
            Agents List
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
            Connected repositories being monitored for cryptographic issues
          </p>
        </div>
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
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "var(--color-accent)", color: "#fff" }}
          >
            <Plus size={14} /> Add Repository
          </button>
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", width: "220px" }}
          >
            <Search size={14} style={{ color: "var(--color-ink-faint)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search repositories..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "var(--color-ink)", caretColor: "var(--color-accent)" }}
            />
          </div>
        </div>
      </div>

      {/* Connect banner */}
      <div
        className="flex items-center justify-between gap-6 rounded-xl p-4"
        style={{
          backgroundColor: "rgba(47,91,255,0.06)",
          border: "1px solid rgba(47,91,255,0.2)",
        }}
      >
        <div className="flex items-center gap-3">
          <Link2 size={16} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
              Connect GitHub Repositories
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
              Install the GitHub App to enable automatic scanning on every push.
            </p>
          </div>
        </div>
        <a
          href={`https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0"
          style={{ backgroundColor: "var(--color-accent)", color: "#fff", textDecoration: "none" }}
        >
          <ExternalLink size={12} /> Install GitHub App
        </a>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
        <table className="w-full">
          <thead>
            <tr>
              <th style={thStyle}>Repository</th>
              <th style={thStyle}>Branch</th>
              <th style={thStyle}>Language</th>
              <th style={thStyle}>Criticality</th>
              <th style={thStyle}>Last Scan</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} style={tdStyle}>
                        <div
                          className="rounded animate-pulse"
                          style={{ height: "14px", width: j === 0 ? "160px" : "70px", backgroundColor: "var(--color-surface-2)" }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : filtered.map((repo) => (
                  <tr
                    key={repo.id}
                    style={{ backgroundColor: "var(--color-surface)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-surface-2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--color-surface)")}
                  >
                    {/* Repo name */}
                    <td style={tdStyle}>
                      <div className="flex items-center gap-2">
                        <GitBranch size={13} style={{ color: "var(--color-ink-faint)", flexShrink: 0 }} />
                        <div>
                          <a 
                            href={`/scanning/repositories/${repo.id}`} 
                            className="font-medium text-sm hover:underline block" 
                            style={{ color: "var(--color-accent)" }}
                          >
                            {repo.name}
                          </a>
                          <p className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
                            {repo.fullName}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Branch + commit */}
                    <td style={tdStyle}>
                      <p className="text-xs" style={{ color: "var(--color-ink-muted)" }}>
                        {repo.defaultBranch}
                      </p>
                      <p className="text-xs font-mono" style={{ color: "var(--color-ink-faint)" }}>
                        {truncateHash(repo.lastCommitSha)}
                      </p>
                    </td>

                    {/* Language */}
                    <td style={tdStyle}>
                      <span className="text-xs" style={{ color: "var(--color-ink-muted)" }}>
                        {repo.language ?? "—"}
                      </span>
                    </td>

                    {/* Criticality */}
                    <td style={tdStyle}>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: CRITICALITY_COLORS[repo.criticality] ?? "#888" }}
                        />
                        <span className="text-xs" style={{ color: "var(--color-ink-muted)" }}>
                          {repo.criticality}
                        </span>
                      </div>
                    </td>

                    {/* Last scan */}
                    <td style={tdStyle}>
                      <span className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
                        {repo.lastScanAt ? formatRelativeTime(repo.lastScanAt) : "Never"}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={tdStyle}>
                      {repo.lastScanStatus
                        ? <StatusPill status={repo.lastScanStatus} />
                        : <span className="text-xs" style={{ color: "var(--color-ink-faint)" }}>—</span>
                      }
                    </td>

                    {/* Actions */}
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <button
                        onClick={() => triggerScan(repo.id)}
                        disabled={scanning[repo.id]}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
                        style={{
                          backgroundColor: "rgba(47,91,255,0.08)",
                          color: "var(--color-accent)",
                          border: "1px solid rgba(47,91,255,0.2)",
                        }}
                      >
                        <Play size={11} fill="currentColor" />
                        {scanning[repo.id] ? "Queuing…" : "Scan Now"}
                      </button>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-2">
            <Link2 size={32} style={{ color: "var(--color-ink-faint)" }} />
            <p className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
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
      </div>

      <p className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
        Showing {filtered.length} of {repos.length} repositories · Auto-refreshes every 5s
      </p>

      <AddRepoModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={load} 
      />
    </div>
  );
}
