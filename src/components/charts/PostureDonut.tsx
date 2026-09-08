"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface PostureDonutProps {
  data: {
    high: number;
    medium: number;
    low: number;
    compliant: number;
  };
}

const COLORS = ["#F0516B", "#F79552", "#5AA9F5", "#3FCF8E"];
const LABELS = ["High", "Medium", "Low", "Compliant"];

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

export function PostureDonut({ data }: PostureDonutProps) {
  const chartData = [
    { name: "High", value: data.high },
    { name: "Medium", value: data.medium },
    { name: "Low", value: data.low },
    { name: "Compliant", value: data.compliant },
  ];

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
        {chartData.map((item, i) => (
          <div key={item.name} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[i] }}
            />
            <span style={{ color: "var(--color-ink-muted)" }}>{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
