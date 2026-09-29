"use client";

import dynamic from "next/dynamic";
import type { VulnBySource, PostureBreakdown, AssetByType } from "@/fixtures/types";

const StackedBar = dynamic(
  () => import("@/components/charts/StackedBar").then((m) => m.StackedBar),
  { ssr: false, loading: () => <Skeleton h={240} /> }
);
const PostureDonut = dynamic(
  () => import("@/components/charts/PostureDonut").then((m) => m.PostureDonut),
  { ssr: false, loading: () => <Skeleton h={200} /> }
);
const TypeBars = dynamic(
  () => import("@/components/charts/TypeBars").then((m) => m.TypeBars),
  { ssr: false, loading: () => <Skeleton h={220} /> }
);
const KeyDistributionDonut = dynamic(
  () => import("@/components/charts/KeyDistributionDonut").then((m) => m.KeyDistributionDonut),
  { ssr: false, loading: () => <Skeleton h={150} /> }
);

function Skeleton({ h }: { h: number }) {
  return (
    <div
      className="rounded-lg"
      style={{ height: h, backgroundColor: "var(--color-surface-2)", animation: "pulse 2s infinite" }}
    />
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="mb-4">
        <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>{title}</p>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: "var(--color-ink-faint)" }}>{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-muted)" }}>
      {title}
    </h2>
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
    <div className="flex flex-col gap-6">
      {/* Vulnerabilities section */}
      <div className="flex flex-col gap-3">
        <SectionHeader title="Vulnerabilities" />
        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Card
            title="Issues by Source"
            subtitle="Where security weaknesses were found in your code"
          >
            <StackedBar data={vulnerabilitiesBySource} />
          </Card>
          <Card
            title="Security Posture"
            subtitle="Risk distribution of all cryptographic assets"
          >
            <PostureDonut data={cryptographicPosture} />
          </Card>
        </div>
      </div>

      {/* Crypto assets section */}
      <div className="flex flex-col gap-3">
        <SectionHeader title="Cryptographic Assets" />
        <Card
          title="Asset Types"
          subtitle="Kinds of cryptographic objects discovered"
        >
          <TypeBars data={assetsByType} />
        </Card>
        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Card
            title="Symmetric Keys"
            subtitle="Secret key algorithms used for data encryption"
          >
            <KeyDistributionDonut data={symmetricKeyDistribution} />
          </Card>
          <Card
            title="Asymmetric Keys"
            subtitle="Public/private key pairs for signing and key exchange"
          >
            <KeyDistributionDonut data={asymmetricKeyDistribution} />
          </Card>
        </div>
      </div>
    </div>
  );
}
