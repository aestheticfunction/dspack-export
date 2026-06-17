/**
 * Vue golden-file tests: the full pipeline run on fixtures/vuetify-demo must
 * reproduce the committed snapshot exactly, be deterministic across runs, and
 * pass dspack v0.2 schema validation — with zero schema changes.
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
const FIXTURE_CONFIG = join(REPO_ROOT, 'fixtures', 'vuetify-demo', 'dspack-export.config.json');
const GOLDEN_PATH = join(REPO_ROOT, 'fixtures', 'vuetify-demo', 'vuetify-demo.dspack.json');
const GOLDEN_GENERATED_AT = '2026-06-10T00:00:00.000Z';

function generateFixture(): DspackDocument {
  const config = loadConfig(FIXTURE_CONFIG);
  const { document } = generateDocument(config, { generatedAt: GOLDEN_GENERATED_AT });
  return document;
}

describe('vue golden file', () => {
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
});

describe('vue component extraction (golden facts)', () => {
  const document = generateFixture();

  it('extracts type-based defineProps + withDefaults (enum, default, role)', () => {
    const props = document.components?.['app-button']?.props as Record<string, PropDescriptor>;
    expect(props.variant.type).toBe('enum');
    expect(props.variant.values).toEqual(['primary', 'secondary', 'tonal']);
    expect(props.variant.default).toBe('primary');
    expect(props.variant.propRole).toBe('choice');
    expect(props.disabled.propRole).toBe('flag');
    expect(props.disabled.default).toBe(false);
  });

  it('normalizes the default slot to children and named slots to slot:<name>', () => {
    const btnProps = document.components?.['app-button']?.props as Record<string, PropDescriptor>;
    expect(btnProps.children.propRole).toBe('slot');
    const cardProps = document.components?.['data-card']?.props as Record<string, PropDescriptor>;
    expect(cardProps['slot:header'].propRole).toBe('slot');
    expect(cardProps['slot:footer'].propRole).toBe('slot');
  });

  it('normalizes emits to on<PascalEvent> handler props and preserves raw names', () => {
    const props = document.components?.['status-badge']?.props as Record<string, PropDescriptor>;
    expect(props.onDismiss).toEqual({ type: 'function', propRole: 'handler' });
    expect(props.onUpdateModelValue.propRole).toBe('handler');
    expect(document.frameworkBindings?.vue.components?.['status-badge']?.emits).toEqual([
      'dismiss',
      'update:modelValue',
    ]);
  });

  it('extracts Options API props with the explicit name option', () => {
    expect(document.components?.['status-badge']?.name).toBe('StatusBadge');
    const props = document.components?.['status-badge']?.props as Record<string, PropDescriptor>;
    expect(props.label.required).toBe(true);
    expect(props.count.default).toBe(0);
  });

  it('emits Vue framework bindings with .vue import paths', () => {
    expect(document.frameworkBindings?.vue.name).toBe('Vue 3');
    expect(document.frameworkBindings?.vue.components?.['app-button']?.importPath).toBe(
      './src/components/AppButton.vue',
    );
  });

  it('detects Vuetify usage conservatively (sorted, additive)', () => {
    expect(document.components?.['form-field']?.tags).toEqual([
      'vuetify:v-select',
      'vuetify:v-text-field',
    ]);
    expect(document.frameworkBindings?.vue.components?.['app-button']?.guidance).toContain('v-btn');
  });
});
