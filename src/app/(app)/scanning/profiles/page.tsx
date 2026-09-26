"use client";

import { useState, useEffect, Fragment } from "react";
import { getScanProfiles } from "@/server/db/scanning";
import type { ScanProfile } from "@/fixtures/types";
import { formatDate } from "@/lib/format";
import { Shield, Star, ChevronDown, ChevronUp } from "lucide-react";

// Page metadata handled by parent — this is a client component
// because it manages expand/collapse state.

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--color-ink-muted)",
  backgroundColor: "var(--color-thead)",
  borderBottom: "1px solid var(--color-border)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: "13px",
  borderBottom: "1px solid var(--color-border)",
  verticalAlign: "middle",
};

function ExpandedRow({ profile }: { profile: ScanProfile }) {
  return (
    <tr>
      <td
        colSpan={7}
        style={{
          padding: "0",
          borderBottom: "1px solid var(--color-border)",
          backgroundColor: "var(--color-surface-2)",
        }}
      >
        <div className="px-6 py-4 flex flex-col gap-4">
          {/* Rule packs */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--color-ink-muted)" }}>
              Rule Packs
            </p>
            <div className="flex flex-wrap gap-1.5">
              {profile.rulePackIds.map((pack) => (
                <span
                  key={pack}
                  className="px-2 py-0.5 rounded text-xs"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--color-accent) 15%, var(--color-surface))",
                    color: "var(--color-accent)",
                    border: "1px solid color-mix(in srgb, var(--color-accent) 30%, var(--color-border))",
                  }}
                >
                  {pack}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            {/* Include globs */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--color-ink-muted)" }}>
                Include Patterns
              </p>
              {profile.includeGlobs.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--color-ink-faint)" }}>All files</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {profile.includeGlobs.map((g) => (
                    <code key={g} className="text-xs font-mono" style={{ color: "var(--color-ink-faint)" }}>{g}</code>
                  ))}
                </div>
              )}
            </div>

            {/* Exclude globs */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--color-ink-muted)" }}>
                Exclude Patterns
              </p>
              {profile.excludeGlobs.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--color-ink-faint)" }}>None</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {profile.excludeGlobs.map((g) => (
                    <code key={g} className="text-xs font-mono" style={{ color: "var(--color-ink-faint)" }}>{g}</code>
                  ))}
                </div>
              )}
            </div>

            {/* Settings */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--color-ink-muted)" }}>
                Settings
              </p>
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between">
                  <span style={{ color: "var(--color-ink-muted)" }}>Max file size</span>
                  <span style={{ color: "var(--color-ink)" }}>
                    {profile.maxFileSizeKb >= 1024
                      ? `${profile.maxFileSizeKb / 1024} MB`
                      : `${profile.maxFileSizeKb} KB`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--color-ink-muted)" }}>Default profile</span>
                  <span style={{ color: profile.isDefault ? "#3FCF8E" : "var(--color-ink-faint)" }}>
                    {profile.isDefault ? "Yes" : "No"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--color-ink-muted)" }}>Rule packs</span>
                  <span style={{ color: "var(--color-ink)" }}>{profile.rulePackIds.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<ScanProfile[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/profiles")
      .then((r) => r.json())
      .then((d) => setProfiles(Array.isArray(d) ? d : []))
      .catch(() => {
        // Fallback: load fixture data via import
        import("@/fixtures/scans").then((m) => setProfiles(m.scanProfiles));
      });
  }, []);

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--color-ink)" }}>
          Scan Profiles
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
          Configure what the scanner checks and how deep it goes
        </p>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
        <table className="w-full">
          <thead>
            <tr>
              <th style={thStyle}>Profile Name</th>
              <th style={thStyle}>Rule Packs</th>
              <th style={thStyle}>Max File Size</th>
              <th style={thStyle}>Include Patterns</th>
              <th style={thStyle}>Exclude Patterns</th>
              <th style={thStyle}>Created</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <Fragment key={profile.id}>
                <tr
                  style={{ backgroundColor: "var(--color-surface)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-surface-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--color-surface)")}
                >
                  {/* Name */}
                  <td style={tdStyle}>
                    <div className="flex items-center gap-2">
                      <Shield size={14} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
                      <span className="font-medium" style={{ color: "var(--color-ink)" }}>
                        {profile.name}
                      </span>
                      {profile.isDefault && (
                        <>
                          <Star size={11} style={{ color: "var(--color-stat-amber)" }} fill="var(--color-stat-amber)" />
                          <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: "color-mix(in srgb, var(--color-stat-amber) 15%, var(--color-surface))", color: "var(--color-stat-amber)", border: "1px solid color-mix(in srgb, var(--color-stat-amber) 30%, var(--color-border))", fontSize: "10px" }}
                          >
                            Default
                          </span>
                        </>
                      )}
                    </div>
                  </td>

                  {/* Rule Packs */}
                  <td style={tdStyle}>
                    <div className="flex flex-wrap gap-1">
                      {profile.rulePackIds.slice(0, 2).map((pack) => (
                        <span
                          key={pack}
                          className="px-2 py-0.5 rounded text-xs"
                          style={{ backgroundColor: "color-mix(in srgb, var(--color-accent) 15%, var(--color-surface))", color: "var(--color-accent)", border: "1px solid color-mix(in srgb, var(--color-accent) 30%, var(--color-border))" }}
                        >
                          {pack}
                        </span>
                      ))}
                      {profile.rulePackIds.length > 2 && (
                        <span className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
                          +{profile.rulePackIds.length - 2}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Max File Size */}
                  <td style={tdStyle}>
                    <span className="text-xs" style={{ color: "var(--color-ink-muted)" }}>
                      {profile.maxFileSizeKb >= 1024
                        ? `${profile.maxFileSizeKb / 1024} MB`
                        : `${profile.maxFileSizeKb} KB`}
                    </span>
                  </td>

                  {/* Include Patterns */}
                  <td style={tdStyle}>
                    <span className="text-xs font-mono" style={{ color: "var(--color-ink-faint)" }}>
                      {profile.includeGlobs.slice(0, 2).join(", ")}
                      {profile.includeGlobs.length > 2 && ` +${profile.includeGlobs.length - 2}`}
                    </span>
                  </td>

                  {/* Exclude Patterns */}
                  <td style={tdStyle}>
                    <span className="text-xs" style={{ color: "var(--color-ink-muted)" }}>
                      {profile.excludeGlobs.length} patterns
                    </span>
                  </td>

                  {/* Created */}
                  <td style={tdStyle}>
                    <span className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
                      {formatDate(profile.createdAt)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <button
                      onClick={() => toggle(profile.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium"
                      style={{
                        color: "var(--color-accent)",
                        backgroundColor: "color-mix(in srgb, var(--color-accent) 15%, var(--color-surface))",
                        border: "1px solid color-mix(in srgb, var(--color-accent) 30%, var(--color-border))",
                      }}
                    >
                      {expanded[profile.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {expanded[profile.id] ? "Hide Details" : "View Details"}
                    </button>
                  </td>
                </tr>

                {/* Expanded detail row */}
                {expanded[profile.id] && <ExpandedRow key={`${profile.id}-detail`} profile={profile} />}
              </Fragment>
            ))}
          </tbody>
        </table>

        {profiles.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-2">
            <Shield size={32} style={{ color: "var(--color-ink-faint)" }} />
            <p className="text-sm" style={{ color: "var(--color-ink-muted)" }}>No scan profiles found.</p>
          </div>
        )}
      </div>

      <p className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
        {profiles.length} profile{profiles.length !== 1 ? "s" : ""} total
      </p>
    </div>
  );
}
