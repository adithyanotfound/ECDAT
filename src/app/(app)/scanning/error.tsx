"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

export default function ScanningError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[scanning]", error);
  }, [error]);

  return <ErrorState error={error} reset={reset} title="Scanning page failed to load" />;
}
