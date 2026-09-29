const BASE = "http://localhost:3000";

async function main() {
  // Login
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "ecdat2024" }),
  });
  const cookie = loginRes.headers.get("set-cookie").split(";")[0];
  console.log("✅ Logged in");

  // Register ECDAT repo
  console.log("Registering local ECDAT repo...");
  const regRes = await fetch(`${BASE}/api/repositories`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      fullName: "local/ecdat-atlas",
      sourceType: "GITHUB",
      cloneUrl: "https://github.com/adithyanotfound/ECDAT.git"
    }),
  });
  
  let repoId;
  if (regRes.status === 409) {
    // Already exists
    const reposRes = await fetch(`${BASE}/api/repositories`, { headers: { Cookie: cookie } });
    const repos = await reposRes.json();
    repoId = repos.items.find((r) => r.fullName === "local/ecdat-atlas")?.id;
    console.log("Repo already registered:", repoId);
  } else {
    const data = await regRes.json();
    repoId = data.id;
    console.log("Registered:", repoId);
  }

  if (!repoId) throw new Error("Could not get repo ID");

  // Trigger scan
  console.log("Triggering scan...");
  const scanRes = await fetch(`${BASE}/api/repositories/${repoId}/scan`, {
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
}
main().catch(e => { console.error("❌", e.message); process.exit(1); });
