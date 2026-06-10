/**
 * Golden-file tests: the full pipeline run on fixtures/shadcn-demo must
 * reproduce the committed snapshot exactly (timestamp pinned via the
 * generatedAt override), pass schema validation, and contain the specific
 * facts each extractor is responsible for.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadConfig } from '../config.js';
import { generateDocument, generatedAtFromEnv } from '../generate.js';
import { validateDspack } from '../emit/validate.js';
import type { DspackDocument, PropDescriptor } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const FIXTURE_CONFIG = join(REPO_ROOT, 'fixtures', 'shadcn-demo', 'dspack-export.config.json');
const GOLDEN_PATH = join(REPO_ROOT, 'fixtures', 'shadcn-demo', 'shadcn-demo.dspack.json');

/** Timestamp the committed golden file was generated with (SOURCE_DATE_EPOCH=1781049600). */
const GOLDEN_GENERATED_AT = '2026-06-10T00:00:00.000Z';

function generateFixture(): DspackDocument {
  const config = loadConfig(FIXTURE_CONFIG);
  const { document } = generateDocument(config, { generatedAt: GOLDEN_GENERATED_AT });
  return document;
}

describe('golden file', () => {
  const document = generateFixture();
  const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf-8')) as DspackDocument;

  it('reproduces the committed snapshot exactly', () => {
    expect(document).toEqual(golden);
  });

  it('is deterministic across runs', () => {
    expect(JSON.stringify(generateFixture())).toBe(JSON.stringify(document));
  });

  it('passes dspack v0.2 schema validation', () => {
    const result = validateDspack(document);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('pins generatedAt via override', () => {
    expect(document.metadata?.generatedAt).toBe(GOLDEN_GENERATED_AT);
  });
});

describe('component extraction', () => {
  const document = generateFixture();
  const button = document.components?.button;
  const buttonProps = button?.props as Record<string, PropDescriptor>;

  it('extracts the Button variant enum from cva via the TS checker', () => {
    expect(buttonProps.variant.type).toBe('enum');
    expect(buttonProps.variant.values).toEqual([
      'default',
      'destructive',
      'outline',
      'secondary',
      'ghost',
      'link',
    ]);
    expect(buttonProps.variant.propRole).toBe('choice');
  });

  it('extracts the Button size enum', () => {
    expect(buttonProps.size.type).toBe('enum');
    expect(buttonProps.size.values).toEqual(['default', 'sm', 'lg', 'icon']);
    expect(buttonProps.size.propRole).toBe('dimension');
  });

  it('fills variant/size defaults from cva defaultVariants', () => {
    expect(buttonProps.variant.default).toBe('default');
    expect(buttonProps.size.default).toBe('default');
  });

  it('keeps docgen-first precedence: descriptions come from JSDoc, not the cva stub', () => {
    expect(button?.description).toBe('Displays a button or a component that looks like a button.');
    expect(document.components?.badge?.description).toBe(
      'Displays a badge or a component that looks like a badge.',
    );
  });

  it('fills the Badge variant default from cva', () => {
    const badgeProps = document.components?.badge?.props as Record<string, PropDescriptor>;
    expect(badgeProps.variant.default).toBe('default');
  });

  it('emits React framework bindings with import paths', () => {
    expect(document.frameworkBindings?.react.components?.button).toEqual({
      importPath: './components/ui/button',
      exportName: 'Button',
    });
  });
});

describe('token extraction', () => {
  const document = generateFixture();

  it('extracts the radius token through the relative @import', () => {
    expect(document.tokens?.radius.values.radius).toEqual({
      value: '0.5rem',
      type: 'borderRadius',
    });
  });

  it('wraps Tailwind-v3 raw HSL triplets as valid hsl() colors', () => {
    expect(document.tokens?.color.values.primary.value).toBe('hsl(222.2 47.4% 11.2%)');
    expect(document.tokens?.color.values.primary.type).toBe('color');
  });

  it('extracts dark theme overrides with dot-path keys', () => {
    const dark = document.themes?.dark;
    expect(dark?.name).toBe('Dark');
    expect(Object.keys(dark?.overrides ?? {})).toHaveLength(17);
    expect(dark?.overrides['color.background']).toBe('hsl(222.2 84% 4.9%)');
    expect(dark?.overrides['color.ring']).toBe('hsl(212.7 26.8% 83.9%)');
  });
});

describe('layout extraction', () => {
  const document = generateFixture();

  it('emits Tailwind default breakpoints when the project declares none', () => {
    const breakpoints = document.layout?.breakpoints ?? {};
    expect(Object.keys(breakpoints)).toEqual(['sm', 'md', 'lg', 'xl', '2xl']);
    expect(breakpoints['md']?.minWidth).toBe('768px');
  });

  it('emits the Tailwind spacing scale base unit', () => {
    expect(document.layout?.spacingScale?.baseUnit).toBe('0.25rem');
  });
});
