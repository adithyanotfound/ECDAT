import type { ReportRow } from "@/server/db/reports";

/** Fallback fixture for when the database is not yet connected — mirrors the fixtures/dashboard.ts convention. */
export const reportRows: ReportRow[] = [
  {
    scanId: "fixture-scan-1",
    repositoryId: "fixture-repo-1",
    repositoryFullName: "acme/payments-api",
    scanDate: new Date().toISOString(),
    scanStatus: "Completed",
    cbomReady: true,
    findingCount: 6,
    status: "Ready",
  },
];
