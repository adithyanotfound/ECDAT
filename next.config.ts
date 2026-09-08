import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // External packages that should not be bundled (use native binaries)
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
};

export default nextConfig;
