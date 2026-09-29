"use client";

/**
 * CBOM report: the standard CycloneDX 1.6 list of a repository's
 * cryptography, ready to hand to an auditor. Pick a repository, read the
 * summary, then the full component list and its open problems. Downloads as
 * JSON (the standard) or PDF (for people).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileBadge2, FileText, Printer, RefreshCw } from "lucide-react";
import type { Finding, Repository } from "@/fixtures/types";
import { Card, CardHeader, PageHeader } from "@/components/ui/Card";
import { Button, buttonClass } from "@/components/ui/Button";
import { FilterChips, inputClass } from "@/components/ui/Controls";
import { Badge, SeverityPill } from "@/components/ui/Pill";
import { EmptyState, Notice, SkeletonBlock } from "@/components/ui/States";
import { StatCard } from "@/components/ui/StatCard";
import { InfoHint } from "@/components/ui/InfoHint";

interface CbomComponent {
  type: string;
  "bom-ref": string;
  name: string;
  cryptoProperties: {
    assetType: string;
    algorithmProperties?: {
      primitive: string;
      parameterSetIdentifier?: string;
      mode?: string;
      nistQuantumSecurityLevel: number;
      executionEnvironment: string;
    };
  };
  evidence: { occurrences: { location: string }[] };
  properties?: { name: string; value: string }[];
}
interface CbomDoc {
  bomFormat: string;
  specVersion: string;
  serialNumber: string;
  metadata: { timestamp: string; component: { name: string; version: string } };
  components: CbomComponent[];
}
interface CbomResponse {
  scanId: string;
  repositoryFullName: string;
  commitSha: string;
  completedAt: string;
  cbom: CbomDoc;
}

const isSafe = (c: CbomComponent) => (c.cryptoProperties.algorithmProperties?.nistQuantumSecurityLevel ?? 0) > 0;
const isAlgo = (c: CbomComponent) => !!c.cryptoProperties.algorithmProperties;

export default function CbomReportPage() {
  const [repos, setRepos] = useState<Repository[] | null>(null);
  const [repoId, setRepoId] = useState("");
  const [report, setReport] = useState<CbomResponse | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"safe" | "vulnerable" | "">("");

  useEffect(() => {
    fetch("/api/repositories")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Repository[]) => {
        const list = Array.isArray(data) ? data : [];
        setRepos(list);
        const fromUrl = new URLSearchParams(window.location.search).get("repositoryId");
        const scanned = list.find((r) => r.lastScanStatus === "Completed");
        setRepoId(list.find((r) => r.id === fromUrl)?.id ?? scanned?.id ?? list[0]?.id ?? "");
      })
      .catch(() => setRepos([]));
  }, []);

  const loadReport = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [cbomRes, findingsRes] = await Promise.all([
        fetch(`/api/repositories/${id}/cbom`),
        fetch(`/api/findings?repositoryId=${encodeURIComponent(id)}&status=OPEN&pageSize=100`),
      ]);
      if (!cbomRes.ok) {
        setReport(null);
        setError(
          (await cbomRes.json().catch(() => null))?.error ?? "No CBOM yet. Run a scan on this repository first.",
        );
      } else {
        setReport(await cbomRes.json());
      }
      const f = await findingsRes.json().catch(() => null);
      setFindings(f?.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch the report for the chosen repository
    if (repoId) loadReport(repoId);
  }, [repoId, loadReport]);

  const components = useMemo(() => report?.cbom.components ?? [], [report]);
  const algos = components.filter(isAlgo);
  const safe = algos.filter(isSafe).length;
  const shown = components.filter(
    (c) => !filter || (filter === "safe" ? isAlgo(c) && isSafe(c) : !(isAlgo(c) && isSafe(c))),
  );

  const generatePDF = async () => {
    if (!report) return;
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF("p", "pt", "a4");
    const charcoal: [number, number, number] = [31, 33, 38];
    const gold: [number, number, number] = [196, 150, 44];
    const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

    doc.setFillColor(...charcoal);
    doc.rect(0, 0, 595, 70, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text(`CBOM report: ${report.repositoryFullName}`, 40, 36);
    doc.setFontSize(9);
    doc.setTextColor(217, 174, 74);
    doc.text(
      `CycloneDX ${report.cbom.specVersion} · commit ${report.commitSha} · scanned ${new Date(report.completedAt).toLocaleString()}`,
      40,
      54,
    );

    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text(
      `Summary: ${components.length} components, ${safe} quantum-safe, ${algos.length - safe} quantum-vulnerable.`,
      40,
      96,
    );

    autoTable(doc, {
      startY: 112,
      head: [["Component", "Type", "Primitive", "Key size", "Quantum-safe", "Where"]],
      body: components.map((c) => {
        const ap = c.cryptoProperties.algorithmProperties;
        return [
          c.name,
          c.cryptoProperties.assetType,
          ap?.primitive ?? "–",
          ap?.parameterSetIdentifier ?? "–",
          isAlgo(c) ? (isSafe(c) ? "Yes" : "No") : "–",
          c.evidence.occurrences[0]?.location ?? "–",
        ];
      }),
      theme: "grid",
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: charcoal, textColor: 255 },
      alternateRowStyles: { fillColor: [246, 244, 239] },
    });

    doc.setFontSize(12);
    doc.text("Open vulnerabilities", 40, lastY() + 30);
    autoTable(doc, {
      startY: lastY() + 40,
      head: [["Rule", "Severity", "Problem", "Affects"]],
      body: findings.length
        ? findings.map((f) => [f.code, f.severity, f.title, f.affectedComponent])
        : [["–", "–", "No open vulnerabilities", "–"]],
      theme: "grid",
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: gold, textColor: charcoal },
    });

    doc.save(`${report.repositoryFullName.replace(/[^A-Za-z0-9._-]+/g, "-")}-cbom.pdf`);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Understand & fix"
        title="CBOM report"
        description={
          <>
            A standard list of every cryptographic component in a repository, in the CycloneDX 1.6 format auditors and
            other tools can read.{" "}
            <span className="inline-flex items-center gap-1">
              What&apos;s a CBOM? <InfoHint label="CBOM" term="cbom" />
            </span>
          </>
        }
        actions={
          report && (
            <>
              <Button onClick={generatePDF}>
                <Printer size={16} /> Download PDF
              </Button>
              <a href={`/api/repositories/${repoId}/cbom?download=1`} className={buttonClass("primary")}>
                <Download size={16} /> Download CBOM (JSON)
              </a>
            </>
          )
        }
      />

      <Card className="no-print">
        <div className="flex flex-wrap items-end gap-3 p-5">
          <label className="flex min-w-[260px] flex-1 flex-col gap-1.5 sm:max-w-md">
            <span className="text-[13px] font-medium text-ink-2">Repository</span>
            <select
              value={repoId}
              onChange={(e) => setRepoId(e.target.value)}
              className={inputClass}
              disabled={!repos?.length}
            >
              {repos === null && <option>Loading…</option>}
              {repos?.length === 0 && <option>No repositories connected</option>}
              {repos?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                  {r.lastScanStatus !== "Completed"
                    ? ` (${r.lastScanStatus ? r.lastScanStatus.toLowerCase() : "not scanned"})`
                    : ""}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={() => loadReport(repoId)} disabled={!repoId || loading}>
            <RefreshCw size={15} className={loading ? "animate-spin" : undefined} /> Refresh
          </Button>
        </div>
      </Card>

      {repos?.length === 0 && (
        <Card>
          <EmptyState icon={<FileBadge2 size={22} />} title="Nothing to report on yet">
            Add a repository on the Repositories page. Its CBOM is ready as soon as the first scan finishes.
          </EmptyState>
        </Card>
      )}

      {error && !loading && <Notice tone="moderate">{error}</Notice>}

      {loading && !report && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      )}

      {report && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <FileText size={15} />
            <span className="font-medium text-ink">{report.repositoryFullName}</span>
            <span>·</span>
            <span>CycloneDX {report.cbom.specVersion}</span>
            <span>·</span>
            <span className="font-mono">{report.commitSha}</span>
            <span>·</span>
            <span>Scanned {new Date(report.completedAt).toLocaleString()}</span>
          </div>

          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard
              title="Components"
              value={components.length}
              subtitle="Cryptographic items in this CBOM"
              term="asset"
              tone="gold"
            />
            <StatCard
              title="Quantum-safe"
              value={safe}
              subtitle={`of ${algos.length} algorithms`}
              term="quantumSafe"
              tone="safe"
            />
            <StatCard
              title="Quantum-vulnerable"
              value={algos.length - safe}
              subtitle="Need a post-quantum replacement"
              tone="critical"
            />
          </section>

          <Card>
            <CardHeader
              title="Components"
              subtitle="Everything listed in the CBOM, with where it was found"
              action={
                <FilterChips
                  label="Quantum safety"
                  value={filter}
                  onChange={setFilter}
                  allCount={components.length}
                  options={[
                    { value: "vulnerable", label: "Vulnerable", tone: "critical" },
                    { value: "safe", label: "Safe", tone: "safe" },
                  ]}
                />
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2/70 text-left text-[12.5px] text-muted">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Component
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Type
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Primitive
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Key size
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Quantum-safe
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Where
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.slice(0, 200).map((c) => {
                    const ap = c.cryptoProperties.algorithmProperties;
                    return (
                      <tr key={c["bom-ref"]} className="border-b border-line last:border-0">
                        <td className="px-4 py-3 font-mono text-[12.5px] text-ink">{c.name}</td>
                        <td className="px-4 py-3 text-ink-2">{c.cryptoProperties.assetType}</td>
                        <td className="px-4 py-3 font-mono text-[12.5px] text-ink-2">{ap?.primitive ?? "–"}</td>
                        <td className="num px-4 py-3 text-ink-2">{ap?.parameterSetIdentifier ?? "–"}</td>
                        <td className="px-4 py-3">
                          {isAlgo(c) ? (
                            <Badge tone={isSafe(c) ? "safe" : "critical"}>{isSafe(c) ? "Yes" : "No"}</Badge>
                          ) : (
                            <span className="text-muted">–</span>
                          )}
                        </td>
                        <td
                          className="max-w-[320px] truncate px-4 py-3 font-mono text-xs text-muted"
                          title={c.evidence.occurrences[0]?.location}
                        >
                          {c.evidence.occurrences[0]?.location ?? "–"}
                        </td>
                      </tr>
                    );
                  })}
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-[13.5px] text-muted">
                        Nothing in this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {shown.length > 200 && (
              <p className="border-t border-line px-5 py-3 text-[13px] text-muted">
                Showing the first 200 of {shown.length}. The JSON download has all of them.
              </p>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Open vulnerabilities"
              subtitle={`Problems still present in ${report.repositoryFullName}`}
              term="finding"
            />
            {findings.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13.5px] text-muted">
                No open vulnerabilities in this repository.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {findings.map((f) => (
                  <li key={f.id} className="flex items-start gap-3 px-5 py-3.5">
                    <SeverityPill severity={f.severity} className="mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium text-ink">{f.title}</p>
                      <p className="text-xs text-muted">
                        <span className="font-mono">{f.code}</span> · {f.affectedComponent}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
