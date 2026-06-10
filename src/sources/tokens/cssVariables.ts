/**
 * CSS custom-property token source (shadcn conventions).
 *
 * Survey-validated (2026-06-10, 6 public repos): token *names* are stable
 * (--background, --primary, --radius, …) across Tailwind v3 and v4, but file
 * layout varies — tokens may sit behind relative `@import './theme.css'`.
 * So this extractor parses `:root` and `.dark` blocks, follows relative
 * @imports, and normalizes Tailwind-v3 raw HSL triplets ("222.2 84% 4.9%")
 * into valid `hsl(...)` color strings.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { SourceFragment } from '../../fragment.js';
import type { TokenEntry, ThemeEntry } from '../../types.js';

export interface CssVariablesOptions {
  /** Entry CSS file(s), absolute paths. Relative @imports are followed. */
  files: string[];
}

/** Known shadcn semantic color token names → descriptions. */
const KNOWN_COLOR_DESCRIPTIONS: Record<string, string> = {
  background: 'Page background color.',
  foreground: 'Default text color on the page background.',
  card: 'Card surface background.',
  'card-foreground': 'Text color on card surfaces.',
  popover: 'Popover surface background.',
  'popover-foreground': 'Text color in popovers.',
  primary: 'Primary brand color for prominent interactive elements.',
  'primary-foreground': 'Text color on primary-colored surfaces.',
  secondary: 'Secondary surface color for less prominent elements.',
  'secondary-foreground': 'Text color on secondary surfaces.',
  muted: 'Muted background for subdued UI regions.',
  'muted-foreground': 'Subdued text color.',
  accent: 'Accent background for hover and highlight states.',
  'accent-foreground': 'Text color on accent surfaces.',
  destructive: 'Color for destructive actions and errors.',
  'destructive-foreground': 'Text color on destructive surfaces.',
  border: 'Default border color.',
  input: 'Form input border color.',
  ring: 'Focus ring color.',
};

const RAW_HSL_TRIPLET = /^-?[\d.]+(deg)?[ ,]+[\d.]+%[ ,]+[\d.]+%$/;
const COLOR_FUNCTION = /^(hsl|hsla|rgb|rgba|oklch|oklab|lab|lch|color)\(/;
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
const DIMENSION = /^-?[\d.]+(px|rem|em|%|vh|vw|ch)$/;

interface VarBlock {
  vars: Map<string, string>;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Collect custom properties from every `selector { ... }` block matching the given selector. */
function collectVars(css: string, selectorPattern: RegExp): VarBlock {
  const vars = new Map<string, string>();
  const blockRe = new RegExp(selectorPattern.source + String.raw`\s*\{([^{}]*)\}`, 'g');
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(css)) !== null) {
    const body = m[1];
    const varRe = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
    let v: RegExpExecArray | null;
    while ((v = varRe.exec(body)) !== null) {
      vars.set(v[1], v[2].trim());
    }
  }
  return { vars };
}

/** Resolve relative @import statements one level deep (survey: sufficient for './theme.css' splits). */
function readWithImports(entryFile: string, warnings: string[]): string {
  let css: string;
  try {
    css = readFileSync(entryFile, 'utf-8');
  } catch {
    warnings.push(`Could not read CSS file: ${entryFile}`);
    return '';
  }
  const importRe = /@import\s+(?:url\()?['"](\.[^'"]+)['"]\)?[^;]*;/g;
  let combined = css;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(css)) !== null) {
    const target = resolve(dirname(entryFile), m[1]);
    try {
      combined += '\n' + readFileSync(target, 'utf-8');
    } catch {
      warnings.push(`Could not follow @import '${m[1]}' from ${entryFile}`);
    }
  }
  return combined;
}

export function normalizeCssValue(raw: string): { value: string; type?: string } {
  const value = raw.trim();
  if (RAW_HSL_TRIPLET.test(value)) {
    // Tailwind-v3 shadcn convention: bare HSL triplet meant for hsl(var(--x))
    return { value: `hsl(${value})`, type: 'color' };
  }
  if (COLOR_FUNCTION.test(value) || HEX_COLOR.test(value)) {
    return { value, type: 'color' };
  }
  if (DIMENSION.test(value)) {
    return { value, type: 'dimension' };
  }
  return { value };
}

export function extractCssVariables(options: CssVariablesOptions): SourceFragment {
  const warnings: string[] = [];
  let combined = '';
  for (const file of options.files) {
    combined += '\n' + readWithImports(file, warnings);
  }
  combined = stripComments(combined);

  const rootVars = collectVars(combined, /:root/);
  const darkVars = collectVars(combined, /\.dark(?:\s+\*)?/);

  const colorValues: Record<string, TokenEntry> = {};
  const radiusValues: Record<string, TokenEntry> = {};

  for (const [name, raw] of rootVars.vars) {
    const { value, type } = normalizeCssValue(raw);
    const entry: TokenEntry = { value };
    if (type) entry.type = name === 'radius' ? 'borderRadius' : type;
    const known = KNOWN_COLOR_DESCRIPTIONS[name];
    if (known) entry.description = known;
    if (name === 'radius' || name.startsWith('radius-')) {
      entry.type = 'borderRadius';
      radiusValues[name] = entry;
    } else if (entry.type === 'color' || known) {
      colorValues[name] = entry;
    } else {
      // Unrecognized var (fonts, charts, sidebar, etc.) — keep colors only in v1.
      if (COLOR_FUNCTION.test(value) || HEX_COLOR.test(value)) colorValues[name] = entry;
    }
  }

  const overrides: Record<string, string> = {};
  for (const [name, raw] of darkVars.vars) {
    const { value } = normalizeCssValue(raw);
    if (colorValues[name]) overrides[`color.${name}`] = value;
    else if (radiusValues[name]) overrides[`radius.${name}`] = value;
  }

  if (Object.keys(colorValues).length === 0) {
    warnings.push(
      'No color custom properties found in :root. If tokens live in an imported package, list its CSS file explicitly in the config "css" array.',
    );
  }

  const tokens: SourceFragment['tokens'] = {};
  if (Object.keys(colorValues).length > 0) {
    tokens.color = {
      description: 'Semantic color tokens extracted from CSS custom properties. Values are the default (light) theme.',
      tier: 'semantic',
      values: colorValues,
    };
  }
  if (Object.keys(radiusValues).length > 0) {
    tokens.radius = {
      description: 'Border radius tokens extracted from CSS custom properties.',
      tier: 'semantic',
      values: radiusValues,
    };
  }

  const themes: Record<string, ThemeEntry> = {};
  if (Object.keys(overrides).length > 0) {
    themes.dark = {
      name: 'Dark',
      description: 'Dark theme overrides extracted from the .dark CSS block.',
      overrides,
    };
  }

  return {
    provenance: 'css-variables',
    precedence: 100,
    confidence: 'high',
    tokens,
    ...(Object.keys(themes).length > 0 ? { themes } : {}),
    warnings,
  };
}
