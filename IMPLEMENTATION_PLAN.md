# ECDAT Atlas — Implementation Plan

**Enterprise Cryptographic Discovery & Analysis Tool (NTRO)**

A five-phase plan for a Next.js monolith that reproduces the QInsight Atlas interface and fills it from a single discovery source: connected GitHub repositories, scanned on connect and re-scanned on every push.

| | |
|---|---|
| **Runtime** | Self-hosted Node 20+ (`next build && next start`) |
| **Database** | Neon Postgres + Prisma 7.10.0 |
| **Ingest** | GitHub App + `push` webhook |
| **Engine** | Custom TypeScript rule packs |
| **Plan date** | 2026-09-08 (dependency versions verified against the npm registry on this date) |

---

## Table of contents

- [0. Scope and locked decisions](#0-scope-and-locked-decisions)
- [1. The marker vocabulary](#1-the-marker-vocabulary)
- [2. Design tokens read off the screenshots](#2-design-tokens-read-off-the-screenshots)
- [3. Dependency manifest, verified against npm](#3-dependency-manifest-verified-against-npm)
- [Phase 1 — Foundation and pixel-accurate app shell](#phase-1--foundation-and-pixel-accurate-app-shell)
- [Phase 2 — Neon, Prisma and the domain model](#phase-2--neon-prisma-and-the-domain-model)
- [Phase 3 — GitHub App, webhooks and scan orchestration](#phase-3--github-app-webhooks-and-scan-orchestration)
- [Phase 4 — Discovery engine and risk analytics](#phase-4--discovery-engine-and-risk-analytics)
- [Phase 5 — Live surfaces, demo repositories and hardening](#phase-5--live-surfaces-demo-repositories-and-hardening)
- [4. Demo repositories](#4-demo-repositories)
- [5. Risk register and sequencing](#5-risk-register-and-sequencing)

---

## 0. Scope and locked decisions

The problem statement covers network, cloud, databases, file systems, KMS/HSM and CI/CD. This build implements **one discovery source end to end** — CI/CD — and keeps the other six as visible, disabled rails in the UI so the architecture reads as complete without pretending to be.

### In scope

- GitHub App install → repository selection → persisted connection
- Automatic **initial scan** on connect
- Automatic **re-scan on every `push`** via webhook
- Cryptographic artefact discovery: algorithms, keys, certificates, protocols, libraries, secrets
- Classification by type, lifetime, business criticality
- CRSF / CIS / PQC safety scoring and Mosca verdict
- PQC + hybrid recommendations with latency and effort estimates
- CycloneDX 1.6 CBOM export
- Pixel-faithful reproduction of the nine reference screens

### Deferred (UI present, disabled)

- Network / port sweep discovery and scan agents
- Cloud, database and file-system connectors
- KMS & HSM inventory
- Credentialed deep scanning with stored secrets
- Users, Settings, Knowledge pages beyond static stubs
- Alerting, ticketing and remediation workflow
- Multi-tenant org separation

### Three decisions that shape everything downstream

| Decision | Choice | Why it wins here |
|---|---|---|
| **Runtime** | Self-hosted Node | Scans need a writable temp dir, minutes of wall clock, and a long-lived process to host the job worker. No serverless timeout to design around, no queue infrastructure to stand up. |
| **GitHub access** | GitHub App | Gives the exact flow described — install, pick repos, revoke — plus auto-provisioned `push` webhooks and 1-hour installation tokens instead of a long-lived PAT. Also supplies user login, which removes the auth library entirely. |
| **Detection** | Custom TS rule packs | No Python or external binary in the deployment. Every finding carries its own rule ID, evidence and CBOM fields, so the report is explainable to an evaluator — which matters more than raw rule count. |

---

## 1. The marker vocabulary

Every visual marker in the screenshots is a rendering of one database column. Reading them backwards gives the schema and tells you what a scan must actually produce.

### Severity pills — `Finding.severity`

`Critical` · `High` · `Moderate` · `Low` · `Compliant`

Colours: critical `#F0516B`, high `#F79552`, moderate `#F2C14E`, low `#5AA9F5`, safe `#3FCF8E`.

### PQC safety chips — `RiskAssessment.pqcSafetyScore`, 0–10

Rendered as a coloured dot plus `N/10`. Observed in the reference: `7/10` green, `2/10` red, `1/10` red.

### Scan status pills — `Scan.status`

`Completed` (green outline) · `Running` (blue outline) · `Failed` (orange outline) · `Queued` (amber outline)

### CRSF score bars — `RiskAssessment.crsfScore`, 0–100

The Algorithms table renders risk as a filled track. Colour bands: 0–19 safe, 20–44 low, 45–69 moderate, 70–100 high.

| Algorithm | Deps | Key length | CRSF | Quantum safe |
|---|---:|---:|---:|---|
| `3DES` | 2 | 168 | 85 | No |
| `SHA-1` | 3 | 160 | 85 | No |
| `RSA-2048` | 13 | 2048 | 48 | No |
| `SHA-256` | 6 | 256 | 14 | Yes |
| `ML-KEM-768` | 1 | 1184 | 0 | Yes |

### The detail drawer — one row per CBOM field

The 3DES drawer in the reference is not decoration; each row is a CycloneDX 1.6 `cryptoProperties.algorithmProperties` field. **Producing this panel *is* producing a valid CBOM.**

| Drawer field | CycloneDX 1.6 path | Example value |
|---|---|---|
| Primitive | `algorithmProperties.primitive` | `block-cipher` |
| Type | `assetType` | `algorithm` |
| Mode | `algorithmProperties.mode` | `cbc` |
| Key Length | `algorithmProperties.parameterSetIdentifier` | `168` |
| Quantum Safe | `algorithmProperties.nistQuantumSecurityLevel` | `0` |
| Execution Environment | `algorithmProperties.executionEnvironment` | `software-plain-ram` |
| Dependencies / Usage Count | `dependencies[].dependsOn` | `2` |
| Last Seen | `evidence.occurrences[]` | `2026-04-16T14:40Z` |

### Navigation remap: network semantics → repository semantics

The reference IA assumes network assets. Keep the layout byte-for-byte and change only what each column *means*.

| Reference screen | Becomes | Column remap |
|---|---|---|
| Scanning › Agents | Scanning › **Repositories** | Hostname/IP → `owner/repo` · Port → default branch · Version → last commit SHA · Added on → connected date |
| Scanning › Profiles | Scanning › **Profiles** | Rule-pack selection, include/exclude globs, file size cap |
| Scanning › Scans | Scanning › **Scans** | Agent → repository · IP Range → `ref@sha` · Profile Used → scan profile · unchanged otherwise |
| Assets › Inventory | Assets › **Inventory** | Tabbed Algorithms / Certificates / Keys / Protocols; Asset ID → artefact ID; IP/Hostname → file path |
| Assets › PQC | Assets › **PQC** | Per-repository PQC score list plus the CBOM Report page |
| Assets › Vulnerabilities | Assets › **Vulnerabilities** | Asset ID → repository · Assets Affected → file path + component |
| Dashboard "By Source Type" | By **artefact source** | Source Code · Dependencies · Certificates · Config · Secrets · Keystores · IaC |

---

## 2. Design tokens read off the screenshots

Encode these once in `globals.css` under Tailwind v4's `@theme` block. Getting the two-level sidebar highlight and the accent-bordered stat card right is most of the visual match.

```css
@import "tailwindcss";

@theme {
  /* surfaces — cool, blue-biased, never neutral grey */
  --color-bg:            #070A12;   /* page ground        */
  --color-sidebar:       #0D1220;   /* nav rail           */
  --color-surface:       #151B2E;   /* card / panel       */
  --color-surface-2:     #1A2138;   /* raised, drawer     */
  --color-row:           #1B2239;   /* table row hover    */
  --color-thead:         #1E2540;   /* table header       */
  --color-border:        #252D48;

  /* type */
  --color-ink:           #E6EAF2;
  --color-ink-muted:     #8A93A8;
  --color-ink-faint:     #626B84;

  /* accent — the Atlas blue */
  --color-accent:        #2F5BFF;
  --color-accent-hover:  #3B6FF6;
  --color-accent-sub:    #2A3B7A;   /* nested active nav item */

  /* semantic, kept out of the accent ramp */
  --color-critical:      #F0516B;
  --color-high:          #F79552;
  --color-moderate:      #F2C14E;
  --color-low:           #5AA9F5;
  --color-safe:          #3FCF8E;

  /* stat-card accent borders, left to right in the reference */
  --color-stat-teal:     #2DD4BF;
  --color-stat-amber:    #F2C14E;
  --color-stat-orange:   #F79552;

  --radius-card:         10px;
  --radius-pill:         999px;
}
```

### Three details that carry the resemblance

1. **Two-level nav highlight.** The active group (*Assets*) is a solid `--color-accent` pill spanning the rail; the active child (*PQC*) is a second, slightly inset pill in `--color-accent-sub`. One level of highlight looks wrong immediately.
2. **Stat cards are not uniform.** Each of the four KPI cards carries a different 1px accent border keyed to its metric's health — teal, teal, amber, orange in the reference. A single border colour flattens the row.
3. **Tabular numerals everywhere.** Every table with digits gets `font-variant-numeric: tabular-nums`, or the score columns visibly jitter between rows.

---

## 3. Dependency manifest, verified against npm

Versions below were read from the npm registry on 2026-09-08, not recalled. Five real conflicts exist in the naive install — installing "latest" across the board produces a broken tree.

### ⚠ Version traps in the default install

- **Prisma majors are split.** `prisma@latest` currently resolves to `8.0.0-rc.13` — a release candidate — while `@prisma/client@latest` is `7.10.0`. `npm i prisma @prisma/client` installs mismatched majors and `prisma generate` fails. **Pin both to `7.10.0`.**
- **NextAuth pins a stale `@auth/core`.** `next-auth@4.24.15` declares a peer of exactly `@auth/core@0.34.3`, but latest is `0.41.3`; installing `@auth/core` yourself throws `ERESOLVE`. Separately `@auth/prisma-adapter@2.11.3` peers `@prisma/client >=6` with no clause for 7. **Drop the auth library entirely** — the GitHub App already provides identity, and `jose` signs the session cookie in about forty lines.
- **TypeScript 7 is the new native compiler line.** `typescript@latest` is `7.0.2`; type-tooling around it still lags. **Pin `5.9.3`** and revisit after the demo.
- **Recharts declares `react-is` as a peer.** `recharts@3.10.1` peers `react`, `react-dom` *and* `react-is`. Install `react-is@19.2.8` explicitly or charts fail to resolve at runtime.
- **Tailwind is v4.** No `tailwind.config.js`, no `autoprefixer`, no `postcss-import` — `@tailwindcss/postcss` handles all three. `tailwindcss-animate` is a v3 plugin; skip it and write the two keyframes you need.

### package.json

```json
{
  "name": "ecdat-atlas",
  "engines": { "node": ">=20.9.0" },
  "dependencies": {
    "next": "16.3.4",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "react-is": "19.2.8",

    "@prisma/client": "7.10.0",
    "@prisma/adapter-neon": "7.10.0",

    "@octokit/app": "16.1.4",
    "@octokit/auth-app": "8.3.1",
    "@octokit/rest": "22.0.1",
    "@octokit/webhooks": "14.2.0",

    "jose": "6.2.12",
    "zod": "4.5.4",

    "fast-glob": "3.3.3",
    "tar-stream": "3.2.1",
    "p-limit": "7.3.2",
    "@peculiar/x509": "2.1.0",
    "node-forge": "1.4.0",

    "recharts": "3.10.1",
    "@tanstack/react-table": "9.2.4",
    "@radix-ui/react-dialog": "1.1.23",
    "@radix-ui/react-tabs": "1.1.21",
    "@radix-ui/react-select": "2.3.7",
    "lucide-react": "1.43.0",
    "class-variance-authority": "0.7.1",
    "clsx": "2.1.1",
    "tailwind-merge": "3.6.0",
    "date-fns": "4.4.0",
    "sonner": "2.0.8"
  },
  "devDependencies": {
    "prisma": "7.10.0",
    "typescript": "5.9.3",
    "@types/node": "26.5.0",
    "@types/react": "19.2.x",
    "@types/react-dom": "19.2.x",
    "@types/node-forge": "1.3.x",
    "tailwindcss": "4.3.3",
    "@tailwindcss/postcss": "4.3.3",
    "eslint": "10.10.0",
    "eslint-config-next": "16.3.4"
  }
}
```

Exact pins, no carets, plus a committed `package-lock.json`. Verify the tree with `npm ls --all > /dev/null` — it exits non-zero on any unmet peer.

---

## Phase 1 — Foundation and pixel-accurate app shell

> **Static fixtures · no database · no network**

Build the entire visual system against hard-coded fixture data first. Every later phase then swaps a data source behind components that are already correct, and you never debug layout and scanning at the same time.

### Deliverables

- `create-next-app` — App Router, TypeScript, `src/`, Turbopack dev.
- Token layer in `src/app/globals.css` per the block above, with the dark palette as the base and a light variant behind `[data-theme="light"]` to drive the Dark/Light toggle in the top bar.
- **Chrome:** `AppShell`, `Sidebar` (collapsible, expandable groups, two-level active pill), `Topbar` (collapse control, breadcrumbs, "Welcome {name}", initials avatar, bell, theme pill).
- **Primitives:** `StatCard`, `DataTable` (sortable headers with the paired-arrow glyph, "Showing 10 of 60 rows.", numbered pager), `SeverityPill`, `ScorePill`, `StatusPill`, `ScoreBar`, `Drawer` (right panel with tab strip), `Tabs`, `Select`, `SearchInput`, `SegmentedFilter`, `Gauge`, `EmptyState`.
- All routes reachable with fixtures: `/dashboard`, `/scanning/repositories`, `/scanning/profiles`, `/scanning/scans`, `/assets/inventory`, `/assets/pqc`, `/assets/pqc/cbom`, `/assets/vulnerabilities`, `/reports`, plus disabled stubs for Knowledge, Settings, Users.
- Fixtures live in `src/fixtures/*.ts` typed against the same interfaces the Prisma layer will later satisfy — so Phase 2 is a swap, not a rewrite.

### Structure

```
src/
  app/
    (app)/layout.tsx          — AppShell: sidebar + topbar
    (app)/dashboard/page.tsx
    (app)/scanning/{repositories,profiles,scans}/page.tsx
    (app)/assets/{inventory,pqc,vulnerabilities}/page.tsx
    (app)/reports/page.tsx
    globals.css               — @theme tokens
  components/
    shell/{Sidebar,Topbar,Breadcrumbs,ThemeToggle}.tsx
    ui/{StatCard,DataTable,Pill,ScoreBar,Drawer,Tabs,Gauge}.tsx
    charts/{StackedBar,PostureDonut,TypeBars,ReadinessGauge}.tsx
  fixtures/
  lib/{cn.ts,format.ts}
```

### ⚠ Watch for

Theme flash on first paint — set the `data-theme` attribute from a cookie in a tiny inline script in `<head>` before React hydrates. Recharts components must be `"use client"` and are best wrapped in `next/dynamic` with `ssr:false`, or the server render disagrees with the client on chart dimensions.

### Definition of done

- [ ] Each of the nine reference screenshots has a side-by-side counterpart that matches on spacing, colour and type
- [ ] Theme toggle persists across reload with no flash
- [ ] `next build` and `tsc --noEmit` both clean, zero console errors
- [ ] Layout holds at 1280px, 1440px and 1920px

---

## Phase 2 — Neon, Prisma and the domain model

> **Schema · migrations · data-access layer · seed**
> *Depends on Phase 1 fixture interfaces*

Model the whole domain now, including the parts Phase 4 will fill. Changing the schema after the scanner writes to it is the most expensive mistake available in this project.

### Neon setup

| | |
|---|---|
| **Branches** | `main` for the demo, `dev` for iteration — Neon branching gives you a throwaway copy per experiment |
| **DATABASE_URL** | the **pooled** endpoint (`-pooler` in the host) for app runtime |
| **DIRECT_URL** | the **direct** endpoint — `prisma migrate` needs it; declare it as `directUrl` in the datasource block |

On a long-lived Node process the plain TCP driver over the pooler is the simplest correct choice. `@prisma/adapter-neon` is listed as optional — adopt it only if you later move to a serverless runtime.

### Core models

| Model | Purpose | Fields that matter |
|---|---|---|
| `User` | GitHub identity | `githubId`, `login`, `avatarUrl` |
| `Installation` | GitHub App install | `githubInstallationId` unique, `accountLogin`, `suspendedAt` |
| `Repository` | Connected repo | `fullName`, `defaultBranch`, `language`, `scanEnabled`, `dataLifetimeYears`, `criticality` |
| `ScanProfile` | Rule-pack config | `rulePackIds[]`, `includeGlobs[]`, `excludeGlobs[]`, `maxFileSizeKb` |
| `Scan` | One scan run | `trigger` (INITIAL·PUSH·MANUAL), `status`, `commitSha`, `ref`, `durationMs`, `filesScanned` |
| `ScanLog` | Live log lines | `scanId`, `ts`, `level`, `message` — feeds the drawer's Logs tab |
| `CryptoAsset` | Discovered artefact | `kind`, `primitive`, `keyLengthBits`, `mode`, `curve`, `quantumSafe`, `filePath`, `fingerprint`, `usageCount`, `firstSeenScanId`, `lastSeenScanId` |
| `Finding` | Vulnerability | `code`, `severity`, `remediation`, `status`, `firstSeenAt`, `lastSeenAt` |
| `RiskAssessment` | Scores | `crsfScore`, `cisScore`, `pqcSafetyScore`, `riskCategory`, `moscaX/Y/Z`, `moscaVerdict` |
| `Recommendation` | PQC migration | `fromAlgorithm`, `toAlgorithm`, `standard`, `effort`, `latencyImpact`, `sizeImpact` |
| `Cbom` | Export artefact | `scanId`, `spec`, `json` |
| `WebhookDelivery` | Idempotency | `deliveryId` unique, `event`, `processedAt` |
| `Job` | DB-backed queue | `type`, `payload`, `status`, `attempts`, `runAfter`, `lockedBy` |

### The one index that makes re-scans work

`@@unique([repositoryId, fingerprint])` on `CryptoAsset`. A fingerprint is a stable hash over rule ID, canonical algorithm name, parameters and file path. On every re-scan you `upsert` against it: unchanged artefacts get `lastSeenScanId` bumped and `usageCount` recomputed instead of being duplicated.

This single constraint is what produces the *Dependencies*, *Usage Count* and *Last Seen* columns, and what makes the "what changed since last push" diff a two-line query.

### Also in this phase

- A typed data-access layer in `src/server/db/` — one function per screen (`getInventoryPage`, `getVulnerabilityPage`, `getDashboardAggregates`). UI never imports Prisma directly, so query tuning never touches a component.
- A seed script that reproduces the reference numbers — 60 assets, 50 classified, 40 high-risk, 15 recent — so the app demos with depth before a single scan runs.
- Swap every fixture import for its data-access call. The interfaces already match.

### Definition of done

- [ ] `prisma migrate dev` applies cleanly against a fresh Neon branch
- [ ] `prisma db seed` populates and every screen renders database rows, unchanged in layout
- [ ] Pagination, sorting and search execute in SQL, not in JavaScript over a full table read

---

## Phase 3 — GitHub App, webhooks and scan orchestration

> **The CI/CD loop — connect, scan, push, re-scan**
> *Depends on Phase 2 schema*

This phase delivers the feature as stated: connect GitHub, grant access to a repository, run an initial scan, then re-run on every push. Build it with a no-op scanner that writes plausible rows, so the loop is provably working before Phase 4 makes it real.

### App registration

| | |
|---|---|
| **Permissions** | `Contents: Read`, `Metadata: Read`, and `Checks: Write` if you want the scan verdict posted back onto the commit |
| **Events** | `push`, `installation`, `installation_repositories` |
| **URLs** | Setup URL `/api/github/setup`, Callback `/api/github/callback`, Webhook `/api/github/webhook` |
| **Secrets** | `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`, `GITHUB_CLIENT_ID/SECRET`, `SESSION_SECRET` |

### The loop, end to end

1. **Login.** The App's own user-identity OAuth flow. Exchange the code, mint a signed JWT with `jose`, set it as an `httpOnly`, `SameSite=Lax` cookie. No auth library.
2. **Install.** *Connect GitHub* redirects to `github.com/apps/<slug>/installations/new`. The user picks repositories on GitHub's own screen — that *is* the repo picker, and it is where the access grant belongs.
3. **Setup callback.** GitHub returns with `installation_id`. Mint an installation token, list accessible repositories, persist `Installation` and `Repository` rows, and enqueue one `INITIAL` scan job per repository.
4. **Push webhook.** Verify `X-Hub-Signature-256`, dedupe on `X-GitHub-Delivery`, enqueue a `PUSH` scan, return `202` immediately.
5. **Worker.** Claims a job, mints a fresh installation token, streams the repository tarball to a temp directory, runs the engine, writes results, cleans up, marks the scan complete.
6. **Live UI.** An SSE endpoint pushes status so the Scans table ticks Running → Completed without a refresh, exactly as the reference implies.

### ⚠ The four things that break here

- **Raw body for signature verification.** In App Router you must call `await req.text()` and verify the HMAC against that exact string *before* parsing JSON. Re-serialising the parsed object produces different bytes and every signature check fails. Also set `export const runtime = "nodejs"` on the webhook route.
- **Local delivery.** GitHub cannot reach `localhost`. Run `cloudflared tunnel` or ngrok and set the webhook URL to the tunnel host. Budget time for this — it is the single most common demo-day failure.
- **Redelivery.** GitHub retries on non-2xx and operators can replay by hand. Without the `WebhookDelivery` unique constraint on `deliveryId` you get duplicate scans on the same commit.
- **Token lifetime.** Installation tokens expire after one hour. Mint per job, never cache across jobs, and never persist one unencrypted.

### Worker design — no Redis, no external queue

A `Job` table plus `SELECT … FOR UPDATE SKIP LOCKED` gives correct at-least-once claiming with nothing to install, and stays correct if you later run two instances. Start the poller once from `instrumentation.ts`'s `register()` hook; bound concurrency with `p-limit` at 2.

```ts
// src/server/jobs/worker.ts  (shape)
const claim = await prisma.$queryRaw`
  UPDATE "Job" SET status='RUNNING', "lockedBy"=${workerId}, "lockedAt"=now()
  WHERE id = (
    SELECT id FROM "Job"
    WHERE status='QUEUED' AND "runAfter" <= now()
    ORDER BY "runAfter" ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  ) RETURNING *`;
```

### Fetching the code

Use `GET /repos/{owner}/{repo}/tarball/{ref}` streamed through `tar-stream` into a temp directory. It is faster than a clone, needs no `git` binary on the host, and gives you exactly the tree at the pushed commit. Reach for `simple-git` only if you later want history or blame — the initial scan does not.

### Definition of done

- [ ] Installing the App on a repository makes a repository card appear and auto-starts a scan
- [ ] `git push` to that repository produces a new scan row within seconds, which runs to Completed
- [ ] Replaying a webhook delivery from GitHub's UI creates no duplicate scan
- [ ] Revoking the installation disables the repository without orphaning history
- [ ] Scan logs stream into the drawer's Logs tab while the scan runs

---

## Phase 4 — Discovery engine and risk analytics

> **Detectors · normalisation · CRSF · Mosca · CBOM**
> *Depends on Phase 3 delivering a checked-out tree*

The substance of the submission. Everything the evaluator scores — artefact catalogue, quantum risk, classification, recommendations — is produced here.

### 4a · Detector families

| Family | Inputs | What it emits |
|---|---|---|
| **Call sites** | JS/TS `createCipheriv`, `createHash`, `subtle.*`, JWT `alg` · Java `Cipher.getInstance("DES/ECB/…")`, `MessageDigest`, `SecureRandom("SHA1PRNG")` · Python `hashlib.md5`, `Crypto.Cipher.DES3`, `ssl.PROTOCOL_*` · Go `crypto/*`, `tls.Config` · C `EVP_*`, `mbedtls_*` · C# `SHA1Managed` | Algorithm artefacts with primitive, mode, padding, key length, file path and line |
| **Manifests** | `package.json`, `requirements.txt`, `pom.xml`, `build.gradle`, `go.mod`, `Cargo.toml`, `*.csproj` and lockfiles | Library artefacts with resolved version, matched against a curated crypto-library table (OpenSSL, BouncyCastle, libsodium, mbedTLS, PyCryptodome, node-forge, CIRCL) |
| **Certificates** | `*.pem .crt .cer .der .p12 .jks` parsed with `@peculiar/x509` | Signature algorithm, public-key algorithm and size, validity window, issuer, SAN — plus an expiry finding class of its own |
| **Keys** | PKCS#1/#8 and OpenSSH keys via `node-forge` | Key artefacts with algorithm, size, curve, and whether the private half is committed |
| **Protocol config** | `nginx.conf` `ssl_protocols`/`ssl_ciphers`, Apache `SSLCipherSuite`, `sshd_config` `KexAlgorithms`/`Ciphers`/`MACs`, `openssl.cnf`, Terraform `ssl_policy` and `aws_kms_key`, k8s TLS secrets | Protocol and cipher-suite artefacts — the source of the reference report's Strong/Weak KEX, Cipher and MAC summary |
| **Secrets** | PEM headers, high-entropy literals, 16/24/32-byte base64 assigned to key-shaped identifiers, cloud key formats | Secret artefacts, gated on Shannon entropy to hold false positives down |

Rules are typed objects, not scattered regexes — `{ id, pack, languages, filePatterns, match, extract, severity, cweId, nistRef }` — so a rule pack is data the Profiles screen can toggle, and every finding can name the rule that produced it.

### 4b · Normalisation

Every hit is canonicalised into the CBOM vocabulary before it touches the database: `primitive`, `parameterSetIdentifier`, `mode`, `padding`, `curve`, `classicalSecurityLevel`, `nistQuantumSecurityLevel`, `cryptoFunctions[]`, `executionEnvironment`.

Do this once, centrally. If normalisation lives in the detectors, the inventory table fills with `AES256`, `aes-256-gcm` and `AES_256_GCM` as three separate artefacts.

### 4c · Scoring

| Score | Definition |
|---|---|
| **CRSF 0–100** | Weighted over algorithm strength (quantum-vulnerable asymmetric dominates), key length against the NIST SP 800-57 floor, deprecation status, exposure, usage count and the repository's data classification. Drives the inventory bar. |
| **CIS** | Conformance against NIST SP 800-131A Rev 3 transitions. Shown in the drawer with a written explanation on its own tab — the reference has a *CIS Explanation* tab, and an evaluator will open it. |
| **PQC safety 0–10** | Per artefact and rolled up per repository. Renders as the coloured chip and the CBOM report donut. |
| **Quantum readiness 0–10** | Organisation-wide roll-up. The dashboard gauge. |

#### Mosca's inequality — give it a first-class card

The problem statement names it explicitly, so surface the arithmetic rather than a verdict alone.

```
X (data lifetime) + Y (migration time) > Z (time to CRQC)  ⟹  act now
```

- **X** — per-repository `dataLifetimeYears`, set on the repository settings panel, defaulting by criticality.
- **Y** — estimated from quantum-vulnerable artefact count weighted by migration complexity per artefact class.
- **Z** — configurable CRQC arrival estimate, default 2033, exposed in Settings so the assumption is auditable.

Render as a three-segment horizontal timeline with the verdict as a pill. It reads instantly and it is defensible.

#### Recommendations

| Current | Recommended | Standard | Latency | Effort |
|---|---|---|---|---|
| `RSA-2048` key exchange | `ML-KEM-768` | FIPS 203 | Comparable | Medium |
| `X25519` TLS KEX | `X25519MLKEM768` hybrid | FIPS 203 + RFC | +1 RTT payload | Low |
| `ECDSA-P256` signatures | `ML-DSA-65` | FIPS 204 | Larger signatures | Medium |
| `RSA-PSS` firmware signing | `SLH-DSA-SHA2-128s` | FIPS 205 | Slow sign, fast verify | High |
| `3DES-CBC` | `AES-256-GCM` | SP 800-38D | Faster | Low |
| `SHA-1` / `MD5` | `SHA-256` / `SHA3-256` | FIPS 180-4 / 202 | Comparable | Low |

### 4d · CBOM export

Emit CycloneDX 1.6 with `cryptographic-asset` components and a real `dependencies` graph, validate against the published schema in a test, and wire it to *Download CBOM*. A CBOM that fails schema validation is worse than none.

### Definition of done

- [ ] Scanning the legacy banking demo repository yields ≥40 artefacts and ≥8 findings across at least four detector families
- [ ] The inventory drawer for `3DES` matches the reference field for field
- [ ] Exported CBOM validates against the CycloneDX 1.6 schema
- [ ] The PQC-ready demo repository scores ≥8/10 while the legacy one scores ≤3/10 — the contrast is the demo
- [ ] A second scan of an unchanged commit creates zero duplicate artefacts

---

## Phase 5 — Live surfaces, demo repositories and hardening

> **Aggregates · exports · the change diff · runbook**
> *Depends on Phase 4 producing real artefacts*

### Dashboard wired to real aggregates

- **Quantum Readiness** gauge, **Cryptographic Assets** count, **Repositories Scanned**, **Vulnerable Assets %**, **High Risk Assets** — the five KPI tiles.
- **By artefact source** stacked bar, severity-segmented.
- **Cryptographic Posture** donut — High / Medium / Low / Compliant.
- **Asset By Type** horizontal bars, plus the symmetric and asymmetric key-distribution donuts.
- Source Type and Last Discovered filters driving every chart from one query.

### The feature that sells the CI/CD story

A **change diff per push**: artefacts and findings introduced, resolved and unchanged since the previous scan of the same repository. The `[repositoryId, fingerprint]` constraint from Phase 2 makes it a two-line query, and it is the one screen that proves this is continuous discovery rather than a one-shot report.

Pair it with an optional GitHub Check Run posting the verdict onto the commit — pushing a weak cipher and watching the check go red is the strongest thirty seconds of any demo.

### Reports and exports

- CBOM Report page with asset and process selectors matching the reference, Download CBOM and Download PDF.
- Findings CSV, and a JSON inventory export for offline review.

### Hardening

- Encrypt installation tokens at rest; never log them.
- Rate-limit the webhook route; cap scan wall clock and artefact count per scan.
- Guarantee temp-directory cleanup in a `finally` block — a failed scan must not leak a checkout.
- Structured JSON logging keyed by `scanId`; React error boundaries per route segment.
- CI running `tsc --noEmit`, `eslint`, `next build` and the CBOM schema test.

### Definition of done

- [ ] Every dashboard number traces to a query, with no fixture left in the tree
- [ ] All six demo repositories scan clean and produce distinguishable risk profiles
- [ ] Pushing a weak cipher to a connected repository moves the dashboard within one minute
- [ ] A written runbook takes a cold machine to a live demo in under ten minutes

---

## 4. Demo repositories

Generated under `demo-repos/` as complete, plausible projects — real file trees, real dependency manifests, real config, code that would compile. Planted artefacts are load-bearing parts of each application, never a file of samples. You push each to GitHub yourself and connect them through the App.

| Repository | Stack | Planted artefacts | Expected profile |
|---|---|---|---|
| `ecdat-demo-payments-api` | Node · TypeScript · Express | JWT `RS256`, `aes-256-cbc` card-token cipher, `md5` idempotency keys, bcrypt cost 8, RSA-2048 keypair, TLS server cert, `node-forge` and `jsonwebtoken` in the manifest | **High** — mixed-strength, realistic |
| `ecdat-demo-banking-core` | Java 8 · Spring Boot · Maven | `Cipher.getInstance("DES/ECB/PKCS5Padding")`, `MessageDigest.getInstance("MD5")`, `SecureRandom("SHA1PRNG")`, a JKS keystore, hardcoded key constant, BouncyCastle 1.46 | **Critical** — the worst-case repo |
| `ecdat-demo-iot-firmware` | C · mbedTLS · CMake | RSA-1024 device identity, hand-rolled XOR obfuscation, hardcoded AES-128 key, `MBEDTLS_SSL_MINOR_VERSION_1`, SHA-1 firmware manifest | **Critical** — long data lifetime, Mosca fails hard |
| `ecdat-demo-ml-platform` | Python · FastAPI · Poetry | `hashlib.md5` cache keys, `DES3` via PyCryptodome, `ssl.PROTOCOL_TLSv1`, `verify=False`, Fernet, a Paramiko host key | **High** — broad language coverage |
| `ecdat-demo-pqc-gateway` | Go 1.22 · CIRCL | `X25519MLKEM768` hybrid KEX, Ed25519 signing, TLS 1.3 floor, AES-256-GCM, ML-KEM-768 via `cloudflare/circl` | **Compliant** — the contrast case |
| `ecdat-demo-platform-infra` | Terraform · nginx · k8s | `ssl_protocols TLSv1 TLSv1.1`, weak `ssl_ciphers`, an expiring cert, `sshd_config` with `diffie-hellman-group1-sha1`, KMS aliases, a workflow signing step | **Moderate** — config-only, no source code |

Each ships a `README.md` explaining the scenario, and the set is accompanied by `push-all.ps1` plus `push-all.sh` that create and push all six in one pass. Every planted weakness is documented in `EXPECTED_FINDINGS.md` alongside the rule ID that should catch it — that file doubles as the engine's regression fixture.

### ⚠ Keep them clearly marked

These repositories deliberately contain weak cryptography and dummy key material. Every README opens with a notice that the repository is a scanner test fixture, keys are non-functional throwaways, and nothing in it should be reused. Make them public only if you are comfortable with that label being visible.

---

## 5. Risk register and sequencing

| Risk | Impact | Mitigation |
|---|---|---|
| Webhook cannot reach a local machine on demo day | **Critical** | Tunnel configured and tested in Phase 3, not Phase 5. Keep a manual *Rescan* button as the fallback path, and rehearse on it once. |
| Prisma 7/8 version split reappears after a dependency bump | **High** | Exact pins, committed lockfile, `npm ls --all` in CI. |
| Detector false positives flood the inventory | **High** | Entropy gates on secrets, confidence scores on every rule, and `EXPECTED_FINDINGS.md` as a precision regression suite. |
| Visual drift from the reference as real data arrives | **Moderate** | Phase 1 freezes the components; later phases change data sources only. Re-run the side-by-side comparison at the end of each phase. |
| Scan time on a large repository | **Moderate** | File-size cap, extension allowlist, streaming line reader, per-scan wall-clock ceiling. Demo repositories are deliberately small. |
| Tailwind v4 guidance mismatch | **Low** | Ignore every v3-era tutorial. No config file, no autoprefixer, no `tailwindcss-animate`. |

### Sequencing note

Phases 1 and 2 can overlap once the fixture interfaces are agreed — one person on components, one on schema.

Phases 3 and 4 **must not**: the engine needs a real checkout to develop against, and debugging webhook delivery and regex precision in the same afternoon is how a week disappears.

If time compresses, cut breadth in Phase 4 — fewer detector families, fully finished — before cutting anything in Phase 3, because the CI/CD loop is the stated feature and the discovery depth is what fills it.
