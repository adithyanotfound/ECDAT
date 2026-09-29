/**
 * Ad-hoc verification: runs the real engine over each demo-repos/* tree and
 * prints artefact/finding counts + families touched, so we can sanity-check
 * against each repo's EXPECTED_FINDINGS.md and IMPLEMENTATION_PLAN.md's
 * Phase 4/5 Definition of Done numbers, with no DB required.
 */
import "reflect-metadata";
import { readdirSync } from "fs";
import { join } from "path";
import { runEngine } from "../src/server/engine/scan";
import { computeCrsf, computePqcSafety, riskCategoryFromCrsf } from "../src/server/engine/scoring";

const DEMO_ROOT = join(__dirname, "..", "demo-repos");

async function main() {
  const dirs = readdirSync(DEMO_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const dir of dirs) {
    const repoRoot = join(DEMO_ROOT, dir);
    const result = await runEngine(dir, repoRoot, {}, () => {});

    const families = new Set(result.hits.map((h) => h.pack));
    let findingsWorthy = 0;
    let critical = 0;
    const pqcScores: number[] = [];

    for (const hit of result.hits) {
      const crsf = computeCrsf(hit, { usageCount: 1, criticality: "HIGH" });
      const cat = riskCategoryFromCrsf(crsf);
      if (hit.severity || cat === "CRITICAL" || cat === "HIGH") findingsWorthy++;
      if (cat === "CRITICAL") critical++;
      // Quantum readiness is scoped to graded primitives, matching
      // src/server/db/dashboard.ts — a LIBRARY or PROTOCOL row isn't itself
      // a graded primitive.
      if (hit.kind === "ALGORITHM" || hit.kind === "CERTIFICATE" || hit.kind === "KEY") {
        pqcScores.push(computePqcSafety(hit));
      }
    }

    const avgPqc = pqcScores.length ? Math.round(pqcScores.reduce((a, b) => a + b, 0) / pqcScores.length) : 0;

    console.log(`\n=== ${dir} ===`);
    console.log(`  files scanned:     ${result.filesScanned}`);
    console.log(`  artefacts (hits):  ${result.hits.length}`);
    console.log(`  finding-worthy:    ${findingsWorthy} (critical: ${critical})`);
    console.log(`  detector families: ${[...families].sort().join(", ")} (${families.size})`);
    console.log(`  avg PQC safety:    ${avgPqc}/10`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
