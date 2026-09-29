"use client";

/**
 * Shown instead of empty charts when nothing is connected yet. Three ways in,
 * none of which blocks the rest of the app.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Cloud, PlugZap } from "lucide-react";
import { GithubIcon } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { AddGithubRepoDialog, ConnectAwsDialog } from "./ConnectDialogs";

const APP_SLUG = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG ?? "ecdat-atlas";

export function GettingStarted() {
  const router = useRouter();
  const [dialog, setDialog] = useState<"github" | "aws" | null>(null);
  const added = (_id: string, scanId?: string) =>
    router.push(scanId ? `/scanning/scans?scan=${scanId}` : "/scanning/repositories");

  const options = [
    {
      icon: <GithubIcon size={20} />,
      title: "Scan a public GitHub repository",
      body: "Paste a name like octocat/hello-world. Nothing to install.",
      onClick: () => setDialog("github"),
    },
    {
      icon: <Cloud size={20} />,
      title: "Connect an AWS account",
      body: "Check KMS keys and ACM certificates with a read-only IAM user.",
      onClick: () => setDialog("aws"),
    },
    {
      icon: <PlugZap size={20} />,
      title: "Install the GitHub App",
      body: "For private repositories, and a fresh scan on every push.",
      href: `https://github.com/apps/${APP_SLUG}/installations/new`,
    },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="bg-dots border-b border-line bg-surface-2/50 px-6 py-8 sm:px-8">
        <p className="text-xs font-semibold tracking-[0.14em] text-gold-ink uppercase">Get started</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">Connect something to scan</h2>
        <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-muted">
          ECDAT Atlas looks through code and cloud accounts for algorithms, keys and certificates, then tells you which
          ones a quantum computer could break. Your first results appear a minute or two after connecting.
        </p>
      </div>
      <div className="grid gap-px bg-line sm:grid-cols-3">
        {options.map((o) => {
          const inner = (
            <>
              <span className="flex size-10 items-center justify-center rounded-xl bg-gold-soft text-gold-ink">
                {o.icon}
              </span>
              <span className="mt-4 block text-[15px] font-semibold text-ink">{o.title}</span>
              <span className="mt-1 block text-[13.5px] leading-relaxed text-muted">{o.body}</span>
              <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-gold-ink">
                {o.href ? "Open GitHub" : "Start"}{" "}
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </>
          );
          const cls = "group block bg-surface p-6 text-left transition-colors hover:bg-surface-2/60";
          return o.href ? (
            <a key={o.title} href={o.href} target="_blank" rel="noopener noreferrer" className={cls}>
              {inner}
            </a>
          ) : (
            <button key={o.title} type="button" onClick={o.onClick} className={cls}>
              {inner}
            </button>
          );
        })}
      </div>
      <AddGithubRepoDialog open={dialog === "github"} onClose={() => setDialog(null)} onAdded={added} />
      <ConnectAwsDialog open={dialog === "aws"} onClose={() => setDialog(null)} onAdded={added} />
    </Card>
  );
}
