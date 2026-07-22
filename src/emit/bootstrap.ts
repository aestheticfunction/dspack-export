/**
 * The DX-3 bootstrap boundary (dspack rfc/dx3-bootstrap-design.md):
 * current-spec emission, the metadata `x-bootstrap` ledger, and the
 * regeneration refusal table.
 *
 * The ledger is NON-SEMANTIC: it exists solely so this tool can make
 * regeneration decisions. Its presence or absence does not affect the
 * meaning or validity of a dspack contract, and deleting it is how a team
 * graduates a document to fully human-owned (after which this tool refuses
 * to touch the file, always).
 */
import { createHash } from 'node:crypto';
import type { DspackDocument } from '../types.js';

/** The spec version this release of the tool emits. */
export const SPEC_VERSION = '0.4';

/** The sections this tool generates and (while their hashes match) owns. */
export const GENERATED_SECTIONS = [
  'tokens',
  'components',
  'frameworkBindings',
  'themes',
  'layout',
] as const;

/**
 * Governance surfaces a snapshot leaves for humans to author. A visible
 * checklist for people — tools never police it, and an empty governance
 * block is deliberately NOT emitted in its place ("unauthored" and
 * "deliberately none" must stay distinguishable).
 */
export const AWAITING_AUTHORSHIP = [
  'categories',
  'intents',
  'rules',
  'examples',
  'patterns',
  'antiPatterns',
  'components.*.whenToUse',
  'components.*.accessibility',
  'components.*.composition',
  'components.*.constraints',
] as const;

/** Top-level keys that are neither generated sections nor human governance. */
const BASE_KEYS = new Set(['dspack', 'name', 'description', 'version', 'metadata']);

export interface BootstrapLedger {
  spec: string;
  generated: Record<string, string>;
  awaitingAuthorship: string[];
}

/** Content hash of one generated section (canonical = the deterministic emitted JSON). */
export function sectionHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

/** Build the ledger for a freshly assembled document (hashes of present sections only). */
export function buildLedger(document: DspackDocument): BootstrapLedger {
  const generated: Record<string, string> = {};
  for (const section of GENERATED_SECTIONS) {
    const value = (document as Record<string, unknown>)[section];
    if (value !== undefined) generated[section] = sectionHash(value);
  }
  return { spec: SPEC_VERSION, generated, awaitingAuthorship: [...AWAITING_AUTHORSHIP] };
}

export type RegenerationDecision = { allow: true } | { allow: false; reason: string };

const WORKFLOW_HINT =
  'The documented workflow is snapshot -> commit -> enrich; regenerate to a fresh path with --out and compare by hand. ' +
  'See ADOPTING.md in the dspack repository.';

/**
 * The refusal table (rfc/dx3-bootstrap-design.md section 3). Invariant:
 * regeneration never destroys human-authored content; when in doubt it
 * refuses and says why. There is deliberately no force override.
 */
export function decideRegeneration(existingContent: string | null): RegenerationDecision {
  if (existingContent === null) return { allow: true };

  let existing: Record<string, unknown>;
  try {
    existing = JSON.parse(existingContent) as Record<string, unknown>;
  } catch {
    return {
      allow: false,
      reason: `the existing output file is not valid JSON, so ownership cannot be established. ${WORKFLOW_HINT}`,
    };
  }

  const metadata = (existing.metadata ?? {}) as Record<string, unknown>;
  const ledger = metadata['x-bootstrap'] as BootstrapLedger | undefined;
  if (!ledger || typeof ledger !== 'object' || typeof ledger.generated !== 'object') {
    return {
      allow: false,
      reason: `the existing document carries no bootstrap ledger (metadata["x-bootstrap"]), so it is human-owned and this tool will not touch it. ${WORKFLOW_HINT}`,
    };
  }

  const humanSections = Object.keys(existing).filter(
    (key) => !BASE_KEYS.has(key) && !(key in ledger.generated),
  );
  if (humanSections.length > 0) {
    return {
      allow: false,
      reason: `the existing document contains human-authored sections (${humanSections.join(', ')}); regenerating would sit alongside content this tool does not own. ${WORKFLOW_HINT}`,
    };
  }

  const edited = Object.entries(ledger.generated)
    .filter(([section, recorded]) => {
      const value = existing[section];
      return value === undefined || sectionHash(value) !== recorded;
    })
    .map(([section]) => section);
  if (edited.length > 0) {
    return {
      allow: false,
      reason: `generated section(s) were edited by hand since the snapshot was written (${edited.join(', ')}); regenerating would destroy those edits. ${WORKFLOW_HINT}`,
    };
  }

  return { allow: true };
}
