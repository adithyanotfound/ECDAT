"use client";

import dynamic from "next/dynamic";
import type {
  VulnBySource,
  PostureBreakdown,
  AssetByType,
} from "@/fixtures/types";

const StackedBar = dynamic(
  () => import("@/components/charts/StackedBar").then((m) => m.StackedBar),
  { ssr: false, loading: () => <ChartSkeleton h={240} /> }
);
const PostureDonut = dynamic(
  () =>
    import("@/components/charts/PostureDonut").then((m) => m.PostureDonut),
  { ssr: false, loading: () => <ChartSkeleton h={200} /> }
);
const TypeBars = dynamic(
  () => import("@/components/charts/TypeBars").then((m) => m.TypeBars),
  { ssr: false, loading: () => <ChartSkeleton h={220} /> }
);
const KeyDistributionDonut = dynamic(
  () =>
    import("@/components/charts/KeyDistributionDonut").then(
      (m) => m.KeyDistributionDonut
    ),
  { ssr: false, loading: () => <ChartSkeleton h={150} /> }
);

function ChartSkeleton({ h }: { h: number }) {
  return (
    <div
      className="rounded-lg animate-pulse"
      style={{ height: h, backgroundColor: "var(--color-surface-2)" }}
    />
  );
}

interface DashboardChartsProps {
  vulnerabilitiesBySource: VulnBySource[];
  cryptographicPosture: PostureBreakdown;
  assetsByType: AssetByType[];
  symmetricKeyDistribution: { name: string; percent: number }[];
  asymmetricKeyDistribution: { name: string; percent: number }[];
}

export function DashboardCharts({
  vulnerabilitiesBySource,
  cryptographicPosture,
  assetsByType,
  symmetricKeyDistribution,
  asymmetricKeyDistribution,
}: DashboardChartsProps) {
  return (
    <>
      {/* Vulnerabilities section */}
      <div>
        <h2
          className="text-lg font-semibold mb-4"
          style={{ color: "var(--color-ink)" }}
        >
          Vulnerabilities
        </h2>
        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div
            className="rounded-xl p-5"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h3
              className="text-sm font-semibold mb-4"
              style={{ color: "var(--color-ink)" }}
            >
              By Source Type
            </h3>
            <StackedBar data={vulnerabilitiesBySource} />
            <p
              className="text-xs mt-3"
              style={{ color: "var(--color-ink-faint)" }}
            >
              Last updated 30 min ago.
            </p>
          </div>
          <div
            className="rounded-xl p-5"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h3
              className="text-sm font-semibold mb-4"
              style={{ color: "var(--color-ink)" }}
            >
              Cryptographic Posture
            </h3>
            <PostureDonut data={cryptographicPosture} />
            <p
              className="text-xs mt-3"
              style={{ color: "var(--color-ink-faint)" }}
            >
              Last updated 30 min ago.
            </p>
          </div>
        </div>
      </div>

      {/* Cryptographic Assets section */}
      <div>
        <h2
          className="text-lg font-semibold mb-4"
          style={{ color: "var(--color-ink)" }}
        >
          Cryptographic Assets
        </h2>
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
        >
          <div
            className="rounded-xl p-5"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h3
              className="text-sm font-semibold mb-4"
              style={{ color: "var(--color-ink)" }}
            >
              Cryptographic Asset By Type
            </h3>
            <TypeBars data={assetsByType} />
          </div>
          <div
            className="rounded-xl p-5"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h3
              className="text-sm font-semibold mb-4"
              style={{ color: "var(--color-ink)" }}
            >
              Symmetric Keys
            </h3>
            <KeyDistributionDonut data={symmetricKeyDistribution} />
          </div>
          <div
            className="rounded-xl p-5"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h3
              className="text-sm font-semibold mb-4"
              style={{ color: "var(--color-ink)" }}
            >
              Asymmetric Keys
            </h3>
            <KeyDistributionDonut data={asymmetricKeyDistribution} />
          </div>
        </div>
      </div>
    </>
  );
}
