"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

export default function AssetsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[assets]", error);
  }, [error]);

  return <ErrorState error={error} reset={reset} title="Assets page failed to load" />;
}
