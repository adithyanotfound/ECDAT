"use client";

/**
 * Top bar: where you are (breadcrumbs), what just happened (recent scans,
 * from real data) and who you are. The bell shows a dot while a scan is
 * running or when one failed since you last opened it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown, LogOut, Menu } from "lucide-react";
import { Breadcrumbs } from "./Breadcrumbs";
import { StatusPill } from "@/components/ui/Pill";
import { formatRelativeTime } from "@/lib/format";
import type { Scan } from "@/fixtures/types";

interface User {
  login: string;
  name: string | null;
  avatarUrl?: string;
}

function useOutsideClose(open: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close, ref]);
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [seenAt, setSeenAt] = useState<number>(0);
  const bellRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const closeBell = useCallback(() => setBellOpen(false), []);
  const closeUser = useCallback(() => setUserOpen(false), []);
  useOutsideClose(bellOpen, closeBell, bellRef);
  useOutsideClose(userOpen, closeUser, userRef);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d?.user ?? null))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/scans?pageSize=6")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => alive && d && setScans(d.items ?? []))
        .catch(() => undefined);
    load();
    const id = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const displayName = user ? user.name || user.login : "";
  const initial = (displayName || "?").charAt(0).toUpperCase();
  const needsAttention = scans.some(
    (s) =>
      s.status === "Running" ||
      s.status === "Queued" ||
      (s.status === "Failed" && new Date(s.startedAt).getTime() > seenAt),
  );

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // A full page load clears every cached view of the signed-in user's data.
      window.location.replace("/login");
    }
  };

  return (
    <header className="no-print sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-md sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open menu"
        className="-ml-1 rounded-lg p-2 text-ink-2 hover:bg-surface-2 lg:hidden"
      >
        <Menu size={19} />
      </button>

      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>

      {/* Recent scans */}
      <div ref={bellRef} className="relative">
        <button
          type="button"
          onClick={() => {
            setBellOpen((o) => !o);
            setSeenAt(Date.now());
          }}
          aria-label="Recent scans"
          aria-expanded={bellOpen}
          className="relative flex size-9 items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2"
        >
          <Bell size={18} />
          {needsAttention && <span className="absolute top-2 right-2 size-2 rounded-full bg-gold ring-2 ring-bg" />}
        </button>
        {bellOpen && (
          <div className="absolute right-0 mt-2 w-[340px] overflow-hidden rounded-2xl border border-line bg-surface shadow-pop animate-pop-in">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-sm font-semibold text-ink">Recent scans</p>
              <Link
                href="/scanning/scans"
                onClick={closeBell}
                className="text-[13px] font-medium text-gold-ink hover:underline"
              >
                See all
              </Link>
            </div>
            {scans.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted">
                No scans yet. Connect a repository and the first scan starts on its own.
              </p>
            ) : (
              <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                {scans.map((s) => (
                  <li key={s.id}>
                    <Link
                      href="/scanning/scans"
                      onClick={closeBell}
                      className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-2/70"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-medium text-ink">
                          {s.repositoryFullName}
                        </span>
                        <span className="text-xs text-muted">
                          {s.trigger.charAt(0) + s.trigger.slice(1).toLowerCase()} scan ·{" "}
                          {formatRelativeTime(s.startedAt)}
                        </span>
                      </span>
                      <StatusPill status={s.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Account */}
      <div ref={userRef} className="relative">
        <button
          type="button"
          onClick={() => setUserOpen((o) => !o)}
          aria-expanded={userOpen}
          aria-label="Account menu"
          className="flex items-center gap-2 rounded-xl py-1 pr-2 pl-1 transition-colors hover:bg-surface-2"
        >
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- small GitHub avatar, not worth an image loader
            <img src={user.avatarUrl} alt="" className="size-8 rounded-full border border-line object-cover" />
          ) : (
            <span className="flex size-8 items-center justify-center rounded-full bg-charcoal text-xs font-semibold text-gold-bright">
              {initial}
            </span>
          )}
          <span className="hidden max-w-[140px] truncate text-[13.5px] font-medium text-ink sm:block">
            {displayName}
          </span>
          <ChevronDown size={14} className="hidden text-muted sm:block" />
        </button>
        {userOpen && (
          <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop animate-pop-in">
            <div className="border-b border-line px-4 py-3">
              <p className="text-xs text-muted">Signed in as</p>
              <p className="truncate text-sm font-semibold text-ink">{displayName || "…"}</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[13.5px] text-ink-2 transition-colors hover:bg-surface-2"
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
