import "dotenv/config";
import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Restoring default scan profiles...");

  const existingProfiles = await prisma.scanProfile.count();
  if (existingProfiles > 0) {
    console.log("Profiles already exist, skipping.");
    return;
  }

  await prisma.scanProfile.create({
    data: {
      name: "Default Full Scan",
      rulePackIds: ["core", "secrets", "certificates", "keys", "protocols"],
      includeGlobs: ["**/*"],
      excludeGlobs: ["**/node_modules/**", "**/vendor/**", "**/.git/**", "**/dist/**"],
      maxFileSizeKb: 1024,
      isDefault: true,
    },
  });
  await prisma.scanProfile.create({
    data: {
      name: "Deep Scan",
      rulePackIds: ["core", "secrets", "certificates", "keys", "protocols", "dependencies", "iac"],
      includeGlobs: ["**/*"],
      excludeGlobs: ["**/node_modules/**", "**/.git/**"],
      maxFileSizeKb: 5120,
      isDefault: false,
    },
  });
  await prisma.scanProfile.create({
    data: {
      name: "Config-Only Scan",
      rulePackIds: ["protocols", "iac"],
      includeGlobs: ["**/*.conf", "**/*.yaml", "**/*.yml", "**/*.tf", "**/*.toml"],
      excludeGlobs: ["**/node_modules/**", "**/.git/**"],
      maxFileSizeKb: 512,
      isDefault: false,
    },
  });

  console.log("Profiles restored!");
}

main().finally(() => prisma.$disconnect());
