"use client";

interface PostureBarProps {
  data: {
    high: number;
    medium: number;
    low: number;
    compliant: number;
  };
}

const SEGMENTS = [
  { key: "high" as const,      label: "High Risk",  color: "#FF2B44", description: "Requires immediate action" },
  { key: "medium" as const,    label: "Medium Risk", color: "#FFD000", description: "Should be addressed soon" },
  { key: "low" as const,       label: "Low Risk",    color: "#1B72E8", description: "Monitor and plan" },
  { key: "compliant" as const, label: "Compliant",   color: "#00D26A", description: "Meets security standards" },
];

export function PostureDonut({ data }: PostureBarProps) {
  const total = data.high + data.medium + data.low + data.compliant || 1;
  const segments = SEGMENTS.map((s) => ({
    ...s,
    value: data[s.key],
    pct: Math.round((data[s.key] / total) * 100),
  }));

  return (
    <div className="flex flex-col gap-3">
      {segments.map((s) => (
        <div key={s.key} className="flex items-center gap-3">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: s.color }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium" style={{ color: "var(--color-ink-muted)" }}>
                {s.label}
              </span>
              <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--color-ink)" }}>
                {s.pct}%
              </span>
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: "var(--color-surface-2)" }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${s.pct}%`, backgroundColor: s.color }}
              />
            </div>
          </div>
        </div>
      ))}
      <p className="text-xs mt-1" style={{ color: "var(--color-ink-faint)" }}>
        Based on risk assessments across all detected cryptographic assets.
      </p>
    </div>
  );
}
