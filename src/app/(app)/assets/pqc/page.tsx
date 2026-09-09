"use client";

import { useState, useEffect } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { ScoreBar, SeverityPill, ScorePill } from "@/components/ui/Pill";
import { Drawer } from "@/components/ui/Drawer";
import { Tabs } from "@/components/ui/Tabs";
import { MoscaTimeline } from "@/components/ui/MoscaTimeline";
import type { ColumnDef } from "@/components/ui/DataTable";
import type { CryptoAsset } from "@/fixtures/types";
import { formatDate } from "@/lib/format";
import { Download, Shield } from "lucide-react";

const columns: ColumnDef<CryptoAsset>[] = [
  {
    key: "name",
    header: "Algorithm Name",
    sortable: true,
    render: (row) => (
      <span className="font-medium" style={{ color: "var(--color-ink)" }}>{row.name}</span>
    ),
  },
  {
    key: "dependencies",
    header: "Dependencies",
    sortable: true,
    width: "100px",
    render: (row) => (
      <span className="tabular-nums" style={{ color: "var(--color-ink-muted)" }}>{row.dependencies}</span>
    ),
    getValue: (row) => row.dependencies,
  },
  {
    key: "keyLengthBits",
    header: "Key Length",
    sortable: true,
    width: "100px",
    render: (row) => (
      <span className="tabular-nums" style={{ color: "var(--color-ink-muted)" }}>
        {row.keyLengthBits ?? "—"}
      </span>
    ),
    getValue: (row) => row.keyLengthBits ?? 0,
  },
  {
    key: "moscaVerdict",
    header: "Mosca Verdict",
    sortable: true,
    width: "120px",
    render: (row) => {
      const v = row.moscaVerdict ?? (row.quantumSafe ? "SAFE" : "PLAN");
      const c = v === "ACT_NOW" ? "#F0516B" : v === "PLAN" ? "#F2C14E" : "#3FCF8E";
      return (
        <span
          className="text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{
            backgroundColor: `${c}1a`,
            color: c,
            border: `1px solid ${c}44`,
          }}
        >
          {v.replace("_", " ")}
        </span>
      );
    },
    getValue: (row) => row.moscaVerdict ?? (row.quantumSafe ? "SAFE" : "PLAN"),
  },
  {
    key: "crsfScore",
    header: "CRSF Score",
    sortable: true,
    width: "160px",
    render: (row) => <ScoreBar score={row.crsfScore} />,
    getValue: (row) => row.crsfScore,
  },
  {
    key: "lastSeenAt",
    header: "Last Seen",
    sortable: true,
    render: (row) => (
      <span className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
        {formatDate(row.lastSeenAt, "MMM d, yyyy HH:mm")}
      </span>
    ),
    getValue: (row) => row.lastSeenAt,
  },
];

function AssetDrawer({ asset, onClose }: { asset: CryptoAsset | null; onClose: () => void }) {
  if (!asset) return null;

  const quantumSafeLabel = asset.quantumSafe === true ? "Yes" : asset.quantumSafe === false ? "No" : "Unknown";
  const riskScore = asset.crsfScore;
  const riskCategory = riskScore >= 70 ? "HIGH" : riskScore >= 45 ? "MEDIUM" : riskScore >= 20 ? "LOW" : "SAFE";
  const riskColor = riskCategory === "HIGH" ? "#F0516B" : riskCategory === "MEDIUM" ? "#F2C14E" : riskCategory === "LOW" ? "#5AA9F5" : "#3FCF8E";

  return (
    <Drawer
      open={!!asset}
      onClose={onClose}
      title={asset.name}
      subtitle={`${asset.primitive ? asset.primitive + " · " : ""}${asset.keyLengthBits ? asset.keyLengthBits + "-bit" : ""} · ${asset.usageCount} ${asset.usageCount === 1 ? "dependency" : "dependencies"}`}
    >
      <div className="p-5 flex flex-col gap-5">
        {/* Score row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "CIS Score", value: (100 - asset.crsfScore).toFixed(2), color: "var(--color-ink)" },
            { label: "Risk Score", value: asset.crsfScore, color: riskColor },
            { label: "Risk Category", value: riskCategory, color: riskColor, isTag: true },
            { label: "Usage Count", value: asset.usageCount, color: "var(--color-ink)" },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-lg p-3 text-center"
              style={{
                backgroundColor: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
              }}
            >
              <p className="text-xl font-bold tabular-nums" style={{ color: kpi.color }}>
                {kpi.isTag ? (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ backgroundColor: `${riskColor}22`, color: riskColor, border: `1px solid ${riskColor}44` }}
                  >
                    {kpi.value}
                  </span>
                ) : (
                  kpi.value
                )}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--color-ink-faint)" }}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs
          tabs={[
            { id: "details", label: "Details" },
            { id: "cis", label: "CIS Explanation" },
            { id: "mosca", label: "Mosca" },
          ]}
        >
          {(activeTab) =>
            activeTab === "mosca" ? (
              <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: "var(--color-surface-2)" }}>
                <MoscaTimeline
                  x={asset.moscaX ?? 5}
                  y={asset.moscaY ?? 3}
                  z={asset.moscaZ ?? 7}
                  verdict={asset.moscaVerdict ?? (asset.quantumSafe ? "SAFE" : "PLAN")}
                />
              </div>
            ) : activeTab === "details" ? (
              <div className="mt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <th
                        className="text-left py-2 font-semibold text-xs uppercase tracking-wide"
                        style={{ color: "var(--color-ink-muted)", width: "40%" }}
                      >
                        Field
                      </th>
                      <th
                        className="text-left py-2 font-semibold text-xs uppercase tracking-wide"
                        style={{ color: "var(--color-ink-muted)" }}
                      >
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { field: "Primitive", value: asset.primitive ?? "—" },
                      { field: "Type", value: asset.kind },
                      { field: "Mode", value: asset.mode ?? "—" },
                      { field: "Key Length", value: asset.keyLengthBits ? `${asset.keyLengthBits} bits` : "—" },
                      {
                        field: "Quantum Safe",
                        value: null,
                        custom: (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                            style={{
                              backgroundColor: asset.quantumSafe ? "rgba(63,207,142,0.15)" : "rgba(240,81,107,0.15)",
                              color: asset.quantumSafe ? "#3FCF8E" : "#F0516B",
                              border: `1px solid ${asset.quantumSafe ? "rgba(63,207,142,0.4)" : "rgba(240,81,107,0.4)"}`,
                            }}
                          >
                            {quantumSafeLabel}
                          </span>
                        ),
                      },
                      { field: "Execution Environment", value: asset.executionEnvironment ?? "—" },
                      { field: "File Path", value: asset.filePath },
                      { field: "Usage Count", value: asset.usageCount },
                      { field: "Dependencies", value: asset.dependencies },
                      {
                        field: "Last Seen",
                        value: formatDate(asset.lastSeenAt, "MMM d, yyyy HH:mm"),
                      },
                    ].map((row) => (
                      <tr
                        key={row.field}
                        style={{ borderBottom: "1px solid var(--color-border)" }}
                      >
                        <td className="py-3 pr-4" style={{ color: "var(--color-ink-muted)" }}>
                          {row.field}
                        </td>
                        <td className="py-3" style={{ color: "var(--color-ink)" }}>
                          {row.custom ?? (
                            <span className="font-mono text-xs">{String(row.value)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: "var(--color-surface-2)" }}>
                <h4 className="font-semibold mb-3" style={{ color: "var(--color-ink)" }}>
                  CIS Explanation
                </h4>
                <div className="flex flex-col gap-3 text-sm" style={{ color: "var(--color-ink-muted)" }}>
                  <p>
                    <strong style={{ color: "var(--color-ink)" }}>{asset.name}</strong> has a CRSF score of{" "}
                    <strong style={{ color: riskColor }}>{asset.crsfScore}/100</strong>, classifying it as{" "}
                    <strong style={{ color: riskColor }}>{riskCategory}</strong> risk.
                  </p>
                  {!asset.quantumSafe && (
                    <p>
                      ⚠️ This algorithm is <strong style={{ color: "#F0516B" }}>not quantum-safe</strong>. 
                      Under NIST SP 800-131A Rev 3 transition guidance, this algorithm should be migrated 
                      to a post-quantum alternative before the estimated CRQC arrival in 2033.
                    </p>
                  )}
                  {asset.crsfScore >= 70 && (
                    <p>
                      🔴 <strong>Recommended action:</strong> Immediately plan migration away from this algorithm. 
                      Consider ML-KEM-768 (FIPS 203) for key agreement or ML-DSA-65 (FIPS 204) for signatures.
                    </p>
                  )}
                  {asset.quantumSafe && (
                    <p>
                      ✅ This algorithm meets post-quantum security requirements and can be retained in your 
                      cryptographic inventory without immediate action.
                    </p>
                  )}
                </div>
              </div>
            )
          }
        </Tabs>
      </div>
    </Drawer>
  );
}

export default function PqcPage() {
  const [selectedAsset, setSelectedAsset] = useState<CryptoAsset | null>(null);
  const [algorithms, setAlgorithms] = useState<CryptoAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/assets?kind=ALGORITHM&pageSize=500")
      .then((r) => r.json())
      .then((data) => setAlgorithms(data.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
            PQC — Cryptographic Inventory
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-ink-muted)" }}>
            Algorithms · Certificates · Keys · Protocols
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/assets/pqc/cbom"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-ink-muted)" }}
          >
            <Shield size={14} /> CBOM Report
          </a>
          <a
            href="/api/assets/export?kind=ALGORITHM"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "var(--color-accent)", color: "#fff" }}
          >
            <Download size={14} /> Export Inventory (JSON)
          </a>
        </div>
      </div>



      <DataTable
        data={algorithms}
        columns={columns}
        pageSize={11}
        searchable
        searchPlaceholder="Search..."
        getRowKey={(r) => r.id}
        onRowClick={(row) => setSelectedAsset(row)}
      />

      <p className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
        Showing 1 to {Math.min(algorithms.length, 11)} of {algorithms.length} records
      </p>

      {/* Detail drawer */}
      <AssetDrawer asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
    </div>
  );
}
