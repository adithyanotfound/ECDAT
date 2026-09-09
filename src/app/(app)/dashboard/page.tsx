import type { Metadata } from "next";
import { dashboardAggregates as fixtureDashboard } from "@/fixtures/dashboard";
import { StatCard } from "@/components/ui/StatCard";
import { ReadinessGauge } from "@/components/charts/ReadinessGauge";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { RecommendationsTable } from "@/components/dashboard/RecommendationsTable";
import { getDashboardAggregates } from "@/server/db/dashboard";
import type { DashboardAggregates } from "@/fixtures/types";

export const metadata: Metadata = {
  title: "Dashboard — ECDAT Atlas",
  description:
    "Overview of your cryptographic posture, quantum readiness, and vulnerabilities.",
};

async function getData(): Promise<DashboardAggregates> {
  try {
    return await getDashboardAggregates();
  } catch {
    // Fallback to fixtures when DB is not yet connected
    return fixtureDashboard;
  }
}

export default async function DashboardPage() {
  const d = await getData();

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
          Dashboard
        </h1>
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium" style={{ color: "var(--color-ink-muted)" }}>
            Last scan: {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <StatCard
          title="Quantum Readiness Score"
          value={d.quantumReadinessScore}
          subtitle="Organisation-wide PQC posture"
          accentColor="var(--color-stat-teal)"
        >
          <div className="flex items-center">
            <ReadinessGauge score={d.quantumReadinessScore} size={90} />
          </div>
        </StatCard>

        <StatCard
          title="Cryptographic Assets"
          value={d.cryptographicAssetsCount}
          subtitle="Discovered artefacts across all repos"
          accentColor="var(--color-stat-teal)"
        />

        <StatCard
          title="Discovered Services"
          value={d.repositoriesScanned}
          subtitle="Repositories scanned"
          accentColor="var(--color-stat-teal)"
        />

        <StatCard
          title="Vulnerable Assets"
          value={`${d.vulnerableAssetsPercent}%`}
          subtitle="Assets with open findings"
          accentColor="var(--color-stat-amber)"
        />

        <StatCard
          title="High Risk Assets"
          value={d.highRiskAssets}
          subtitle="CRSF score ≥ 70"
          accentColor="var(--color-stat-orange)"
        />
      </div>

      {/* Charts (client — Recharts) */}
      <DashboardCharts
        vulnerabilitiesBySource={d.vulnerabilitiesBySource}
        cryptographicPosture={d.cryptographicPosture}
        assetsByType={d.assetsByType}
        symmetricKeyDistribution={d.symmetricKeyDistribution}
        asymmetricKeyDistribution={d.asymmetricKeyDistribution}
      />

      {/* Recommendations Table */}
      <RecommendationsTable />
    </div>
  );
}
