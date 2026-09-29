"use client";

/**
 * Repositories: everything being watched. Layer 1 is a count of what's
 * connected and whether scans are healthy; layer 2 the list; clicking a name
 * opens that repository's own page with its findings and history.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Cloud,
  FolderGit2,
  GitBranch,
  Loader2,
  Play,
  PlugZap,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { GithubIcon } from "@/components/ui/icons";
import type { Repository } from "@/fixtures/types";
import { PageHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FilterChips, SearchInput } from "@/components/ui/Controls";
import { StatusPill, Badge } from "@/components/ui/Pill";
import { EmptyState, Notice, SkeletonRows } from "@/components/ui/States";
import { StatCard } from "@/components/ui/StatCard";
import { Modal } from "@/components/ui/Drawer";
import { InfoHint } from "@/components/ui/InfoHint";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import { AddGithubRepoDialog, ConnectAwsDialog } from "@/components/repos/ConnectDialogs";
import { formatRelativeTime, isCommitSha, truncateHash } from "@/lib/format";
import type { Tone } from "@/lib/tones";

const APP_SLUG = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG ?? "ecdat-atlas";

const CRITICALITY_TONE: Record<Repository["criticality"], Tone> = {
  Critical: "critical",
  High: "high",
  Medium: "moderate",
  Low: "safe",
};

// Messages for the redirect GitHub sends back after installing the App.
const REDIRECT_NOTICE: Record<string, { tone: Tone; title: string; body: string }> = {
  connected: {
    tone: "safe",
    title: "GitHub App connected",
    body: "Your repositories are being added and their first scans have started.",
  },
  uninstalled: {
    tone: "neutral",
    title: "GitHub App removed",
    body: "Scanning is paused for repositories that came from that installation.",
  },
  setup_failed: {
    tone: "critical",
    title: "The GitHub App couldn't be connected",
    body: "Check the App ID and private key on the server, then try installing again.",
  },
  missing_installation: {
    tone: "critical",
    title: "GitHub didn't say which installation to use",
    body: "Start the install again from the Add menu.",
  },
};

type SourceFilter = "GITHUB" | "AWS";

export default function RepositoriesPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceFilter | "">("");
  const [scanning, setScanning] = useState<Record<string, boolean>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<"github" | "aws" | null>(null);
  const [toDelete, setToDelete] = useState<Repository | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [redirectNotice, setRedirectNotice] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const toastSeq = useRef(0);
  const [syncing, setSyncing] = useState(false);

  // State is only set in the request's callbacks, so calling this from an effect
  // (and from the buttons) doesn't trigger a synchronous re-render.
  const load = useCallback(
    () =>
      fetch("/api/repositories")
        .then((r) => r.json())
        .then((data) => setRepos(Array.isArray(data) ? data : []))
        .catch(() => setRepos([]))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  // ?connected=1, ?uninstalled=1 or ?error=… after the GitHub App round trip.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const key = p.get("error") ?? (p.has("connected") ? "connected" : p.has("uninstalled") ? "uninstalled" : null);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL once on mount
    if (key && REDIRECT_NOTICE[key]) setRedirectNotice(key);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false);
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const notify = (t: Omit<ToastMessage, "id">) => setToast({ ...t, id: ++toastSeq.current });

  const triggerScan = async (repo: Repository) => {
    setScanning((s) => ({ ...s, [repo.id]: true }));
    try {
      const res = await fetch(`/api/repositories/${repo.id}/scan`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "The scan couldn't start.");
      notify({
        tone: "success",
        title: data.alreadyRunning ? "A scan is already running" : "Scan started",
        body: repo.fullName,
        action: { label: "Watch the live log", href: `/scanning/scans?scan=${data.scanId}` },
      });
      load();
    } catch (err) {
      notify({ tone: "error", title: "Scan didn't start", body: err instanceof Error ? err.message : String(err) });
    } finally {
      setScanning((s) => ({ ...s, [repo.id]: false }));
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/repositories/${toDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Delete failed.");
      notify({ tone: "success", title: "Removed", body: `${toDelete.fullName} and everything found in it.` });
      setToDelete(null);
      load();
    } catch (err) {
      notify({ tone: "error", title: "Couldn't remove it", body: err instanceof Error ? err.message : String(err) });
    } finally {
      setDeleting(false);
    }
  };

  // Pull in this App's installations on the user's GitHub account, in case
  // GitHub's post-install redirect or a webhook never reached ECDAT.
  const syncWithGithub = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/github/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Syncing with GitHub didn't work.");
      if (data.installations === 0) {
        notify({
          tone: "error",
          title: "The GitHub App isn't installed on your account",
          body: "Install it and choose which repositories ECDAT Atlas can read, then sync again.",
          action: { label: "Install the GitHub App", href: `https://github.com/apps/${APP_SLUG}/installations/new` },
        });
      } else {
        const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
        notify({
          tone: "success",
          title: data.added ? `Added ${count(data.added, "repository", "repositories")}` : "Everything is up to date",
          body: `${count(data.repositories, "repository", "repositories")} shared with the App${
            data.scansStarted ? `; ${count(data.scansStarted, "first scan", "first scans")} started` : ""
          }.`,
          action: data.scansStarted ? { label: "Watch the scans", href: "/scanning/scans" } : undefined,
        });
      }
      load();
    } catch (err) {
      notify({ tone: "error", title: "Sync didn't work", body: err instanceof Error ? err.message : String(err) });
    } finally {
      setSyncing(false);
    }
  };

  const onAdded = (_id: string, scanId?: string) => {
    notify({
      tone: "success",
      title: scanId ? "Added, and the first scan has started" : "Added",
      body: "Results appear here in a minute or two.",
      action: scanId ? { label: "Watch the live log", href: `/scanning/scans?scan=${scanId}` } : undefined,
    });
    load();
  };

  const sourceOf = (r: Repository): SourceFilter => (r.sourceType === "AWS" ? "AWS" : "GITHUB");
  const filtered = repos.filter(
    (r) => r.fullName.toLowerCase().includes(query.toLowerCase()) && (!source || sourceOf(r) === source),
  );
  const counts = {
    total: repos.length,
    scanned: repos.filter((r) => r.lastScanStatus === "Completed").length,
    active: repos.filter((r) => r.lastScanStatus === "Running" || r.lastScanStatus === "Queued").length,
    failed: repos.filter((r) => r.lastScanStatus === "Failed").length,
    aws: repos.filter((r) => sourceOf(r) === "AWS").length,
  };
  const notice = redirectNotice ? REDIRECT_NOTICE[redirectNotice] : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Connect & scan"
        title="Repositories"
        description="The code and cloud accounts ECDAT Atlas watches. Each one is scanned when it's added, whenever you press Scan now, and on every push if it came through the GitHub App."
        actions={
          <>
            <Button onClick={load} aria-label="Refresh">
              <RefreshCw size={15} /> Refresh
            </Button>
            <Button
              onClick={syncWithGithub}
              disabled={syncing}
              title="Bring in every repository you've shared with the GitHub App"
            >
              {syncing ? <Loader2 size={15} className="animate-spin" /> : <GithubIcon size={15} />}
              {syncing ? "Syncing…" : "Sync with GitHub"}
            </Button>
            <div ref={menuRef} className="relative">
              <Button variant="primary" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen}>
                <Plus size={16} /> Add <ChevronDown size={14} className="opacity-70" />
              </Button>
              {menuOpen && (
                <div className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-pop animate-pop-in">
                  {[
                    {
                      icon: <GithubIcon size={17} />,
                      title: "Public GitHub repository",
                      body: "By name; nothing to install",
                      onClick: () => setDialog("github"),
                    },
                    {
                      icon: <Cloud size={17} />,
                      title: "AWS account",
                      body: "KMS keys, ACM certificates, code",
                      onClick: () => setDialog("aws"),
                    },
                  ].map((o) => (
                    <button
                      key={o.title}
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        o.onClick();
                      }}
                      className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
                    >
                      <span className="mt-0.5 text-gold-ink">{o.icon}</span>
                      <span>
                        <span className="block text-[13.5px] font-medium text-ink">{o.title}</span>
                        <span className="block text-xs text-muted">{o.body}</span>
                      </span>
                    </button>
                  ))}
                  <a
                    href={`https://github.com/apps/${APP_SLUG}/installations/new`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2"
                  >
                    <span className="mt-0.5 text-gold-ink">
                      <PlugZap size={17} />
                    </span>
                    <span>
                      <span className="block text-[13.5px] font-medium text-ink">Install the GitHub App</span>
                      <span className="block text-xs text-muted">Private repos, and a scan on every push</span>
                    </span>
                  </a>
                </div>
              )}
            </div>
          </>
        }
      />

      {notice && (
        <Notice tone={notice.tone} title={notice.title}>
          {notice.body}
        </Notice>
      )}

      {/* Layer 1: the state of things */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Connected"
          value={loading ? "–" : counts.total}
          subtitle={`${counts.aws} AWS, ${counts.total - counts.aws} GitHub`}
          tone="gold"
        />
        <StatCard title="Scanned" value={loading ? "–" : counts.scanned} subtitle="Last scan finished" tone="safe" />
        <StatCard title="Scanning now" value={loading ? "–" : counts.active} subtitle="Waiting or running" tone="low" />
        <StatCard
          title="Last scan failed"
          value={loading ? "–" : counts.failed}
          subtitle={counts.failed ? "Open Scans to read the log" : "None failing"}
          tone={counts.failed ? "critical" : "neutral"}
          href={counts.failed ? "/scanning/scans" : undefined}
        />
      </section>

      {/* Layer 2: the list */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          label="Source"
          value={source}
          onChange={setSource}
          allCount={repos.length}
          options={[
            { value: "GITHUB", label: "GitHub", count: counts.total - counts.aws },
            { value: "AWS", label: "AWS", count: counts.aws },
          ]}
        />
        <SearchInput value={query} onChange={setQuery} placeholder="Search repositories" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/70 text-left text-[12.5px] text-muted">
                <th scope="col" className="px-4 py-3 font-medium">
                  Repository
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Branch
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="inline-flex items-center gap-1">
                    Importance <InfoHint label="Importance" term="criticality" />
                  </span>
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Last scan
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows rows={5} cols={5} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    {repos.length === 0 ? (
                      <EmptyState
                        icon={<FolderGit2 size={22} />}
                        title="Nothing connected yet"
                        action={
                          <>
                            <Button variant="primary" onClick={() => setDialog("github")}>
                              <GithubIcon size={16} /> Add a public repository
                            </Button>
                            <Button onClick={() => setDialog("aws")}>
                              <Cloud size={16} /> Connect AWS
                            </Button>
                            <Button onClick={syncWithGithub} disabled={syncing}>
                              <GithubIcon size={16} /> {syncing ? "Syncing…" : "Sync with GitHub"}
                            </Button>
                          </>
                        }
                      >
                        Add a repository or an AWS account and its first scan starts straight away.
                      </EmptyState>
                    ) : (
                      <EmptyState title="No matches">Nothing matches your search or filter.</EmptyState>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((repo) => {
                  const aws = sourceOf(repo) === "AWS";
                  return (
                    <tr
                      key={repo.id}
                      className="border-b border-line transition-colors last:border-0 hover:bg-surface-2/50"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2">
                            {aws ? <Cloud size={16} /> : <GitBranch size={16} />}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/scanning/repositories/${repo.id}`}
                              className="block truncate font-semibold text-ink hover:text-gold-ink hover:underline"
                            >
                              {repo.name}
                            </Link>
                            <p className="truncate text-xs text-muted">
                              {repo.fullName}
                              {repo.language && repo.language !== "Unknown" && ` · ${repo.language}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-[13px] text-ink-2">{repo.defaultBranch}</p>
                        {isCommitSha(repo.lastCommitSha) && (
                          <p className="font-mono text-xs text-muted">{truncateHash(repo.lastCommitSha)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge tone={CRITICALITY_TONE[repo.criticality] ?? "neutral"}>{repo.criticality}</Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          {repo.lastScanStatus ? (
                            <StatusPill status={repo.lastScanStatus} />
                          ) : (
                            <Badge>Not scanned</Badge>
                          )}
                          <span className="text-xs text-muted">
                            {repo.lastScanAt ? formatRelativeTime(repo.lastScanAt) : "Never"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" onClick={() => triggerScan(repo)} disabled={scanning[repo.id]}>
                            {scanning[repo.id] ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                            {scanning[repo.id] ? "Starting…" : "Scan now"}
                          </Button>
                          <button
                            type="button"
                            onClick={() => setToDelete(repo)}
                            aria-label={`Remove ${repo.fullName}`}
                            title="Remove"
                            className="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-critical-tint hover:text-critical-ink"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {!loading && repos.length > 0 && (
        <p className="text-[13px] text-muted">
          Showing {filtered.length} of {repos.length}. This list refreshes every few seconds.
        </p>
      )}

      <AddGithubRepoDialog open={dialog === "github"} onClose={() => setDialog(null)} onAdded={onAdded} />
      <ConnectAwsDialog open={dialog === "aws"} onClose={() => setDialog(null)} onAdded={onAdded} />

      <Modal
        open={!!toDelete}
        onClose={() => !deleting && setToDelete(null)}
        icon={<Trash2 size={19} />}
        title={`Remove ${toDelete?.name ?? "repository"}?`}
        description={
          <>
            This deletes <b className="text-ink">{toDelete?.fullName}</b> from ECDAT Atlas along with every scan, asset
            and finding from it. Your code on GitHub or AWS isn&apos;t touched. This can&apos;t be undone.
          </>
        }
        footer={
          <>
            <Button onClick={() => setToDelete(null)} disabled={deleting}>
              Keep it
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 size={15} className="animate-spin" />}
              {deleting ? "Removing…" : "Remove permanently"}
            </Button>
          </>
        }
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
