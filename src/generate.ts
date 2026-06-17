/**
 * Generation pipeline shared by the CLI and the test suite.
 *
 * Component extraction is delegated to a single resolved FrameworkAdapter;
 * token/layout extraction is framework-independent and runs for every adapter.
 */
import { resolveAdapter } from './adapters/registry.js';
import { extractCssVariables } from './sources/tokens/cssVariables.js';
import { extractDesignTokens } from './sources/tokens/designTokens.js';
import { extractLayout } from './sources/tokens/layout.js';
import { assemble } from './emit/assemble.js';
import type { ResolvedConfig } from './config.js';
import type { DspackDocument } from './types.js';

// Re-exported for the existing unit test (src/tests/orphanCva.test.ts), which
// imports it from here. The implementation now lives in the React adapter.
export { dropOrphanCvaComponents } from './adapters/react/index.js';

// Keep in sync with package.json version (embedded in metadata.generatedBy).
export const GENERATOR_VERSION = '0.1.0-alpha.1';

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
  // Resolve exactly one component-framework adapter (explicit or inferred).
  // Throws (fail-fast, before any output is written) on ambiguous input.
  const { adapter, warnings: adapterWarnings } = resolveAdapter(config);

  const fragments = adapter.extractComponents({
    files: config.componentFiles,
    projectRoot: config.projectRoot,
    tsconfigPath: config.tsconfigPath,
  });

  // CSS custom-property tokens + layout (only when CSS files are configured).
  // Framework-independent: runs for every adapter.
  if (config.cssFiles.length > 0) {
    fragments.push(extractCssVariables({ files: config.cssFiles }));
    fragments.push(extractLayout({ cssFiles: config.cssFiles }));
  }

  // DTCG design-token files. Higher precedence than CSS (set in the source),
  // so an explicit token file wins over the same token scraped from CSS.
  if (config.tokensFiles.length > 0) {
    fragments.push(extractDesignTokens({ files: config.tokensFiles }));
  }

  const { document, warnings } = assemble(fragments, {
    name: config.name,
    version: config.version,
    description: config.description,
    source: config.source,
    generatorVersion: GENERATOR_VERSION,
    generatedAt: options.generatedAt,
  });

  // Provenance-tag registry warnings to match fragment/assembler warnings (`[provenance] ...`).
  const taggedAdapterWarnings = adapterWarnings.map((w) => `[adapter-registry] ${w}`);
  return { document, warnings: [...taggedAdapterWarnings, ...warnings] };
}
