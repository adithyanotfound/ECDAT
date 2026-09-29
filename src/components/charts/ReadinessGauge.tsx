/**
 * Quantum readiness, 0–10, as a half-circle gauge. The arc is split into
 * the three bands the score is read in (0–3, 4–6, 7–10) so the needle's
 * position means something even before reading the number. With no score
 * (nothing scanned yet) it shows an empty track and a dash, never a number.
 */
import { TONE, pqcTone } from "@/lib/tones";

interface ReadinessGaugeProps {
  score: number | null; // 0–10, or null when nothing has been scored
  size?: number;
  onDark?: boolean;
}

export function ReadinessGauge({ score, size = 220, onDark = false }: ReadinessGaugeProps) {
  const scored = score !== null && Number.isFinite(score);
  const s = scored ? Math.max(0, Math.min(10, score)) : 0;
  const cx = 100;
  const cy = 100;
  const r = 80;
  const at = (v: number) => {
    const a = Math.PI - (v / 10) * Math.PI;
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  };
  const arc = (from: number, to: number) => {
    const a = at(from);
    const b = at(to);
    return `M ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y}`;
  };
  const tone = TONE[pqcTone(s)];
  const needle = at(s);
  const track = onDark ? "rgb(255 255 255 / 0.12)" : "var(--color-sunken)";

  return (
    <svg
      width={size}
      height={size * 0.62}
      viewBox="0 0 200 124"
      role="img"
      aria-label={scored ? `Quantum readiness ${s} out of 10` : "Quantum readiness not scored yet"}
      className="overflow-visible"
    >
      {/* Bands: not ready, partly ready, ready */}
      <path d={arc(0, 3.9)} stroke={track} strokeWidth="14" fill="none" strokeLinecap="round" />
      <path d={arc(4.1, 6.9)} stroke={track} strokeWidth="14" fill="none" />
      <path d={arc(7.1, 10)} stroke={track} strokeWidth="14" fill="none" strokeLinecap="round" />
      {scored && s > 0 && <path d={arc(0, s)} stroke={tone.fill} strokeWidth="14" fill="none" strokeLinecap="round" />}
      {scored && (
        <circle
          cx={needle.x}
          cy={needle.y}
          r="9"
          fill={onDark ? "#1f2126" : "#fdfcf9"}
          stroke={tone.fill}
          strokeWidth="4"
        />
      )}
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        fontSize="46"
        fontWeight="650"
        fill={onDark ? "#ffffff" : "var(--color-ink)"}
        style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}
      >
        {scored ? s : "–"}
      </text>
      <text
        x={cx}
        y={cy + 16}
        textAnchor="middle"
        fontSize="13"
        fill={onDark ? "rgb(255 255 255 / 0.6)" : "var(--color-muted)"}
      >
        {scored ? "out of 10" : "not scored"}
      </text>
      <text
        x={cx - r}
        y={cy + 22}
        textAnchor="middle"
        fontSize="11"
        fill={onDark ? "rgb(255 255 255 / 0.45)" : "var(--color-faint)"}
      >
        0
      </text>
      <text
        x={cx + r}
        y={cy + 22}
        textAnchor="middle"
        fontSize="11"
        fill={onDark ? "rgb(255 255 255 / 0.45)" : "var(--color-faint)"}
      >
        10
      </text>
    </svg>
  );
}
