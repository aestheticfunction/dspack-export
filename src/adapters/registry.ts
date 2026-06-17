/**
 * Adapter registry + selection.
 *
 * One adapter is resolved per run. Selection is explicit (config.framework) or
 * inferred from component file extensions, with a hard fail on mixed/ambiguous
 * input so we never silently pick the wrong framework.
 */
import { extname } from 'node:path';
import type { ResolvedConfig } from '../config.js';
import type { FrameworkAdapter } from './types.js';
import { reactAdapter } from './react/index.js';
import { vueAdapter } from './vue/index.js';

/** Static, ordered registry. Adding a framework = one entry here. */
const ADAPTERS: readonly FrameworkAdapter[] = [reactAdapter, vueAdapter];

export interface AdapterResolution {
  adapter: FrameworkAdapter;
  /** Non-fatal warnings (e.g. configured files an adapter doesn't claim). */
  warnings: string[];
}

function uniqueSortedExtensions(files: string[]): string[] {
  return [...new Set(files.map((f) => extname(f).toLowerCase()))].sort();
}

/**
 * Infer the adapter id from component file extensions. Throws (fail-fast,
 * before extraction) when the input is empty, mixed, or otherwise ambiguous.
 */
function inferAdapterId(files: string[]): string {
  const exts = uniqueSortedExtensions(files);
  const claimedBy = (ext: string): FrameworkAdapter | undefined =>
    ADAPTERS.find((a) => a.extensions.includes(ext));

  const owners = new Set(
    exts.map((e) => claimedBy(e)?.id).filter((id): id is string => Boolean(id)),
  );
  const hasUnclaimed = exts.some((e) => !claimedBy(e));

  if (exts.length > 0 && owners.size === 1 && !hasUnclaimed) {
    return [...owners][0];
  }

  throw new Error(
    `Could not infer a component framework from file extension(s) ${
      exts.join(', ') || '(none)'
    }. Set "framework" explicitly in the config (e.g. "framework": "react" or "framework": "vue").`,
  );
}

export function resolveAdapter(config: ResolvedConfig): AdapterResolution {
  const warnings: string[] = [];
  const id = config.framework ?? inferAdapterId(config.componentFiles);

  const adapter = ADAPTERS.find((a) => a.id === id);
  if (!adapter) {
    throw new Error(
      `Unknown framework "${id}". Supported: ${ADAPTERS.map((a) => a.id).join(', ')}.`,
    );
  }

  // Non-fatal: warn (don't silently skip) when configured files carry an
  // extension this adapter doesn't claim.
  const claimed = new Set(adapter.extensions);
  const stray = uniqueSortedExtensions(config.componentFiles).filter((e) => !claimed.has(e));
  if (stray.length > 0) {
    warnings.push(
      `framework "${adapter.id}" does not claim file extension(s) ${stray.join(
        ', ',
      )}; those files may be skipped or fail to parse`,
    );
  }

  return { adapter, warnings };
}
