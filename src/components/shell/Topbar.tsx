"use client";

import { useState, useEffect } from "react";
import { Bell, LogOut } from "lucide-react";
import { Breadcrumbs } from "./Breadcrumbs";
import { useRouter } from "next/navigation";

export function Topbar() {
  const router = useRouter();
  const [user, setUser] = useState<{ login: string; name: string | null; avatarUrl?: string } | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

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
        <button
          className="p-1.5 rounded-md relative"
          style={{ color: "var(--color-ink-muted)" }}
          aria-label="Notifications"
        >
          <Bell size={16} />
          <span
            className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full"
            style={{ backgroundColor: "var(--color-accent)" }}
          />
        </button>

      </div>
    </header>
  );
}
