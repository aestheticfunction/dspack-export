/**
 * Validate an assembled document against the bundled dspack v0.4 JSON Schema
 * (a byte copy of the spec repo's schema, guarded by scripts/check-sync.mjs).
 * Schema-shape gate on this tool's own output only — contract validation
 * semantics live upstream in the dspack repository's harness.
 * AJV setup mirrors ds-mcp's loader (the reference consumer), so anything we
 * emit is guaranteed loadable by ds-mcp.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// ajv/dist/2020 has broken ESM types; same workaround as ds-mcp src/loader.ts
const Ajv2020 = require('ajv/dist/2020');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read from src/ at runtime (tsc does not copy JSON) — same pattern as ds-mcp's loader.
const schemaV04 = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'src', 'emit', 'schema', 'dspack.v0.4.schema.json'), 'utf-8'),
);

const ajv = new Ajv2020({ allErrors: true, validateFormats: false });
const validateV04 = ajv.compile(schemaV04);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateDspack(doc: unknown): ValidationResult {
  if (validateV04(doc)) {
    return { valid: true, errors: [] };
  }
  const errors = (validateV04.errors as Array<{ instancePath?: string; message?: string }>).map(
    (e) => `${e.instancePath || '/'}: ${e.message}`,
  );
  return { valid: false, errors };
}
