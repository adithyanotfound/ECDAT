"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Lightbulb } from "lucide-react";

interface Recommendation {
  id: string;
  fromAlgorithm: string;
  toAlgorithm: string;
  standard: string | null;
  effort: "HIGH" | "MEDIUM" | "LOW";
  repositoryFullName: string;
}

const EFFORT_STYLES = {
  HIGH:   { c: "#FFFFFF", bg: "#FF2B44", border: "#FF2B44" },
  MEDIUM: { c: "#000000", bg: "#FFD000", border: "#FFD000" },
  LOW:    { c: "#000000", bg: "#00D26A", border: "#00D26A" },
};

function EffortBadge({ effort }: { effort: "HIGH" | "MEDIUM" | "LOW" }) {
  const s = EFFORT_STYLES[effort] ?? EFFORT_STYLES.MEDIUM;
  return (
    <span
      className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-semibold"
      style={{ color: s.c, backgroundColor: s.bg, border: `1px solid ${s.border}` }}
    >
      {effort}
    </span>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--color-ink-muted)",
  backgroundColor: "var(--color-thead)",
  borderBottom: "1px solid var(--color-border)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: "13px",
  borderBottom: "1px solid var(--color-border)",
  verticalAlign: "middle",
};

export function RecommendationsTable() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/recommendations?pageSize=5&sort=effort")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl p-5" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb size={15} style={{ color: "var(--color-accent)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>Remediation Priority</span>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded animate-pulse" style={{ backgroundColor: "var(--color-surface-2)" }} />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-muted)" }}>
        Recommendations
      </h2>
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div className="flex items-center gap-2">
            <Lightbulb size={14} style={{ color: "var(--color-accent)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>Remediation Priority</span>
          </div>
          <Link
            href="/assets/recommendations"
            className="text-xs flex items-center gap-1 font-medium"
            style={{ color: "var(--color-accent)" }}
          >
            View All <ArrowRight size={11} />
          </Link>
        </div>

        <table className="w-full">
          <thead>
            <tr>
              <th style={thStyle}>Current Algorithm</th>
              <th style={thStyle}>Upgrade To</th>
              <th style={thStyle}>Effort</th>
              <th style={thStyle}>Repository</th>
            </tr>
          </thead>
          <tbody>
            {items.map((rec) => (
              <tr
                key={rec.id}
                style={{ backgroundColor: "var(--color-surface)" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-surface-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--color-surface)")}
              >
                <td style={tdStyle}>
                  <span className="font-mono text-xs" style={{ color: "var(--color-critical)" }}>
                    {rec.fromAlgorithm}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span className="font-mono text-xs" style={{ color: "var(--color-safe)" }}>
                    {rec.toAlgorithm}
                  </span>
                </td>
                <td style={tdStyle}>
                  <EffortBadge effort={rec.effort} />
                </td>
                <td style={tdStyle}>
                  <span className="text-xs" style={{ color: "var(--color-ink-muted)" }}>
                    {rec.repositoryFullName}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
