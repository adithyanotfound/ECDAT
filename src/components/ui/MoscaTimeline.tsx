/**
 * Mosca's inequality, as a first-class card — not a verdict alone.
 * X (data lifetime) + Y (migration time) > Z (time to CRQC) ⟹ act now.
 * (IMPLEMENTATION_PLAN.md §4c "Mosca's inequality — give it a first-class card")
 */
interface MoscaTimelineProps {
  x: number;
  y: number;
  z: number;
  verdict: "ACT_NOW" | "PLAN" | "SAFE";
}

const verdictConfig: Record<MoscaTimelineProps["verdict"], { label: string; color: string; bg: string; border: string }> = {
  ACT_NOW: { label: "Act now", color: "#F0516B", bg: "rgba(240,81,107,0.15)", border: "rgba(240,81,107,0.4)" },
  PLAN: { label: "Plan migration", color: "#F2C14E", bg: "rgba(242,193,78,0.15)", border: "rgba(242,193,78,0.4)" },
  SAFE: { label: "Safe today", color: "#3FCF8E", bg: "rgba(63,207,142,0.15)", border: "rgba(63,207,142,0.4)" },
};

export function MoscaTimeline({ x, y, z, verdict }: MoscaTimelineProps) {
  const cfg = verdictConfig[verdict];
  const total = Math.max(x + y, z, 1);
  const xPct = (x / total) * 100;
  const yPct = (y / total) * 100;
  const zMarkPct = (z / total) * 100;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
          Mosca&rsquo;s inequality
        </p>
        <span
          className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
          style={{ color: cfg.color, backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}
        >
          {cfg.label}
        </span>
      </div>

      <p className="text-xs font-mono" style={{ color: "var(--color-ink-muted)" }}>
        X ({x}y data lifetime) + Y ({y}y migration) {x + y > z ? ">" : "≤"} Z ({z}y to CRQC)
      </p>

      {/* Three-segment horizontal timeline */}
      <div className="relative">
        <div className="flex h-3 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-surface-2)" }}>
          <div style={{ width: `${xPct}%`, backgroundColor: "var(--color-accent)" }} title={`X: data lifetime, ${x} years`} />
          <div style={{ width: `${yPct}%`, backgroundColor: cfg.color }} title={`Y: migration time, ${y} years`} />
        </div>
        {/* Z marker — the CRQC arrival line */}
        <div
          className="absolute top-[-4px] bottom-[-4px] w-[2px]"
          style={{ left: `${Math.min(zMarkPct, 100)}%`, backgroundColor: "var(--color-ink)" }}
          title={`Z: estimated CRQC arrival, ${z} years out`}
        />
      </div>

      <div className="flex items-center justify-between text-xs" style={{ color: "var(--color-ink-faint)" }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: "var(--color-accent)" }} /> X: data lifetime ({x}y)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} /> Y: migration ({y}y)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: "var(--color-ink)" }} /> Z: CRQC ({z}y)
        </span>
      </div>
    </div>
  );
}
