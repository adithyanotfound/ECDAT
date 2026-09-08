"use client";

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div
        className="flex flex-col items-center gap-8 p-10 rounded-2xl max-w-sm w-full"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black"
            style={{
              background: "linear-gradient(135deg, var(--color-accent), #8B5CF6)",
              color: "#fff",
              boxShadow: "0 8px 24px rgba(47,91,255,0.4)",
            }}
          >
            ⬡
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold" style={{ color: "var(--color-ink)" }}>
              ECDAT Atlas
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--color-ink-muted)" }}>
              Cryptographic Discovery Platform
            </p>
          </div>
        </div>

        {/* Sign in button */}
        <a
          href="/api/github/login"
          className="flex items-center justify-center gap-3 w-full py-3 px-5 rounded-xl font-semibold text-sm"
          style={{
            backgroundColor: "#24292f",
            color: "#fff",
            textDecoration: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <svg height="20" viewBox="0 0 16 16" width="20" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          Continue with GitHub
        </a>

        <p className="text-xs text-center" style={{ color: "var(--color-ink-faint)" }}>
          Requires a GitHub account with access to the ECDAT Atlas App installation.
        </p>
      </div>
    </div>
  );
}
