/**
 * Sign-in, with GitHub only. A charcoal panel says what the product does; the
 * right side has the GitHub button. If the server has no GitHub App
 * configured, the page says so instead of sending people to an error.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, FileSearch, ShieldCheck, Timer } from "lucide-react";
import { BrandMark, BrandName } from "@/components/shell/BrandMark";
import { GithubIcon } from "@/components/ui/icons";
import { LatticeField } from "@/components/effects/LatticeField";

export const metadata: Metadata = { title: "Sign in" };

// Reads server settings on each request, so it isn't pre-rendered at build time.
export const dynamic = "force-dynamic";

const POINTS = [
  {
    icon: <FileSearch size={18} />,
    title: "Finds every algorithm, key and certificate",
    body: "In code, dependencies, config files and AWS.",
  },
  {
    icon: <Timer size={18} />,
    title: "Shows what quantum computers will break",
    body: "And how much time you have to move.",
  },
  {
    icon: <ShieldCheck size={18} />,
    title: "Tells you what to replace it with",
    body: "Mapped to the NIST post-quantum standards.",
  },
];

// Messages for the ?error= values the GitHub callback redirects back with.
const GITHUB_ERRORS: Record<string, string> = {
  invalid_state: "The sign-in link expired or was opened in another tab. Try again.",
  token_exchange: "GitHub didn't accept the sign-in. Check the GitHub App's client secret on the server.",
  server_error: "Something went wrong while signing in with GitHub. Try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const githubEnabled = Boolean(process.env.GITHUB_CLIENT_ID);
  const message = error ? (GITHUB_ERRORS[error] ?? "Sign-in didn't work. Try again.") : null;

  return (
    <div className="grid h-dvh overflow-y-auto bg-bg lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-charcoal p-12 text-white lg:flex lg:flex-col">
        <LatticeField
          tone="dark"
          spacing={56}
          packets={6}
          className="[mask-image:radial-gradient(ellipse_90%_80%_at_70%_30%,black_10%,transparent_80%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -bottom-40 size-[560px] rounded-full bg-[radial-gradient(closest-side,rgb(217_174_74/0.22),transparent)]"
        />
        <svg
          aria-hidden="true"
          className="animate-orbit pointer-events-none absolute -top-24 -right-24 size-[460px] text-gold-bright opacity-20"
          viewBox="0 0 200 200"
          fill="none"
        >
          {[40, 60, 80, 98].map((r, i) => (
            <circle
              key={r}
              cx="100"
              cy="100"
              r={r}
              stroke="currentColor"
              strokeWidth="0.8"
              strokeDasharray={i % 2 ? "3 5" : undefined}
            />
          ))}
          <ellipse cx="100" cy="100" rx="36" ry="98" stroke="currentColor" strokeWidth="0.8" />
        </svg>

        <Link href="/" className="relative flex items-center gap-2.5">
          <BrandMark size={34} onDark />
          <BrandName onDark />
        </Link>

        <div className="relative my-auto max-w-md py-16">
          <p className="text-xs font-semibold tracking-[0.14em] text-gold-bright uppercase">Post-quantum readiness</p>
          <h1 className="mt-3 text-4xl leading-[1.1] font-semibold tracking-tight">
            Know which cryptography won&apos;t survive a quantum computer.
          </h1>
          <ul className="mt-10 space-y-6">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-gold-bright">
                  {p.icon}
                </span>
                <span>
                  <span className="block text-[15px] font-medium">{p.title}</span>
                  <span className="block text-[14px] text-on-dark-muted">{p.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[13px] text-white/40">CycloneDX 1.6 CBOM · FIPS 203 and 204 recommendations</p>
      </aside>

      {/* Form */}
      <main className="flex min-h-full flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted hover:text-ink"
          >
            <ArrowLeft size={15} /> Back to the website
          </Link>
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <BrandMark size={28} />
            <BrandName />
          </Link>
        </div>

        <div className="mx-auto my-auto w-full max-w-[400px] py-12">
          <h2 className="text-[28px] font-semibold tracking-tight text-ink">Sign in</h2>
          <p className="mt-1.5 text-[15px] text-muted">
            Use your GitHub account. You&apos;ll see the repositories you&apos;ve connected.
          </p>

          {message && (
            <p
              role="alert"
              className="mt-6 flex gap-2.5 rounded-xl bg-critical-tint px-4 py-3 text-[13.5px] text-critical-ink"
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {message}
            </p>
          )}

          <div className="mt-8">
            {githubEnabled ? (
              <a
                href="/api/github/login"
                className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-charcoal text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-charcoal-2"
              >
                <GithubIcon size={19} /> Continue with GitHub
              </a>
            ) : (
              <div className="rounded-2xl border border-moderate/40 bg-moderate-tint p-5 text-[13.5px] leading-relaxed text-moderate-ink">
                <p className="flex items-center gap-2 font-semibold">
                  <AlertTriangle size={16} /> GitHub sign-in isn&apos;t set up on this server
                </p>
                <p className="mt-1.5">
                  An administrator needs to register a GitHub App and set{" "}
                  <code className="font-mono">GITHUB_CLIENT_ID</code>,{" "}
                  <code className="font-mono">GITHUB_CLIENT_SECRET</code> and the other GitHub values, then restart the
                  server. RUNBOOK.md, section 3, has the steps.
                </p>
              </div>
            )}
            <p className="mt-4 text-center text-xs text-muted">
              ECDAT Atlas only asks GitHub for your public profile and email address.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-faint">
          Access is logged. Only sign in if you&apos;ve been given an account.
        </p>
      </main>
    </div>
  );
}
