"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

export default function ReportsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[reports]", error);
  }, [error]);

  return <ErrorState error={error} reset={reset} title="Reports page failed to load" />;
}
