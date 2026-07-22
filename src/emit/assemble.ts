/**
 * Merge SourceFragments into a dspack document at the current emitted spec
 * version (SPEC_VERSION in bootstrap.ts).
 *
 * Merge rules: fragments are processed lowest precedence first, so higher
 * precedence overwrites per key. Component entries merge per field (a
 * higher-precedence fragment's props replace, lower fills gaps). Token
 * categories merge per token name. Themes merge per override key.
 */
import { SPEC_VERSION, buildLedger } from './bootstrap.js';
import type { SourceFragment } from '../fragment.js';
import type {
  DspackDocument,
  ComponentEntry,
  TokenCategory,
  ThemeEntry,
  FrameworkBinding,
} from '../types.js';

export interface AssembleOptions {
  name: string;
  version?: string;
  description?: string;
  source?: string;
  generatorVersion: string;
  /** Override the generatedAt timestamp (ISO 8601) for deterministic output. */
  generatedAt?: string;
}

export interface AssembleResult {
  document: DspackDocument;
  warnings: string[];
}

function mergeProps(
  base: ComponentEntry['props'],
  next: ComponentEntry['props'],
): ComponentEntry['props'] {
  const out = { ...(base ?? {}) };
  for (const [name, descriptor] of Object.entries(next ?? {})) {
    // Field-level merge: higher precedence wins per field, lower fills gaps
    // (e.g. cva contributes `default` where docgen reports none).
    out[name] = out[name] ? { ...out[name], ...descriptor } : descriptor;
  }
  return out;
}

function mergeComponents(
  base: Record<string, ComponentEntry>,
  next: Record<string, ComponentEntry>,
): Record<string, ComponentEntry> {
  const out = { ...base };
  for (const [id, entry] of Object.entries(next)) {
    const existing = out[id];
    if (!existing) {
      out[id] = entry;
      continue;
    }
    const merged: ComponentEntry = { ...existing, ...entry };
    if (existing.props || entry.props) {
      merged.props = mergeProps(existing.props, entry.props);
    }
    out[id] = merged;
  }
  return out;
}

function mergeTokens(
  base: Record<string, TokenCategory>,
  next: Record<string, TokenCategory>,
): Record<string, TokenCategory> {
  const out = { ...base };
  for (const [category, cat] of Object.entries(next)) {
    const existing = out[category];
    out[category] = existing
      ? { ...existing, ...cat, values: { ...existing.values, ...cat.values } }
      : cat;
  }
  return out;
}

function mergeThemes(
  base: Record<string, ThemeEntry>,
  next: Record<string, ThemeEntry>,
): Record<string, ThemeEntry> {
  const out = { ...base };
  for (const [id, theme] of Object.entries(next)) {
    const existing = out[id];
    out[id] = existing
      ? { ...existing, ...theme, overrides: { ...existing.overrides, ...theme.overrides } }
      : theme;
  }
  return out;
}

function mergeBindings(
  base: Record<string, FrameworkBinding>,
  next: Record<string, FrameworkBinding>,
): Record<string, FrameworkBinding> {
  const out = { ...base };
  for (const [fw, binding] of Object.entries(next)) {
    const existing = out[fw];
    out[fw] = existing
      ? { ...existing, ...binding, components: { ...existing.components, ...binding.components } }
      : binding;
  }
  return out;
}

export function assemble(fragments: SourceFragment[], options: AssembleOptions): AssembleResult {
  const ordered = [...fragments].sort((a, b) => a.precedence - b.precedence);
  const warnings: string[] = [];

  let components: Record<string, ComponentEntry> = {};
  let tokens: Record<string, TokenCategory> = {};
  let themes: Record<string, ThemeEntry> = {};
  let frameworkBindings: Record<string, FrameworkBinding> = {};
  let layout: DspackDocument['layout'] | undefined;

  for (const fragment of ordered) {
    if (fragment.warnings) {
      warnings.push(...fragment.warnings.map((w) => `[${fragment.provenance}] ${w}`));
    }
    if (fragment.components) components = mergeComponents(components, fragment.components);
    if (fragment.tokens) tokens = mergeTokens(tokens, fragment.tokens);
    if (fragment.themes) themes = mergeThemes(themes, fragment.themes);
    if (fragment.frameworkBindings) frameworkBindings = mergeBindings(frameworkBindings, fragment.frameworkBindings);
    if (fragment.layout) layout = { ...layout, ...fragment.layout };
  }

  const document: DspackDocument = {
    dspack: SPEC_VERSION,
    name: options.name,
    ...(options.description ? { description: options.description } : {}),
    ...(options.version ? { version: options.version } : {}),
    metadata: {
      generatedBy: `@aestheticfunction/dspack-export@${options.generatorVersion}`,
      generatedAt: options.generatedAt ?? new Date().toISOString(),
      ...(options.source ? { source: options.source } : {}),
      note: 'Generated snapshot. Hand-authored sections (patterns, antiPatterns, whenToUse, accessibility, composition, constraints) are not generated; regeneration refuses to overwrite a document containing human-authored content (see metadata["x-bootstrap"]).',
    },
    ...(Object.keys(tokens).length > 0 ? { tokens } : {}),
    ...(Object.keys(components).length > 0 ? { components } : {}),
    ...(Object.keys(frameworkBindings).length > 0 ? { frameworkBindings } : {}),
    ...(Object.keys(themes).length > 0 ? { themes } : {}),
    ...(layout ? { layout } : {}),
  };
  (document.metadata as Record<string, unknown>)['x-bootstrap'] = buildLedger(document);

  return { document, warnings };
}
