"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

interface VulnBySource {
  source: string;
  critical: number;
  high: number;
  moderate: number;
  low: number;
}

interface StackedBarProps {
  data: VulnBySource[];
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
}) => {
  if (!active || !payload) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{
        backgroundColor: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      <p className="font-semibold mb-1" style={{ color: "var(--color-ink)" }}>{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
};

export function StackedBar({ data }: StackedBarProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barSize={20}>
        <CartesianGrid vertical={false} stroke="rgba(37,45,72,0.6)" strokeDasharray="3 3" />
        <XAxis
          dataKey="source"
          tick={{ fill: "var(--color-ink-faint)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "var(--color-ink-faint)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(47,91,255,0.08)" }} />
        <Bar dataKey="critical" stackId="a" fill="#F0516B" name="Critical" radius={[0, 0, 0, 0]} />
        <Bar dataKey="high" stackId="a" fill="#F79552" name="High" />
        <Bar dataKey="moderate" stackId="a" fill="#F2C14E" name="Moderate" />
        <Bar dataKey="low" stackId="a" fill="#5AA9F5" name="Low" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
