const BASE = "http://localhost:3000";
const REPO_ID = "cmuje2oyl0000fwla6xebobck"; // existing AWS repo

async function main() {
  // Login
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "ecdat2024" }),
  });
  const cookie = loginRes.headers.get("set-cookie").split(";")[0];
  console.log("✅ Logged in");

  // Trigger scan
  const scanRes = await fetch(`${BASE}/api/repositories/${REPO_ID}/scan`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  const { scanId } = await scanRes.json();
  console.log(`✅ Scan queued: ${scanId}\n⏳ Polling…\n`);

  // Poll
  let lastLogCount = 0;
  const start = Date.now();
  while (Date.now() - start < 180_000) {
    await new Promise(r => setTimeout(r, 3000));
    const r = await fetch(`${BASE}/api/scans/${scanId}`, { headers: { Cookie: cookie } });
    const scan = await r.json();
    for (const log of (scan.logs ?? []).slice(lastLogCount)) {
      console.log(`  [${log.level}] ${log.message}`);
    }
    lastLogCount = scan.logs?.length ?? 0;
    if (scan.status === "COMPLETED") { console.log("\n✅ Scan complete!"); break; }
    if (scan.status === "FAILED") { console.log(`\n❌ Failed: ${scan.errorMessage}`); break; }
  }

  // Print assets
  const assetsRes = await fetch(`${BASE}/api/assets?repositoryId=${REPO_ID}&pageSize=100`, { headers: { Cookie: cookie } });
  const assets = await assetsRes.json();
  if (assets?.items?.length) {
    console.log(`\n🔐 ${assets.items.length} crypto asset(s) found:\n`);
    for (const a of assets.items) {
      const qs = a.quantumSafe === false ? "❌ not quantum-safe" : "✅ quantum-safe";
      console.log(`  [${a.kind.padEnd(11)}] ${a.name.padEnd(50)} ${qs}`);
      console.log(`               ${a.filePath}`);
    }
  } else {
    console.log("\nℹ️  No assets returned.");
  }
}
main().catch(e => { console.error("❌", e.message); process.exit(1); });
