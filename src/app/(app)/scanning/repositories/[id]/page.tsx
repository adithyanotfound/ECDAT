import { prisma } from "@/server/db/client";
import { notFound } from "next/navigation";
import { StatusPill } from "@/components/ui/Pill";
import { GitBranch, Shield, AlertTriangle, Play, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { formatRelativeTime, truncateHash } from "@/lib/format";

export default async function RepositoryDetailsPage({ params }: { params: { id: string } }) {
  const repo = await prisma.repository.findUnique({
    where: { id: params.id },
    include: {
      scans: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      _count: {
        select: {
          cryptoAssets: true,
          findings: true,
        }
      }
    }
  });

  if (!repo) return notFound();

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-5xl mx-auto w-full">
      <div className="flex items-center gap-4">
        <Link 
          href="/scanning/repositories" 
          className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          style={{ color: "var(--color-ink-muted)" }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--color-ink)" }}>
            <GitBranch size={22} style={{ color: "var(--color-ink-muted)" }} />
            {repo.name}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-ink-muted)" }}>
            {repo.fullName} · {repo.defaultBranch}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl p-5" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: "var(--color-ink-muted)" }}>
            <Shield size={16} />
            <h3 className="text-sm font-medium">Cryptographic Assets</h3>
          </div>
          <p className="text-3xl font-bold mb-4" style={{ color: "var(--color-ink)" }}>
            {repo._count.cryptoAssets}
          </p>
          <Link
            href={`/assets/pqc?repositoryId=${repo.id}`}
            className="text-sm font-medium hover:underline"
            style={{ color: "var(--color-accent)" }}
          >
            View Inventory →
          </Link>
        </div>

        <div className="rounded-xl p-5" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: "var(--color-ink-muted)" }}>
            <AlertTriangle size={16} />
            <h3 className="text-sm font-medium">Vulnerabilities</h3>
          </div>
          <p className="text-3xl font-bold mb-4" style={{ color: "var(--color-ink)" }}>
            {repo._count.findings}
          </p>
          <Link
            href={`/assets/vulnerabilities?repositoryId=${repo.id}`}
            className="text-sm font-medium hover:underline"
            style={{ color: "var(--color-accent)" }}
          >
            View Findings →
          </Link>
        </div>

        <div className="rounded-xl p-5 flex flex-col justify-center items-center text-center gap-3" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <h3 className="text-sm font-medium" style={{ color: "var(--color-ink-muted)" }}>Ready for another scan?</h3>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "var(--color-accent)", color: "#fff" }}
            onClick={() => alert("Scan triggered!")}
          >
            <Play size={14} fill="currentColor" /> Scan Now
          </button>
        </div>
      </div>

      <div className="mt-4">
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--color-ink)" }}>Scan History</h2>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)" }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-thead)" }}>
                <th className="text-left py-3 px-4 text-xs font-semibold" style={{ color: "var(--color-ink-muted)" }}>Scan ID</th>
                <th className="text-left py-3 px-4 text-xs font-semibold" style={{ color: "var(--color-ink-muted)" }}>Commit</th>
                <th className="text-left py-3 px-4 text-xs font-semibold" style={{ color: "var(--color-ink-muted)" }}>Status</th>
                <th className="text-right py-3 px-4 text-xs font-semibold" style={{ color: "var(--color-ink-muted)" }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {repo.scans.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm" style={{ color: "var(--color-ink-muted)" }}>
                    No scans have been run on this repository yet.
                  </td>
                </tr>
              ) : (
                repo.scans.map(scan => (
                  <tr key={scan.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td className="py-3 px-4 text-sm font-mono" style={{ color: "var(--color-ink)" }}>
                      {scan.id.slice(-8)}
                    </td>
                    <td className="py-3 px-4 text-sm font-mono" style={{ color: "var(--color-ink-faint)" }}>
                      {truncateHash(scan.commitSha)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusPill status={scan.status} />
                    </td>
                    <td className="py-3 px-4 text-sm text-right" style={{ color: "var(--color-ink-muted)" }}>
                      {formatRelativeTime(scan.createdAt.toISOString())}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
