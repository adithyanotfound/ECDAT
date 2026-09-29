import type { Metadata } from "next";
import { dashboardAggregates as fixtureDashboard } from "@/fixtures/dashboard";
import { StatCard } from "@/components/ui/StatCard";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { RecommendationsTable } from "@/components/dashboard/RecommendationsTable";
import { getDashboardAggregates } from "@/server/db/dashboard";
import type { DashboardAggregates } from "@/fixtures/types";

export const metadata: Metadata = {
  title: "Dashboard — ECDAT Atlas",
  description: "Overview of your cryptographic posture, quantum readiness, and vulnerabilities.",
};

async function getData(): Promise<DashboardAggregates> {
  try { return await getDashboardAggregates(); }
  catch { return fixtureDashboard; }
}

export default async function DashboardPage() {
  const d = await getData();

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--color-ink)" }}>
          Dashboard
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
          Cryptographic health overview across all connected repositories
        </p>
      </div>

      {/* KPI tiles */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <StatCard
          title="Quantum Readiness"
          value={`${d.quantumReadinessScore}/10`}
          subtitle="PQC posture score"
          accentColor="var(--color-stat-teal)"
          tooltip="Measures how ready your cryptography is against quantum threats. 10/10 = fully quantum-safe."
        />

        <StatCard
          title="Crypto Assets"
          value={d.cryptographicAssetsCount}
          subtitle="Keys, certs & algorithms found"
          accentColor="var(--color-stat-teal)"
          tooltip="Total cryptographic objects discovered across all scanned repositories."
        />

        <StatCard
          title="Repos Scanned"
          value={d.repositoriesScanned}
          subtitle="Repositories analysed"
          accentColor="var(--color-stat-teal)"
          tooltip="Number of code repositories that have been scanned at least once."
        />

        <StatCard
          title="Vulnerable Assets"
          value={`${d.vulnerableAssetsPercent}%`}
          subtitle="Assets with open findings"
          accentColor="var(--color-stat-amber)"
          tooltip="Percentage of crypto assets that have at least one known security issue."
        />

        <StatCard
          title="High Risk Assets"
          value={d.highRiskAssets}
          subtitle="CRSF score ≥ 70"
          accentColor="var(--color-stat-orange)"
          tooltip="Assets with a Crypto Risk Severity Factor ≥ 70 — needs immediate attention."
        />
      </div>

      {/* Charts */}
      <DashboardCharts
        vulnerabilitiesBySource={d.vulnerabilitiesBySource}
        cryptographicPosture={d.cryptographicPosture}
        assetsByType={d.assetsByType}
        symmetricKeyDistribution={d.symmetricKeyDistribution}
        asymmetricKeyDistribution={d.asymmetricKeyDistribution}
      />

      {/* Recommendations */}
      <RecommendationsTable />
    </div>
  );
}
