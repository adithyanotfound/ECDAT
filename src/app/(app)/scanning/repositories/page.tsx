"use client";

import { useState, useEffect } from "react";
import type { Repository } from "@/fixtures/types";
import { StatusPill } from "@/components/ui/Pill";
import { X } from "lucide-react";
import { Search, Plus, ExternalLink, RefreshCw, Play, Link2, GitBranch, Cloud, Trash2 } from "lucide-react";
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
  const [scanAlert, setScanAlert] = useState<{ scanId: string, repoId: string } | null>(null);
  const [awsModalOpen, setAwsModalOpen] = useState(false);
  const [awsForm, setAwsForm] = useState({ name: "", accessKeyId: "", secretAccessKey: "", region: "us-east-1" });
  const [awsLoading, setAwsLoading] = useState(false);
  const [awsError, setAwsError] = useState("");
  const [repoToDelete, setRepoToDelete] = useState<{ id: string, name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
        setScanAlert({ scanId: data.scanId, repoId });
        load();
      }
    } catch {
      // ignore
    } finally {
      setScanning((s) => ({ ...s, [repoId]: false }));
    }
  };

  const connectAws = async (e: React.FormEvent) => {
    e.preventDefault();
    setAwsLoading(true);
    setAwsError("");
    try {
      const res = await fetch("/api/repositories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "AWS",
          ...awsForm
        })
      });
      if (res.ok) {
        setAwsModalOpen(false);
        setAwsForm({ name: "", accessKeyId: "", secretAccessKey: "", region: "us-east-1" });
        load();
      } else {
        const err = await res.json();
        setAwsError(err.error || "Failed to connect AWS account");
      }
    } catch (e) {
      setAwsError("Network error. Please try again.");
    } finally {
      setAwsLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!repoToDelete) return;
    setDeleteLoading(true);
    
    try {
      const res = await fetch(`/api/repositories/${repoToDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        setRepoToDelete(null);
        load();
      } else {
        alert("Failed to delete repository.");
      }
    } catch (e) {
      alert("Network error while deleting.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = repos.filter((r) =>
    r.fullName.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <div className="flex flex-col gap-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-ink)" }}>
              Repositories
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
            onClick={() => setAwsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
            style={{ color: "var(--color-ink)" }}
          >
            <Cloud size={14} /> Connect AWS
          </button>
          <a
            href={`https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium no-underline"
            style={{ backgroundColor: "var(--color-accent)", color: "#fff" }}
          >
            <Plus size={14} /> Add Repository
          </a>
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
                        {repo.sourceType === "AWS" ? (
                          <Cloud size={13} style={{ color: "var(--color-ink-faint)", flexShrink: 0 }} />
                        ) : (
                          <GitBranch size={13} style={{ color: "var(--color-ink-faint)", flexShrink: 0 }} />
                        )}
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
                      <div className="flex items-center justify-end gap-2">
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
                        <button
                          onClick={() => setRepoToDelete({ id: repo.id, name: repo.fullName })}
                          className="p-1.5 rounded hover:bg-red-50 text-[var(--color-ink-muted)] hover:text-red-500 transition-colors"
                          title="Delete Repository"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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

      </div>

      {scanAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in duration-200">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl p-6 w-full max-w-md relative">
            <button onClick={() => setScanAlert(null)} className="absolute top-4 right-4 text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
              <X size={18} />
            </button>
            <h3 className="text-lg font-bold text-[var(--color-ink)] mb-2">Scan Queued!</h3>
            <p className="text-sm text-[var(--color-ink-muted)] mb-4">
              Your cryptographic scan has been successfully triggered.
            </p>
            <div className="bg-[var(--color-surface-2)] rounded p-3 mb-6 border border-[var(--color-border)]">
              <p className="text-xs font-mono text-[var(--color-ink)]">Scan ID: {scanAlert.scanId}</p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setScanAlert(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--color-border)] text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]"
              >
                OK
              </button>
              <a 
                href="/scanning/scans"
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:opacity-90"
              >
                View Live Logs
              </a>
            </div>
          </div>
        </div>
      )}

      {awsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in duration-200">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl p-6 w-full max-w-md relative">
            <button onClick={() => setAwsModalOpen(false)} className="absolute top-4 right-4 text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
              <X size={18} />
            </button>
            <h3 className="text-lg font-bold text-[var(--color-ink)] mb-2 flex items-center gap-2">
              <Cloud size={20} /> Connect AWS Account
            </h3>
            <p className="text-sm text-[var(--color-ink-muted)] mb-6">
              Enter a read-only IAM user credentials to scan KMS and ACM assets.
            </p>
            
            {awsError && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded text-sm">
                {awsError}
              </div>
            )}
            
            <form onSubmit={connectAws} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-muted)] mb-1">Account Label</label>
                <input 
                  required
                  type="text" 
                  value={awsForm.name}
                  onChange={e => setAwsForm({...awsForm, name: e.target.value})}
                  placeholder="e.g. production-us-east-1"
                  className="w-full px-3 py-2 bg-transparent border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-muted)] mb-1">Access Key ID</label>
                <input 
                  required
                  type="text" 
                  value={awsForm.accessKeyId}
                  onChange={e => setAwsForm({...awsForm, accessKeyId: e.target.value})}
                  className="w-full px-3 py-2 bg-transparent border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-muted)] mb-1">Secret Access Key</label>
                <input 
                  required
                  type="password" 
                  value={awsForm.secretAccessKey}
                  onChange={e => setAwsForm({...awsForm, secretAccessKey: e.target.value})}
                  className="w-full px-3 py-2 bg-transparent border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-muted)] mb-1">Region</label>
                <input 
                  required
                  type="text" 
                  value={awsForm.region}
                  onChange={e => setAwsForm({...awsForm, region: e.target.value})}
                  className="w-full px-3 py-2 bg-transparent border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]" 
                />
              </div>
              
              <div className="flex justify-end gap-3 mt-4">
                <button 
                  type="button"
                  onClick={() => setAwsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--color-border)] text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={awsLoading}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                >
                  {awsLoading ? "Connecting..." : "Connect"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {repoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in duration-200">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl p-6 w-full max-w-md relative">
            <button onClick={() => setRepoToDelete(null)} className="absolute top-4 right-4 text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
              <X size={18} />
            </button>
            <h3 className="text-lg font-bold text-[var(--color-ink)] mb-2 flex items-center gap-2">
              <Trash2 size={20} className="text-red-500" /> Delete Repository
            </h3>
            <p className="text-sm text-[var(--color-ink-muted)] mb-6">
              Are you sure you want to delete repository <strong className="text-[var(--color-ink)]">'{repoToDelete.name}'</strong>? This will permanently delete all associated scans, assets, and findings. This action cannot be undone.
            </p>
            
            <div className="flex justify-end gap-3 mt-4">
              <button 
                type="button"
                onClick={() => setRepoToDelete(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--color-border)] text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]"
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={confirmDelete}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 flex items-center gap-2"
              >
                {deleteLoading ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
