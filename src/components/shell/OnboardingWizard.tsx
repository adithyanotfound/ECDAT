"use client";

import { useState, useEffect } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

const GITHUB_APP_SLUG = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG ?? "ecdat-atlas";

export function OnboardingWizard() {
  const [hasRepos, setHasRepos] = useState<boolean | null>(null);
  const router = useRouter();

  const checkRepos = async () => {
    try {
      const res = await fetch("/api/repositories");
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setHasRepos(true);
      } else {
        setHasRepos(false);
      }
    } catch {
      setHasRepos(false);
    }
  };

  useEffect(() => {
    checkRepos();
    // Poll every 3 seconds to auto-detect when a repo is added via GitHub webhook
    const interval = setInterval(() => {
      if (!hasRepos) checkRepos();
    }, 3000);
    return () => clearInterval(interval);
  }, [hasRepos]);

  // If we haven't loaded yet, or if they already have repos, don't show the blocking wizard
  if (hasRepos === null || hasRepos === true) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div 
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center text-center border border-gray-200"
        style={{ color: "#1A1F36" }}
      >
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
        </div>
        
        <h2 className="text-2xl font-bold mb-2">Connect a Repository</h2>
        <p className="text-gray-500 mb-8 text-sm leading-relaxed">
          To get started with ECDAT Atlas, you need to connect at least one GitHub repository. We will automatically scan it for cryptographic assets.
        </p>

        <a
          href={`https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95 mb-6"
        >
          <ExternalLink size={18} />
          Install GitHub App
        </a>

        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 size={14} className="animate-spin" />
          Waiting for repository connection...
        </div>
      </div>
    </div>
  );
}
