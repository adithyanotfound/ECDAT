"use client";

/**
 * Crypto inventory: every algorithm, key, certificate, protocol and library
 * found. Peeled in layers:
 *   1. Four numbers: how much, how much is quantum-safe, how much is urgent.
 *   2. Filters by risk band and kind (the dashboard and repository pages link
 *      here pre-filtered with ?risk=high and ?repositoryId=).
 *   3. The table, most risky first.
 *   4. A drawer per asset: one sentence, why it matters, what to do, the
 *      timeline, and every technical field.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Download, FileBadge2, Lightbulb, ShieldAlert, ShieldCheck, ShieldQuestion, X } from "lucide-react";
import type { CryptoAsset, CryptoKind } from "@/fixtures/types";
import { PageHeader } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { FilterChips } from "@/components/ui/Controls";
import { Drawer } from "@/components/ui/Drawer";
import { Tabs } from "@/components/ui/Tabs";
import { MoscaTimeline } from "@/components/ui/MoscaTimeline";
import { Badge, QuantumSafePill, ScoreBar, ScorePill, SeverityPill, VerdictPill } from "@/components/ui/Pill";
import { StatCard } from "@/components/ui/StatCard";
import { InfoHint, Term } from "@/components/ui/InfoHint";
import { Notice } from "@/components/ui/States";
import { adviceFor, inShort, purposeOf } from "@/lib/advice";
import { riskBand, type SeverityLabel } from "@/lib/tones";
import { formatDate, formatRelativeTime } from "@/lib/format";

const KINDS: CryptoKind[] = ["Algorithm", "Key", "Certificate", "Protocol", "Library", "Secret"];
const KIND_LABEL: Record<CryptoKind, string> = {
  Algorithm: "Algorithms",
  Key: "Keys",
  Certificate: "Certificates",
  Protocol: "Protocols",
  Library: "Libraries",
  Secret: "Secrets",
};
const BANDS: SeverityLabel[] = ["Critical", "High", "Moderate", "Low", "Compliant"];
const BAND_TONE = { Critical: "critical", High: "high", Moderate: "moderate", Low: "low", Compliant: "safe" } as const;

const bandOf = (a: CryptoAsset) => riskBand(a.crsfScore).label;
const verdictOf = (a: CryptoAsset) => a.moscaVerdict ?? (a.quantumSafe ? "SAFE" : "PLAN");

const columns: ColumnDef<CryptoAsset>[] = [
  {
    key: "name",
    header: "Asset",
    sortable: true,
    render: (a) => (
      <div className="min-w-0">
        <p className="font-medium text-ink">{a.name}</p>
        <p className="max-w-[260px] truncate text-xs text-muted">
          {a.kind}
          {a.repositoryFullName ? ` · ${a.repositoryFullName}` : ""}
        </p>
      </div>
    ),
    getValue: (a) => a.name,
  },
  {
    key: "quantumSafe",
    header: "Quantum-safe",
    term: "quantumSafe",
    sortable: true,
    render: (a) => <QuantumSafePill safe={a.quantumSafe} />,
    getValue: (a) => (a.quantumSafe ? 1 : 0),
  },
  {
    key: "moscaVerdict",
    header: "Timeline",
    term: "mosca",
    sortable: true,
    render: (a) => <VerdictPill verdict={verdictOf(a)} />,
    getValue: (a) => ({ ACT_NOW: 0, PLAN: 1, SAFE: 2 })[verdictOf(a)],
  },
  {
    key: "crsfScore",
    header: "Risk score",
    term: "crsf",
    sortable: true,
    width: "170px",
    render: (a) => <ScoreBar score={a.crsfScore} />,
    getValue: (a) => a.crsfScore,
  },
  {
    key: "keyLengthBits",
    header: "Key size",
    term: "keyLength",
    sortable: true,
    align: "right",
    render: (a) => <span className="num text-ink-2">{a.keyLengthBits ? `${a.keyLengthBits}-bit` : "–"}</span>,
    getValue: (a) => a.keyLengthBits ?? 0,
  },
  {
    key: "usageCount",
    header: "Used",
    sortable: true,
    align: "right",
    render: (a) => <span className="num text-ink-2">{a.usageCount}×</span>,
    getValue: (a) => a.usageCount,
  },
  {
    key: "lastSeenAt",
    header: "Last seen",
    sortable: true,
    render: (a) => <span className="text-[13px] whitespace-nowrap text-muted">{formatRelativeTime(a.lastSeenAt)}</span>,
    getValue: (a) => a.lastSeenAt,
  },
];

export default function PqcPage() {
  const [assets, setAssets] = useState<CryptoAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CryptoAsset | null>(null);
  const [band, setBand] = useState<SeverityLabel | "">("");
  const [kind, setKind] = useState<CryptoKind | "">("");
  const [repositoryId, setRepositoryId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Filters arrive in the URL from the dashboard and repository pages.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    /* eslint-disable react-hooks/set-state-in-effect -- reading the URL once on mount */
    setRepositoryId(p.get("repositoryId"));
    if (p.get("risk") === "high") setBand("Critical");
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!ready) return;
    const url = new URL("/api/assets", window.location.origin);
    url.searchParams.set("pageSize", "500");
    if (repositoryId) url.searchParams.set("repositoryId", repositoryId);
    fetch(url.toString())
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setAssets(data.items ?? []))
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, [ready, repositoryId]);

  const shown = useMemo(
    () => assets.filter((a) => (!band || bandOf(a) === band) && (!kind || a.kind === kind)),
    [assets, band, kind],
  );

  const safe = assets.filter((a) => a.quantumSafe === true).length;
  const actNow = assets.filter((a) => verdictOf(a) === "ACT_NOW").length;
  const high = assets.filter((a) => a.crsfScore >= 70).length;
  const repoName = repositoryId ? (assets[0]?.repositoryFullName ?? "this repository") : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Understand & fix"
        title="Crypto inventory"
        description="Every algorithm, key, certificate, protocol setting and crypto library we found, most risky first. Open any row for what it's used for and what to replace it with."
        actions={
          <>
            <Link href="/assets/pqc/cbom" className={buttonClass("secondary")}>
              <FileBadge2 size={16} /> CBOM report
            </Link>
            <a
              href={`/api/assets/export${repositoryId ? `?repositoryId=${encodeURIComponent(repositoryId)}` : ""}`}
              className={buttonClass("primary")}
            >
              <Download size={16} /> Export JSON
            </a>
          </>
        }
      />

      {repoName && (
        <Notice
          tone="gold"
          action={
            <Link
              href="/assets/pqc"
              onClick={() => setRepositoryId(null)}
              className="inline-flex items-center gap-1 font-semibold hover:underline"
            >
              <X size={14} /> Show all
            </Link>
          }
        >
          Showing only <b>{repoName}</b>.
        </Notice>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Assets found"
          value={loading ? "–" : assets.length}
          subtitle="Across the repositories shown"
          term="asset"
          tone="gold"
        />
        <StatCard
          title="Quantum-safe"
          value={loading ? "–" : `${assets.length ? Math.round((safe / assets.length) * 100) : 0}%`}
          subtitle={`${safe} of ${assets.length} would survive a quantum computer`}
          term="quantumSafe"
          tone="safe"
          icon={<ShieldCheck size={16} />}
        />
        <StatCard
          title="High risk"
          value={loading ? "–" : high}
          subtitle="Risk score 70 or more"
          term="highRisk"
          tone="critical"
          icon={<ShieldAlert size={16} />}
        />
        <StatCard
          title="Act now"
          value={loading ? "–" : actNow}
          subtitle="Data outlives the time left to migrate"
          term="mosca"
          tone="high"
          icon={<ShieldQuestion size={16} />}
        />
      </section>

      <DataTable
        data={shown}
        columns={columns}
        loading={loading}
        pageSize={12}
        searchable
        searchPlaceholder="Search name, repository…"
        getRowKey={(a) => a.id}
        onRowClick={setSelected}
        rowLabel={(a) => `Open ${a.name}`}
        noun="assets"
        emptyTitle={assets.length ? "Nothing in this filter" : "No cryptography found yet"}
        emptyMessage={
          assets.length
            ? "Try another risk level or kind."
            : "Assets appear here after a scan finishes. Add a repository or press Scan now to run one."
        }
        toolbar={
          <div className="flex flex-col gap-2.5">
            <FilterChips
              label="Risk level"
              value={band}
              onChange={setBand}
              allLabel="Any risk"
              allCount={assets.length}
              options={BANDS.map((b) => ({
                value: b,
                label: b === "Compliant" ? "Safe" : b,
                tone: BAND_TONE[b],
                count: assets.filter((a) => bandOf(a) === b).length,
              }))}
            />
            <FilterChips
              label="Kind"
              value={kind}
              onChange={setKind}
              allLabel="Every kind"
              options={KINDS.filter((k) => assets.some((a) => a.kind === k)).map((k) => ({
                value: k,
                label: KIND_LABEL[k],
                count: assets.filter((a) => a.kind === k).length,
              }))}
            />
          </div>
        }
      />

      <AssetDrawer asset={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function AssetDrawer({ asset, onClose }: { asset: CryptoAsset | null; onClose: () => void }) {
  if (!asset) return null;
  const band = riskBand(asset.crsfScore);
  const advice = adviceFor(asset);
  const verdict = verdictOf(asset);

  const facts: [string, React.ReactNode][] = [
    ["Kind", asset.kind],
    ["Purpose", asset.primitive ?? "–"],
    ["Mode", asset.mode ?? "–"],
    ["Key size", asset.keyLengthBits ? `${asset.keyLengthBits} bits` : "–"],
    ["Curve", asset.curve ?? "–"],
    ["Runs in", asset.executionEnvironment ?? "–"],
    ["Used", `${asset.usageCount} ${asset.usageCount === 1 ? "place" : "places"}`],
    ["Repository", asset.repositoryFullName ?? "–"],
    [
      "File",
      <span key="f" className="font-mono text-[12.5px] break-all">
        {asset.filePath}
      </span>,
    ],
    ["Last seen", formatDate(asset.lastSeenAt, "d MMM yyyy, HH:mm")],
  ];

  return (
    <Drawer
      open
      onClose={onClose}
      title={asset.name}
      eyebrow={
        <>
          <SeverityPill severity={band.label} />
          <QuantumSafePill safe={asset.quantumSafe} />
          <VerdictPill verdict={verdict} />
        </>
      }
      subtitle={purposeOf(asset)}
      footer={
        advice ? (
          <Link
            href={`/assets/recommendations?search=${encodeURIComponent(asset.name)}`}
            className={buttonClass("primary", "md", "w-full")}
          >
            <Lightbulb size={16} /> See the recommendation for {asset.name} <ArrowRight size={16} />
          </Link>
        ) : undefined
      }
    >
      <Tabs
        stripClassName="px-6"
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "timeline", label: "Timeline" },
          { id: "details", label: "Technical details" },
        ]}
      >
        {(tab) => (
          <div className="p-6">
            {tab === "overview" && (
              <div className="flex flex-col gap-5">
                <div className="rounded-xl bg-surface-2/70 p-4">
                  <p className="text-xs font-semibold tracking-[0.12em] text-gold-ink uppercase">In short</p>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{inShort(asset)}</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-line p-3.5">
                    <p className="text-xs text-muted">
                      <Term term="crsf">Risk score</Term>
                    </p>
                    <p className="num mt-1 text-2xl font-semibold text-ink">
                      {asset.crsfScore}
                      <span className="text-sm font-normal text-muted">/100</span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-line p-3.5">
                    <p className="text-xs text-muted">
                      <Term term="cis">Integrity</Term>
                    </p>
                    <p className="num mt-1 text-2xl font-semibold text-ink">
                      {100 - asset.crsfScore}
                      <span className="text-sm font-normal text-muted">/100</span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-line p-3.5">
                    <p className="text-xs text-muted">
                      <Term term="pqcScore">Quantum safety</Term>
                    </p>
                    <p className="mt-1.5">
                      <ScorePill score={asset.pqcSafetyScore} />
                    </p>
                  </div>
                </div>

                <section>
                  <h3 className="text-[14px] font-semibold text-ink">Why it matters</h3>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">
                    {advice?.why ??
                      (asset.quantumSafe
                        ? "This algorithm is designed to resist quantum computers, so it can stay as it is."
                        : "It isn't quantum-safe, but its risk score is low because of how and where it's used.")}{" "}
                    {band.advice}
                  </p>
                </section>

                {advice && (
                  <section className="rounded-xl border border-safe/25 bg-safe-tint/50 p-4">
                    <h3 className="text-[14px] font-semibold text-ink">What to do</h3>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">
                      Move to <b className="text-safe-ink">{advice.moveTo}</b>
                      {advice.standard && (
                        <>
                          {" "}
                          <Badge dot={false} className="ml-1 align-middle">
                            {advice.standard}
                          </Badge>
                        </>
                      )}
                      .
                    </p>
                  </section>
                )}

                <p className="text-[13px] text-muted">
                  Found in <span className="font-mono text-ink-2">{asset.filePath}</span>
                  {asset.usageCount > 1 &&
                    `, and ${asset.usageCount - 1} other place${asset.usageCount === 2 ? "" : "s"}`}
                  .
                </p>
              </div>
            )}

            {tab === "timeline" && (
              <MoscaTimeline x={asset.moscaX ?? 5} y={asset.moscaY ?? 3} z={asset.moscaZ ?? 7} verdict={verdict} />
            )}

            {tab === "details" && (
              <dl className="divide-y divide-line rounded-xl border border-line">
                {facts.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[130px_1fr] gap-4 px-4 py-2.5 text-[13.5px]">
                    <dt className="text-muted">{k}</dt>
                    <dd className="min-w-0 text-ink">{v}</dd>
                  </div>
                ))}
                <div className="grid grid-cols-[130px_1fr] gap-4 px-4 py-2.5 text-[13.5px]">
                  <dt className="flex items-center gap-1 text-muted">
                    Quantum-safe <InfoHint label="Quantum-safe" term="quantumSafe" />
                  </dt>
                  <dd>
                    <QuantumSafePill safe={asset.quantumSafe} />
                  </dd>
                </div>
              </dl>
            )}
          </div>
        )}
      </Tabs>
    </Drawer>
  );
}
