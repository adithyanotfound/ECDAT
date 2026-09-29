/**
 * Manifest detector family — package.json, requirements.txt, pom.xml,
 * build.gradle, go.mod, Cargo.toml, *.csproj, CMakeLists.txt and lockfiles,
 * matched against a curated crypto-library table (IMPLEMENTATION_PLAN.md §4a).
 */
import type { Rule, RawHit } from "../types";

type Emit = Omit<RawHit, "ruleId" | "pack">;

interface CuratedLib {
  match: RegExp;
  name: string;
  /** Rough risk signal — older/abandoned crypto libs surface a moderate finding. */
  knownWeak?: boolean;
}

const CURATED_LIBS: CuratedLib[] = [
  { match: /^node-forge$/, name: "node-forge" },
  { match: /^jsonwebtoken$/, name: "jsonwebtoken (JWT)" },
  { match: /^libsodium-wrappers?$/, name: "libsodium" },
  { match: /^bcryptjs?$/, name: "bcrypt" },
  { match: /^jose$/, name: "jose (JOSE/JWT)" },
  { match: /^pycryptodome$/, name: "PyCryptodome" },
  { match: /^cryptography$/, name: "PyCA cryptography" },
  { match: /^paramiko$/, name: "Paramiko (SSH)" },
  { match: /^pyopenssl$/, name: "PyOpenSSL" },
  { match: /^bouncycastle$|^bcprov-jdk[\w]*$|^bcpkix-jdk[\w]*$/, name: "BouncyCastle" },
];

function matchLib(depName: string): CuratedLib | undefined {
  return CURATED_LIBS.find((l) => l.match.test(depName));
}

function emitLibHit(lib: CuratedLib, version: string | undefined): Emit {
  return {
    kind: "LIBRARY",
    rawName: lib.name,
    version,
    filePath: "",
    evidence: version ? `${lib.name}@${version}` : lib.name,
    confidence: 0.9,
  };
}

export const manifestRules: Rule[] = [
  {
    id: "manifest.packageJson",
    pack: "manifests",
    languages: ["javascript", "typescript"],
    filePatterns: ["**/package.json"],
    match(content) {
      const hits: Emit[] = [];
      try {
        const pkg = JSON.parse(content) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        for (const [name, version] of Object.entries(deps ?? {})) {
          const lib = matchLib(name);
          if (lib) hits.push(emitLibHit(lib, version));
        }
      } catch {
        // malformed JSON — skip silently, not a crypto finding
      }
      return hits;
    },
  },
  {
    id: "manifest.requirementsTxt",
    pack: "manifests",
    languages: ["python"],
    filePatterns: ["**/requirements*.txt", "**/Pipfile", "**/pyproject.toml"],
    match(content) {
      const hits: Emit[] = [];
      const lines = content.split("\n");
      for (const line of lines) {
        const m = line.trim().match(/^([A-Za-z0-9_.-]+)\s*(?:==|>=|~=|\^)?\s*([\w.]*)/);
        if (!m) continue;
        const lib = matchLib(m[1].toLowerCase());
        if (lib) hits.push(emitLibHit(lib, m[2] || undefined));
      }
      return hits;
    },
  },
  {
    id: "manifest.pomXml",
    pack: "manifests",
    languages: ["java"],
    filePatterns: ["**/pom.xml"],
    match(content) {
      const hits: Emit[] = [];
      const depRe = /<dependency>([\s\S]*?)<\/dependency>/g;
      let m: RegExpExecArray | null;
      while ((m = depRe.exec(content))) {
        const block = m[1];
        const artifact = block.match(/<artifactId>([^<]+)<\/artifactId>/)?.[1];
        const version = block.match(/<version>([^<]+)<\/version>/)?.[1];
        if (!artifact) continue;
        const lib = matchLib(artifact.toLowerCase());
        if (lib) hits.push(emitLibHit(lib, version));
      }
      return hits;
    },
  },
  {
    id: "manifest.buildGradle",
    pack: "manifests",
    languages: ["java"],
    filePatterns: ["**/build.gradle", "**/build.gradle.kts"],
    match(content) {
      const hits: Emit[] = [];
      const re = /['"]([\w.]+):([\w-]+):([\w.]+)['"]/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content))) {
        const [, , artifact, version] = m;
        const lib = matchLib(artifact.toLowerCase());
        if (lib) hits.push(emitLibHit(lib, version));
      }
      return hits;
    },
  },
  {
    id: "manifest.goMod",
    pack: "manifests",
    languages: ["go"],
    filePatterns: ["**/go.mod"],
    match(content) {
      const hits: Emit[] = [];
      const re = /^\s*(?:require\s+)?(\S+)\s+v?([\w.-]+)/gm;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content))) {
        const [, mod, version] = m;
        if (mod.includes("cloudflare/circl")) {
          hits.push({
            kind: "LIBRARY",
            rawName: "CIRCL (Cloudflare PQC)",
            version,
            filePath: "",
            evidence: `${mod}@${version}`,
            confidence: 0.9,
          });
        }
      }
      return hits;
    },
  },
  {
    id: "manifest.cmakeLists",
    pack: "manifests",
    languages: ["c", "cpp"],
    filePatterns: ["**/CMakeLists.txt"],
    match(content) {
      const hits: Emit[] = [];
      if (/mbedtls/i.test(content)) {
        hits.push({
          kind: "LIBRARY",
          rawName: "mbedTLS",
          filePath: "",
          evidence: content.match(/.*mbedtls.*/i)?.[0]?.trim().slice(0, 120) ?? "mbedTLS",
          confidence: 0.75,
        });
      }
      if (/find_package\(\s*OpenSSL/i.test(content)) {
        hits.push({
          kind: "LIBRARY",
          rawName: "OpenSSL",
          filePath: "",
          evidence: "find_package(OpenSSL)",
          confidence: 0.8,
        });
      }
      if (/sodium/i.test(content)) {
        hits.push({
          kind: "LIBRARY",
          rawName: "libsodium",
          filePath: "",
          evidence: content.match(/.*sodium.*/i)?.[0]?.trim().slice(0, 120) ?? "libsodium",
          confidence: 0.7,
        });
      }
      return hits;
    },
  },
];
