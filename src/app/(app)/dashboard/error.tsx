"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  return <ErrorState error={error} reset={reset} title="Dashboard failed to load" />;
}
