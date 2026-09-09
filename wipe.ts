import "dotenv/config";
import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const i = await prisma.installation.count();
  const r = await prisma.repository.count();
  const logs = await prisma.scanLog.count();
  console.log('Installations:', i, 'Repositories:', r, 'ScanLogs:', logs);
  
  if (r > 0) {
    const repos = await prisma.repository.findMany();
    console.log(repos.map(repo => repo.fullName));
  }
}

main()
  .catch((e) => {
    console.error("Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
