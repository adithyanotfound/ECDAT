import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // External packages that should not be bundled (use native binaries)
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
  allowedDevOrigins: [
    "unmanful-unbalanced-kacey.ngrok-free.dev",
    "*.ngrok-free.dev",
    "*.ngrok.app",
    "*.ngrok-free.app",
    "*.trycloudflare.com",
  ],
  poweredByHeader: false,
  // Baseline hardening headers on every response.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://github.com",
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
