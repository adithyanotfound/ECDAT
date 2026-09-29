"use client";

/**
 * The charcoal navigation rail. Grouped by what a person is trying to do:
 * see the big picture, connect and scan code, then understand what was found.
 * Collapses to icons on desktop and slides in as a drawer on small screens.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  ChevronsLeft,
  ChevronsRight,
  Cpu,
  FileBadge2,
  GitBranch,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { BrandMark, BrandName } from "./BrandMark";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** One-line explanation shown as a tooltip. */
  hint: string;
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: <LayoutDashboard size={17} />,
        hint: "Your overall quantum readiness",
      },
    ],
  },
  {
    group: "Connect & scan",
    items: [
      {
        label: "Repositories",
        href: "/scanning/repositories",
        icon: <GitBranch size={17} />,
        hint: "Code and cloud accounts being watched",
      },
      {
        label: "Scans",
        href: "/scanning/scans",
        icon: <Cpu size={17} />,
        hint: "Every scan, with live logs and changes",
      },
    ],
  },
  {
    group: "Understand & fix",
    items: [
      {
        label: "Crypto inventory",
        href: "/assets/pqc",
        icon: <ShieldCheck size={17} />,
        hint: "Every algorithm, key and certificate found",
      },
      {
        label: "Vulnerabilities",
        href: "/assets/vulnerabilities",
        icon: <AlertTriangle size={17} />,
        hint: "Specific problems to fix",
      },
      {
        label: "Recommendations",
        href: "/assets/recommendations",
        icon: <Lightbulb size={17} />,
        hint: "What to move to, and how hard it is",
      },
      {
        label: "CBOM report",
        href: "/assets/pqc/cbom",
        icon: <FileBadge2 size={17} />,
        hint: "Standard bill of materials to share",
      },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  // The most specific matching link wins, so /assets/pqc/cbom doesn't also light up /assets/pqc.
  const allHrefs = NAV.flatMap((g) => g.items.map((i) => i.href));
  const activeHref = allHrefs
    .filter((h) => pathname === h || pathname.startsWith(h + "/"))
    .sort((a, b) => b.length - a.length)[0];

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // A full page load clears every cached view of the signed-in user's data.
      window.location.replace("/login");
    }
  };

  const panel = (isMobile: boolean) => {
    const narrow = collapsed && !isMobile;
    return (
      <div className="flex h-full flex-col bg-charcoal text-on-dark-muted">
        <div
          className={cn(
            "flex h-16 items-center gap-2.5 border-b border-white/[0.06]",
            narrow ? "justify-center px-2" : "px-5",
          )}
        >
          <Link
            href="/dashboard"
            onClick={onMobileClose}
            className="flex items-center gap-2.5"
            aria-label="ECDAT Atlas dashboard"
          >
            <BrandMark size={30} onDark />
            {!narrow && <BrandName onDark />}
          </Link>
          {isMobile && (
            <button
              type="button"
              onClick={onMobileClose}
              aria-label="Close menu"
              className="ml-auto rounded-lg p-1.5 hover:bg-white/10"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
          {NAV.map((group) => (
            <div key={group.group} className="mb-5">
              {!narrow ? (
                <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-[0.12em] text-white/40 uppercase">
                  {group.group}
                </p>
              ) : (
                <div className="mx-auto mb-2 h-px w-6 bg-white/10" />
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.href === activeHref;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onMobileClose}
                        title={narrow ? `${item.label}: ${item.hint}` : item.hint}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-xl py-2 text-[14px] font-medium transition-colors",
                          narrow ? "justify-center px-2" : "px-3",
                          active ? "bg-white/[0.08] text-white" : "hover:bg-white/[0.05] hover:text-white",
                        )}
                      >
                        {active && (
                          <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-gold-bright" />
                        )}
                        <span
                          className={cn(
                            "shrink-0",
                            active ? "text-gold-bright" : "text-on-dark-muted group-hover:text-white",
                          )}
                        >
                          {item.icon}
                        </span>
                        {!narrow && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="space-y-0.5 border-t border-white/[0.06] px-3 py-3">
          {!isMobile && (
            <button
              type="button"
              onClick={onToggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl py-2 text-[14px] font-medium transition-colors hover:bg-white/[0.05] hover:text-white",
                narrow ? "justify-center px-2" : "px-3",
              )}
            >
              {collapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
              {!narrow && "Collapse"}
            </button>
          )}
          <button
            type="button"
            onClick={signOut}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl py-2 text-[14px] font-medium transition-colors hover:bg-white/[0.05] hover:text-white",
              narrow ? "justify-center px-2" : "px-3",
            )}
          >
            <LogOut size={17} />
            {!narrow && "Sign out"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <aside
        className="no-print hidden h-full shrink-0 transition-[width] duration-300 lg:block"
        style={{ width: collapsed ? 72 : 252 }}
      >
        {panel(false)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-charcoal/50 animate-fade-in" onClick={onMobileClose} />
          <div className="absolute top-0 bottom-0 left-0 w-[272px] shadow-pop animate-slide-in">{panel(true)}</div>
        </div>
      )}
    </>
  );
}
