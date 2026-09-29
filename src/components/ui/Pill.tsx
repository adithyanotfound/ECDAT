import { cn } from "@/lib/cn";

type Severity = "Critical" | "High" | "Moderate" | "Low" | "Compliant";
type ScanStatus = "Completed" | "Running" | "Failed" | "Queued";

// ─── Severity Pill ────────────────────────────────────────────────────────────

const severityConfig: Record<Severity, { bg: string; color: string; border: string }> = {
  Critical: { bg: "#FF2B44", color: "#FFFFFF", border: "#FF2B44" },
  High:     { bg: "#FF6B00", color: "#FFFFFF", border: "#FF6B00" },
  Moderate: { bg: "#FFD000", color: "#000000", border: "#FFD000" },
  Low:      { bg: "#1B72E8", color: "#FFFFFF", border: "#1B72E8" },
  Compliant:{ bg: "#00D26A", color: "#000000", border: "#00D26A" },
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
  Completed: { bg: "#00D26A", color: "#000000", border: "#00D26A" },
  Running:   { bg: "#1B72E8", color: "#FFFFFF", border: "#1B72E8" },
  Failed:    { bg: "#FF2B44", color: "#FFFFFF", border: "#FF2B44" },
  Queued:    { bg: "#FFD000", color: "#000000", border: "#FFD000" },
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
  const bg = pct >= 0.7 ? "#00D26A" : pct >= 0.4 ? "#FFD000" : "#FF2B44";
  const color = pct >= 0.7 ? "#000000" : pct >= 0.4 ? "#000000" : "#FFFFFF";
  return (
    <span
      className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold", className)}
      style={{ backgroundColor: bg, color, fontVariantNumeric: "tabular-nums" }}
    >
      {score}/{max}
    </span>
  );
}
