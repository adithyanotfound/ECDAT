// Quick DB check - what data exists for admin user?
import { prisma } from './src/server/db/client';

async function main() {
  const [repos, assets, findings, scans] = await Promise.all([
    prisma.repository.findMany({ where: { owner: 'admin' }, select: { id: true, fullName: true, sourceType: true } }),
    prisma.cryptoAsset.count({ where: { repository: { owner: 'admin' } } }),
    prisma.finding.count({ where: { repository: { owner: 'admin' } } }),
    prisma.scan.count({ where: { status: 'COMPLETED', repository: { owner: 'admin' } } }),
  ]);
  console.log('Repos:', JSON.stringify(repos, null, 2));
  console.log('Total crypto assets:', assets);
  console.log('Total findings:', findings);
  console.log('Completed scans:', scans);

  // Show the actual asset
  if (assets > 0) {
    const a = await prisma.cryptoAsset.findMany({ where: { repository: { owner: 'admin' } }, include: { riskAssessment: true } });
    console.log('Assets:', JSON.stringify(a.map(x => ({ name: x.name, kind: x.kind, quantumSafe: x.quantumSafe, risk: x.riskAssessment?.crsfScore })), null, 2));
  }
  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
