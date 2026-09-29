"use client";

/**
 * What changed since the previous scan: a one-line summary first, then the
 * new and fixed problems, then new assets.
 */
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Minus, Plus } from "lucide-react";
import { SeverityPill } from "@/components/ui/Pill";
import { TONE, riskBand, type SeverityLabel } from "@/lib/tones";

interface DiffAssetRow {
  id: string;
  name: string;
  kind: string;
  filePath: string;
  crsfScore: number;
  severity: string;
}
interface DiffFindingRow {
  id: string;
  code: string;
  title: string;
  severity: string;
  filePath: string | null;
}
interface ScanDiff {
  previousScanId: string | null;
  assetsIntroducedCount: number;
  assetsResolvedCount: number;
  assetsUnchangedCount: number;
  findingsIntroducedCount: number;
  findingsResolvedCount: number;
  findingsUnchangedCount: number;
  introducedAssets: DiffAssetRow[];
  resolvedAssets: DiffAssetRow[];
  introducedFindings: DiffFindingRow[];
  resolvedFindings: DiffFindingRow[];
}

const toLabel = (s: string): SeverityLabel => {
  const v = s.charAt(0) + s.slice(1).toLowerCase();
  return (
    ["Critical", "High", "Moderate", "Low", "Compliant"].includes(v) ? v : v === "Safe" ? "Compliant" : "Low"
  ) as SeverityLabel;
};

export function ScanDiffPanel({ scanId }: { scanId: string }) {
  const [diff, setDiff] = useState<ScanDiff | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when a different scan is opened
    setLoading(true);
    fetch(`/api/scans/${scanId}/diff`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => !cancelled && setDiff(data))
      .catch(() => !cancelled && setDiff(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [scanId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-[13px] text-muted">
        <Loader2 size={14} className="animate-spin" /> Comparing with the previous scan…
      </div>
    );
  }
  if (!diff) return <p className="p-6 text-[13.5px] text-muted">There&apos;s no comparison for this scan yet.</p>;
  if (!diff.previousScanId) {
    return (
      <p className="p-6 text-[13.5px] text-muted">
        This is the first finished scan of this repository, so there&apos;s nothing earlier to compare with.
      </p>
    );
  }

  const nothing =
    diff.introducedFindings.length === 0 && diff.resolvedFindings.length === 0 && diff.introducedAssets.length === 0;
  const stats = [
    { label: "New problems", value: diff.findingsIntroducedCount, tone: "critical" as const },
    { label: "Problems fixed", value: diff.findingsResolvedCount, tone: "safe" as const },
    { label: "New assets", value: diff.assetsIntroducedCount, tone: "gold" as const },
    { label: "Assets removed", value: diff.assetsResolvedCount, tone: "neutral" as const },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-line px-3.5 py-3">
            <p className="num text-xl font-semibold text-ink">{s.value}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
              <span className="size-2 rounded-full" style={{ backgroundColor: TONE[s.tone].fill }} />
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {nothing && (
        <p className="flex items-center gap-2 text-[13.5px] text-safe-ink">
          <CheckCircle2 size={16} /> Nothing changed since the previous scan; {diff.assetsUnchangedCount} assets are the
          same.
        </p>
      )}

      {diff.introducedFindings.length > 0 && (
        <DiffList icon={<Plus size={14} className="text-critical" />} title="New problems in this scan">
          {diff.introducedFindings.map((f) => (
            <li
              key={f.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5"
            >
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium text-ink">{f.title}</span>
                <span className="block truncate font-mono text-xs text-muted">{f.filePath ?? f.code}</span>
              </span>
              <SeverityPill severity={toLabel(f.severity)} />
            </li>
          ))}
        </DiffList>
      )}

      {diff.resolvedFindings.length > 0 && (
        <DiffList icon={<Minus size={14} className="text-safe" />} title="Fixed since the previous scan">
          {diff.resolvedFindings.map((f) => (
            <li key={f.id} className="rounded-xl border border-line bg-safe-tint/40 px-3.5 py-2.5">
              <span className="block text-[13.5px] font-medium text-ink line-through decoration-safe/60">
                {f.title}
              </span>
              <span className="block truncate font-mono text-xs text-muted">{f.filePath ?? f.code}</span>
            </li>
          ))}
        </DiffList>
      )}

      {diff.introducedAssets.length > 0 && (
        <DiffList icon={<Plus size={14} className="text-gold-ink" />} title="New cryptography found">
          {diff.introducedAssets.slice(0, 25).map((a) => {
            const band = riskBand(a.crsfScore);
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-medium text-ink">{a.name}</span>
                  <span className="block truncate font-mono text-xs text-muted">{a.filePath}</span>
                </span>
                <SeverityPill severity={band.label} />
              </li>
            );
          })}
        </DiffList>
      )}
    </div>
  );
}

function DiffList({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
        {icon}
        {title}
      </h3>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  );
}
