/**
 * Engine orchestrator — walks a checked-out repository tree with fast-glob,
 * dispatches each file to the rule packs whose filePatterns match, collects
 * raw hits, and normalises them into the CBOM vocabulary.
 *
 * Caps (§Phase 5 "Hardening"): file-size cap, extension allowlist via
 * excludeGlobs, a wall-clock ceiling and an artefact ceiling — a scan must
 * never hang or flood the inventory.
 */
import fg from "fast-glob";
import fs from "fs/promises";
import path from "path";
import micromatch from "micromatch";
import type { EngineResult, NormalizedHit, Rule, ScanProfileConfig } from "./types";
import { DEFAULT_PROFILE } from "./types";
import { normalizeHit } from "./normalize";
import { callsiteRules } from "./detectors/callsites";
import { manifestRules } from "./detectors/manifests";
import { certificateRules } from "./detectors/certificates";
import { keyRules } from "./detectors/keys";
import { protocolRules } from "./detectors/protocols";
import { secretRules } from "./detectors/secrets";

const ALL_RULES: Record<string, Rule[]> = {
  callsites: callsiteRules,
  manifests: manifestRules,
  certificates: certificateRules,
  keys: keyRules,
  protocols: protocolRules,
  secrets: secretRules,
};

export const MAX_FILES_SCANNED = 5_000;
export const MAX_ARTIFACTS = 2_000;
export const MAX_SCAN_WALL_CLOCK_MS = 120_000;

export interface EngineLogger {
  (level: "INFO" | "WARN" | "ERROR", message: string): void;
}

export async function runEngine(
  repositoryId: string,
  repoRoot: string,
  profile: Partial<ScanProfileConfig> = {},
  log: EngineLogger = () => {}
): Promise<EngineResult> {
  const start = Date.now();
  const config: ScanProfileConfig = { ...DEFAULT_PROFILE, ...profile };
  const activeRules = config.rulePackIds.flatMap((id) => ALL_RULES[id] ?? []);

  log("INFO", `Enabled rule packs: ${config.rulePackIds.join(", ")} (${activeRules.length} rules)`);

  const entries = await fg(config.includeGlobs, {
    cwd: repoRoot,
    ignore: config.excludeGlobs,
    onlyFiles: true,
    dot: false,
    absolute: false,
    followSymbolicLinks: false,
  });

  log("INFO", `Discovered ${entries.length} candidate files`);

  const hits: NormalizedHit[] = [];
  const seenFingerprints = new Set<string>();
  let filesScanned = 0;
  let filesSkipped = 0;
  let truncated = false;

  for (const relPath of entries) {
    if (Date.now() - start > MAX_SCAN_WALL_CLOCK_MS) {
      truncated = true;
      log("WARN", `Scan wall-clock ceiling (${MAX_SCAN_WALL_CLOCK_MS}ms) reached — stopping early`);
      break;
    }
    if (filesScanned >= MAX_FILES_SCANNED) {
      truncated = true;
      log("WARN", `Scan file ceiling (${MAX_FILES_SCANNED}) reached — stopping early`);
      break;
    }
    if (hits.length >= MAX_ARTIFACTS) {
      truncated = true;
      log("WARN", `Scan artefact ceiling (${MAX_ARTIFACTS}) reached — stopping early`);
      break;
    }

    const absPath = path.join(repoRoot, relPath);
    let stat;
    try {
      stat = await fs.stat(absPath);
    } catch {
      filesSkipped++;
      continue;
    }
    if (stat.size > config.maxFileSizeKb * 1024) {
      filesSkipped++;
      continue;
    }

    const matchingRules = activeRules.filter((r) => micromatch.isMatch(relPath, r.filePatterns, { dot: true }));
    if (matchingRules.length === 0) continue;

    let content: string;
    try {
      content = await fs.readFile(absPath, "utf-8");
    } catch {
      filesSkipped++;
      continue;
    }
    // Skip binary-looking files (null byte in first 512 chars) except known binary formats we parse deliberately.
    const looksBinary = content.includes(String.fromCharCode(0));
    const isKnownBinaryFormat = /\.(der|p12|pfx|jks)$/i.test(relPath);
    if (looksBinary && !isKnownBinaryFormat) {
      filesSkipped++;
      continue;
    }

    filesScanned++;

    for (const ruleDef of matchingRules) {
      let rawHits;
      try {
        rawHits = ruleDef.match(content, relPath);
      } catch (err) {
        log("WARN", `Rule ${ruleDef.id} threw on ${relPath}: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
      for (const raw of rawHits) {
        const normalized = normalizeHit(repositoryId, {
          ...raw,
          ruleId: ruleDef.id,
          pack: ruleDef.pack,
          filePath: relPath,
          cweId: raw.cweId ?? ruleDef.cweId,
          nistRef: raw.nistRef ?? ruleDef.nistRef,
        });
        if (seenFingerprints.has(normalized.fingerprint)) continue;
        seenFingerprints.add(normalized.fingerprint);
        hits.push(normalized);
        if (hits.length >= MAX_ARTIFACTS) break;
      }
    }
  }

  const durationMs = Date.now() - start;
  log(
    "INFO",
    `Engine finished: ${filesScanned} files scanned, ${filesSkipped} skipped, ${hits.length} artefacts in ${durationMs}ms${truncated ? " (truncated)" : ""}`
  );

  return { hits, filesScanned, filesSkipped, durationMs, truncated };
}
