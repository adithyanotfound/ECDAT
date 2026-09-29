import "dotenv/config";
import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const deliveries = await prisma.webhookDelivery.findMany({
    orderBy: { processedAt: 'desc' },
    take: 1
  });
  console.dir(deliveries[0]?.payload, { depth: null });
}
main().finally(() => prisma.$disconnect());
