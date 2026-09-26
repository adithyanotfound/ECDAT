"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface AssetByType { type: string; count: number; }

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) => {
  if (!active || !payload) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{ backgroundColor: "var(--color-surface-2)", border: "1px solid var(--color-border)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
    >
      <p style={{ color: "var(--color-ink)" }}>{label}: <strong>{payload[0]?.value}</strong></p>
    </div>
  );
};

export function TypeBars({ data }: { data: AssetByType[] }) {
  const max = Math.max(...data.map((d) => d.count));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="color-mix(in srgb, var(--color-border) 60%, transparent)" strokeDasharray="3 3" />
        <XAxis dataKey="type" tick={{ fill: "var(--color-ink-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="number" domain={[0, max + 10]} tick={{ fill: "var(--color-ink-faint)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "color-mix(in srgb, var(--color-accent) 20%, transparent)", strokeWidth: 1 }} />
        <Line type="monotone" dataKey="count" stroke="var(--color-accent)" strokeWidth={2} dot={{ r: 4, fill: "var(--color-accent)" }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
