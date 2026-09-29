"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

const segmentLabels: Record<string, string> = {
  dashboard: "Dashboard",
  scanning: "Scanning",
  repositories: "Repositories",
  profiles: "Profiles",
  scans: "Scans",
  assets: "Assets",
  recommendations: "Recommendations",
  pqc: "PQC",
  vulnerabilities: "Vulnerabilities",
  reports: "Reports",
  knowledge: "Knowledge",
  settings: "Settings",
  users: "Users",
  cbom: "CBOM Report",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
      {segments.map((seg, i) => {
        const href = "/" + segments.slice(0, i + 1).join("/");
        const label = segmentLabels[seg] ?? seg;
        const isLast = i === segments.length - 1;

        return (
          <span key={href} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight size={13} style={{ color: "var(--color-ink-faint)" }} />
            )}
            {isLast ? (
              <span style={{ color: "var(--color-ink)", fontWeight: 500 }}>{label}</span>
            ) : (
              <Link
                href={href}
                className="transition-colors"
                style={{ color: "var(--color-ink-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-ink)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-ink-muted)")}
              >
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
