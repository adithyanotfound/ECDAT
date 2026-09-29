"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface VulnBySource { source: string; critical: number; high: number; moderate: number; low: number; }

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
}) => {
  if (!active || !payload) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{ backgroundColor: "var(--color-surface-2)", border: "1px solid var(--color-border)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
    >
      <p className="font-semibold mb-1" style={{ color: "var(--color-ink)" }}>{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>{entry.name}: {entry.value}</p>
      ))}
    </div>
  );
};

export function StackedBar({ data }: { data: VulnBySource[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid vertical={false} stroke="color-mix(in srgb, var(--color-border) 60%, transparent)" strokeDasharray="3 3" />
        <XAxis dataKey="source" tick={{ fill: "var(--color-ink-faint)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "var(--color-ink-faint)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(47,91,255,0.2)", strokeWidth: 1 }} />
        <Line type="monotone" dataKey="critical" stroke="var(--color-critical)" strokeWidth={2} name="Critical" dot={{ r: 3 }} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="high" stroke="var(--color-high)" strokeWidth={2} name="High" dot={{ r: 3 }} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="moderate" stroke="var(--color-moderate)" strokeWidth={2} name="Moderate" dot={{ r: 3 }} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="low" stroke="var(--color-low)" strokeWidth={2} name="Low" dot={{ r: 3 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
