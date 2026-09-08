import { cn } from "@/lib/cn";

type Severity = "Critical" | "High" | "Moderate" | "Low" | "Compliant";
type ScanStatus = "Completed" | "Running" | "Failed" | "Queued";

// ─── Severity Pill ────────────────────────────────────────────────────────────

const severityConfig: Record<Severity, { bg: string; color: string; border: string }> = {
  Critical: { bg: "rgba(240,81,107,0.15)", color: "#F0516B", border: "rgba(240,81,107,0.4)" },
  High:     { bg: "rgba(247,149,82,0.15)", color: "#F79552", border: "rgba(247,149,82,0.4)" },
  Moderate: { bg: "rgba(242,193,78,0.15)", color: "#F2C14E", border: "rgba(242,193,78,0.4)" },
  Low:      { bg: "rgba(90,169,245,0.15)", color: "#5AA9F5", border: "rgba(90,169,245,0.4)" },
  Compliant:{ bg: "rgba(63,207,142,0.15)", color: "#3FCF8E", border: "rgba(63,207,142,0.4)" },
};

interface SeverityPillProps {
  severity: Severity;
  className?: string;
}

export function SeverityPill({ severity, className }: SeverityPillProps) {
  const cfg = severityConfig[severity];
  return (
    <span
      className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold", className)}
      style={{
        backgroundColor: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
      }}
    >
      {severity}
    </span>
  );
}

// ─── Status Pill ──────────────────────────────────────────────────────────────

const statusConfig: Record<ScanStatus, { bg: string; color: string; border: string }> = {
  Completed: { bg: "rgba(63,207,142,0.12)", color: "#3FCF8E", border: "rgba(63,207,142,0.4)" },
  Running:   { bg: "rgba(47,91,255,0.12)",  color: "#5AA9F5", border: "rgba(90,169,245,0.4)" },
  Failed:    { bg: "rgba(247,149,82,0.12)", color: "#F79552", border: "rgba(247,149,82,0.4)" },
  Queued:    { bg: "rgba(242,193,78,0.12)", color: "#F2C14E", border: "rgba(242,193,78,0.4)" },
};

interface StatusPillProps {
  status: ScanStatus;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  const cfg = statusConfig[status];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold", className)}
      style={{
        backgroundColor: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
      }}
    >
      {status === "Running" && (
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: cfg.color }}
        />
      )}
      {status}
    </span>
  );
}

// ─── Score Bar (CRSF) ─────────────────────────────────────────────────────────

function crsfColor(score: number): string {
  if (score <= 19) return "#3FCF8E";
  if (score <= 44) return "#5AA9F5";
  if (score <= 69) return "#F2C14E";
  return "#F0516B";
}

interface ScoreBarProps {
  score: number;
  max?: number;
  className?: string;
}

export function ScoreBar({ score, max = 100, className }: ScoreBarProps) {
  const pct = Math.min(100, (score / max) * 100);
  const color = crsfColor(score);
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      <div
        className="rounded-full overflow-hidden flex-1"
        style={{ height: "6px", backgroundColor: "var(--color-border)", minWidth: "60px" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs w-6 text-right" style={{ color }}>{score}</span>
    </div>
  );
}

// ─── PQC Score Chip ───────────────────────────────────────────────────────────

interface ScorePillProps {
  score: number;
  max?: number;
  className?: string;
}

export function ScorePill({ score, max = 10, className }: ScorePillProps) {
  const pct = score / max;
  const color = pct >= 0.7 ? "#3FCF8E" : pct >= 0.4 ? "#F2C14E" : "#F0516B";
  const bg = pct >= 0.7 ? "rgba(63,207,142,0.12)" : pct >= 0.4 ? "rgba(242,193,78,0.12)" : "rgba(240,81,107,0.12)";
  return (
    <span
      className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold", className)}
      style={{ backgroundColor: bg, color, fontVariantNumeric: "tabular-nums" }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      {score}/{max}
    </span>
  );
}
