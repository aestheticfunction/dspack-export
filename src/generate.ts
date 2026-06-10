/**
 * Generation pipeline shared by the CLI and the test suite.
 */
import { extractWithDocgen } from './sources/docgen.js';
import { extractWithAst } from './sources/ast/discovery.js';
import { extractCvaVariants } from './sources/ast/cvaVariants.js';
import { extractCssVariables } from './sources/tokens/cssVariables.js';
import { extractLayout } from './sources/tokens/layout.js';
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

/**
 * A cva fragment id that matches no extracted component means the
 * `<name>Variants` naming convention didn't hold. Emitting it would create a
 * phantom component with a stub description, so drop it and warn.
 */
export function dropOrphanCvaComponents(
  cvaFragment: import('./fragment.js').SourceFragment,
  knownIds: Set<string>,
): void {
  for (const id of Object.keys(cvaFragment.components ?? {})) {
    if (!knownIds.has(id)) {
      delete cvaFragment.components![id];
      cvaFragment.warnings = cvaFragment.warnings ?? [];
      cvaFragment.warnings.push(
        `cva variants for "${id}" matched no extracted component (naming convention mismatch?); variant defaults for it were dropped`,
      );
    }
  }
}

export function generateDocument(config: ResolvedConfig, options: GenerateOptions = {}): GenerateResult {
  const docgenFragment = extractWithDocgen({
    tsconfigPath: config.tsconfigPath,
    files: config.componentFiles,
    projectRoot: config.projectRoot,
  });
  const cvaFragment = extractCvaVariants({ files: config.componentFiles });
  const astFragment = extractWithAst({
    files: config.componentFiles,
    projectRoot: config.projectRoot,
  });

  const knownIds = new Set([
    ...Object.keys(docgenFragment.components ?? {}),
    ...Object.keys(astFragment.components ?? {}),
  ]);
  dropOrphanCvaComponents(cvaFragment, knownIds);

  const fragments = [
    docgenFragment,
    cvaFragment,
    astFragment,
    extractCssVariables({ files: config.cssFiles }),
    extractLayout({ cssFiles: config.cssFiles }),
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
