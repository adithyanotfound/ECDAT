/**
 * Dashboard: the outer layer of the onion.
 *   1. One verdict: how ready are we for quantum computers, in a sentence.
 *   2. Four headline numbers, each linking to the records behind it.
 *   3. Where the risk sits (charts), then what to fix first.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileKey2, FolderGit2, ShieldAlert, TriangleAlert } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader, SectionTitle } from "@/components/ui/Card";
import { InfoHint } from "@/components/ui/InfoHint";
import { buttonClass } from "@/components/ui/Button";
import { ReadinessGauge } from "@/components/charts/ReadinessGauge";
import { PostureCard, RankedBarsCard, SourceCard, assetRows, keyRows } from "@/components/dashboard/DashboardCharts";
import { RecommendationsTable } from "@/components/dashboard/RecommendationsTable";
import { GettingStarted } from "@/components/repos/GettingStarted";
import { LatticeField } from "@/components/effects/LatticeField";
import { getDashboardAggregates } from "@/server/db/dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Overview of your cryptographic posture, quantum readiness, and vulnerabilities.",
};

// Every number here comes from the database. If it can't be reached, the
// error boundary (dashboard/error.tsx) says so; there is no sample-data fallback.
export const dynamic = "force-dynamic";

function verdict(score: number | null) {
  if (score === null)
    return {
      headline: "Not scored yet.",
      body: "The score comes from the algorithms, keys and certificates found in your scans. None have been found yet, so there's nothing to average. Scan a repository to get your first score.",
    };
  if (score >= 8)
    return {
      headline: "Mostly ready for quantum computers.",
      body: "Most of your cryptography already uses quantum-safe methods. Keep new code on the same path.",
    };
  if (score >= 5)
    return {
      headline: "Partly ready. There's work to plan.",
      body: "A good share of your cryptography would need replacing before a quantum computer arrives. Start with the quick wins below.",
    };
  return {
    headline: "Not ready yet. Most of it will need replacing.",
    body: "Most of the cryptography we found could be broken by a large quantum computer. The list below shows where to start.",
  };
}

export default async function DashboardPage() {
  const d = await getDashboardAggregates();
  const nothingYet = d.repositoriesScanned === 0 && d.cryptographicAssetsCount === 0;
  const v = verdict(d.quantumReadinessScore);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="How exposed your cryptography is to quantum computers, and what to change first."
        actions={
          <Link href="/scanning/repositories" className={buttonClass("secondary")}>
            <FolderGit2 size={16} /> Repositories
          </Link>
        }
      />

      {nothingYet ? (
        <GettingStarted />
      ) : (
        <>
          {/* Layer 1: the verdict */}
          <section className="relative overflow-hidden rounded-3xl bg-charcoal text-white shadow-pop">
            <LatticeField
              tone="dark"
              spacing={50}
              packets={4}
              className="[mask-image:linear-gradient(to_right,transparent_25%,black_75%)]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-32 -right-24 size-[420px] rounded-full bg-[radial-gradient(closest-side,rgb(217_174_74/0.28),transparent)]"
            />
            <div className="relative grid items-center gap-8 p-6 sm:p-8 lg:grid-cols-[auto_1fr] lg:gap-12 lg:p-10">
              <div className="flex flex-col items-center">
                <ReadinessGauge score={d.quantumReadinessScore} onDark />
                <p className="mt-1 flex items-center gap-1.5 text-[13px] text-on-dark-muted">
                  Quantum readiness <InfoHint label="Quantum readiness" term="quantumReadiness" onDark />
                </p>
                <p className="num mt-1 text-xs text-white/45">
                  {d.quantumReadinessBasis > 0
                    ? `Average of ${d.quantumReadinessBasis} ${d.quantumReadinessBasis === 1 ? "algorithm, key or certificate" : "algorithms, keys and certificates"}`
                    : "Nothing scored yet"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-gold-bright uppercase">The short answer</p>
                <h2 className="mt-2 text-[26px] leading-tight font-semibold tracking-tight sm:text-3xl">
                  {v.headline}
                </h2>
                <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-on-dark-muted">{v.body}</p>
                <ul className="mt-6 flex flex-wrap gap-2.5 text-[13.5px]">
                  <li className="rounded-full bg-white/[0.07] px-3.5 py-1.5">
                    <b className="num text-white">{d.highRiskAssets}</b> high-risk assets
                  </li>
                  <li className="rounded-full bg-white/[0.07] px-3.5 py-1.5">
                    <b className="num text-white">{d.vulnerableAssetsPercent}%</b> of assets need a look
                  </li>
                  <li className="rounded-full bg-white/[0.07] px-3.5 py-1.5">
                    <b className="num text-white">{d.repositoriesScanned}</b> repositories scanned
                  </li>
                </ul>
                <div className="mt-7 flex flex-wrap gap-2.5">
                  <Link href="/assets/recommendations" className={buttonClass("gold")}>
                    See what to fix first <ArrowRight size={16} />
                  </Link>
                  <Link
                    href="/assets/pqc?risk=high"
                    className={buttonClass("ghost", "md", "text-on-dark-muted hover:bg-white/10 hover:text-white")}
                  >
                    Review high-risk assets
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Layer 2: the headline numbers, each a door to the detail */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Crypto assets found"
              value={d.cryptographicAssetsCount}
              subtitle="Algorithms, keys, certificates and libraries"
              term="asset"
              tone="gold"
              icon={<FileKey2 size={16} />}
              href="/assets/pqc"
            />
            <StatCard
              title="High-risk assets"
              value={d.highRiskAssets}
              subtitle="Risk score of 70 or more: fix these first"
              term="highRisk"
              tone="critical"
              icon={<ShieldAlert size={16} />}
              href="/assets/pqc?risk=high"
            />
            <StatCard
              title="Assets needing a look"
              value={`${d.vulnerableAssetsPercent}%`}
              subtitle="Have at least one reason to review"
              term="vulnerable"
              tone="moderate"
              icon={<TriangleAlert size={16} />}
              href="/assets/vulnerabilities"
            />
            <StatCard
              title="Repositories scanned"
              value={d.repositoriesScanned}
              subtitle="Scanned at least once"
              term="scan"
              tone="safe"
              icon={<FolderGit2 size={16} />}
              href="/scanning/repositories"
            />
          </section>

          {/* Layer 3: where the risk sits */}
          <section className="flex flex-col gap-4">
            <SectionTitle title="Where the risk sits" description="Hover a bar for its exact numbers." />
            <div className="grid gap-4 xl:grid-cols-2">
              <PostureCard data={d.cryptographicPosture} />
              <SourceCard data={d.vulnerabilitiesBySource} />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <RankedBarsCard
                title="What kinds of assets"
                subtitle="Count of each kind we found"
                rows={assetRows(d.assetsByType)}
                empty="No assets found yet."
              />
              <RankedBarsCard
                title="Keys in use"
                subtitle="Share of each key type"
                rows={keyRows(d.symmetricKeyDistribution)}
                suffix="%"
                empty="No keys found yet."
                tone="low"
              />
              <RankedBarsCard
                title="Signing and key exchange"
                subtitle="Public-key algorithms, most at quantum risk"
                rows={keyRows(d.asymmetricKeyDistribution)}
                suffix="%"
                empty="No public-key algorithms found yet."
                tone="high"
              />
            </div>
          </section>

          {/* Layer 4: what to do */}
          <RecommendationsTable />
        </>
      )}
    </div>
  );
}
