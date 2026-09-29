"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import {
  LayoutDashboard,
  ScanLine,
  ChevronDown,
  ChevronRight,
  Package,
  AlertTriangle,
  Shield,
  Lightbulb,
  GitBranch,
  Database,
  Cpu,
  LogOut,
  Network,
} from "lucide-react";
interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard size={16} />,
  },
  {
    label: "Scanning",
    icon: <ScanLine size={16} />,
    children: [
      { label: "Repositories", href: "/scanning/repositories", icon: <GitBranch size={14} /> },
      { label: "Scans",        href: "/scanning/scans",       icon: <Cpu size={14} /> },
    ],
  },
  {
    label: "Assets",
    icon: <Package size={16} />,
    children: [
      { label: "Recommendations", href: "/assets/recommendations", icon: <Lightbulb size={14} /> },
      { label: "PQC",             href: "/assets/pqc",             icon: <Shield size={14} /> },
      { label: "Vulnerabilities", href: "/assets/vulnerabilities", icon: <AlertTriangle size={14} /> },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  const initialOpen: Record<string, boolean> = {};
  navItems.forEach((item) => {
    if (item.children) {
      initialOpen[item.label] = item.children.some((c) => c.href && pathname.startsWith(c.href));
    }
  });

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(initialOpen);
  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  const isGroupActive = (item: NavItem) =>
    item.children?.some((c) => c.href && pathname.startsWith(c.href)) ?? false;
  const isItemActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className="flex flex-col h-full"
      style={{
        width: collapsed ? "64px" : "220px",
        backgroundColor: "var(--color-sidebar)",
        borderRight: "1px solid var(--color-border)",
        flexShrink: 0,
        transition: "width 0.25s ease",
      }}
    >
      {/* Logo / collapse toggle */}
      <button
        onClick={onToggle}
        className="flex items-center gap-3 px-4 w-full"
        style={{
          borderBottom: "1px solid var(--color-border)",
          minHeight: "64px",
          background: "transparent",
          cursor: "pointer",
        }}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <div
          className="flex items-center justify-center rounded-lg flex-shrink-0"
          style={{
            width: "32px",
            height: "32px",
            background: "linear-gradient(135deg, var(--color-accent), #6B8FFF)",
          }}
        >
          {collapsed
            ? <ChevronRight size={18} color="white" />
            : <Network size={18} color="white" />
          }
        </div>
        {!collapsed && (
          <span
            className="font-bold text-lg tracking-tight"
            style={{ color: "var(--color-ink)" }}
          >
            ecdat
            <span style={{ color: "var(--color-accent)" }}>atlas</span>
          </span>
        )}
      </button>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navItems.map((item) => {
          const groupActive = isGroupActive(item);
          return (
            <div key={item.label} className="mb-1">
              {item.children ? (
                <>
                  <button
                    onClick={() => toggleGroup(item.label)}
                    data-tour={`nav-group-${item.label.toLowerCase()}`}
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium cursor-pointer"
                    style={{
                      color: groupActive ? "#fff" : "var(--color-ink-muted)",
                      backgroundColor: groupActive ? "var(--color-accent)" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!groupActive)
                        e.currentTarget.style.backgroundColor = "rgba(47,91,255,0.12)";
                    }}
                    onMouseLeave={(e) => {
                      if (!groupActive)
                        e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        {openGroups[item.label]
                          ? <ChevronDown size={14} />
                          : <ChevronRight size={14} />
                        }
                      </>
                    )}
                  </button>
                  {!collapsed && openGroups[item.label] && (
                    <div
                      className="mt-1 ml-4 pl-3 border-l"
                      style={{ borderColor: "var(--color-border)" }}
                    >
                      {item.children.map((child) => (
                        <Link
                          key={child.label}
                          href={child.href!}
                          data-tour={`nav-${child.label.toLowerCase()}`}
                          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm mb-0.5"
                          style={{
                            color: isItemActive(child.href!)
                              ? "var(--color-accent)"
                              : "var(--color-ink-muted)",
                            backgroundColor: isItemActive(child.href!)
                              ? "var(--color-accent-sub)"
                              : "transparent",
                            fontWeight: isItemActive(child.href!) ? 500 : 400,
                          }}
                          onMouseEnter={(e) => {
                            if (!isItemActive(child.href!))
                              e.currentTarget.style.backgroundColor = "rgba(47,91,255,0.1)";
                          }}
                          onMouseLeave={(e) => {
                            if (!isItemActive(child.href!))
                              e.currentTarget.style.backgroundColor = "transparent";
                          }}
                        >
                          <span className="flex-shrink-0">{child.icon}</span>
                          <span>{child.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={item.href!}
                  data-tour={`nav-${item.label.toLowerCase()}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium"
                  style={{
                    color: isItemActive(item.href!) ? "#fff" : "var(--color-ink-muted)",
                    backgroundColor: isItemActive(item.href!)
                      ? "var(--color-accent)"
                      : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isItemActive(item.href!))
                      e.currentTarget.style.backgroundColor = "rgba(47,91,255,0.12)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isItemActive(item.href!))
                      e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom: Getting Started + Logout */}
      <div className="py-3 px-2 pb-6" style={{ borderTop: "1px solid var(--color-border)" }}>

        <button
          onClick={async () => {
            try { await fetch("/api/auth/logout", { method: "POST" }); }
            finally { window.location.href = "/login"; }
          }}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium"
          style={{ color: "var(--color-ink-muted)", backgroundColor: "transparent", cursor: "pointer" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-surface-2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <span className="flex-shrink-0"><LogOut size={16} /></span>
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
