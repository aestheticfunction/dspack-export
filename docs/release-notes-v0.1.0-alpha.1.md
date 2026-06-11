# dspack-export v0.1.0-alpha.1

Released: 2026-06-11

## What's new

**DTCG design-token-file import** — dspack-export can now read W3C Design Tokens
Community Group (DTCG) JSON files and fold them into the snapshot alongside
CSS-extracted tokens.

### How it works

Add a `tokens` field to your config pointing at one or more local DTCG JSON files:

```json
{
  "name": "acme-ui",
  "components": ["components/ui/*.tsx"],
  "tokens": ["tokens/tokens.json"],
  "css": ["app/globals.css"],
  "tsconfig": "tsconfig.json"
}
```

Several tools can produce these files as an upstream step — Figma variable exports,
Tokens Studio (export to DTCG), Style Dictionary source files — and any of them
works as long as the output is DTCG JSON. dspack-export has no tool-specific logic;
it reads the file, nothing more.

### Scope

- **Imported types:** `color`, `dimension`, `fontFamily`, `fontWeight` (resolved
  values only).
- **Skipped with a warning:** alias/reference values (`"{color.primary}"`) and
  unsupported `$type`s (typography composites, shadow, duration, etc.).
- **Precedence:** when both a token file and CSS define the same token, the
  **token file wins** (designer source of truth over compiled-CSS scraping).
- **File-based only:** no Figma API, no network calls, no write-back. A local
  JSON file is read once and folded into the snapshot.

### What this does NOT add

- Direct Figma API integration
- Tokens Studio or Style Dictionary-specific parsing
- Alias/reference resolution
- Theme/mode import from DTCG files (dark themes still come from CSS `.dark`)
- Merge behavior, Storybook enrichment, compound grouping, npm publishing

## Stats

- 52 tests (17 new), all green
- ds-mcp round-trip gate: pass
- Boundary audit: clean (no network, no write beyond output, no shell)
