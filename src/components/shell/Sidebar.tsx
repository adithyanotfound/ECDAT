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
  List,
  Shield,
  AlertTriangle,
  FileText,
  BookOpen,
  Settings,
  Users,
  LogOut,
  Database,
  GitBranch,
  Cpu,
  Network,
} from "lucide-react";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  children?: NavItem[];
  disabled?: boolean;
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
      {
        label: "Repositories",
        href: "/scanning/repositories",
        icon: <GitBranch size={14} />,
      },
      {
        label: "Profiles",
        href: "/scanning/profiles",
        icon: <Database size={14} />,
      },
      {
        label: "Scans",
        href: "/scanning/scans",
        icon: <Cpu size={14} />,
      },
    ],
  },
  {
    label: "Assets",
    icon: <Package size={16} />,
    children: [
      {
        label: "Inventory",
        href: "/assets/inventory",
        icon: <List size={14} />,
      },
      {
        label: "PQC",
        href: "/assets/pqc",
        icon: <Shield size={14} />,
      },
      {
        label: "Vulnerabilities",
        href: "/assets/vulnerabilities",
        icon: <AlertTriangle size={14} />,
      },
    ],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: <FileText size={16} />,
  },
];

const bottomNavItems: NavItem[] = [
  {
    label: "Knowledge",
    href: "/knowledge",
    icon: <BookOpen size={16} />,
    disabled: true,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: <Settings size={16} />,
    disabled: true,
  },
  {
    label: "Users",
    href: "/users",
    icon: <Users size={16} />,
    disabled: true,
  },
  {
    label: "Logout",
    href: "/logout",
    icon: <LogOut size={16} />,
    disabled: true,
  },
];

interface SidebarProps {
  collapsed: boolean;
}

export function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname();

  // determine which groups should start open
  const initialOpen: Record<string, boolean> = {};
  navItems.forEach((item) => {
    if (item.children) {
      const isActive = item.children.some((c) => c.href && pathname.startsWith(c.href));
      initialOpen[item.label] = isActive;
    }
  });

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(initialOpen);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const isGroupActive = (item: NavItem) =>
    item.children?.some((c) => c.href && pathname.startsWith(c.href)) ?? false;

  const isItemActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className="flex flex-col h-full transition-all duration-300 ease-in-out"
      style={{
        width: collapsed ? "64px" : "220px",
        backgroundColor: "var(--color-sidebar)",
        borderRight: "1px solid var(--color-border)",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 py-5"
        style={{ borderBottom: "1px solid var(--color-border)", minHeight: "64px" }}
      >
        <div
          className="flex items-center justify-center rounded-lg flex-shrink-0"
          style={{
            width: "32px",
            height: "32px",
            background: "linear-gradient(135deg, var(--color-accent), #6B8FFF)",
          }}
        >
          <Network size={18} color="white" />
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
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navItems.map((item) => (
          <div key={item.label} className="mb-1">
            {item.children ? (
              <>
                <button
                  onClick={() => toggleGroup(item.label)}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 cursor-pointer"
                  style={{
                    color: isGroupActive(item) ? "#fff" : "var(--color-ink-muted)",
                    backgroundColor: isGroupActive(item) ? "var(--color-accent)" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isGroupActive(item))
                      e.currentTarget.style.backgroundColor = "rgba(47,91,255,0.12)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isGroupActive(item))
                      e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      {openGroups[item.label] ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                    </>
                  )}
                </button>
                {!collapsed && openGroups[item.label] && (
                  <div className="mt-1 ml-4 pl-3 border-l" style={{ borderColor: "var(--color-border)" }}>
                    {item.children.map((child) => (
                      <Link
                        key={child.label}
                        href={child.href!}
                        className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-all duration-150 mb-0.5"
                        style={{
                          color: isItemActive(child.href!) ? "#fff" : "var(--color-ink-muted)",
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
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150"
                style={{
                  color: isItemActive(item.href!) ? "#fff" : "var(--color-ink-muted)",
                  backgroundColor: isItemActive(item.href!) ? "var(--color-accent)" : "transparent",
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
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="py-3 px-2" style={{ borderTop: "1px solid var(--color-border)" }}>
        {bottomNavItems.map((item) => (
          <button
            key={item.label}
            disabled={item.disabled}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 mb-1"
            style={{
              color: "var(--color-ink-faint)",
              backgroundColor: "transparent",
              opacity: item.disabled ? 0.6 : 1,
              cursor: item.disabled ? "default" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (!item.disabled)
                e.currentTarget.style.backgroundColor = "rgba(47,91,255,0.12)";
            }}
            onMouseLeave={(e) => {
              if (!item.disabled)
                e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </div>
    </aside>
  );
}
