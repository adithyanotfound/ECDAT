"use client";

/**
 * The dashboard's "fix first" list: the five most valuable migrations, each
 * as from → to with the effort, linking through to the full list.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Lightbulb } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { EffortPill } from "@/components/ui/Pill";
import { SkeletonBlock } from "@/components/ui/States";

interface Recommendation {
  id: string;
  fromAlgorithm: string;
  toAlgorithm: string;
  standard: string | null;
  effort: "HIGH" | "MEDIUM" | "LOW";
  repositoryFullName: string;
}

export function RecommendationsTable() {
  const [items, setItems] = useState<Recommendation[] | null>(null);

  useEffect(() => {
    // Lowest effort first: quick wins come before redesigns.
    fetch("/api/recommendations?pageSize=100&sort=effort")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: Recommendation[] }) => {
        const all = d.items ?? [];
        const order = { LOW: 0, MEDIUM: 1, HIGH: 2 };
        setItems([...all].sort((a, b) => order[a.effort] - order[b.effort]).slice(0, 5));
      })
      .catch(() => setItems([]));
  }, []);

  return (
    <Card>
      <CardHeader
        icon={<Lightbulb size={16} />}
        title="Quick wins to start with"
        subtitle="The easiest upgrades first, so progress shows early"
        term="recommendation"
        action={
          <Link
            href="/assets/recommendations"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-gold-ink hover:underline"
          >
            All recommendations <ArrowUpRight size={14} />
          </Link>
        }
      />
      {items === null ? (
        <div className="space-y-3 p-5">
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} className="h-11" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="px-5 py-10 text-center text-[13.5px] text-muted">
          No recommendations yet. They appear after a scan finds something to replace.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((rec) => (
            <li key={rec.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
              <span className="flex min-w-0 flex-1 items-center gap-2.5 text-[13.5px]">
                <span className="rounded-md bg-critical-tint px-2 py-0.5 font-mono text-[12.5px] text-critical-ink">
                  {rec.fromAlgorithm}
                </span>
                <ArrowRight size={14} className="shrink-0 text-faint" />
                <span className="rounded-md bg-safe-tint px-2 py-0.5 font-mono text-[12.5px] text-safe-ink">
                  {rec.toAlgorithm}
                </span>
                {rec.standard && <span className="hidden text-xs text-muted md:inline">{rec.standard}</span>}
              </span>
              <span className="hidden max-w-[220px] truncate text-[13px] text-muted lg:block">
                {rec.repositoryFullName}
              </span>
              <EffortPill effort={rec.effort} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
