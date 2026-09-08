import { cn } from "@/lib/cn";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  accentColor?: string;
  children?: React.ReactNode;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  accentColor = "var(--color-accent)",
  children,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn("rounded-xl p-4 flex flex-col gap-2 animate-fade-in", className)}
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderLeft: `3px solid ${accentColor}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p
            className="text-xs font-medium uppercase tracking-wide mb-1 truncate"
            style={{ color: "var(--color-ink-muted)" }}
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
        </div>
      </div>
      {subtitle && (
        <p className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
