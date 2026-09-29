/**
 * Coloured labels. Every pill writes its meaning out in words and uses the
 * tone system from src/lib/tones.ts, so colour is never the only signal.
 */
import { cn } from "@/lib/cn";
import {
  EFFORT,
  MOSCA,
  SCAN_STATUS,
  SEVERITY_TONE,
  TONE,
  pqcTone,
  riskBand,
  toScanStatus,
  type MoscaVerdict,
  type SeverityLabel,
  type Tone,
} from "@/lib/tones";

// ─── Badge (the base for every pill) ──────────────────────────────────────────

interface BadgeProps {
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function Badge({ tone = "neutral", dot = true, pulse = false, children, className, title }: BadgeProps) {
  const t = TONE[tone];
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        className,
      )}
      style={{ backgroundColor: t.tint, color: t.ink }}
    >
      {dot && (
        <span className="relative flex size-1.5 shrink-0">
          {pulse && (
            <span
              className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
              style={{ backgroundColor: t.fill }}
            />
          )}
          <span className="relative inline-flex size-1.5 rounded-full" style={{ backgroundColor: t.fill }} />
        </span>
      )}
      {children}
    </span>
  );
}

// ─── Severity ─────────────────────────────────────────────────────────────────

export function SeverityPill({ severity, className }: { severity: SeverityLabel; className?: string }) {
  return (
    <Badge tone={SEVERITY_TONE[severity] ?? "neutral"} className={className}>
      {severity}
    </Badge>
  );
}

// ─── Scan status ──────────────────────────────────────────────────────────────

/** Accepts "Completed" or the database's "COMPLETED". */
export function StatusPill({ status, className }: { status: string; className?: string }) {
  const s = toScanStatus(status);
  if (!s) return <Badge className={className}>{status}</Badge>;
  const cfg = SCAN_STATUS[s];
  return (
    <Badge tone={cfg.tone} pulse={s === "Running"} className={className}>
      {cfg.label}
    </Badge>
  );
}

// ─── Mosca verdict and effort ─────────────────────────────────────────────────

export function VerdictPill({ verdict, className }: { verdict: MoscaVerdict; className?: string }) {
  const cfg = MOSCA[verdict] ?? MOSCA.PLAN;
  return (
    <Badge tone={cfg.tone} className={className} title={cfg.plain}>
      {cfg.label}
    </Badge>
  );
}

export function EffortPill({ effort, className }: { effort: "HIGH" | "MEDIUM" | "LOW"; className?: string }) {
  const cfg = EFFORT[effort] ?? EFFORT.MEDIUM;
  return (
    <Badge tone={cfg.tone} className={className} title={cfg.plain}>
      {cfg.label}
    </Badge>
  );
}

export function QuantumSafePill({ safe, className }: { safe: boolean | null; className?: string }) {
  if (safe === null) return <Badge className={className}>Unknown</Badge>;
  return (
    <Badge tone={safe ? "safe" : "critical"} className={className}>
      {safe ? "Quantum-safe" : "Not quantum-safe"}
    </Badge>
  );
}

// ─── Risk score bar (0–100) ───────────────────────────────────────────────────

export function ScoreBar({ score, max = 100, className }: { score: number; max?: number; className?: string }) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  const band = riskBand(score);
  const t = TONE[band.tone];
  return (
    <div className={cn("flex items-center gap-2.5", className)} title={`${band.label}: ${band.advice}`}>
      <div className="h-1.5 min-w-[56px] flex-1 overflow-hidden rounded-full bg-sunken">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, backgroundColor: t.fill }}
        />
      </div>
      <span className="num w-7 text-right text-xs font-semibold" style={{ color: t.ink }}>
        {score}
      </span>
    </div>
  );
}

// ─── Post-quantum safety chip (0–10) ──────────────────────────────────────────

export function ScorePill({ score, max = 10, className }: { score: number; max?: number; className?: string }) {
  return (
    <Badge tone={pqcTone(score, max)} dot={false} className={cn("num", className)}>
      {score}/{max}
    </Badge>
  );
}
