"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface AssetByType {
  type: string;
  count: number;
}

interface TypeBarsProps {
  data: AssetByType[];
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
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
      <p style={{ color: "var(--color-ink)" }}>{label}: <strong>{payload[0]?.value}</strong></p>
    </div>
  );
};

export function TypeBars({ data }: TypeBarsProps) {
  const max = Math.max(...data.map((d) => d.count));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 40, bottom: 4, left: 0 }}
        barSize={12}
      >
        <CartesianGrid horizontal={false} stroke="rgba(37,45,72,0.6)" strokeDasharray="3 3" />
        <XAxis
          type="number"
          domain={[0, max + 10]}
          tick={{ fill: "var(--color-ink-faint)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="type"
          tick={{ fill: "var(--color-ink-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={80}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(47,91,255,0.08)" }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill="var(--color-accent)" opacity={0.8 - i * 0.08} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
