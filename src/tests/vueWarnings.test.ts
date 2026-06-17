/**
 * The Vue adapter must omit-and-warn (never guess) on ambiguous/unsafe input.
 * These assertions lock in the warning behavior over the fixture.
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadConfig } from '../config.js';
import { generateDocument } from '../generate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const FIXTURE_CONFIG = join(REPO_ROOT, 'fixtures', 'vuetify-demo', 'dspack-export.config.json');

describe('vue adapter warnings', () => {
  const config = loadConfig(FIXTURE_CONFIG);
  const { warnings } = generateDocument(config, { generatedAt: '2026-06-10T00:00:00.000Z' });

  it('warns on string-array props (no type information)', () => {
    expect(warnings.some((w) => /ArrayProps.*no type information/.test(w))).toBe(true);
  });

  it('warns on a non-literal (factory) default and omits it', () => {
    expect(warnings.some((w) => /"rows".*non-literal default/.test(w))).toBe(true);
  });

  it('prefixes warnings with the fragment provenance', () => {
    expect(warnings.every((w) => w.startsWith('[vue-sfc-docgen]'))).toBe(true);
  });
});
