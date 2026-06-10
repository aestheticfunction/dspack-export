/**
 * SourceFragment — the contract every extractor implements.
 *
 * Each source (react-docgen-typescript, AST discovery, CSS variables, and in
 * the future Storybook enrichment or other surfaces) emits a partial dspack
 * document plus provenance. The assembler merges fragments by declared
 * precedence — sources are never referenced by name in merge logic, so new
 * sources slot in without restructuring.
 */
import type {
  TokenCategory,
  ComponentEntry,
  ThemeEntry,
  LayoutPrimitives,
  FrameworkBinding,
} from './types.js';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface SourceFragment {
  /** Which extractor produced this fragment, e.g. "react-docgen-typescript". */
  provenance: string;
  /**
   * Merge precedence. Higher wins on conflicting scalar fields; object maps
   * (props, tokens) are deep-merged with higher precedence winning per key.
   */
  precedence: number;
  confidence: ConfidenceLevel;
  tokens?: Record<string, TokenCategory>;
  components?: Record<string, ComponentEntry>;
  themes?: Record<string, ThemeEntry>;
  layout?: LayoutPrimitives;
  frameworkBindings?: Record<string, FrameworkBinding>;
  warnings?: string[];
}

/** dspack v0.2 ID rule: ^[a-z][a-z0-9-]*$ */
export function toDspackId(name: string): string {
  const kebab = name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  // IDs must start with a letter
  return /^[a-z]/.test(kebab) ? kebab : `c-${kebab}`;
}
