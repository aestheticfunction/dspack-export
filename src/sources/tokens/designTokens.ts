/**
 * Design-token-file import source (W3C DTCG format).
 *
 * Reads local DTCG-style token JSON — the interchange format that tools such
 * as Figma variable exports, Tokens Studio, and Style Dictionary can *produce*
 * — and contributes a snapshot `{ tokens }` fragment. This is an import path,
 * not an integration: no network, no Figma API, no tool-specific logic, no
 * alias resolution, and no comparison against any prior export.
 *
 * Scope (smallest slice): resolved scalar values only. Alias/reference values
 * ("{group.token}") and unsupported $types are skipped with warnings.
 */
import { readFileSync } from 'node:fs';
import type { SourceFragment } from '../../fragment.js';
import { toDspackId } from '../../fragment.js';
import type { TokenCategory, TokenEntry } from '../../types.js';

export interface DesignTokensOptions {
  /** Absolute paths to DTCG token JSON files. */
  files: string[];
}

/**
 * DTCG `$type` → dspack token `type`. Only these are imported; any other
 * `$type` (typography composite, shadow, cubicBezier, duration, number, …)
 * is skipped with a warning, because it has no clear, safe single-string
 * mapping to a dspack token value.
 */
const SUPPORTED_TYPES: Record<string, string> = {
  color: 'color',
  dimension: 'dimension',
  fontFamily: 'fontFamily',
  fontWeight: 'fontWeight',
};

interface DtcgToken {
  $value: unknown;
  $type?: string;
  $description?: string;
}

interface FlatToken {
  category: string;
  name: string;
  entry: TokenEntry;
}

function isReference(value: unknown): boolean {
  return typeof value === 'string' && value.trim().startsWith('{') && value.trim().endsWith('}');
}

function isTokenNode(node: unknown): node is DtcgToken {
  return typeof node === 'object' && node !== null && '$value' in (node as Record<string, unknown>);
}

/** Render a DTCG `$value` to a dspack token string for a supported type, or null to skip. */
function renderValue(type: string, value: unknown): string | null {
  switch (type) {
    case 'color':
      // Basic DTCG color is a string (hex/rgb/hsl/oklch). Composite/object → skip.
      return typeof value === 'string' ? value : null;
    case 'dimension':
      if (typeof value === 'string') return value;
      // DTCG draft dimension object form: { value: 16, unit: "px" }.
      if (typeof value === 'object' && value !== null && 'value' in value && 'unit' in value) {
        const v = (value as { value: unknown }).value;
        const u = (value as { unit: unknown }).unit;
        if ((typeof v === 'number' || typeof v === 'string') && typeof u === 'string') {
          return `${v}${u}`;
        }
      }
      return null;
    case 'fontFamily':
      if (typeof value === 'string') return value;
      if (Array.isArray(value) && value.every((x) => typeof x === 'string')) return value.join(', ');
      return null;
    case 'fontWeight':
      if (typeof value === 'number' || typeof value === 'string') return String(value);
      return null;
    default:
      return null;
  }
}

function handleToken(
  token: DtcgToken,
  path: string[],
  inheritedType: string | undefined,
  out: FlatToken[],
  warnings: string[],
): void {
  const dotted = path.join('.');
  if (isReference(token.$value)) {
    warnings.push(`Token "${dotted}" is an alias/reference; skipped (alias resolution is not supported in this version).`);
    return;
  }
  const type = typeof token.$type === 'string' ? token.$type : inheritedType;
  if (!type) {
    warnings.push(`Token "${dotted}" has no $type (and no inherited group type); skipped.`);
    return;
  }
  const dspackType = SUPPORTED_TYPES[type];
  if (!dspackType) {
    warnings.push(`Token "${dotted}" has unsupported $type "${type}"; skipped.`);
    return;
  }
  const value = renderValue(type, token.$value);
  if (value === null) {
    warnings.push(`Token "${dotted}" ($type "${type}") has a non-scalar or unsupported value; skipped.`);
    return;
  }
  // category = first DTCG group segment (or, for a root-level token, its type);
  // name = the remaining path, kebab-cased. Both conform to the dspack id rule.
  const category = toDspackId(path.length >= 2 ? path[0] : type);
  const name = toDspackId(path.length >= 2 ? path.slice(1).join('-') : path[0]);
  const entry: TokenEntry = { value, type: dspackType };
  if (typeof token.$description === 'string' && token.$description) entry.description = token.$description;
  out.push({ category, name, entry });
}

/** Walk a DTCG document/group, collecting tokens. `$`-prefixed keys are DTCG metadata. */
function walk(
  node: Record<string, unknown>,
  path: string[],
  inheritedType: string | undefined,
  out: FlatToken[],
  warnings: string[],
): void {
  const groupType = typeof node.$type === 'string' ? node.$type : inheritedType;
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue; // DTCG metadata ($type, $themes, $metadata, $extensions, …)
    if (!child || typeof child !== 'object') continue;
    const childPath = [...path, key];
    if (isTokenNode(child)) {
      handleToken(child, childPath, groupType, out, warnings);
    } else {
      walk(child as Record<string, unknown>, childPath, groupType, out, warnings);
    }
  }
}

function buildCategories(flat: FlatToken[]): Record<string, TokenCategory> {
  const tokens: Record<string, TokenCategory> = {};
  for (const { category, name, entry } of flat) {
    if (!tokens[category]) {
      tokens[category] = {
        description: `Imported from a design token file (${category}).`,
        tier: 'semantic',
        values: {},
      };
    }
    tokens[category].values[name] = entry;
  }
  return tokens;
}

/** Map a single parsed DTCG document to dspack token categories. Exported for testing. */
export function dtcgDocToTokens(doc: unknown): {
  tokens: Record<string, TokenCategory>;
  warnings: string[];
} {
  const warnings: string[] = [];
  if (!doc || typeof doc !== 'object') {
    warnings.push('Token document is not a JSON object; skipped.');
    return { tokens: {}, warnings };
  }
  const flat: FlatToken[] = [];
  walk(doc as Record<string, unknown>, [], undefined, flat, warnings);
  return { tokens: buildCategories(flat), warnings };
}

function mergeInto(
  target: Record<string, TokenCategory>,
  next: Record<string, TokenCategory>,
): void {
  for (const [category, cat] of Object.entries(next)) {
    if (!target[category]) {
      target[category] = { ...cat, values: { ...cat.values } };
    } else {
      Object.assign(target[category].values, cat.values); // later file wins per token
    }
  }
}

export function extractDesignTokens(options: DesignTokensOptions): SourceFragment {
  const warnings: string[] = [];
  const tokens: Record<string, TokenCategory> = {};

  for (const file of options.files) {
    let raw: string;
    try {
      raw = readFileSync(file, 'utf-8');
    } catch {
      warnings.push(`Could not read token file: ${file}`);
      continue;
    }
    let doc: unknown;
    try {
      doc = JSON.parse(raw);
    } catch (err) {
      warnings.push(`Invalid JSON in token file ${file}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    const result = dtcgDocToTokens(doc);
    mergeInto(tokens, result.tokens);
    warnings.push(...result.warnings);
  }

  if (Object.keys(tokens).length === 0 && options.files.length > 0) {
    warnings.push('No supported tokens were imported from the provided token file(s).');
  }

  return {
    provenance: 'design-tokens',
    // Higher than css-variables (100): an explicit design-token file is the
    // designer's source of truth and wins over tokens scraped from compiled CSS.
    precedence: 110,
    confidence: 'high',
    tokens,
    warnings,
  };
}
