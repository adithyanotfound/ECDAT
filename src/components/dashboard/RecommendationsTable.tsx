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

function EffortBadge({ effort }: { effort: "HIGH" | "MEDIUM" | "LOW" }) {
  const colors = {
    HIGH: { c: "#F0516B", bg: "rgba(240,81,107,0.12)", border: "rgba(240,81,107,0.4)" },
    MEDIUM: { c: "#F2C14E", bg: "rgba(242,193,78,0.12)", border: "rgba(242,193,78,0.4)" },
    LOW: { c: "#3FCF8E", bg: "rgba(63,207,142,0.12)", border: "rgba(63,207,142,0.4)" },
  };
  const style = colors[effort] || colors.MEDIUM;

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-semibold"
      style={{
        color: style.c,
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
      }}
    >
      {effort}
    </span>
  );
}

export function RecommendationsTable() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/recommendations?pageSize=5&sort=effort")
      .then((res) => res.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl p-5" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--color-ink)" }}>
            <Lightbulb size={16} style={{ color: "var(--color-accent)" }} />
            Remediation Priority
          </h3>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 rounded animate-pulse" style={{ backgroundColor: "var(--color-surface-2)" }} />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--color-ink-muted)",
    backgroundColor: "var(--color-thead)",
    borderBottom: "1px solid var(--color-border)",
    whiteSpace: "nowrap",
  };
  
  const tdStyle: React.CSSProperties = {
    padding: "8px 12px",
    fontSize: "12px",
    borderBottom: "1px solid var(--color-border)",
    verticalAlign: "middle",
  };

  return (
    <div className="rounded-xl overflow-hidden flex flex-col" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <div className="p-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--color-ink)" }}>
          <Lightbulb size={16} style={{ color: "var(--color-accent)" }} />
          Remediation Priority
        </h3>
        <Link 
          href="/assets/recommendations" 
          className="text-xs flex items-center gap-1 font-medium transition-colors"
          style={{ color: "var(--color-accent)" }}
        >
          View All <ArrowRight size={12} />
        </Link>
      </div>
      
      <table className="w-full">
        <thead>
          <tr>
            <th style={thStyle}>Algorithm</th>
            <th style={thStyle}>Migration Target</th>
            <th style={thStyle}>Effort</th>
            <th style={thStyle}>Repository</th>
          </tr>
        </thead>
        <tbody>
          {items.map((rec) => (
            <tr key={rec.id} style={{ backgroundColor: "var(--color-surface)", transition: "background-color 0.1s" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-surface-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--color-surface)")}
            >
              <td style={tdStyle}>
                <span className="font-medium" style={{ color: "var(--color-critical)" }}>{rec.fromAlgorithm}</span>
              </td>
              <td style={tdStyle}>
                <span className="font-medium" style={{ color: "var(--color-safe)" }}>{rec.toAlgorithm}</span>
              </td>
              <td style={tdStyle}>
                <EffortBadge effort={rec.effort} />
              </td>
              <td style={tdStyle}>
                <span style={{ color: "var(--color-ink-muted)" }}>{rec.repositoryFullName}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
