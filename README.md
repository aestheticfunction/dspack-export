# dspack-export

Bootstrap current-spec [dspack](https://github.com/aestheticfunction/dspack)
design-system snapshots from component codebases — **React + Tailwind/shadcn** and **Vue 3 +
Vuetify 3** — ready to serve to AI agents via
[ds-mcp](https://github.com/aestheticfunction/ds-mcp).

> Part of the [dspack ecosystem](https://github.com/aestheticfunction) — the organization profile has the full map of how the repositories fit together.
>
> **Kind:** snapshot tool (CLI, experimental, npm `@aestheticfunction/dspack-export`) · **Audience:** teams with an existing component codebase who want a starting dspack file · **Neighbors:** produces [dspack](https://github.com/aestheticfunction/dspack) documents; serves them via [ds-mcp](https://github.com/aestheticfunction/ds-mcp); see the governed end-to-end chain in [dspack-studio](https://github.com/aestheticfunction/dspack-studio) ([hosted replay](https://studio.aesthetic-function.com))
>
> This tool is **step 1** of the adoption journey; what to do with the snapshot it produces — review, governance authoring, validation, serving — is the [adoption guide](https://github.com/aestheticfunction/dspack/blob/main/ADOPTING.md).

Component extraction runs through a framework-adapter layer (see
[docs/adapters.md](docs/adapters.md)); the shared pipeline — token extraction,
assembly, provenance, warnings, validation, deterministic output — is identical
across frameworks. The active adapter is chosen by an optional `framework` config
field, or inferred from component file extensions (`.tsx/.jsx` → React, `.vue` →
Vue) with a hard error on ambiguous input.

**Status: experimental** (`0.3.0`). Config format and output details may
still change between versions. Published to npm as
`@aestheticfunction/dspack-export`. The [handbook](docs/handbook.md) covers
the supported stack, known limitations, and troubleshooting.

The snapshot declares the current spec version (v0.4) and populates the
machine-discoverable sections only. The governance layer (categories,
intents, rules, examples, patterns, anti-patterns, and prose guidance) is
hand-authored downstream, never extracted — the output's
`metadata["x-bootstrap"]` ledger records exactly which sections this tool
generated (with content hashes) and which surfaces await authorship. The
ledger is non-semantic: it exists only so regeneration can make safe
decisions, and deleting it marks the document fully human-owned.

**Regeneration never destroys human-authored content.** If the output file
contains anything this tool does not own — governance blocks, edited
sections, or no ledger at all — `generate` refuses, explains why, and
points at `--out` for writing a fresh snapshot elsewhere. There is no
force flag.

## Install

```bash
npm install -g @aestheticfunction/dspack-export
```

Or from source:

```bash
git clone https://github.com/aestheticfunction/dspack-export
cd dspack-export && npm install && npm run build && npm link
```

Then, from your design-system project (with its own dependencies installed):

```bash
dspack-export init                                    # detect conventions, write config
dspack-export generate --config dspack-export.config.json
dspack-export validate my-system.dspack.json
```

A snapshot answers "what does my design system look like right now": components,
props (including cva variant enums **and their defaults**, or Vue
`defineProps`/`withDefaults` types and defaults), semantic color/radius tokens
from CSS custom properties (Tailwind v3 and v4 conventions), dark-theme
overrides, layout breakpoints, and per-framework import bindings
(`frameworkBindings.react` or `frameworkBindings.vue`).

For Vue 3 SFCs the Vue adapter extracts props (`<script setup>` type-based and
runtime `defineProps`/`withDefaults`, plus the Options API), emits (normalized to
`on<Event>` handler props), slots (default → `children`, named → `slot:<name>`),
and conservative Vuetify 3 usage detection. See
[Vue 3 + Vuetify 3](docs/handbook.md#vue-3--vuetify-3).

Tokens can also be imported from a **DTCG design-token JSON file** — the
interchange format that Figma exports, Tokens Studio, and Style Dictionary can
produce — via the `tokens` config field. This is a file-based snapshot import,
not a tool integration: no Figma API, no network. See
[Importing design token files](docs/handbook.md#importing-design-token-files-dtcg).

Validated against real repositories — see [trial results](docs/trials.md):
shadcn-ui/next-template and shadcn-ui/taxonomy with zero config edits,
satnaing/shadcn-admin with one.

## How it fits the ecosystem

```
your component codebase
        │
        ▼
  dspack-export  ──────►  your-system.dspack.json  ──────►  ds-mcp  ──────►  AI agents
  (this repo:              (open format, defined by         (serves it       (Claude, Cursor, …)
   snapshot generator)      the dspack specification)        over MCP)
```

- **[dspack](https://github.com/aestheticfunction/dspack)** — the open
  specification: what a design-system snapshot contains.
- **dspack-export** (this repo) — generates a spec-valid snapshot from code.
- **[ds-mcp](https://github.com/aestheticfunction/ds-mcp)** — serves a
  snapshot to MCP-compatible AI agents, read-only.
- **[Aesthetic Function](https://github.com/aestheticfunction/aesthetic-function)**
  — the open-core reconciliation engine beneath a commercial product: it
  reads a committed dspack file as a reference contract and continuously
  checks Figma, code, and docs against it.

## What this tool is not

dspack-export generates **snapshots only**. It has no drift detection, no
diffing, no watch mode, no CI enforcement, no write-back, and no reconciliation —
those concerns belong to [Aesthetic Function](https://github.com/aestheticfunction/aesthetic-function).
Hand-authored dspack sections (patterns, antiPatterns, whenToUse, accessibility,
composition, constraints) are not generated; author them in the output file or a
downstream copy.

## Development

```bash
npm install
npm run build
npm test                          # vitest: golden files, units, ds-mcp round-trip
npm run generate:fixture          # regenerate the fixture snapshot (pinned epoch)
DS_MCP=../ds-mcp/dist/index.js scripts/roundtrip.sh   # end-to-end gate check
scripts/trial.sh <repo-url>       # run against a real repo (docs/trials.md)
```

## Contributing & scope

See [CONTRIBUTING.md](CONTRIBUTING.md) — especially the scope section before
proposing features — plus [SECURITY.md](SECURITY.md) (the tool's three
invariants: writes only its output file, no network, no shell execution) and
[docs/maintainership.md](docs/maintainership.md).

## License

Apache-2.0
