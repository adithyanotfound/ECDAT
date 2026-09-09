"use client";

interface ReadinessGaugeProps {
  score: number; // 0–10
  size?: number;
}

export function ReadinessGauge({ score, size = 140 }: ReadinessGaugeProps) {
  // Draw a semi-circle gauge
  const cx = size / 2;
  const cy = size * 0.56;
  const r = size * 0.36;
  const strokeWidth = size * 0.085;

  // Angle range: 180° to 0° (left to right semi-circle over the top)
  const startAngle = Math.PI;
  const totalAngle = Math.PI;

  const clampedScore = Math.max(0, Math.min(10, score));
  const pct = clampedScore / 10;
  const angle = startAngle - totalAngle * pct;

  function polarToCartesian(a: number) {
    return {
      x: cx + r * Math.cos(a),
      y: cy - r * Math.sin(a),
    };
  }

  function describeArc(sAngle: number, eAngle: number) {
    const start = polarToCartesian(sAngle);
    const end = polarToCartesian(eAngle);
    const largeArc = Math.abs(eAngle - sAngle) > Math.PI ? 1 : 0;
    // Sweep-flag 1 = clockwise arc over the top in screen coordinates
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  }

  // Color ramp
  const color = clampedScore <= 3 ? "#F0516B" : clampedScore <= 6 ? "#F2C14E" : "#3FCF8E";

  const h = size * 0.76;

  return (
    <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} className="overflow-visible">
      {/* Track */}
      <path
        d={describeArc(Math.PI, 0)}
        fill="none"
        stroke="rgba(255, 255, 255, 0.12)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Fill */}
      {clampedScore > 0 && (
        <path
          d={describeArc(Math.PI, angle)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      )}
      {/* Score label */}
      <text
        x={cx}
        y={cy - 2}
        textAnchor="middle"
        fill={color}
        fontSize={size * 0.22}
        fontWeight="700"
        fontFamily="Inter, sans-serif"
      >
        {clampedScore}
      </text>
      {/* Sub label */}
      <text
        x={cx}
        y={cy + size * 0.1}
        textAnchor="middle"
        fill="var(--color-ink-faint)"
        fontSize={size * 0.085}
        fontFamily="Inter, sans-serif"
      >
        / 10
      </text>
      {/* Min/Max labels */}
      <text
        x={cx - r}
        y={cy + size * 0.14}
        textAnchor="middle"
        fill="var(--color-ink-faint)"
        fontSize={size * 0.08}
        fontFamily="Inter, sans-serif"
      >
        0
      </text>
      <text
        x={cx + r}
        y={cy + size * 0.14}
        textAnchor="middle"
        fill="var(--color-ink-faint)"
        fontSize={size * 0.08}
        fontFamily="Inter, sans-serif"
      >
        10
      </text>
    </svg>
  );
}
