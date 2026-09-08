"use client";

import { useEffect, useState } from "react";
import { Plus, Minus, Loader2 } from "lucide-react";

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

const severityColor: Record<string, string> = {
  CRITICAL: "#F0516B",
  HIGH: "#F79552",
  MODERATE: "#F2C14E",
  LOW: "#5AA9F5",
  SAFE: "#3FCF8E",
  COMPLIANT: "#3FCF8E",
};

export function ScanDiffPanel({ scanId }: { scanId: string }) {
  const [diff, setDiff] = useState<ScanDiff | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/scans/${scanId}/diff`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setDiff(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scanId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs p-4" style={{ color: "var(--color-ink-faint)" }}>
        <Loader2 size={12} className="animate-spin" /> Loading change diff…
      </div>
    );
  }

  if (!diff) {
    return (
      <div className="p-4 text-xs" style={{ color: "var(--color-ink-faint)" }}>
        No diff data available for this scan.
      </div>
    );
  }

  if (!diff.previousScanId) {
    return (
      <div className="p-4 text-xs" style={{ color: "var(--color-ink-faint)" }}>
        This is the first completed scan of this repository — no prior scan to diff against.
      </div>
    );
  }

  const summary = [
    { label: "Assets introduced", value: diff.assetsIntroducedCount, color: "var(--color-safe)" },
    { label: "Assets resolved", value: diff.assetsResolvedCount, color: "var(--color-ink-muted)" },
    { label: "Assets unchanged", value: diff.assetsUnchangedCount, color: "var(--color-ink-faint)" },
    { label: "Findings introduced", value: diff.findingsIntroducedCount, color: "var(--color-critical)" },
    { label: "Findings resolved", value: diff.findingsResolvedCount, color: "var(--color-safe)" },
  ];

  return (
    <div className="p-4 flex flex-col gap-5 overflow-y-auto">
      <div className="grid grid-cols-2 gap-2">
        {summary.map((s) => (
          <div
            key={s.label}
            className="rounded-lg p-3"
            style={{ backgroundColor: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
          >
            <p className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-ink-faint)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {diff.introducedFindings.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--color-ink)" }}>
            <Plus size={12} style={{ color: "var(--color-critical)" }} /> New findings this scan
          </p>
          <div className="flex flex-col gap-1.5">
            {diff.introducedFindings.map((f) => (
              <div key={f.id} className="rounded-lg p-2.5 text-xs" style={{ backgroundColor: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium" style={{ color: "var(--color-ink)" }}>{f.title}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0" style={{ color: severityColor[f.severity], backgroundColor: `${severityColor[f.severity]}22` }}>
                    {f.severity}
                  </span>
                </div>
                <p className="mt-1 font-mono" style={{ color: "var(--color-ink-faint)" }}>{f.filePath ?? f.code}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {diff.resolvedFindings.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--color-ink)" }}>
            <Minus size={12} style={{ color: "var(--color-safe)" }} /> Findings resolved since last scan
          </p>
          <div className="flex flex-col gap-1.5">
            {diff.resolvedFindings.map((f) => (
              <div key={f.id} className="rounded-lg p-2.5 text-xs opacity-70" style={{ backgroundColor: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
                <span className="font-medium" style={{ color: "var(--color-ink)" }}>{f.title}</span>
                <p className="mt-1 font-mono" style={{ color: "var(--color-ink-faint)" }}>{f.filePath ?? f.code}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {diff.introducedAssets.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--color-ink)" }}>
            <Plus size={12} style={{ color: "var(--color-accent)" }} /> New artefacts discovered
          </p>
          <div className="flex flex-col gap-1.5">
            {diff.introducedAssets.slice(0, 25).map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg p-2.5 text-xs" style={{ backgroundColor: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
                <div className="min-w-0">
                  <span className="font-medium" style={{ color: "var(--color-ink)" }}>{a.name}</span>
                  <p className="font-mono truncate" style={{ color: "var(--color-ink-faint)" }}>{a.filePath}</p>
                </div>
                <span className="tabular-nums flex-shrink-0" style={{ color: severityColor[a.severity] }}>{a.crsfScore}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {diff.introducedFindings.length === 0 && diff.resolvedFindings.length === 0 && diff.introducedAssets.length === 0 && (
        <p className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
          No changes detected since the previous scan — {diff.assetsUnchangedCount} artefacts confirmed unchanged.
        </p>
      )}
    </div>
  );
}
