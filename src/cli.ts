#!/usr/bin/env node
/**
 * dspack-export — generate dspack v0.2 snapshots from React + Tailwind/shadcn codebases.
 *
 * Commands:
 *   dspack-export generate --config <path>   Generate a .dspack.json snapshot
 *   dspack-export validate <file>            Validate any dspack file against the v0.2 schema
 *
 * Snapshot generator only: no watching, no diffing, no write-back.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';
import minimist from 'minimist';
import { loadConfig } from './config.js';
import { generateDocument, generatedAtFromEnv } from './generate.js';
import { validateDspack } from './emit/validate.js';
import { initConfig } from './init.js';

function usage(): never {
  console.error(
    [
      'Usage:',
      '  dspack-export init [--force]',
      '  dspack-export generate --config <dspack-export.config.json>',
      '  dspack-export validate <file.dspack.json>',
    ].join('\n'),
  );
  process.exit(1);
}

function runGenerate(configPath: string): void {
  const config = loadConfig(configPath);

  // SOURCE_DATE_EPOCH (reproducible-builds convention) pins generatedAt for
  // deterministic output, e.g. golden-file tests and reviewable diffs.
  const { document, warnings } = generateDocument(config, {
    generatedAt: generatedAtFromEnv(),
  });

  const validation = validateDspack(document);
  if (!validation.valid) {
    console.error('Generated document failed dspack v0.2 schema validation:');
    for (const err of validation.errors) console.error(`  ${err}`);
    process.exit(1);
  }

  writeFileSync(config.outputPath, JSON.stringify(document, null, 2) + '\n', 'utf-8');

  const componentCount = Object.keys(document.components ?? {}).length;
  const tokenCount = Object.values(document.tokens ?? {}).reduce(
    (n, cat) => n + Object.keys(cat.values).length,
    0,
  );
  const themeCount = Object.keys(document.themes ?? {}).length;
  console.log(`✓ Wrote ${relative(process.cwd(), config.outputPath)}`);
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
    console.log(`✓ ${filePath} is a valid dspack v0.2 document`);
  } else {
    console.error(`✗ ${filePath} failed dspack v0.2 schema validation:`);
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
    runGenerate(configPath);
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
