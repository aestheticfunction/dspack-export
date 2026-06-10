/**
 * Generation pipeline shared by the CLI and the test suite.
 */
import { extractWithDocgen } from './sources/docgen.js';
import { extractWithAst } from './sources/ast/discovery.js';
import { extractCvaVariants } from './sources/ast/cvaVariants.js';
import { extractCssVariables } from './sources/tokens/cssVariables.js';
import { assemble } from './emit/assemble.js';
import type { ResolvedConfig } from './config.js';
import type { DspackDocument } from './types.js';

export const GENERATOR_VERSION = '0.0.1';

export interface GenerateOptions {
  /** ISO 8601 timestamp override for deterministic output. */
  generatedAt?: string;
}

export interface GenerateResult {
  document: DspackDocument;
  warnings: string[];
}

/**
 * Resolve a deterministic timestamp from the environment, if configured.
 * SOURCE_DATE_EPOCH is the reproducible-builds convention: seconds since epoch.
 */
export function generatedAtFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const raw = env.SOURCE_DATE_EPOCH;
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds)) {
    throw new Error(`SOURCE_DATE_EPOCH must be an integer number of seconds, got "${raw}"`);
  }
  return new Date(seconds * 1000).toISOString();
}

export function generateDocument(config: ResolvedConfig, options: GenerateOptions = {}): GenerateResult {
  const fragments = [
    extractWithDocgen({
      tsconfigPath: config.tsconfigPath,
      files: config.componentFiles,
      projectRoot: config.projectRoot,
    }),
    extractCvaVariants({ files: config.componentFiles }),
    extractWithAst({
      files: config.componentFiles,
      projectRoot: config.projectRoot,
    }),
    extractCssVariables({ files: config.cssFiles }),
  ];

  return assemble(fragments, {
    name: config.name,
    version: config.version,
    description: config.description,
    source: config.source,
    generatorVersion: GENERATOR_VERSION,
    generatedAt: options.generatedAt,
  });
}
