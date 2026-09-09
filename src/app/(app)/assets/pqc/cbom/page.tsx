"use client";

import { useState, useEffect, useCallback } from "react";
import { SeverityPill } from "@/components/ui/Pill";
import { Download, Printer } from "lucide-react";
import type { Repository, Finding } from "@/fixtures/types";

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
  color: "var(--color-ink)",
  borderBottom: "1px solid var(--color-border)",
  verticalAlign: "middle",
};

const pqcColor = (safe: boolean) =>
  safe
    ? { color: "#3FCF8E", bg: "rgba(63,207,142,0.12)", border: "rgba(63,207,142,0.4)" }
    : { color: "#F0516B", bg: "rgba(240,81,107,0.12)", border: "rgba(240,81,107,0.4)" };

export default function CbomReportPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [report, setReport] = useState<CbomResponse | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/repositories")
      .then((r) => r.json())
      .then((data: Repository[]) => {
        setRepos(data ?? []);
        const scanned = data?.find((r) => r.lastScanStatus === "Completed");
        setSelectedRepoId(scanned?.id ?? data?.[0]?.id ?? "");
      });
  }, []);

  const loadReport = useCallback(async (repositoryId: string) => {
    if (!repositoryId) return;
    setLoading(true);
    setError(null);
    try {
      const [cbomRes, findingsRes] = await Promise.all([
        fetch(`/api/repositories/${repositoryId}/cbom`),
        fetch(`/api/findings?repositoryId=${repositoryId}&pageSize=6`),
      ]);
      if (!cbomRes.ok) {
        setReport(null);
        setError((await cbomRes.json().catch(() => null))?.error ?? "No CBOM available yet — run a scan first.");
      } else {
        setReport(await cbomRes.json());
      }
      const findingsData = await findingsRes.json().catch(() => null);
      setFindings(findingsData?.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRepoId) loadReport(selectedRepoId);
  }, [selectedRepoId, loadReport]);

  const components = report?.cbom.components ?? [];
  const algoComponents = components.filter((c) => c.cryptoProperties.algorithmProperties);
  const strongAlgos = algoComponents.filter((c) => (c.cryptoProperties.algorithmProperties?.nistQuantumSecurityLevel ?? 0) > 0);
  const weakAlgos = algoComponents.filter((c) => (c.cryptoProperties.algorithmProperties?.nistQuantumSecurityLevel ?? 0) === 0);

  const generatePDF = () => {
    if (!report) return;
    import("jspdf").then(({ default: jsPDF }) => {
      import("jspdf-autotable").then(({ default: autoTable }) => {
        const doc = new jsPDF("p", "pt", "a4");
        
        // Header
        doc.setFontSize(18);
        doc.text(`CBOM Report: ${report.repositoryFullName}`, 40, 40);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Commit: ${report.commitSha} | Scan: ${new Date(report.completedAt).toLocaleString()}`, 40, 55);

        // Component Table
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Component Details", 40, 80);
        autoTable(doc, {
          startY: 90,
          head: [["Name", "Type", "Version", "Cryptographic Assets"]],
          body: [[
            report.cbom.metadata.component.name || "", 
            "Application", 
            report.cbom.metadata.component.version || "", 
            components.length.toString()
          ]],
          theme: "grid",
        });

        // Assets Table
        doc.setFontSize(14);
        doc.text("Cryptographic Assets", 40, (doc as any).lastAutoTable.finalY + 30);
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 40,
          head: [["Component", "Type", "Primitive", "Key Length", "PQC Safe?", "Reference"]],
          body: components.map(c => {
            const ap = c.cryptoProperties.algorithmProperties;
            const safe = (ap?.nistQuantumSecurityLevel ?? 0) > 0;
            return [
              c.name,
              c.cryptoProperties.assetType,
              ap?.primitive ?? "—",
              ap?.parameterSetIdentifier ?? "—",
              safe ? "Yes" : "No",
              c.evidence.occurrences[0]?.location ?? "N/A"
            ];
          }),
          theme: "grid",
          styles: { fontSize: 9 },
          headStyles: { fillColor: [47, 91, 255] }
        });

        // Vulnerabilities
        doc.setFontSize(14);
        doc.text("Vulnerabilities", 40, (doc as any).lastAutoTable.finalY + 30);
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 40,
          head: [["ID", "Severity", "Title", "Affected Component"]],
          body: findings.map(f => [
            f.code,
            f.severity,
            f.title,
            f.affectedComponent
          ]),
          theme: "grid",
          styles: { fontSize: 9 },
          headStyles: { fillColor: [47, 91, 255] }
        });

        doc.save(`${report.repositoryFullName.replace(/\\//g, "-")}-cbom.pdf`);
      });
    });
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <style>{`
        @media print {
          .no-print, aside, header { display: none !important; }
          body, main, .flex-1, .app-container {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: none !important;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { margin: 1.5cm; }
          .rounded-xl, .rounded-t-xl, .rounded-b-xl { border-radius: 4px !important; }
          table, th, td { border-color: #ddd !important; }
        }
      `}</style>

      {/* Title & selector row */}
      <div className="no-print">
        <h1 className="text-2xl font-bold mb-4" style={{ color: "var(--color-ink)" }}>
          CBOM Report
        </h1>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-ink-muted)" }}>
              Select Repository*
            </label>
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-ink)",
                minWidth: "260px",
              }}
            >
              {repos.length === 0 && <option>No repositories connected</option>}
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName} {r.lastScanStatus !== "Completed" ? `(${r.lastScanStatus ?? "not scanned"})` : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => loadReport(selectedRepoId)}
            className="px-5 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "var(--color-accent)", color: "#fff" }}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-ink-muted)" }}>
          {error}
        </div>
      )}

      {report && (
        <>
          {/* Report header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--color-ink)" }}>
                {report.repositoryFullName} — CBOM (CycloneDX {report.cbom.specVersion})
              </h2>
              <p className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
                Commit {report.commitSha} · Last Scan: {new Date(report.completedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-3 no-print">
              <button
                onClick={generatePDF}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-ink-muted)" }}
              >
                <Printer size={13} /> Download PDF
              </button>
              <a
                href={`/api/repositories/${selectedRepoId}/cbom?download=1`}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: "var(--color-accent)", color: "#fff" }}
              >
                <Download size={13} /> Download CBOM
              </a>
            </div>
          </div>

          {/* Component */}
          <section>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-ink)" }}>
              Component
            </h3>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
              <table className="w-full">
                <thead>
                  <tr>{["Name", "Type", "Version (commit)", "Cryptographic Assets"].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  <tr style={{ backgroundColor: "var(--color-surface)" }}>
                    <td style={tdStyle}>{report.cbom.metadata.component.name}</td>
                    <td style={tdStyle}>Application</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "12px" }}>{report.cbom.metadata.component.version}</td>
                    <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums" }}>{components.length}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Cryptographic Assets */}
          <section>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-ink)" }}>
              Cryptographic Assets
            </h3>
            <div
              className="rounded-t-xl p-4"
              style={{ backgroundColor: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderBottom: "none" }}
            >
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-ink)" }}>Summary</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs" style={{ color: "var(--color-ink-muted)" }}>
                <p><span style={{ color: "#3FCF8E" }}>• Quantum-safe assets: </span>{strongAlgos.length}</p>
                <p><span style={{ color: "#F0516B" }}>• Quantum-vulnerable assets: </span>{weakAlgos.length}</p>
              </div>
            </div>
            <div className="rounded-b-xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
              <table className="w-full" style={{ backgroundColor: "var(--color-surface)" }}>
                <thead>
                  <tr>{["Component", "Type", "Primitive", "Key Length", "PQC Safe?", "Reference"].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {components.slice(0, 60).map((c) => {
                    const ap = c.cryptoProperties.algorithmProperties;
                    const safe = (ap?.nistQuantumSecurityLevel ?? 0) > 0;
                    const pqs = pqcColor(safe);
                    return (
                      <tr key={c["bom-ref"]}>
                        <td style={{ ...tdStyle, fontSize: "12px", fontFamily: "monospace" }}>{c.name}</td>
                        <td style={tdStyle}>{c.cryptoProperties.assetType}</td>
                        <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "12px" }}>{ap?.primitive ?? "—"}</td>
                        <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums" }}>{ap?.parameterSetIdentifier ?? "—"}</td>
                        <td style={tdStyle}>
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ color: pqs.color, backgroundColor: pqs.bg, border: `1px solid ${pqs.border}` }}>
                            {safe ? "Yes" : "No"}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontSize: "12px", fontFamily: "monospace", color: "var(--color-ink-faint)" }}>
                          {c.evidence.occurrences[0]?.location ?? "N/A"}
                        </td>
                      </tr>
                    );
                  })}
                  {components.length === 0 && (
                    <tr><td style={tdStyle} colSpan={6}>No cryptographic assets recorded for this repository yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Vulnerabilities */}
          <section>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-ink)" }}>
              Vulnerabilities
            </h3>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
              <table className="w-full" style={{ backgroundColor: "var(--color-surface)" }}>
                <thead>
                  <tr>{["ID", "Severity", "Title", "Detail", "Affected Component"].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {findings.map((f) => (
                    <tr key={f.id}>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "12px" }}>{f.code}</td>
                      <td style={tdStyle}><SeverityPill severity={f.severity} /></td>
                      <td style={tdStyle}>{f.title}</td>
                      <td style={{ ...tdStyle, maxWidth: "280px", fontSize: "12px", color: "var(--color-ink-muted)" }}>{f.detail}</td>
                      <td style={tdStyle}>{f.affectedComponent}</td>
                    </tr>
                  ))}
                  {findings.length === 0 && (
                    <tr><td style={tdStyle} colSpan={5}>No open findings for this repository.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
