/**
 * FrameworkAdapter — the framework-specific extension point.
 *
 * An adapter owns everything language/framework-specific: parsing component
 * files and extracting props/slots/events into the shared, normalized
 * SourceFragment shape. Adapters never touch the schema, validator, or output
 * file. Token extraction (CSS variables, DTCG, Tailwind layout) is
 * framework-independent and stays in the shared pipeline.
 *
 * Components are single-adapter per run: a snapshot describes one component
 * framework. New frameworks (Vue, later Svelte) slot in by adding an adapter
 * plus one registry entry — nothing else in the pipeline changes.
 */
import type { SourceFragment } from '../fragment.js';

/**
 * Read-only context handed to an adapter. Adapters must be pure: no I/O beyond
 * reading the listed source files, no network, no shell, no writes.
 */
export interface AdapterContext {
  /**
   * Absolute paths of component files this adapter should parse (already
   * glob-expanded and sorted by config).
   */
  files: string[];
  projectRoot: string;
  /** Absolute tsconfig path. Required by React; optional/ignored by others. */
  tsconfigPath?: string;
}

export interface FrameworkAdapter {
  /**
   * Stable framework id; also the frameworkBindings namespace key. Must match
   * the dspack id rule ^[a-z][a-z0-9-]*$ (e.g. "react", "vue").
   */
  readonly id: string;
  /** Human-readable name used in FrameworkBinding.name (e.g. "React", "Vue 3"). */
  readonly displayName: string;
  /** File extensions this adapter claims, for auto-detection (e.g. [".vue"]). */
  readonly extensions: readonly string[];
  /**
   * Produce normalized fragments. One adapter may return several fragments
   * (e.g. a primary docgen fragment plus a variant/usage fragment), exactly as
   * the React path does. Must be deterministic for identical inputs.
   */
  extractComponents(ctx: AdapterContext): SourceFragment[];
}
