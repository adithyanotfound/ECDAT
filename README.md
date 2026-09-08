# ECDAT Atlas

Enterprise Cryptographic Discovery & Analysis Tool — a Next.js monolith that
discovers cryptographic assets in connected GitHub repositories (scanned on
connect and on every push), classifies them, scores quantum risk, and
recommends PQC migrations.

See [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) for the full design
(scope, schema, detector rule packs, scoring formulas, CBOM mapping) and
[`RUNBOOK.md`](./RUNBOOK.md) for cold-machine-to-live-demo setup.

## Stack

Next.js 16 (App Router) · Neon Postgres + Prisma 7 · GitHub App +
webhooks · custom TypeScript detector rule packs · CycloneDX 1.6 CBOM export.

## Layout

```
src/
  app/                 routes (dashboard, scanning, assets, reports)
  components/          shell, UI primitives, charts
  server/
    db/                data-access layer — UI never imports Prisma directly
    engine/            the discovery engine (Phase 4)
      detectors/       rule packs: call-sites, manifests, certs, keys, protocols, secrets
      scan.ts          orchestrator — fast-glob + rule dispatch + caps
      normalize.ts      canonical algorithm table
      scoring.ts       CRSF / CIS / PQC safety / Mosca
      cbom.ts          CycloneDX 1.6 export + structural validator
    github/            GitHub App auth, webhook verification, tarball checkout, Check Runs
    jobs/              DB-backed job queue + worker + scanner
    security/          rate limiting
  fixtures/            typed fixtures Phase 1 built against — still the offline fallback
prisma/                schema, migrations, seed
demo-repos/            six planted-vulnerability repos for exercising the engine end to end
scripts/               validate-cbom.ts (CI), scan-demo-repos.ts (ad-hoc engine check)
```

## Local development

```bash
npm ci
cp .env.example .env.local   # fill in DATABASE_URL, GitHub App credentials — see RUNBOOK.md
npx prisma migrate deploy
npm run db:seed              # optional — fills the UI with representative numbers, no live scan needed
npm run dev
```

`next build`, `npx tsc --noEmit` and `npx eslint .` all succeed with **no**
`DATABASE_URL` set — every server-side data call is either behind a
try/catch fixture fallback or the lazy Prisma client Proxy in
`src/server/db/client.ts`. This is enforced in `.github/workflows/ci.yml`.

## The discovery engine

`npm run test:cbom` runs the real engine over a small synthetic fixture tree
and validates the resulting CBOM — no database required. For a broader
sanity check across all six demo repositories:

```bash
npx tsx scripts/scan-demo-repos.ts
```

## Demo repositories

`demo-repos/` holds six complete, plausible small projects (Node/TS, Java,
C, Python, Go, Terraform) with deliberately planted cryptographic
weaknesses — see `demo-repos/README.md`. Push them to GitHub with
`demo-repos/push-all.sh` (or `.ps1`) and connect them through the app's
GitHub integration to see the full connect → scan → push → re-scan loop.
