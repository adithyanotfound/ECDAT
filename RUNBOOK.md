# Runbook — cold machine to a live demo

Target: under 10 minutes, assuming Node 20+, `git`, and a GitHub account are
already on the machine. Steps that only need doing once (GitHub App
registration, Neon project) are marked **[one-time]** — skip them on a
machine that's already set up.

## 1. Clone and install (1 min)

```bash
git clone <this-repo-url> ecdat-atlas && cd ecdat-atlas
npm ci
```

## 2. Database — Neon Postgres (2 min) **[one-time setup, then reuse]**

1. Create a project at [neon.tech](https://neon.tech) (free tier is enough).
2. Copy the **pooled** connection string (host contains `-pooler`) → this is
   `DATABASE_URL`.
3. Copy the **direct** connection string (no `-pooler`) → this is
   `DIRECT_URL`. Prisma CLI operations (`migrate`, `db seed`) need it;
   the running app only ever uses the pooled `DATABASE_URL`.

## 3. GitHub App (3 min) **[one-time setup, then reuse]**

1. GitHub → Settings → Developer settings → GitHub Apps → **New GitHub App**.
2. Homepage URL: your tunnel URL from step 5 (placeholder is fine for now,
   update after the tunnel is up).
3. Callback URL: `<APP_URL>/api/github/callback`
4. Setup URL: `<APP_URL>/api/github/setup` (redirect on update, required)
5. Webhook URL: `<APP_URL>/api/github/webhook`, generate and save a webhook
   secret.
6. Permissions: **Contents: Read**, **Metadata: Read**, **Checks: Write**.
7. Subscribe to events: **Push**, **Installation**, **Installation
   repositories**.
8. Request user-identity **OAuth** during installation (for login) — note
   the Client ID and generate a Client Secret.
9. Generate and download a **private key** (PEM).
10. Note the **App ID** and the **App slug** (from the app's public URL,
    `github.com/apps/<slug>`).

## 4. Environment (1 min)

Create `.env.local`:

```bash
DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require"
DIRECT_URL="postgresql://.../neondb?sslmode=require"

GITHUB_APP_ID="123456"
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
GITHUB_CLIENT_ID="Iv1.xxxxxxxxxxxx"
GITHUB_CLIENT_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
GITHUB_WEBHOOK_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

SESSION_SECRET="<32+ random characters — `openssl rand -hex 32`>"

NEXT_PUBLIC_APP_URL="https://<your-tunnel-subdomain>.trycloudflare.com"
NEXT_PUBLIC_GITHUB_APP_SLUG="<your-app-slug>"
```

`GITHUB_APP_PRIVATE_KEY`: paste the PEM with literal `\n` for newlines (one
line in the `.env` file).

## 5. Migrate, seed, and start the tunnel (2 min)

```bash
npx prisma migrate deploy   # or: npm run db:migrate on a fresh Neon branch
npm run db:seed             # optional — populates demo numbers without a real scan
npm run dev
```

In a second terminal, start a tunnel and point the GitHub App's URLs at it
(update Homepage/Callback/Setup/Webhook URLs in the App settings to match):

```bash
cloudflared tunnel --url http://localhost:3000
# or: ngrok http 3000
```

> ⚠️ **This is the #1 demo-day failure mode** (IMPLEMENTATION_PLAN.md §5
> risk register). Start the tunnel and update the App's URLs *before* the
> demo, not during it. Rehearse the manual **Rescan** button on the
> Repositories page as your fallback if the webhook doesn't fire live.

## 6. The demo itself

1. Open `<tunnel-url>`, log in with GitHub.
2. Scanning → Repositories → **Connect GitHub** → install the App on one or
   more of the six repositories in `demo-repos/` (push them first — see
   `demo-repos/README.md` and `push-all.sh`/`push-all.ps1`).
3. Watch the repository card appear and the initial scan run to Completed
   (Scans page, click **Logs** for the live SSE stream).
4. Open Assets → PQC, click a row (e.g. `3DES` or `DES`) to show the
   detail drawer — CBOM fields, CIS explanation tab.
5. **The 30-second moment**: edit a connected repository (e.g. add an MD5
   call in `ecdat-demo-payments-api`), `git push`. Watch a new scan appear
   within seconds and, if Checks: Write is enabled, the commit's check run
   go red. Open the scan's **Changes** tab to show the diff since the
   previous scan.
6. Dashboard → point at the Quantum Readiness gauge and the Mosca card on a
   long-lifetime repository (`ecdat-demo-iot-firmware`, `dataLifetimeYears`
   set high) to show `moscaVerdict = ACT_NOW`.
7. Assets → PQC → CBOM Report → pick a scanned repository → **Download
   CBOM** for the CycloneDX 1.6 export.

## Troubleshooting

- **Webhook returns 403**: signature mismatch — check `GITHUB_WEBHOOK_SECRET`
  matches the App settings exactly, and that the tunnel URL in the App's
  webhook URL is current (tunnels rotate subdomains on restart unless
  reserved).
- **Scan stuck at Queued**: the worker polls every 3s from
  `instrumentation.ts`; confirm the dev server process is actually running
  (`npm run dev`, not just `next build`) and check its console for
  `[worker] starting`.
- **`next build` fails locally**: it must succeed with *no* `DATABASE_URL`
  set (CI runs it that way) — if it doesn't, something now imports
  `src/server/db/client.ts` eagerly instead of behind the lazy Proxy.
