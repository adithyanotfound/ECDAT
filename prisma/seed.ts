import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ─── Deterministic random ─────────────────────────────────────────────────────
let seed = 42;
function rand(min: number, max: number): number {
  seed = (seed * 1664525 + 1013904223) & 0xffffffff;
  const t = ((seed >>> 0) / 0xffffffff);
  return Math.floor(t * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[rand(0, arr.length - 1)];
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ALGORITHMS = [
  { name: "3DES", primitive: "block-cipher", key: 168, mode: "CBC", qs: false, crsf: 85, pqc: 1 },
  { name: "SHA-1", primitive: "hash", key: 160, mode: null, qs: false, crsf: 85, pqc: 1 },
  { name: "MD5", primitive: "hash", key: 128, mode: null, qs: false, crsf: 90, pqc: 0 },
  { name: "RSA-1024", primitive: "signature", key: 1024, mode: null, qs: false, crsf: 95, pqc: 0 },
  { name: "RSA-2048", primitive: "signature", key: 2048, mode: null, qs: false, crsf: 48, pqc: 4 },
  { name: "RSA-3072", primitive: "signature", key: 3072, mode: null, qs: false, crsf: 42, pqc: 5 },
  { name: "RSA-4096", primitive: "signature", key: 4096, mode: null, qs: false, crsf: 38, pqc: 5 },
  { name: "AES-128-CBC", primitive: "block-cipher", key: 128, mode: "CBC", qs: true, crsf: 15, pqc: 7 },
  { name: "AES-256-GCM", primitive: "block-cipher", key: 256, mode: "GCM", qs: true, crsf: 3, pqc: 9 },
  { name: "SHA-256", primitive: "hash", key: 256, mode: null, qs: true, crsf: 5, pqc: 8 },
  { name: "SHA-384", primitive: "hash", key: 384, mode: null, qs: true, crsf: 2, pqc: 9 },
  { name: "ECDSA-P256", primitive: "signature", key: 256, mode: null, qs: false, crsf: 40, pqc: 4 },
  { name: "Ed25519", primitive: "signature", key: 256, mode: null, qs: true, crsf: 5, pqc: 8 },
  { name: "ChaCha20-Poly1305", primitive: "stream-cipher", key: 256, mode: null, qs: true, crsf: 2, pqc: 9 },
  { name: "ML-KEM-768", primitive: "key-agreement", key: 1184, mode: null, qs: true, crsf: 0, pqc: 10 },
  { name: "DES", primitive: "block-cipher", key: 56, mode: "ECB", qs: false, crsf: 100, pqc: 0 },
  { name: "RC4", primitive: "stream-cipher", key: 128, mode: null, qs: false, crsf: 95, pqc: 0 },
  { name: "Blowfish", primitive: "block-cipher", key: 128, mode: "ECB", qs: false, crsf: 70, pqc: 2 },
  { name: "HMAC-SHA256", primitive: "mac", key: 256, mode: null, qs: true, crsf: 8, pqc: 8 },
  { name: "HMAC-MD5", primitive: "mac", key: 128, mode: null, qs: false, crsf: 88, pqc: 0 },
];

const REPO_CONFIGS = [
  { name: "payments-api", owner: "acme-corp", lang: "TypeScript", criticality: "CRITICAL" as const, lifetime: 10 },
  { name: "banking-core", owner: "acme-corp", lang: "Java", criticality: "CRITICAL" as const, lifetime: 15 },
  { name: "iot-firmware", owner: "acme-corp", lang: "C", criticality: "HIGH" as const, lifetime: 20 },
  { name: "ml-platform", owner: "acme-corp", lang: "Python", criticality: "MEDIUM" as const, lifetime: 5 },
  { name: "pqc-gateway", owner: "acme-corp", lang: "Go", criticality: "LOW" as const, lifetime: 3 },
  { name: "platform-infra", owner: "acme-corp", lang: "HCL", criticality: "HIGH" as const, lifetime: 7 },
  { name: "auth-service", owner: "acme-corp", lang: "TypeScript", criticality: "CRITICAL" as const, lifetime: 8 },
  { name: "data-pipeline", owner: "acme-corp", lang: "Python", criticality: "LOW" as const, lifetime: 2 },
  { name: "mobile-backend", owner: "acme-corp", lang: "Go", criticality: "MEDIUM" as const, lifetime: 5 },
];

const VULNERABILITY_TEMPLATES = [
  { code: "HASH-MD5-001", title: "MD5 used for security-sensitive hashing", severity: "CRITICAL" as const, detail: "MD5 is cryptographically broken and must not be used for security functions." },
  { code: "CIPHER-DES-001", title: "DES cipher in use", severity: "CRITICAL" as const, detail: "DES has an effective key length of 56 bits which is below modern security thresholds." },
  { code: "CIPHER-3DES-001", title: "3DES (Triple DES) cipher in use", severity: "HIGH" as const, detail: "3DES is deprecated per NIST SP 800-131A Rev 2 as of 2023." },
  { code: "HASH-SHA1-001", title: "SHA-1 used for integrity or signature", severity: "HIGH" as const, detail: "SHA-1 is collision-vulnerable. Replace with SHA-256 or SHA-3." },
  { code: "KEY-RSA-1024-001", title: "RSA-1024 key in use", severity: "CRITICAL" as const, detail: "RSA-1024 is below the NIST SP 800-57 security floor of 112 bits." },
  { code: "KEY-RSA-2048-PQC", title: "RSA-2048 not quantum-safe", severity: "MODERATE" as const, detail: "RSA-2048 will be broken by a CRQC. Plan migration to ML-KEM-768 (FIPS 203)." },
  { code: "TLS-VER-001", title: "TLS 1.0/1.1 enabled", severity: "HIGH" as const, detail: "TLS 1.0 and 1.1 are deprecated. Enforce TLS 1.2+ and prefer TLS 1.3." },
  { code: "PQC-MISSING-001", title: "No post-quantum key exchange", severity: "MODERATE" as const, detail: "No PQC or hybrid key exchange algorithm detected. Add X25519MLKEM768 or ML-KEM-768." },
  { code: "CIPHER-RC4-001", title: "RC4 stream cipher in use", severity: "CRITICAL" as const, detail: "RC4 is prohibited by RFC 7465 and must not be used in any context." },
  { code: "HMAC-MD5-001", title: "HMAC-MD5 in use", severity: "HIGH" as const, detail: "HMAC-MD5 should be replaced with HMAC-SHA256 or stronger." },
];

async function main() {
  console.log("🌱 Seeding database...");

  // ── Wipe existing seed data ───────────────────────────────────────────────
  await prisma.$transaction([
    prisma.findingAsset.deleteMany(),
    prisma.finding.deleteMany(),
    prisma.riskAssessment.deleteMany(),
    prisma.cryptoAsset.deleteMany(),
    prisma.scanLog.deleteMany(),
    prisma.cbom.deleteMany(),
    prisma.scan.deleteMany(),
    prisma.scanProfile.deleteMany(),
    prisma.recommendation.deleteMany(),
    prisma.repository.deleteMany(),
    prisma.installation.deleteMany(),
    prisma.job.deleteMany(),
    prisma.webhookDelivery.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // ── User ──────────────────────────────────────────────────────────────────
  const user = await prisma.user.create({
    data: {
      githubId: 1234567,
      login: "saurabh",
      name: "Saurabh",
      avatarUrl: "https://avatars.githubusercontent.com/u/1234567",
      email: "saurabh@acme-corp.com",
    },
  });
  console.log(`✓ Created user: ${user.login}`);

  // ── Installation ──────────────────────────────────────────────────────────
  const installation = await prisma.installation.create({
    data: {
      githubInstallationId: 98765432,
      accountLogin: "acme-corp",
      accountType: "Organization",
      avatarUrl: "https://avatars.githubusercontent.com/u/98765432",
    },
  });
  console.log(`✓ Created installation: ${installation.accountLogin}`);

  // ── Scan Profiles ─────────────────────────────────────────────────────────
  const profileDefault = await prisma.scanProfile.create({
    data: {
      name: "Default Full Scan",
      rulePackIds: ["core", "secrets", "certificates", "keys", "protocols"],
      includeGlobs: ["**/*"],
      excludeGlobs: ["**/node_modules/**", "**/vendor/**", "**/.git/**", "**/dist/**"],
      maxFileSizeKb: 1024,
      isDefault: true,
    },
  });
  const profileDeep = await prisma.scanProfile.create({
    data: {
      name: "Deep Scan",
      rulePackIds: ["core", "secrets", "certificates", "keys", "protocols", "dependencies", "iac"],
      includeGlobs: ["**/*"],
      excludeGlobs: ["**/node_modules/**", "**/.git/**"],
      maxFileSizeKb: 5120,
      isDefault: false,
    },
  });
  const profileConfig = await prisma.scanProfile.create({
    data: {
      name: "Config-Only Scan",
      rulePackIds: ["protocols", "iac"],
      includeGlobs: ["**/*.conf", "**/*.yaml", "**/*.yml", "**/*.tf", "**/*.toml"],
      excludeGlobs: ["**/node_modules/**", "**/.git/**"],
      maxFileSizeKb: 512,
      isDefault: false,
    },
  });
  console.log("✓ Created scan profiles");

  // ── Repositories + Scans + Assets + Findings ──────────────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const now = new Date();

  // We'll create 9 base repos from config + 51 more synthetic ones to hit 60 total
  const allRepoConfigs = [
    ...REPO_CONFIGS,
    ...Array.from({ length: 51 }, (_, i) => ({
      name: `service-${String(i + 10).padStart(3, "0")}`,
      owner: "acme-corp",
      lang: pick(["TypeScript", "Java", "Python", "Go", "Rust", "C++", "C#"]),
      criticality: pick(["CRITICAL", "HIGH", "MEDIUM", "LOW"]) as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      lifetime: rand(2, 20),
    })),
  ];

  let totalCryptoAssets = 0;
  let totalFindings = 0;

  for (let i = 0; i < allRepoConfigs.length; i++) {
    const cfg = allRepoConfigs[i];
    const isNew = i >= allRepoConfigs.length - 15; // last 15 are "new"
    const scanEnabled = i < 50; // first 50 are classified/enabled

    const createdAt = isNew
      ? new Date(now.getTime() - rand(0, 6) * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() - rand(7, 60) * 24 * 60 * 60 * 1000);

    const repo = await prisma.repository.create({
      data: {
        installationId: installation.id,
        githubRepoId: 10000000 + i,
        fullName: `${cfg.owner}/${cfg.name}`,
        owner: cfg.owner,
        name: cfg.name,
        defaultBranch: "main",
        language: cfg.lang,
        scanEnabled,
        dataLifetimeYears: cfg.lifetime,
        criticality: cfg.criticality,
        createdAt,
        updatedAt: createdAt,
      },
    });

    // Only create scans for enabled repos
    if (!scanEnabled) continue;

    const hasCompletedScan = i < 40; // 40 monitored
    if (!hasCompletedScan) continue;

    const commitSha = Math.random().toString(16).slice(2, 9);
    const scanStart = new Date(createdAt.getTime() + rand(1, 30) * 60 * 1000);
    const scanDuration = rand(15000, 90000);
    const filesScanned = rand(50, 500);

    const scan = await prisma.scan.create({
      data: {
        repositoryId: repo.id,
        profileId: profileDefault.id,
        trigger: i === 0 ? "PUSH" : "INITIAL",
        status: "COMPLETED",
        commitSha,
        ref: "refs/heads/main",
        durationMs: scanDuration,
        filesScanned,
        startedAt: scanStart,
        completedAt: new Date(scanStart.getTime() + scanDuration),
      },
    });

    // Create crypto assets — ~1290 spread across 40 repos ≈ 32 per repo
    const numAssets = rand(20, 45);
    totalCryptoAssets += numAssets;

    // Pick algorithms weighted towards weak ones for legacy repos
    const isLegacy = ["Java", "C", "C++"].includes(cfg.lang ?? "");
    const algoPool = isLegacy
      ? ALGORITHMS.filter((a) => a.crsf >= 40)
      : ALGORITHMS;

    for (let j = 0; j < numAssets; j++) {
      const algo = pick(j < 3 ? algoPool : ALGORITHMS);
      const filePath = `/src/${pick(["crypto", "auth", "security", "utils"])}/${pick(["cipher", "hash", "key", "token", "sign"])}.${pick(["ts", "js", "py", "java", "go", "c"])}`;
      const fingerprint = `${repo.id}-${algo.name}-${filePath}-${j}`;

      const asset = await prisma.cryptoAsset.create({
        data: {
          repositoryId: repo.id,
          fingerprint,
          kind: "ALGORITHM",
          name: algo.name,
          primitive: algo.primitive,
          algorithm: algo.name,
          keyLengthBits: algo.key,
          mode: algo.mode ?? null,
          quantumSafe: algo.qs,
          nistQuantumLevel: algo.qs ? rand(1, 5) : 0,
          executionEnvironment: "software-plain-ram",
          filePath,
          lineNumber: rand(10, 200),
          usageCount: rand(1, 15),
          ruleId: `RULE-${algo.name.replace(/[^A-Z0-9]/g, "").toUpperCase()}-001`,
          firstSeenScanId: scan.id,
          lastSeenScanId: scan.id,
        },
      });

      // Risk assessment
      const variance = rand(-5, 5);
      await prisma.riskAssessment.create({
        data: {
          cryptoAssetId: asset.id,
          crsfScore: Math.max(0, Math.min(100, algo.crsf + variance)),
          cisScore: Math.max(0, 100 - algo.crsf - variance),
          pqcSafetyScore: Math.max(0, Math.min(10, algo.pqc + rand(-1, 1))),
          riskCategory:
            algo.crsf >= 70 ? "CRITICAL" :
            algo.crsf >= 45 ? "HIGH" :
            algo.crsf >= 20 ? "MODERATE" :
            algo.crsf >= 10 ? "LOW" : "SAFE",
          moscaX: cfg.lifetime,
          moscaY: 3,
          moscaZ: 7,
          moscaVerdict: (cfg.lifetime + 3) > 7 ? "ACT_NOW" : "PLAN",
        },
      });
    }

    // Create findings — only for repos with weak algos
    if (isLegacy || cfg.criticality === "CRITICAL") {
      const vulnTemplates = VULNERABILITY_TEMPLATES.slice(0, rand(3, 7));
      for (const tmpl of vulnTemplates) {
        await prisma.finding.create({
          data: {
            repositoryId: repo.id,
            code: tmpl.code,
            severity: tmpl.severity,
            title: tmpl.title,
            detail: tmpl.detail,
            status: rand(0, 4) > 0 ? "OPEN" : "MITIGATED",
            affectedComponent: pick(["OpenSSH", "Nginx", "Spring Boot", "Node.js", "OpenSSL"]),
            filePath: `/src/${pick(["crypto", "auth", "config"])}/${pick(["cipher", "hash", "tls"])}.${pick(["ts", "java", "py", "go", "c"])}`,
            lineNumber: rand(10, 300),
            firstSeenScanId: scan.id,
            lastSeenScanId: scan.id,
            firstSeenAt: scanStart,
            lastSeenAt: now,
          },
        });
        totalFindings++;
      }
    }

    // Create recommendations for quantum-vulnerable repos
    if (!["Go", "Rust"].includes(cfg.lang ?? "")) {
      await prisma.recommendation.createMany({
        data: [
          {
            repositoryId: repo.id,
            fromAlgorithm: "RSA-2048",
            toAlgorithm: "ML-KEM-768",
            standard: "FIPS 203",
            effort: "MEDIUM",
            latencyImpact: "Comparable",
            sizeImpact: "Larger keys",
          },
          {
            repositoryId: repo.id,
            fromAlgorithm: "ECDSA-P256",
            toAlgorithm: "ML-DSA-65",
            standard: "FIPS 204",
            effort: "MEDIUM",
            latencyImpact: "Larger signatures",
            sizeImpact: "Larger signatures",
          },
        ],
      });
    }

    // Scan logs
    await prisma.scanLog.createMany({
      data: [
        { scanId: scan.id, level: "INFO", message: `Starting scan of ${repo.fullName} @ ${commitSha}`, ts: scanStart },
        { scanId: scan.id, level: "INFO", message: `Fetching tarball from GitHub...`, ts: new Date(scanStart.getTime() + 2000) },
        { scanId: scan.id, level: "INFO", message: `Running detector: algorithms`, ts: new Date(scanStart.getTime() + 5000) },
        { scanId: scan.id, level: "INFO", message: `Running detector: certificates`, ts: new Date(scanStart.getTime() + 10000) },
        { scanId: scan.id, level: "INFO", message: `Running detector: keys`, ts: new Date(scanStart.getTime() + 15000) },
        { scanId: scan.id, level: "INFO", message: `Running detector: protocols`, ts: new Date(scanStart.getTime() + 20000) },
        { scanId: scan.id, level: "INFO", message: `Scan complete: ${numAssets} assets, ${filesScanned} files`, ts: new Date(scanStart.getTime() + scanDuration) },
      ],
    });
  }

  console.log(`✓ Created ${allRepoConfigs.length} repositories`);
  console.log(`✓ Created ~${totalCryptoAssets} crypto assets`);
  console.log(`✓ Created ${totalFindings} findings`);

  // ── Verify counts ─────────────────────────────────────────────────────────
  const counts = await Promise.all([
    prisma.repository.count(),
    prisma.repository.count({ where: { scanEnabled: true } }),
    prisma.cryptoAsset.count(),
    prisma.finding.count(),
    prisma.riskAssessment.count({ where: { crsfScore: { gte: 70 } } }),
  ]);

  console.log("\n📊 Seed summary:");
  console.log(`  Total repositories:  ${counts[0]} (target: 60)`);
  console.log(`  Classified repos:    ${counts[1]} (target: 50)`);
  console.log(`  Crypto assets:       ${counts[2]} (target: ~1290)`);
  console.log(`  Findings:            ${counts[3]}`);
  console.log(`  High-risk assets:    ${counts[4]} (target: ~47)`);
  console.log("\n✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
