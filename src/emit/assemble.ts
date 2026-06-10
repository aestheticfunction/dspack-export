/**
 * Merge SourceFragments into a dspack v0.2 document.
 *
 * Merge rules: fragments are processed lowest precedence first, so higher
 * precedence overwrites per key. Component entries merge per field (a
 * higher-precedence fragment's props replace, lower fills gaps). Token
 * categories merge per token name. Themes merge per override key.
 */
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
}

export interface AssembleResult {
  document: DspackDocument;
  warnings: string[];
}

function mergeComponents(
  base: Record<string, ComponentEntry>,
  next: Record<string, ComponentEntry>,
): Record<string, ComponentEntry> {
  const out = { ...base };
  for (const [id, entry] of Object.entries(next)) {
    const existing = out[id];
    out[id] = existing ? { ...existing, ...entry } : entry;
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
    dspack: '0.2',
    name: options.name,
    ...(options.description ? { description: options.description } : {}),
    ...(options.version ? { version: options.version } : {}),
    metadata: {
      generatedBy: `@aestheticfunction/dspack-export@${options.generatorVersion}`,
      generatedAt: new Date().toISOString(),
      ...(options.source ? { source: options.source } : {}),
      note: 'Generated snapshot. Hand-authored sections (patterns, antiPatterns, whenToUse, accessibility, composition, constraints) are not generated and will be overwritten on regeneration.',
    },
    ...(Object.keys(tokens).length > 0 ? { tokens } : {}),
    ...(Object.keys(components).length > 0 ? { components } : {}),
    ...(Object.keys(frameworkBindings).length > 0 ? { frameworkBindings } : {}),
    ...(Object.keys(themes).length > 0 ? { themes } : {}),
    ...(layout ? { layout } : {}),
  };

  return { document, warnings };
}
