"use client";

import { useEffect } from "react";

/**
 * Root-level error boundary — catches failures in the root layout itself
 * (theme script, providers) that a segment-level error.tsx can't reach.
 * Must render its own <html lang="en">/<body>; it replaces the whole tree on error.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global]", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f6f4ef", color: "#1d1f23", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: 16, textAlign: "center", padding: 24 }}>
          <p style={{ fontSize: 18, fontWeight: 600 }}>Vajra couldn&apos;t load</p>
          <p style={{ fontSize: 14, color: "#676b72", maxWidth: 480 }}>{error.message || "Something went wrong while starting. Nothing was changed; try again."}</p>
          <button
            onClick={reset}
            style={{ padding: "10px 20px", borderRadius: 8, background: "#1f2126", color: "#fff", border: "none", fontSize: 14, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
