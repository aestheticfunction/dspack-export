# Contributing to dspack-export

dspack-export generates [dspack](https://github.com/aestheticfunction/dspack)
v0.2 snapshots from React + Tailwind/shadcn codebases. Contributions — bug
reports, extraction-gap reports, documentation, and code — are welcome.

This repository is at an early public stage. The pipeline is implemented and
tested against real repositories, but the variety of real-world project
layouts is the main open frontier. The most valuable contribution right now
is running the tool on your design system and reporting what happened.

---

## A note on scope (please read before proposing features)

This tool occupies one deliberate spot in a small ecosystem:

| Concern | Where it lives |
|---|---|
| The dspack file **format** (schema, new fields, validation rules) | [dspack](https://github.com/aestheticfunction/dspack) — spec repo, RFC process |
| **Serving** dspack files to AI agents | [ds-mcp](https://github.com/aestheticfunction/ds-mcp) |
| **Generating** a dspack snapshot from code | **this repository** |
| Keeping code and design **aligned over time** — drift detection, diffing snapshots, watch/monitoring, CI enforcement, reconciliation, write-back | [Aesthetic Function](https://github.com/aestheticfunction/aesthetic-function) (commercial) — **permanently out of scope here** |

The last row is a hard boundary, not a backlog. dspack-export is a snapshot
generator: it has no comparison code path, no stored prior state, and no
notion of "change." Issues and PRs that add drift detection, snapshot
diffing, watch mode, CI gates, or write-back will be closed with a pointer
to this section. This is what keeps the tool small, auditable, and
maintained.

Deferred-but-in-scope (roadmap, PRs welcome after discussion): a merge
workflow that preserves hand-authored dspack sections across regeneration,
Storybook enrichment (stories/snippets from the static manifest), compound
component grouping into `composition.subComponents`, and additional
extraction conventions — see [docs/maintainership.md](docs/maintainership.md)
for how these are triaged.

Component frameworks are now pluggable through a framework-adapter layer
(`src/adapters/`, see [docs/adapters.md](docs/adapters.md)). **React +
Tailwind/shadcn** and **Vue 3 + Vuetify 3** ship today. New adapters (Svelte
next) still require a maintainer-accepted proposal before code — one excellent
stack is worth more than three mediocre ones — but they slot into the existing
contract without pipeline, schema, or assembly changes.

---

## Ways to contribute

### Run a trial on your repo

Follow [docs/trials.md](docs/trials.md). Whether it works or not, the result
is useful — open an issue with the **extraction gap** template if output is
missing or wrong, including your config, the printed warnings, and a minimal
snippet of the component/CSS that extracted incorrectly.

### Bug reports

Use the bug report template. Include the exporter version, Node version,
your config file, and the full command output. If generation produced a
schema-invalid document, that is always a bug — please report it.

### Code contributions

Pull requests are welcome. Ground rules:

- `npm test` must pass; new behavior needs tests (this repo leans on
  golden-file tests — if your change alters output, regenerate fixtures with
  `npm run generate:fixture` and explain the diff in the PR).
- Match existing conventions: TypeScript strict ESM, sources as
  `SourceFragment` producers, no new runtime dependencies without discussion.
- Determinism is load-bearing: output must be byte-identical across runs for
  the same input. No timestamps (outside the `SOURCE_DATE_EPOCH`-controlled
  field), no unordered iteration leaking into output.
- No repo-specific hacks: if a trial repo needs special handling, the fix is
  a general capability or a config option, never a hardcoded case.

### Documentation

Improvements to the [handbook](docs/handbook.md), trial notes, or governance
files are welcome at any time.

---

## Development setup

```bash
npm install
npm run build
npm test                                   # vitest: goldens, units, ds-mcp round-trip
DS_MCP=../ds-mcp/dist/index.js scripts/roundtrip.sh
```

The ds-mcp round-trip test auto-skips if you don't have ds-mcp checked out
next to this repo.

---

## Code of conduct

Participation is governed by the
[Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under
Apache-2.0.
