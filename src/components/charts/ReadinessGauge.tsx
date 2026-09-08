"use client";

interface ReadinessGaugeProps {
  score: number; // 0–10
  size?: number;
}

export function ReadinessGauge({ score, size = 140 }: ReadinessGaugeProps) {
  // Draw a semi-circle gauge
  const cx = size / 2;
  const cy = size * 0.6;
  const r = size * 0.38;
  const strokeWidth = size * 0.08;

  // Angle range: -180° to 0° (left to right semi-circle, top of circle)
  const startAngle = Math.PI; // 180°
  const endAngle = 0;
  const totalAngle = startAngle - endAngle;

  const pct = score / 10;
  const angle = startAngle - totalAngle * pct;

  const trackStart = { x: cx - r, y: cy };
  const trackEnd = { x: cx + r, y: cy };

  function polarToCartesian(angle: number) {
    return {
      x: cx + r * Math.cos(angle),
      y: cy - r * Math.sin(angle),
    };
  }

  const fillEnd = polarToCartesian(angle);

  function describeArc(startAngle: number, endAngle: number) {
    const start = polarToCartesian(startAngle);
    const end = polarToCartesian(endAngle);
    const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  }

  // Color ramp
  const color = score <= 3 ? "#F0516B" : score <= 6 ? "#F2C14E" : "#3FCF8E";

  return (
    <svg width={size} height={size * 0.7} viewBox={`0 0 ${size} ${size * 0.7}`}>
      {/* Track */}
      <path
        d={describeArc(Math.PI, 0)}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Fill */}
      {score > 0 && (
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
        y={cy - 4}
        textAnchor="middle"
        fill={color}
        fontSize={size * 0.22}
        fontWeight="700"
        fontFamily="Inter, sans-serif"
      >
        {score}
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
      <text x={cx - r} y={cy + size * 0.13} textAnchor="middle" fill="var(--color-ink-faint)" fontSize={size * 0.08} fontFamily="Inter, sans-serif">0</text>
      <text x={cx + r} y={cy + size * 0.13} textAnchor="middle" fill="var(--color-ink-faint)" fontSize={size * 0.08} fontFamily="Inter, sans-serif">10</text>
    </svg>
  );
}
