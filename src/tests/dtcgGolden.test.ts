/**
 * DTCG token-import fixture: golden equality plus the cross-source behaviors
 * — precedence over CSS, CSS-token interaction, dimension/fontFamily mapping,
 * and skip warnings for alias/unsupported tokens.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadConfig } from '../config.js';
import { generateDocument } from '../generate.js';
import { validateDspack } from '../emit/validate.js';
import type { DspackDocument } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const FIXTURE_CONFIG = join(REPO_ROOT, 'fixtures', 'dtcg-tokens-demo', 'dspack-export.config.json');
const GOLDEN_PATH = join(REPO_ROOT, 'fixtures', 'dtcg-tokens-demo', 'dtcg-tokens-demo.dspack.json');
const GOLDEN_GENERATED_AT = '2026-06-10T00:00:00.000Z';

function generateFixture(): { document: DspackDocument; warnings: string[] } {
  const config = loadConfig(FIXTURE_CONFIG);
  return generateDocument(config, { generatedAt: GOLDEN_GENERATED_AT });
}

describe('dtcg fixture', () => {
  const { document, warnings } = generateFixture();

  it('reproduces the committed golden snapshot', () => {
    const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf-8')) as DspackDocument;
    expect(document).toEqual(golden);
  });

  it('passes dspack v0.2 schema validation', () => {
    expect(validateDspack(document).errors).toEqual([]);
  });

  it('lets the design-token file win over CSS on a colliding token (precedence)', () => {
    // CSS defines --primary as an HSL triplet; the DTCG file defines #2563eb.
    expect(document.tokens?.color.values.primary.value).toBe('#2563eb');
  });

  it('keeps CSS-only tokens the token file does not define (sources merge)', () => {
    expect(document.tokens?.color.values.background.value).toBe('hsl(0 0% 100%)');
  });

  it('imports DTCG-only categories and dimension/fontFamily values', () => {
    expect(document.tokens?.spacing.values.sm.value).toBe('8px');
    expect(document.tokens?.spacing.values.md.value).toBe('16px'); // { value: 16, unit: "px" }
    expect(document.tokens?.font.values.sans.value).toBe('Inter, system-ui, sans-serif');
    expect(document.tokens?.font.values['weight-bold'].value).toBe('700');
  });

  it('does not emit skipped tokens (alias, unsupported type)', () => {
    expect(document.tokens?.color.values['brand-alias']).toBeUndefined();
    expect(document.tokens?.effect).toBeUndefined();
  });

  it('warns about the skipped alias and unsupported-type tokens', () => {
    expect(warnings.some((w) => w.includes('alias/reference') && w.includes('color.brand-alias'))).toBe(true);
    expect(warnings.some((w) => w.includes('unsupported $type "shadow"'))).toBe(true);
  });

  it('still extracts the CSS dark theme alongside the imported tokens', () => {
    expect(document.themes?.dark).toBeDefined();
    expect(document.themes?.dark.overrides['color.background']).toBe('hsl(222.2 84% 4.9%)');
  });
});
