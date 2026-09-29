"use client";

import { useEffect } from "react";

/**
 * Root-level error boundary — catches failures in the root layout itself
 * (theme script, providers) that a segment-level error.tsx can't reach.
 * Must render its own <html>/<body>; it replaces the whole tree on error.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global]", error);
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, background: "#070A12", color: "#E6EAF2", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: 16, textAlign: "center", padding: 24 }}>
          <p style={{ fontSize: 18, fontWeight: 600 }}>ECDAT Atlas failed to start</p>
          <p style={{ fontSize: 14, color: "#8A93A8", maxWidth: 480 }}>{error.message || "An unexpected error occurred."}</p>
          <button
            onClick={reset}
            style={{ padding: "10px 20px", borderRadius: 8, background: "#2F5BFF", color: "#fff", border: "none", fontSize: 14, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
