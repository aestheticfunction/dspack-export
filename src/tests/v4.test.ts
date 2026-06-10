/**
 * Tailwind v4 / @theme fixture: golden equality plus the v4-specific
 * behaviors — oklch passthrough, var() reference skipping, direct @theme
 * tokens, breakpoint extension, spacing base unit.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadConfig } from '../config.js';
import { generateDocument } from '../generate.js';
import { validateDspack } from '../emit/validate.js';
import type { DspackDocument, PropDescriptor } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const FIXTURE_CONFIG = join(REPO_ROOT, 'fixtures', 'shadcn-v4-demo', 'dspack-export.config.json');
const GOLDEN_PATH = join(REPO_ROOT, 'fixtures', 'shadcn-v4-demo', 'shadcn-v4-demo.dspack.json');
const GOLDEN_GENERATED_AT = '2026-06-10T00:00:00.000Z';

function generateFixture(): DspackDocument {
  const config = loadConfig(FIXTURE_CONFIG);
  return generateDocument(config, { generatedAt: GOLDEN_GENERATED_AT }).document;
}

describe('tailwind v4 fixture', () => {
  const document = generateFixture();

  it('reproduces the committed golden snapshot', () => {
    const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf-8')) as DspackDocument;
    expect(document).toEqual(golden);
  });

  it('passes dspack v0.2 schema validation', () => {
    expect(validateDspack(document).errors).toEqual([]);
  });

  it('extracts a plain-function (non-forwardRef) component with cva enums and defaults', () => {
    const props = document.components?.button?.props as Record<string, PropDescriptor>;
    expect(props.variant.values).toEqual(['default', 'destructive', 'outline', 'secondary', 'ghost']);
    expect(props.variant.default).toBe('default');
    expect(props.size.default).toBe('default');
  });

  it('passes oklch color values through unchanged', () => {
    expect(document.tokens?.color.values.primary).toMatchObject({
      value: 'oklch(0.205 0 0)',
      type: 'color',
    });
  });

  it('skips unresolved var()/calc(var()) references', () => {
    for (const category of Object.values(document.tokens ?? {})) {
      for (const entry of Object.values(category.values)) {
        expect(entry.value).not.toContain('var(');
      }
    }
    // @theme inline only aliases --radius via var(); the resolved value comes from :root
    expect(document.tokens?.radius.values).toEqual({
      radius: { value: '0.625rem', type: 'borderRadius' },
    });
  });

  it('captures direct @theme color tokens', () => {
    expect(document.tokens?.color.values.brand).toEqual({
      value: 'oklch(0.6 0.2 250)',
      type: 'color',
    });
  });

  it('extracts dark overrides from the .dark block alongside @custom-variant', () => {
    expect(Object.keys(document.themes?.dark?.overrides ?? {})).toHaveLength(9);
    expect(document.themes?.dark?.overrides['color.background']).toBe('oklch(0.145 0 0)');
  });

  it('extends Tailwind default breakpoints with @theme --breakpoint-*', () => {
    const breakpoints = document.layout?.breakpoints ?? {};
    expect(breakpoints['sm']?.minWidth).toBe('640px');
    expect(breakpoints['2xl']?.minWidth).toBe('1536px');
    expect(breakpoints['3xl']?.minWidth).toBe('1920px');
  });

  it('reads the spacing base unit from @theme --spacing', () => {
    expect(document.layout?.spacingScale?.baseUnit).toBe('0.25rem');
  });
});
