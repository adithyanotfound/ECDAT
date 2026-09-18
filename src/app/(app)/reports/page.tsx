import type { Metadata } from "next";
import { FileText, Download } from "lucide-react";
import { getReportsPage } from "@/server/db/reports";
import { reportRows as fixtureReports } from "@/fixtures/reports";
import type { ReportRow } from "@/server/db/reports";
import { formatDate } from "@/lib/format";
import { GenerateReportButton } from "@/components/reports/GenerateReportButton";

export const metadata: Metadata = { title: "Reports — ECDAT Atlas" };

async function getData(): Promise<ReportRow[]> {
  try {
    const { items } = await getReportsPage({ pageSize: 25 });
    return items;
  } catch {
    // Fallback to fixtures when DB is not yet connected
    return fixtureReports;
  }
}

export default async function ReportsPage() {
  const reports = await getData();

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
          Reports
        </h1>
        <GenerateReportButton />
      </div>

      <div className="flex flex-col gap-3">
        {reports.map((report) => (
          <div
            key={report.scanId}
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
              <p className="font-medium" style={{ color: "var(--color-ink)" }}>{report.repositoryFullName}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-ink-faint)" }}>
                {formatDate(report.scanDate, "MMM d, yyyy")} · {report.findingCount} findings
              </p>
            </div>
            <span
              className="text-xs px-2.5 py-1 rounded-full flex-shrink-0"
              style={
                report.status === "Ready"
                  ? { backgroundColor: "rgba(63,207,142,0.12)", color: "#3FCF8E", border: "1px solid rgba(63,207,142,0.4)" }
                  : { backgroundColor: "rgba(242,193,78,0.12)", color: "#F2C14E", border: "1px solid rgba(242,193,78,0.4)" }
              }
            >
              {report.status}
            </span>
            {report.cbomReady ? (
              <a
                href={`/api/scans/${report.scanId}/cbom`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs flex-shrink-0"
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-ink-muted)",
                  textDecoration: "none",
                }}
              >
                <Download size={12} /> Download CBOM
              </a>
            ) : (
              <span
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs flex-shrink-0"
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-ink-faint)",
                }}
              >
                <Download size={12} /> Pending
              </span>
            )}
          </div>
        ))}

        {reports.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-3">
            <FileText size={36} style={{ color: "var(--color-ink-faint)" }} />
            <p style={{ color: "var(--color-ink-muted)" }}>
              No reports yet. Generate one from a connected repository above.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
