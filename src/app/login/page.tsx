"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, Shield, Eye, EyeOff, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed. Please check your credentials.");
        return;
      }

      // Redirect to dashboard on success
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #EEF2FF 0%, #F0F2F7 50%, #E8F0FE 100%)",
      }}
    >
      {/* Background decoration */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        <div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #2F5BFF 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #8B5CF6 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            backgroundColor: "#FFFFFF",
            boxShadow: "0 20px 60px rgba(47,91,255,0.12), 0 4px 16px rgba(0,0,0,0.06)",
            border: "1px solid rgba(216,220,232,0.6)",
          }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #2F5BFF 0%, #6B8FFF 100%)",
                boxShadow: "0 8px 24px rgba(47,91,255,0.3)",
              }}
            >
              <Shield size={28} color="white" />
            </div>
            <div className="text-center">
              <h1
                className="text-2xl font-bold tracking-tight"
                style={{ color: "#1A1F36" }}
              >
                ECDAT Atlas
              </h1>
              <p className="text-sm mt-1" style={{ color: "#5A6480" }}>
                Enterprise Cryptographic Discovery Platform
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" id="login-form">
            {/* Error message */}
            {error && (
              <div
                className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
                style={{
                  backgroundColor: "rgba(255,43,68,0.08)",
                  border: "1px solid rgba(255,43,68,0.2)",
                  color: "#FF2B44",
                }}
                role="alert"
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="username"
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "#5A6480" }}
              >
                Username
              </label>
              <div
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  border: `1px solid ${error ? "rgba(255,43,68,0.3)" : "#D8DCE8"}`,
                  backgroundColor: "#F8F9FD",
                  transition: "border-color 0.15s",
                }}
              >
                <User size={15} style={{ color: "#9AA2BA", flexShrink: 0 }} />
                <input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: "#1A1F36" }}
                  onFocus={(e) => {
                    const parent = e.target.parentElement!;
                    parent.style.borderColor = "#2F5BFF";
                    parent.style.backgroundColor = "#FFFFFF";
                  }}
                  onBlur={(e) => {
                    const parent = e.target.parentElement!;
                    parent.style.borderColor = "#D8DCE8";
                    parent.style.backgroundColor = "#F8F9FD";
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "#5A6480" }}
              >
                Password
              </label>
              <div
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  border: "1px solid #D8DCE8",
                  backgroundColor: "#F8F9FD",
                  transition: "border-color 0.15s",
                }}
              >
                <Lock size={15} style={{ color: "#9AA2BA", flexShrink: 0 }} />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: "#1A1F36" }}
                  onFocus={(e) => {
                    const parent = e.target.parentElement!;
                    parent.style.borderColor = "#2F5BFF";
                    parent.style.backgroundColor = "#FFFFFF";
                  }}
                  onBlur={(e) => {
                    const parent = e.target.parentElement!;
                    parent.style.borderColor = "#D8DCE8";
                    parent.style.backgroundColor = "#F8F9FD";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{ color: "#9AA2BA" }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading || !username || !password}
              className="w-full py-3.5 rounded-xl text-sm font-semibold mt-2"
              style={{
                background: loading || !username || !password
                  ? "#D8DCE8"
                  : "linear-gradient(135deg, #2F5BFF 0%, #4B75FF 100%)",
                color: loading || !username || !password ? "#9AA2BA" : "#FFFFFF",
                border: "none",
                cursor: loading || !username || !password ? "not-allowed" : "pointer",
                boxShadow: loading || !username || !password
                  ? "none"
                  : "0 4px 16px rgba(47,91,255,0.3)",
                transition: "all 0.15s",
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                    style={{ display: "inline-block" }}
                  />
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div
            className="mt-6 pt-5 text-center text-xs"
            style={{
              borderTop: "1px solid #EEF0F7",
              color: "#9AA2BA",
            }}
          >
            <p className="mb-2">Don't have an account? Use the demo credentials:</p>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setUsername("admin");
                  setPassword("ecdat2024");
                }}
                className="px-3 py-1.5 rounded-md font-mono text-xs cursor-pointer hover:bg-gray-100 transition-colors"
                style={{ border: "1px dashed #D8DCE8", color: "#1A1F36" }}
              >
                admin / ecdat2024
              </button>
            </div>
          </div>
        </div>

        {/* Version badge */}
        <p
          className="text-center text-xs mt-4"
          style={{ color: "#9AA2BA" }}
        >
          ECDAT Atlas v1.0 · NTRO Internal Use Only
        </p>
      </div>
    </div>
  );
}
