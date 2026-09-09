import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // External packages that should not be bundled (use native binaries)
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
  allowedDevOrigins: [
    "unmanful-unbalanced-kacey.ngrok-free.dev",
    "*.ngrok-free.dev",
    "*.ngrok.app",
    "*.trycloudflare.com",
  ],
};

export default nextConfig;

