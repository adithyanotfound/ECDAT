import type { Metadata } from "next";
import { cryptoAssets, findings } from "@/fixtures/assets";
import { SeverityPill, ScorePill } from "@/components/ui/Pill";
import { Download } from "lucide-react";

export const metadata: Metadata = { title: "CBOM Report — ECDAT Atlas" };

// CBOM report fixtures matching the reference screenshot for SSH
const components = [
  {
    name: "OpenSSH",
    type: "Application",
    version: "OpenSSH_8.2p1",
    description: "OpenSSH_8.9p1 Ubuntu-3ubuntu0.13",
    port: 22,
  },
];

const cryptographicSummary = {
  strong: {
    kex: ["curve25519-sha256", "ECDH (nistp256/384/521)"],
    ciphers: ["aes128-ctr", "aes256-ctr", "aes-gcm"],
    macs: ["hmac-sha2-256", "hmac-sha2-512"],
  },
  weak: {
    kex: ["diffie-hellman-group1/group14 (SHA-1)"],
    ciphers: ["3des-cbc"],
    macs: ["hmac-md5", "hmac-sha1-96"],
  },
};

const detectedCryptoAssets = [
  { component: "curve25519-sha256@libssh.org", type: "Symmetric", algorithm: "RSA-2048", keyLength: "2048", pqcSafe: "Yes", reference: "/etc/ssl/server.crt" },
  { component: "ecdh-sha2-nistp256", type: "Hash", algorithm: "AES-256-GCM", keyLength: "256", pqcSafe: "No", reference: "N/A" },
  { component: "diffie-hellman-group14-sha1", type: "Asymmetric", algorithm: "SHA-1", keyLength: "—", pqcSafe: "No", reference: "N/A" },
  { component: "diffie-hellman-group1-sha1", type: "Symmetric", algorithm: "ECDSA-P256", keyLength: "256", pqcSafe: "Medium", reference: "/home/.ssh/id_ecdsa" },
  { component: "ssh-ed25519", type: "Symmetric", algorithm: "RSA-4096", keyLength: "4096", pqcSafe: "Upgrade to PQC", reference: "vault:/key/xyz" },
  { component: "aes128-ctr / aes128-gcm", type: "Symmetric", algorithm: "AES-256-PHM", keyLength: "256", pqcSafe: "Yes", reference: "N/A" },
];

const servicesDetected = [
  {
    service: "SSH Service",
    endpoint: "ssh://20.20.5.32:22",
    serverSoftware: "OpenSSH_8.9p1 Ubuntu",
    protocolVersion: "2.0",
    authenticated: "No",
    exposure: "Public (Assumed)",
  },
];

const pqcSafetyColor = (val: string) => {
  if (val === "Yes") return { color: "#3FCF8E", bg: "rgba(63,207,142,0.12)", border: "rgba(63,207,142,0.4)" };
  if (val === "No") return { color: "#F0516B", bg: "rgba(240,81,107,0.12)", border: "rgba(240,81,107,0.4)" };
  if (val === "Medium") return { color: "#F2C14E", bg: "rgba(242,193,78,0.12)", border: "rgba(242,193,78,0.4)" };
  return { color: "#5AA9F5", bg: "rgba(90,169,245,0.12)", border: "rgba(90,169,245,0.4)" };
};

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
  color: "var(--color-ink)",
  borderBottom: "1px solid var(--color-border)",
  verticalAlign: "middle",
};

export default function CbomReportPage() {
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Title & selector row */}
      <div>
        <h1 className="text-2xl font-bold mb-4" style={{ color: "var(--color-ink)" }}>
          CBOM Report
        </h1>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-ink-muted)" }}>
              Select Asset*
            </label>
            <div
              className="rounded-lg px-3 py-2 text-sm"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-ink)",
                minWidth: "200px",
              }}
            >
              Asset001 (20.20.5.32)
            </div>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-ink-muted)" }}>
              Select Asset Process*
            </label>
            <div
              className="rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-4"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-ink)",
                minWidth: "160px",
              }}
            >
              <span>SSH (22)</span>
              <span style={{ color: "var(--color-ink-faint)" }}>▼</span>
            </div>
          </div>
          <button
            className="px-5 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "var(--color-accent)", color: "#fff" }}
          >
            Submit
          </button>
        </div>
      </div>

      {/* Report header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "var(--color-ink)" }}>
            Asset001 — SSH (22) Report
          </h2>
          <p className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
            Last Scan: Oct 8, 2025 12:05:45 PM
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-ink-muted)",
            }}
          >
            <Download size={13} /> Download PDF
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "var(--color-accent)", color: "#fff" }}
          >
            <Download size={13} /> Download CBOM
          </button>
        </div>
      </div>

      {/* Components table */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-ink)" }}>
          Components
        </h3>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
          <table className="w-full">
            <thead>
              <tr>
                {["Name", "Type", "Version", "Description", "Port"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {components.map((c, i) => (
                <tr key={i} style={{ backgroundColor: "var(--color-surface)" }}>
                  <td style={tdStyle}>{c.name}</td>
                  <td style={tdStyle}>{c.type}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "12px" }}>{c.version}</td>
                  <td style={tdStyle}>{c.description}</td>
                  <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums" }}>{c.port}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cryptographic Assets */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-ink)" }}>
          Cryptographic Assets
        </h3>
        {/* Summary box */}
        <div
          className="rounded-t-xl p-4 mb-0"
          style={{
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            borderBottom: "none",
          }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-ink)" }}>Summary</p>
          <p className="text-xs mb-2" style={{ color: "var(--color-ink-muted)" }}>
            Detected key-exchange algorithms, host keys, ciphers and MACs. Some deprecated algorithms present.
          </p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs" style={{ color: "var(--color-ink-muted)" }}>
            <div>
              {Object.entries(cryptographicSummary.strong).map(([k, vals]) => (
                <p key={k}>
                  <span style={{ color: "#3FCF8E" }}>• Strong {k.toUpperCase()}: </span>
                  {vals.join(", ")}
                </p>
              ))}
            </div>
            <div>
              {Object.entries(cryptographicSummary.weak).map(([k, vals]) => (
                <p key={k}>
                  <span style={{ color: "#F0516B" }}>• Weak {k.toUpperCase()}: </span>
                  {vals.join(", ")}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Detected assets table */}
        <div className="rounded-b-xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
          <div
            className="px-4 py-2"
            style={{ backgroundColor: "var(--color-surface-2)", borderBottom: "1px solid var(--color-border)" }}
          >
            <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>
              Detected Cryptographic Assets
            </p>
          </div>
          <table className="w-full" style={{ backgroundColor: "var(--color-surface)" }}>
            <thead>
              <tr>
                {["Component", "Type", "Algorithm", "Key Length", "PQC Safe?", "Reference"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detectedCryptoAssets.map((row, i) => {
                const pqs = pqcSafetyColor(row.pqcSafe);
                return (
                  <tr key={i}>
                    <td style={{ ...tdStyle, fontSize: "12px", fontFamily: "monospace" }}>{row.component}</td>
                    <td style={tdStyle}>{row.type}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "12px" }}>{row.algorithm}</td>
                    <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums" }}>{row.keyLength}</td>
                    <td style={tdStyle}>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ color: pqs.color, backgroundColor: pqs.bg, border: `1px solid ${pqs.border}` }}
                      >
                        {row.pqcSafe}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontSize: "12px", fontFamily: "monospace", color: "var(--color-ink-faint)" }}>
                      {row.reference}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Services Detected */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-ink)" }}>
          Services Detected
        </h3>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
          <table className="w-full" style={{ backgroundColor: "var(--color-surface)" }}>
            <thead>
              <tr>
                {["Service", "Endpoint", "Server Software", "Protocol Version", "Authenticated", "Exposure"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {servicesDetected.map((row, i) => (
                <tr key={i}>
                  <td style={tdStyle}>{row.service}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "12px" }}>{row.endpoint}</td>
                  <td style={tdStyle}>{row.serverSoftware}</td>
                  <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums" }}>{row.protocolVersion}</td>
                  <td style={tdStyle}>{row.authenticated}</td>
                  <td style={tdStyle}>{row.exposure}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Vulnerabilities */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-ink)" }}>
          Vulnerabilities
        </h3>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
          <table className="w-full" style={{ backgroundColor: "var(--color-surface)" }}>
            <thead>
              <tr>
                {["ID", "Severity", "Title", "Detail", "Affected Component"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {findings.slice(0, 4).map((f) => (
                <tr key={f.id}>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "12px" }}>{f.code}</td>
                  <td style={tdStyle}><SeverityPill severity={f.severity} /></td>
                  <td style={tdStyle}>{f.title}</td>
                  <td style={{ ...tdStyle, maxWidth: "280px", fontSize: "12px", color: "var(--color-ink-muted)" }}>
                    {f.detail}
                  </td>
                  <td style={tdStyle}>{f.affectedComponent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
