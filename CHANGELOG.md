# Changelog

## 0.3.0

The DX-3 bootstrap boundary (dspack `rfc/dx3-bootstrap-design.md`), and the
first npm-published release.

- Snapshots declare the current spec version (**dspack 0.4**) instead of the
  hard-coded 0.2; the manual relabel step disappears from the adoption
  journey. Populated sections are unchanged — this tool still writes no
  governance content, ever.
- Every snapshot carries a **non-semantic `metadata["x-bootstrap"]` ledger**:
  the spec version, a content hash per generated section, and the list of
  governance surfaces awaiting human authorship. Deleting the ledger marks a
  document fully human-owned.
- **Regeneration refusal table**: `generate` refuses to overwrite any file it
  cannot prove it owns — no ledger, human-authored sections present, or a
  generated section edited by hand — and every refusal explains why. There
  is deliberately no force flag. A pure untouched snapshot still
  regenerates in place.
- `generate --out <file>` writes the snapshot to an explicit path.
- `validate` now checks against a vendored byte copy of the dspack **v0.4**
  schema, guarded by `scripts/check-sync.mjs` (shape gate only; full
  contract validation lives in the dspack repository's harness).
- CI (`test.yml`) and tag-triggered OIDC trusted publishing (`release.yml`),
  mirroring ds-mcp/dspack-gen.

Release note: 0.3.0 itself was published manually (npm's trusted-publisher
flow needed the package to exist first); the trusted publisher is now
registered, and OIDC publishing is exercised from the next versioned
release onward.

## 0.2.0-alpha.0

Unpublished baseline: v0.2 snapshot generation (React + Tailwind/shadcn and
Vue 3 + Vuetify 3 adapters, DTCG token import, deterministic output,
round-trip gate against ds-mcp).
