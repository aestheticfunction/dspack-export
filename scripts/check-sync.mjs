#!/usr/bin/env node
/**
 * Copy drift check (dspack-gen#7, ecosystem-wide).
 *
 * dspack-export vendors a byte copy of the dspack v0.4 JSON Schema (source
 * of truth: the dspack spec repo) as its output-shape gate. The price of a
 * copy is silent drift — exactly how the tool once shipped a stale v0.2
 * emitter; this script makes drift loud: the copy must match its source
 * BYTE-FOR-BYTE. On a red check, run with --write to re-sync and commit.
 *
 * Boring by design: node builtins + global fetch, one retry, no deps.
 */
import { readFileSync, writeFileSync } from "node:fs";

const MANIFEST = [
  {
    local: "src/emit/schema/dspack.v0.4.schema.json",
    source:
      "https://raw.githubusercontent.com/aestheticfunction/dspack/main/schema/dspack.v0.4.schema.json",
  },
];

const write = process.argv.includes("--write");

async function fetchSource(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === 1) throw err;
    }
  }
}

let failed = 0;
for (const { local, source } of MANIFEST) {
  const remote = await fetchSource(source);
  let current;
  try {
    current = readFileSync(local, "utf-8");
  } catch {
    current = null;
  }
  if (current === remote) {
    console.log(`in sync  ${local}`);
  } else if (write) {
    writeFileSync(local, remote);
    console.log(`re-synced  ${local}`);
  } else {
    console.error(`DRIFT  ${local} differs from ${source}`);
    failed++;
  }
}
if (failed > 0) {
  console.error(`\n${failed} cop(ies) out of sync. Run: node scripts/check-sync.mjs --write`);
  process.exit(1);
}
