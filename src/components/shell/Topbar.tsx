"use client";

import { Bell, Menu } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Breadcrumbs } from "./Breadcrumbs";

interface TopbarProps {
  onToggleSidebar: () => void;
}

export function Topbar({ onToggleSidebar }: TopbarProps) {
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
      {/* Hamburger */}
      <button
        onClick={onToggleSidebar}
        className="p-1.5 rounded-md transition-colors"
        style={{ color: "var(--color-ink-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-ink)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-ink-muted)")}
        aria-label="Toggle sidebar"
      >
        <Menu size={18} />
      </button>

      {/* Breadcrumbs */}
      <div className="flex-1">
        <Breadcrumbs />
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Welcome text */}
        <span
          className="text-sm hidden md:block"
          style={{ color: "var(--color-ink-muted)" }}
        >
          Welcome{" "}
          <span style={{ color: "var(--color-ink)", fontWeight: 500 }}>Saurabh</span>
        </span>

        {/* Avatar */}
        <div
          className="flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0"
          style={{
            width: "32px",
            height: "32px",
            background: "linear-gradient(135deg, var(--color-accent), #6B8FFF)",
            color: "white",
          }}
        >
          S
        </div>

        {/* Bell */}
        <button
          className="p-1.5 rounded-md relative transition-colors"
          style={{ color: "var(--color-ink-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-ink)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-ink-muted)")}
          aria-label="Notifications"
        >
          <Bell size={16} />
          <span
            className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full"
            style={{ backgroundColor: "var(--color-accent)" }}
          />
        </button>

        {/* Theme toggle */}
        <ThemeToggle />
      </div>
    </header>
  );
}
