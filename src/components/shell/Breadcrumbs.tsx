"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  scanning: "Connect & scan",
  repositories: "Repositories",
  scans: "Scans",
  assets: "Understand & fix",
  recommendations: "Recommendations",
  pqc: "Crypto inventory",
  vulnerabilities: "Vulnerabilities",
  cbom: "CBOM report",
};

// Group segments have no page of their own, so they aren't links.
const NOT_A_PAGE = new Set(["scanning", "assets"]);

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  return (
    <nav className="flex min-w-0 items-center gap-1 text-[13.5px]" aria-label="Breadcrumb">
      {segments.map((seg, i) => {
        const href = "/" + segments.slice(0, i + 1).join("/");
        // Unknown segments are record ids (e.g. a repository).
        const label = LABELS[seg] ?? (segments[i - 1] === "repositories" ? "Repository" : seg);
        const isLast = i === segments.length - 1;
        return (
          <span key={href} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight size={14} className="shrink-0 text-faint" />}
            {isLast ? (
              <span aria-current="page" className="truncate font-medium text-ink">
                {label}
              </span>
            ) : NOT_A_PAGE.has(seg) ? (
              <span className="hidden truncate text-muted sm:inline">{label}</span>
            ) : (
              <Link href={href} className="truncate text-muted transition-colors hover:text-ink">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
