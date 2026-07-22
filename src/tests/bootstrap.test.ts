/**
 * DX-3 bootstrap boundary (rfc/dx3-bootstrap-design.md in the dspack repo):
 * current-spec emission, the metadata x-bootstrap ledger, and the
 * regeneration refusal table. Written fail-first against the pre-boundary
 * generator.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadConfig } from '../config.js';
import { generateDocument } from '../generate.js';
import {
  SPEC_VERSION,
  GENERATED_SECTIONS,
  sectionHash,
  decideRegeneration,
} from '../emit/bootstrap.js';
import type { DspackDocument } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const FIXTURE_CONFIG = join(REPO_ROOT, 'fixtures', 'shadcn-demo', 'dspack-export.config.json');
const GENERATED_AT = '2026-06-10T00:00:00.000Z';

function generateFixture(): DspackDocument {
  const config = loadConfig(FIXTURE_CONFIG);
  const { document } = generateDocument(config, { generatedAt: GENERATED_AT });
  return document;
}

type Ledger = {
  spec: string;
  generated: Record<string, string>;
  awaitingAuthorship: string[];
};

function ledgerOf(doc: DspackDocument): Ledger {
  return (doc.metadata as Record<string, unknown>)['x-bootstrap'] as Ledger;
}

describe('current-spec emission', () => {
  const doc = generateFixture();

  it('declares the current spec version, not 0.2', () => {
    expect(doc.dspack).toBe(SPEC_VERSION);
    expect(SPEC_VERSION).toBe('0.4');
  });

  it('states the refusal guarantee in the metadata note, not the overwrite warning', () => {
    const note = String((doc.metadata as Record<string, unknown>).note);
    expect(note).not.toContain('will be overwritten');
    expect(note).toContain('refuse');
  });
});

describe('the x-bootstrap ledger', () => {
  const doc = generateFixture();
  const ledger = ledgerOf(doc);

  it('is present, spec-stamped, and non-semantic metadata', () => {
    expect(ledger).toBeDefined();
    expect(ledger.spec).toBe(SPEC_VERSION);
  });

  it('records a content hash for every generated section present in the document', () => {
    for (const section of GENERATED_SECTIONS) {
      const value = (doc as Record<string, unknown>)[section];
      if (value === undefined) {
        expect(ledger.generated[section]).toBeUndefined();
      } else {
        expect(ledger.generated[section]).toBe(sectionHash(value));
      }
    }
    // Nothing beyond the generated set is ever claimed by the tool.
    for (const key of Object.keys(ledger.generated)) {
      expect(GENERATED_SECTIONS).toContain(key);
    }
  });

  it('names the governance surfaces awaiting authorship', () => {
    expect(ledger.awaitingAuthorship).toContain('rules');
    expect(ledger.awaitingAuthorship).toContain('intents');
    expect(ledger.awaitingAuthorship).toContain('examples');
    expect(ledger.awaitingAuthorship).toContain('categories');
  });

  it('emits no empty governance blocks', () => {
    for (const block of ['categories', 'intents', 'rules', 'examples', 'patterns', 'antiPatterns']) {
      expect((doc as Record<string, unknown>)[block]).toBeUndefined();
    }
  });

  it('is deterministic (ledger hashes included)', () => {
    expect(JSON.stringify(generateFixture())).toBe(JSON.stringify(doc));
  });
});

describe('regeneration refusal table', () => {
  const doc = generateFixture();
  const raw = JSON.stringify(doc, null, 2) + '\n';

  it('allows when no file exists', () => {
    expect(decideRegeneration(null)).toEqual({ allow: true });
  });

  it('refuses an unparseable file', () => {
    const d = decideRegeneration('not json {');
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.reason).toMatch(/JSON/i);
  });

  it('refuses, always, when the ledger is absent (human-owned document)', () => {
    const owned = JSON.parse(raw) as DspackDocument;
    delete (owned.metadata as Record<string, unknown>)['x-bootstrap'];
    const d = decideRegeneration(JSON.stringify(owned));
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.reason).toMatch(/human-owned|no bootstrap ledger/i);
  });

  it('allows a pure untouched snapshot', () => {
    expect(decideRegeneration(raw)).toEqual({ allow: true });
  });

  it('refuses when human-authored sections are present, even with matching hashes', () => {
    const enriched = JSON.parse(raw) as Record<string, unknown>;
    enriched.intents = [{ id: 'signup-form', description: 'x' }];
    const d = decideRegeneration(JSON.stringify(enriched));
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.reason).toContain('intents');
  });

  it('refuses when a generated section was edited, naming the section', () => {
    const edited = JSON.parse(raw) as DspackDocument;
    (edited.components as Record<string, { whenToUse?: string }>)['button'].whenToUse = 'enriched';
    const d = decideRegeneration(JSON.stringify(edited));
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.reason).toContain('components');
  });
});
