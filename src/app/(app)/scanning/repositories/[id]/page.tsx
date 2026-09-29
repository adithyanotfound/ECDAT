/**
 * One repository, peeled a layer deeper than the list: what was found in it,
 * its most serious problems, and every scan it has had.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Cloud, FileKey2, GitBranch, Lightbulb, ShieldAlert } from "lucide-react";
import { prisma } from "@/server/db/client";
import { requireSession } from "@/server/auth/session";
import { Card, CardHeader, PageHeader } from "@/components/ui/Card";
import { Badge, SeverityPill } from "@/components/ui/Pill";
import { StatCard } from "@/components/ui/StatCard";
import { InfoHint } from "@/components/ui/InfoHint";
import { ScanHistory, ScanNowButton } from "@/components/repos/RepoActions";
import type { SeverityLabel, Tone } from "@/lib/tones";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Repository" };

const SEVERITY_LABEL: Record<string, SeverityLabel> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MODERATE: "Moderate",
  LOW: "Low",
  COMPLIANT: "Compliant",
};

const CRITICALITY: Record<string, { label: string; tone: Tone }> = {
  CRITICAL: { label: "Critical", tone: "critical" },
  HIGH: { label: "High", tone: "high" },
  MEDIUM: { label: "Medium", tone: "moderate" },
  LOW: { label: "Low", tone: "safe" },
};

export default async function RepositoryDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  // Only the owner's repositories exist as far as this page is concerned.
  const repo = await prisma.repository.findFirst({
    where: { id, owner: session.login },
    include: {
      scans: { orderBy: { createdAt: "desc" }, take: 10 },
      _count: { select: { cryptoAssets: true, recommendations: true } },
    },
  });
  if (!repo) notFound();

  const [openFindings, highRisk, topFindings] = await Promise.all([
    prisma.finding.count({ where: { repositoryId: id, status: "OPEN" } }),
    prisma.riskAssessment.count({ where: { crsfScore: { gte: 70 }, cryptoAsset: { repositoryId: id } } }),
    prisma.finding.findMany({
      where: { repositoryId: id, status: "OPEN" },
      orderBy: [{ severity: "asc" }, { lastSeenAt: "desc" }],
      take: 5,
      select: { id: true, title: true, severity: true, filePath: true, lineNumber: true, code: true },
    }),
  ]);

  const aws = repo.sourceType === "AWS";
  const crit = CRITICALITY[repo.criticality] ?? CRITICALITY.MEDIUM;
  const q = `repositoryId=${encodeURIComponent(repo.id)}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={
          <Link
            href="/scanning/repositories"
            className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink"
          >
            <ArrowLeft size={15} /> All repositories
          </Link>
        }
        eyebrow={aws ? "AWS account" : "GitHub repository"}
        title={repo.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5">
              {aws ? <Cloud size={15} /> : <GitBranch size={15} />}
              {repo.fullName}
            </span>
            <span className="text-faint">·</span>
            <span>Branch {repo.defaultBranch}</span>
            {repo.language && repo.language !== "AWS" && (
              <>
                <span className="text-faint">·</span>
                <span>{repo.language}</span>
              </>
            )}
            <span className="text-faint">·</span>
            <span>Added {formatDate(repo.createdAt)}</span>
          </span>
        }
        actions={<ScanNowButton repositoryId={repo.id} disabled={!repo.scanEnabled} />}
      />

      <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          Importance <InfoHint label="Importance" term="criticality" />
        </span>
        <Badge tone={crit.tone}>{crit.label}</Badge>
        <span className="ml-3 inline-flex items-center gap-1.5">
          Data must stay secret for <InfoHint label="Data lifetime" term="dataLifetime" />
        </span>
        <Badge tone="gold" dot={false}>
          {repo.dataLifetimeYears} years
        </Badge>
        {!repo.scanEnabled && <Badge tone="neutral">Scanning paused</Badge>}
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Crypto assets"
          value={repo._count.cryptoAssets}
          subtitle="Found in this repository"
          term="asset"
          icon={<FileKey2 size={16} />}
          href={`/assets/pqc?${q}`}
        />
        <StatCard
          title="High-risk assets"
          value={highRisk}
          subtitle="Risk score 70 or more"
          term="highRisk"
          tone="critical"
          icon={<ShieldAlert size={16} />}
          href={`/assets/pqc?${q}&risk=high`}
        />
        <StatCard
          title="Open vulnerabilities"
          value={openFindings}
          subtitle="Problems still to fix"
          term="finding"
          tone="high"
          icon={<AlertTriangle size={16} />}
          href={`/assets/vulnerabilities?${q}`}
        />
        <StatCard
          title="Recommendations"
          value={repo._count.recommendations}
          subtitle="Suggested replacements"
          term="recommendation"
          tone="safe"
          icon={<Lightbulb size={16} />}
          href={`/assets/recommendations?${q}`}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Most serious open problems"
            subtitle="The top five, most severe first"
            term="severity"
            action={
              <Link
                href={`/assets/vulnerabilities?${q}`}
                className="inline-flex items-center gap-1 text-[13px] font-medium text-gold-ink hover:underline"
              >
                All <ArrowRight size={14} />
              </Link>
            }
          />
          {topFindings.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13.5px] text-muted">No open problems in this repository.</p>
          ) : (
            <ul className="divide-y divide-line">
              {topFindings.map((f) => (
                <li key={f.id} className="flex items-start gap-3 px-5 py-3.5">
                  <SeverityPill severity={SEVERITY_LABEL[f.severity] ?? "Low"} className="mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium text-ink">{f.title}</p>
                    {f.filePath && (
                      <p className="truncate font-mono text-xs text-muted">
                        {f.filePath}
                        {f.lineNumber ? `:${f.lineNumber}` : ""}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Scan history"
            subtitle="The last ten scans. Open one to read its log and what changed."
            term="scan"
          />
          <ScanHistory
            scans={repo.scans.map((s) => ({
              id: s.id,
              status: s.status,
              trigger: s.trigger,
              commitSha: s.commitSha,
              createdAt: s.createdAt.toISOString(),
              durationMs: s.durationMs,
              filesScanned: s.filesScanned,
            }))}
          />
        </Card>
      </div>
    </div>
  );
}
