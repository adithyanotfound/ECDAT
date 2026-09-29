"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface KeyDistribution { name: string; percent: number; }

const COLORS = ["#FF2B44", "#FF6B00", "#FFD000", "#1B72E8", "#00D26A", "#2F5BFF", "#8B5CF6"];

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { name: string } }>;
  label?: string;
}) => {
  if (!active || !payload) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{ backgroundColor: "var(--color-surface-2)", border: "1px solid var(--color-border)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
    >
      <p style={{ color: "var(--color-ink)" }}>{label}: <strong>{payload[0]?.value}%</strong></p>
    </div>
  );
};

export function KeyDistributionDonut({ data }: { data: KeyDistribution[] }) {
  // It's requested to be a bar chart, so we return a horizontal bar chart here.
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 0 }} barSize={12}>
        <CartesianGrid horizontal={false} stroke="color-mix(in srgb, var(--color-border) 60%, transparent)" strokeDasharray="3 3" />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" tick={{ fill: "var(--color-ink-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={120} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "color-mix(in srgb, var(--color-accent) 8%, transparent)" }} />
        <Bar dataKey="percent" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
