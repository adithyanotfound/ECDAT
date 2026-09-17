/**
 * Offline CycloneDX 1.6 JSON Schema validation — Phase 4, Step 6.
 *
 * Validates against the REAL official schema, vendored under
 * src/server/cbom/schema/ (fetched once from
 * https://github.com/CycloneDX/specification, tag 1.6 — bom-1.6.schema.json
 * plus its two external $refs, spdx.schema.json and jsf-0.82.schema.json).
 * Nothing here fetches anything over the network: schema files are read
 * from disk, so tests never require internet access.
 *
 * Chosen approach: AJV (the de-facto standard, well-maintained JSON Schema
 * validator for Node) compiling the vendored draft-07 schema directly,
 * rather than a CycloneDX-specific npm package — this repo had no such
 * package installed, AJV is a minimal, generic, trustworthy dependency,
 * and validating the actual published schema is more rigorous than
 * trusting a third-party wrapper's fidelity to it.
 */
import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import path from "node:path";

const SCHEMA_DIR = path.join(__dirname, "schema");

let cachedValidate: ValidateFunction | null = null;

function loadValidator(): ValidateFunction {
  if (cachedValidate) return cachedValidate;

  // strict:false because the vendored schema itself uses a couple of
  // Ajv-unrecognised string formats (e.g. "iri-reference") that are
  // irrelevant to every field this project actually emits; unknown
  // formats are simply not enforced (valid per JSON Schema semantics),
  // never silently treated as "valid" for fields we DO populate.
  const ajv = new Ajv({ strict: false, allErrors: true, logger: false });
  addFormats(ajv);

  const bomSchema = JSON.parse(readFileSync(path.join(SCHEMA_DIR, "bom-1.6.schema.json"), "utf8"));
  const spdxSchema = JSON.parse(readFileSync(path.join(SCHEMA_DIR, "spdx.schema.json"), "utf8"));
  const jsfSchema = JSON.parse(readFileSync(path.join(SCHEMA_DIR, "jsf-0.82.schema.json"), "utf8"));

  ajv.addSchema(spdxSchema, "spdx.schema.json");
  ajv.addSchema(jsfSchema, "jsf-0.82.schema.json");
  cachedValidate = ajv.compile(bomSchema);
  return cachedValidate;
}

export interface CbomValidationResult {
  valid: boolean;
  errors: string[];
}

/** Validates an arbitrary value against the official CycloneDX 1.6 JSON Schema. */
export function validateCbom(cbom: unknown): CbomValidationResult {
  const validate = loadValidator();
  const valid = validate(cbom) as boolean;
  return {
    valid,
    errors: valid ? [] : (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? "invalid"}`),
  };
}
