import type { Metadata } from "next";
import { getScanProfiles } from "@/server/db/scanning";
import { scanProfiles as fixtureProfiles } from "@/fixtures/scans";
import type { ScanProfile } from "@/fixtures/types";
import { formatDate } from "@/lib/format";
import { Shield, Star } from "lucide-react";

export const metadata: Metadata = { title: "Scan Profiles — ECDAT Atlas" };

async function getData(): Promise<ScanProfile[]> {
  try {
    return await getScanProfiles();
  } catch {
    return fixtureProfiles;
  }
}

export default async function ProfilesPage() {
  const profiles = await getData();

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
          Scan Profiles
        </h1>
        <button
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: "var(--color-accent)", color: "#fff" }}
        >
          + New Profile
        </button>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className="rounded-xl p-5 flex flex-col gap-4"
            style={{
              backgroundColor: "var(--color-surface)",
              border: `1px solid ${profile.isDefault ? "var(--color-accent)" : "var(--color-border)"}`,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Shield size={16} style={{ color: "var(--color-accent)" }} />
                <span className="font-semibold" style={{ color: "var(--color-ink)" }}>
                  {profile.name}
                </span>
                {profile.isDefault && (
                  <Star size={12} style={{ color: "var(--color-stat-amber)" }} fill="var(--color-stat-amber)" />
                )}
              </div>
              <span className="text-xs flex-shrink-0" style={{ color: "var(--color-ink-faint)" }}>
                Created {formatDate(profile.createdAt)}
              </span>
            </div>

            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: "var(--color-ink-muted)" }}>
                Rule Packs
              </p>
              <div className="flex flex-wrap gap-1.5">
                {profile.rulePackIds.map((pack) => (
                  <span
                    key={pack}
                    className="px-2 py-0.5 rounded-full text-xs"
                    style={{
                      backgroundColor: "rgba(47,91,255,0.12)",
                      color: "var(--color-accent)",
                      border: "1px solid rgba(47,91,255,0.3)",
                    }}
                  >
                    {pack}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="mb-1" style={{ color: "var(--color-ink-muted)" }}>Max File Size</p>
                <p className="font-medium" style={{ color: "var(--color-ink)" }}>
                  {profile.maxFileSizeKb >= 1024
                    ? `${profile.maxFileSizeKb / 1024} MB`
                    : `${profile.maxFileSizeKb} KB`}
                </p>
              </div>
              <div>
                <p className="mb-1" style={{ color: "var(--color-ink-muted)" }}>Exclude Patterns</p>
                <p className="font-medium" style={{ color: "var(--color-ink)" }}>
                  {profile.excludeGlobs.length} patterns
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs mb-1" style={{ color: "var(--color-ink-muted)" }}>Include Globs</p>
              <div className="flex flex-wrap gap-2">
                {profile.includeGlobs.slice(0, 3).map((g) => (
                  <span key={g} className="text-xs font-mono" style={{ color: "var(--color-ink-faint)" }}>
                    {g}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
