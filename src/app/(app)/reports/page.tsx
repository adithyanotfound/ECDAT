import type { Metadata } from "next";
import { FileText, Download } from "lucide-react";

export const metadata: Metadata = { title: "Reports — ECDAT Atlas" };

export default function ReportsPage() {
  const reports = [
    {
      id: "r-001",
      name: "Q3 2025 Cryptographic Posture Report",
      date: "Sep 1, 2025",
      repos: 9,
      findings: 23,
      status: "Ready",
    },
    {
      id: "r-002",
      name: "August 2025 PQC Readiness Assessment",
      date: "Aug 31, 2025",
      repos: 7,
      findings: 18,
      status: "Ready",
    },
    {
      id: "r-003",
      name: "Banking Core — Critical Findings Summary",
      date: "Aug 15, 2025",
      repos: 1,
      findings: 6,
      status: "Ready",
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
          Reports
        </h1>
        <button
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: "var(--color-accent)", color: "#fff" }}
        >
          + Generate Report
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {reports.map((report) => (
          <div
            key={report.id}
            className="flex items-center gap-4 rounded-xl p-4"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div
              className="rounded-lg p-3 flex-shrink-0"
              style={{ backgroundColor: "rgba(47,91,255,0.12)" }}
            >
              <FileText size={20} style={{ color: "var(--color-accent)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium" style={{ color: "var(--color-ink)" }}>{report.name}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-ink-faint)" }}>
                {report.date} · {report.repos} repositories · {report.findings} findings
              </p>
            </div>
            <span
              className="text-xs px-2.5 py-1 rounded-full flex-shrink-0"
              style={{
                backgroundColor: "rgba(63,207,142,0.12)",
                color: "#3FCF8E",
                border: "1px solid rgba(63,207,142,0.4)",
              }}
            >
              {report.status}
            </span>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs flex-shrink-0"
              style={{
                backgroundColor: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-ink-muted)",
              }}
            >
              <Download size={12} /> Download
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
