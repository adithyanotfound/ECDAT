"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface KeyDistribution {
  name: string;
  percent: number;
}

interface KeyDistributionDonutProps {
  data: KeyDistribution[];
  title?: string;
}

const COLORS = ["#F0516B", "#F79552", "#F2C14E", "#5AA9F5", "#3FCF8E", "#2F5BFF", "#8B5CF6"];

const CustomTooltip = ({ active, payload }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { fill: string } }>;
}) => {
  if (!active || !payload?.[0]) return null;
  const entry = payload[0];
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{
        backgroundColor: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      <p style={{ color: entry.payload.fill }}>{entry.name}: {entry.value}%</p>
    </div>
  );
};

export function KeyDistributionDonut({ data, title }: KeyDistributionDonutProps) {
  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={150}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={65}
            paddingAngle={2}
            dataKey="percent"
            nameKey="name"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex flex-col gap-1">
        {data.map((item, i) => (
          <div key={item.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span style={{ color: "var(--color-ink-muted)" }} className="truncate max-w-[120px]">{item.name}</span>
            </div>
            <span style={{ color: "var(--color-ink-faint)", fontVariantNumeric: "tabular-nums" }}>
              {item.percent}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
