"use client";

import { cn } from "@/lib/cn";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  accentColor?: string;
  children?: React.ReactNode;
  className?: string;
  tooltip?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  accentColor = "var(--color-accent)",
  children,
  className,
  tooltip,
}: StatCardProps) {
  // Use CSS color-mix to create a solid opaque background from the accent color and surface color.
  // This automatically adapts to light and dark themes.
  const bg = `color-mix(in srgb, ${accentColor} 12%, var(--color-surface))`;
  const border = `color-mix(in srgb, ${accentColor} 25%, var(--color-border))`;

  return (
    <div
      className={cn("rounded-xl p-4 flex flex-col gap-2 animate-fade-in", className)}
      style={{ backgroundColor: bg, border: `1px solid ${border}` }}
      title={tooltip}
    >
      <p
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: accentColor }}
      >
        {title}
      </p>

      {children ? (
        children
      ) : (
        <p
          className="text-3xl font-bold tabular-nums"
          style={{ color: "var(--color-ink)" }}
        >
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
      )}

      {subtitle && (
        <p className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
