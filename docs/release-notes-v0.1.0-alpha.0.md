# dspack-export v0.1.0-alpha.0

First public release. **Experimental** — the config format and output details
may change between versions, and this tool has been validated by one
maintainer against three real repositories, not by a crowd. That's exactly
why it's public: to find out what your repo does to it.

## What it does

`dspack-export` generates a [dspack v0.2](https://github.com/aestheticfunction/dspack)
snapshot of your design system — a single JSON file AI agents can query via
[ds-mcp](https://github.com/aestheticfunction/ds-mcp) — directly from your
codebase:

- **Components and props** via the TypeScript checker: types, required flags,
  JSDoc descriptions, defaults.
- **cva variant enums with their true defaults** — `variant: "default" |
  "destructive" | …` including `defaultVariants`, the data that
  react-docgen-based tooling can't see inside `VariantProps`.
- **Color and radius tokens** from CSS custom properties — both Tailwind v3
  conventions (`:root`/`.dark`, raw HSL triplets, normalized to `hsl()`) and
  v4 (`@theme`, oklch, `@custom-variant dark`), following relative `@import`s.
- **Dark-theme overrides**, **layout breakpoints** (Tailwind defaults plus
  `@theme --breakpoint-*`), and **React import bindings**.

Output is deterministic (`SOURCE_DATE_EPOCH` pins the timestamp), validated
against the bundled dspack v0.2 JSON Schema on every run, and round-trip
tested against ds-mcp, the reference consumer.

## Who it's for

Teams with a React + Tailwind/shadcn-style component library who want their
design system queryable by AI agents without hand-authoring a dspack file
from scratch. The generated snapshot is a starting point: the
highest-value dspack sections (`patterns`, `antiPatterns`, `whenToUse`,
`accessibility`, `constraints`) are institutional knowledge and remain yours
to write.

## Supported stack (this release)

React function components in TypeScript (including `forwardRef`/`memo`),
cva variants via the `<name>Variants` convention, Tailwind v3 and v4 token
CSS. Not yet: Storybook enrichment, compound-component grouping, regeneration
that preserves hand edits (`--merge`), customized v3 `tailwind.config.js`
screens. Full matrix and limitations: [docs/handbook.md](handbook.md).

Validated against: `shadcn-ui/next-template` and `shadcn-ui/taxonomy` (zero
config edits), `satnaing/shadcn-admin` (one path edit) — details in
[docs/trials.md](trials.md).

## Intentionally out of scope — permanently

This is a **snapshot** generator. It will not gain drift detection, snapshot
diffing, watch mode, CI enforcement, reconciliation, or write-back to code
or design tools. That problem — keeping a design system aligned *over time* —
is [Aesthetic Function](https://github.com/aestheticfunction/aesthetic-function),
the commercial product this tool is the open front door to. The boundary is
architectural (there is no comparison code path to extend) and documented in
[CONTRIBUTING](../CONTRIBUTING.md).

## How to report extraction gaps usefully

If the tool runs but misses or mangles something in your system, open an
**extraction gap** issue with: your config, the warnings `generate` printed
(they're designed to explain gaps), a minimal snippet of the source that
extracted wrong, and what the output contains instead. A reproducible
snippet beats a repo link; a repo link beats a description.

## Install

```bash
git clone https://github.com/aestheticfunction/dspack-export
cd dspack-export && npm install && npm run build && npm link

cd /path/to/your/design-system
dspack-export init && dspack-export generate --config dspack-export.config.json
```

Not yet on npm — that's a separate, later step.
