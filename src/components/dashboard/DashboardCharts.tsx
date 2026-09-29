/**
 * The dashboard's second layer: where the risk sits. Plain HTML bars instead
 * of a charting library, so they're crisp, light and readable without
 * hovering: every bar carries its number, and each coloured segment also
 * names itself on hover.
 *
 * Colour follows meaning (severity tones), never position, and every
 * severity is also written out in the legend.
 */
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { RepositoryRiskChart } from "./RepositoryRiskChart";
import { TONE, type Tone } from "@/lib/tones";
import type { AssetByType, KeyDistribution, PostureBreakdown, RepositoryRisk, VulnBySource } from "@/fixtures/types";

const SEVERITIES: { key: keyof Omit<VulnBySource, "source">; label: string; tone: Tone }[] = [
  { key: "critical", label: "Critical", tone: "critical" },
  { key: "high", label: "High", tone: "high" },
  { key: "moderate", label: "Moderate", tone: "moderate" },
  { key: "low", label: "Low", tone: "low" },
];

function Legend({ items }: { items: { label: string; tone: Tone }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: TONE[i.tone].fill }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

// ─── Which repositories to fix first ──────────────────────────────────────────

/**
 * The priority map (see RepositoryRiskChart): readiness across, urgent assets
 * up, so the repositories to start with sit in the top-left corner.
 */
export function RepositoryRiskCard({ data }: { data: RepositoryRisk[] }) {
  return (
    <Card>
      <CardHeader
        title="Which repositories to fix first"
        subtitle="Each repository by its quantum readiness and how many assets need action first. Click one to open it."
        term="quantumReadiness"
        action={
          <Link
            href="/scanning/repositories"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-gold-ink hover:underline"
          >
            All repositories <ArrowUpRight size={14} />
          </Link>
        }
      />
      <div className="p-5">
        <RepositoryRiskChart data={data} />
      </div>
    </Card>
  );
}

// ─── Risk posture: one 100% bar, then the same numbers as a readable list ────

const POSTURE: { key: keyof PostureBreakdown; label: string; tone: Tone; meaning: string }[] = [
  { key: "high", label: "High risk", tone: "critical", meaning: "Fix first" },
  { key: "medium", label: "Moderate", tone: "moderate", meaning: "Plan a fix" },
  { key: "low", label: "Low", tone: "low", meaning: "Keep an eye on" },
  { key: "compliant", label: "Safe", tone: "safe", meaning: "Nothing to do" },
];

export function PostureCard({ data }: { data: PostureBreakdown }) {
  const total = POSTURE.reduce((s, p) => s + data[p.key], 0);
  return (
    <Card>
      <CardHeader
        title="How risky is what we found?"
        subtitle="Every asset sorted by its risk score"
        term="crsf"
        action={
          <Link
            href="/assets/pqc"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-gold-ink hover:underline"
          >
            Inventory <ArrowUpRight size={14} />
          </Link>
        }
      />
      <div className="p-5">
        {total === 0 ? (
          <p className="py-6 text-center text-[13.5px] text-muted">No assets scored yet.</p>
        ) : (
          <>
            <div className="flex h-4 gap-[2px] overflow-hidden rounded-full">
              {POSTURE.filter((p) => data[p.key] > 0).map((p) => (
                <div
                  key={p.key}
                  title={`${p.label}: ${data[p.key]}%`}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${(data[p.key] / total) * 100}%`, backgroundColor: TONE[p.tone].fill }}
                />
              ))}
            </div>
            <ul className="mt-5 grid grid-cols-2 gap-3">
              {POSTURE.map((p) => (
                <li key={p.key} className="rounded-xl border border-line px-3.5 py-3">
                  <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted">
                    <span className="size-2 rounded-full" style={{ backgroundColor: TONE[p.tone].fill }} />
                    {p.label}
                  </p>
                  <p className="num mt-1 text-xl font-semibold text-ink">{data[p.key]}%</p>
                  <p className="text-xs text-muted">{p.meaning}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}

// ─── Open problems by where they were found ───────────────────────────────────

export function SourceCard({ data }: { data: VulnBySource[] }) {
  const rows = data.map((d) => ({ ...d, total: d.critical + d.high + d.moderate + d.low }));
  const max = Math.max(1, ...rows.map((r) => r.total));
  const any = rows.some((r) => r.total > 0);
  return (
    <Card>
      <CardHeader
        title="Where are the problems?"
        subtitle="Open vulnerabilities by the kind of file they were found in"
        term="severity"
        action={
          <Link
            href="/assets/vulnerabilities"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-gold-ink hover:underline"
          >
            All issues <ArrowUpRight size={14} />
          </Link>
        }
      />
      <div className="p-5">
        {!any ? (
          <p className="py-6 text-center text-[13.5px] text-muted">No open vulnerabilities. Nice.</p>
        ) : (
          <>
            <Legend items={SEVERITIES} />
            <ul className="mt-4 space-y-3">
              {[...rows]
                .sort((a, b) => b.total - a.total)
                .map((r) => (
                  <li key={r.source} className="grid grid-cols-[104px_1fr_32px] items-center gap-3">
                    <span className={`truncate text-[13px] ${r.total ? "text-ink-2" : "text-faint"}`}>{r.source}</span>
                    <div className="h-3 overflow-hidden rounded-full bg-sunken/60">
                      <div className="flex h-full gap-[2px]" style={{ width: `${(r.total / max) * 100}%` }}>
                        {SEVERITIES.filter((s) => r[s.key] > 0).map((s) => (
                          <div
                            key={s.key}
                            title={`${r.source}: ${r[s.key]} ${s.label.toLowerCase()}`}
                            className="h-full first:rounded-l-full last:rounded-r-full"
                            style={{ flexGrow: r[s.key], backgroundColor: TONE[s.tone].fill }}
                          />
                        ))}
                      </div>
                    </div>
                    <span className="num text-right text-[13px] font-semibold text-ink">{r.total || "–"}</span>
                  </li>
                ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}

// ─── Ranked single-series bars (asset kinds, algorithm mix) ───────────────────

export function RankedBarsCard({
  title,
  subtitle,
  rows,
  suffix = "",
  empty,
  tone = "gold",
}: {
  title: string;
  subtitle: string;
  rows: { label: string; value: number }[];
  suffix?: string;
  empty: string;
  tone?: Tone;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="p-5">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-[13.5px] text-muted">{empty}</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.label} className="grid grid-cols-[minmax(0,130px)_1fr_48px] items-center gap-3">
                <span className="truncate font-mono text-[12.5px] text-ink-2" title={r.label}>
                  {r.label}
                </span>
                <div className="h-2.5 overflow-hidden rounded-full bg-sunken/60">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(r.value / max) * 100}%`, backgroundColor: TONE[tone].fill }}
                    title={`${r.label}: ${r.value}${suffix}`}
                  />
                </div>
                <span className="num text-right text-[13px] font-semibold text-ink">
                  {r.value}
                  {suffix}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

export const assetRows = (d: AssetByType[]) => d.map((a) => ({ label: a.type, value: a.count }));
export const keyRows = (d: KeyDistribution[]) => d.map((k) => ({ label: k.name, value: k.percent }));
