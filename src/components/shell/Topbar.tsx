"use client";

import { useState, useEffect } from "react";
import { Bell, LogOut } from "lucide-react";
import { Breadcrumbs } from "./Breadcrumbs";
import { useRouter } from "next/navigation";

export function Topbar() {
  const router = useRouter();
  const [user, setUser] = useState<{ login: string; name: string | null; avatarUrl?: string } | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d?.user ?? null))
      .catch(() => setUser(null));
  }, []);

  const displayName = user ? (user.name || user.login) : "User";
  const initial = displayName.charAt(0).toUpperCase();

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <header
      className="flex items-center gap-4 px-5"
      style={{
        height: "64px",
        backgroundColor: "var(--color-sidebar)",
        borderBottom: "1px solid var(--color-border)",
        flexShrink: 0,
      }}
    >
      {/* Breadcrumbs */}
      <div className="flex-1">
        <Breadcrumbs />
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Welcome */}
        <span className="text-sm hidden md:block" style={{ color: "var(--color-ink-muted)" }}>
          {user ? (
            <>
              Welcome{" "}
              <span style={{ color: "var(--color-ink)", fontWeight: 500 }}>{displayName}</span>
            </>
          ) : null}
        </span>

        {/* Avatar */}
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={displayName}
            className="rounded-full flex-shrink-0 object-cover"
            style={{ width: "32px", height: "32px", border: "1px solid var(--color-border)" }}
          />
        ) : (
          <div
            className="flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0"
            style={{
              width: "32px",
              height: "32px",
              background: "linear-gradient(135deg, var(--color-accent), #6B8FFF)",
              color: "white",
            }}
          >
            {initial}
          </div>
        )}

        {/* Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-1.5 rounded-md relative hover:bg-[var(--color-surface-2)]"
            style={{ color: "var(--color-ink-muted)" }}
            aria-label="Notifications"
          >
            <Bell size={16} />
            <span
              className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--color-accent)" }}
            />
          </button>
          
          {showNotifications && (
            <div 
              className="absolute right-0 mt-2 w-72 rounded-xl shadow-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2"
            >
              <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
                <span className="font-semibold text-sm text-[var(--color-ink)]">Notifications</span>
                <span className="text-xs text-[var(--color-accent)] font-medium bg-[rgba(47,91,255,0.1)] px-2 py-0.5 rounded-full">2 New</span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                <div className="px-4 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer">
                  <p className="text-sm font-medium text-[var(--color-ink)] mb-0.5">Scan Completed</p>
                  <p className="text-xs text-[var(--color-ink-muted)]">PQC scan finished on aws/us-east-1/production-mock with 2 findings.</p>
                  <p className="text-[10px] text-[var(--color-ink-faint)] mt-1.5">Just now</p>
                </div>
                <div className="px-4 py-3 hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer">
                  <p className="text-sm font-medium text-[var(--color-ink)] mb-0.5">Welcome to ECDAT Atlas</p>
                  <p className="text-xs text-[var(--color-ink-muted)]">Your workspace is ready. Try connecting a repository to get started.</p>
                  <p className="text-[10px] text-[var(--color-ink-faint)] mt-1.5">1 hour ago</p>
                </div>
              </div>
              <div className="px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-surface-2)] text-center">
                <button className="text-xs font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
                  Mark all as read
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
