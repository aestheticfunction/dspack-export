#!/usr/bin/env node
/**
 * dspack-export — bootstrap a current-spec dspack snapshot from a component
 * codebase (React + Tailwind/shadcn, Vue 3 + Vuetify 3). Step 1 of the
 * adoption journey (ADOPTING.md in the dspack repository).
 *
 * Commands:
 *   dspack-export generate --config <path> [--out <file>]   Generate a .dspack.json snapshot
 *   dspack-export validate <file>            Schema-check a dspack file (shape only —
 *                                            full contract validation lives in the dspack repo)
 *
 * Snapshot generator only: no watching, no diffing, no write-back.
 * Regeneration never destroys human-authored content — the refusal table in
 * src/emit/bootstrap.ts decides, and every refusal explains why.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { relative } from 'node:path';
import minimist from 'minimist';
import { loadConfig } from './config.js';
import { generateDocument, generatedAtFromEnv } from './generate.js';
import { validateDspack } from './emit/validate.js';
import { decideRegeneration } from './emit/bootstrap.js';
import { initConfig } from './init.js';

function usage(): never {
  console.error(
    [
      'Usage:',
      '  dspack-export init [--force]',
      '  dspack-export generate --config <dspack-export.config.json> [--out <file>]',
      '  dspack-export validate <file.dspack.json>',
    ].join('\n'),
  );
  process.exit(1);
}

function runGenerate(configPath: string, outOverride: string | undefined): void {
  const config = loadConfig(configPath);
  const outputPath = outOverride ?? config.outputPath;

  // SOURCE_DATE_EPOCH (reproducible-builds convention) pins generatedAt for
  // deterministic output, e.g. golden-file tests and reviewable diffs.
  const { document, warnings } = generateDocument(config, {
    generatedAt: generatedAtFromEnv(),
  });

  const validation = validateDspack(document);
  if (!validation.valid) {
    console.error('Generated document failed dspack v0.4 schema validation:');
    for (const err of validation.errors) console.error(`  ${err}`);
    process.exit(1);
  }

  const decision = decideRegeneration(existsSync(outputPath) ? readFileSync(outputPath, 'utf-8') : null);
  if (!decision.allow) {
    console.error(`Refusing to write ${relative(process.cwd(), outputPath)}: ${decision.reason}`);
    process.exit(1);
  }

  writeFileSync(outputPath, JSON.stringify(document, null, 2) + '\n', 'utf-8');

  const componentCount = Object.keys(document.components ?? {}).length;
  const tokenCount = Object.values(document.tokens ?? {}).reduce(
    (n, cat) => n + Object.keys(cat.values).length,
    0,
  );
  const themeCount = Object.keys(document.themes ?? {}).length;
  console.log(`✓ Wrote ${relative(process.cwd(), outputPath)}`);
  console.log(`  components: ${componentCount}, tokens: ${tokenCount}, themes: ${themeCount}`);
  if (warnings.length > 0) {
    console.log(`  warnings (${warnings.length}):`);
    for (const w of warnings) console.log(`    - ${w}`);
  }
}

function runValidate(filePath: string): void {
  const doc = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown;
  const result = validateDspack(doc);
  if (result.valid) {
    console.log(`✓ ${filePath} matches the dspack v0.4 schema (shape only — run the dspack repo's validator for full contract checks)`);
  } else {
    console.error(`✗ ${filePath} failed dspack v0.4 schema validation:`);
    for (const err of result.errors) console.error(`  ${err}`);
    process.exit(1);
  }
}

const argv = minimist(process.argv.slice(2));
const [command, positional] = argv._;

try {
  if (command === 'init') {
    const { configPath, notes } = initConfig(process.cwd(), Boolean(argv.force));
    console.log(`✓ Wrote ${configPath}`);
    console.log('  Review and edit it, then run: dspack-export generate');
    for (const note of notes) console.log(`  note: ${note}`);
  } else if (command === 'generate') {
    const configPath = (argv.config as string | undefined) ?? 'dspack-export.config.json';
    runGenerate(configPath, argv.out as string | undefined);
  } else if (command === 'validate') {
    if (!positional) usage();
    runValidate(positional);
  } else {
    usage();
  }
} catch (err) {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
