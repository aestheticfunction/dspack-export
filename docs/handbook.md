# dspack-export — Handbook

Status: **experimental** (`0.1.0-alpha.1`). Not on npm; install from this
repository. Expect rough edges — please report everything that surprises you
(see [CONTRIBUTING](../CONTRIBUTING.md) for the issue templates to use).

## What it does

`dspack-export` generates a [dspack v0.2](https://github.com/aestheticfunction/dspack)
snapshot of a React + Tailwind/shadcn design system: components and props
(including cva variant enums and their defaults), semantic color/radius tokens
from CSS custom properties, dark-theme overrides, layout breakpoints, and React
import bindings. The snapshot is ready to serve to AI agents with
[ds-mcp](https://github.com/aestheticfunction/ds-mcp).

It answers *"what does my design system look like right now."* It does not
watch, diff, repair, or enforce anything — see
[Boundary](#whats-deliberately-not-here).

## Installation (from source)

```bash
git clone https://github.com/aestheticfunction/dspack-export
cd dspack-export
npm install
npm run build
```

Then either invoke it directly:

```bash
node /path/to/dspack-export/dist/cli.js init
```

or link it once so `dspack-export` is on your PATH:

```bash
cd /path/to/dspack-export && npm link
```

## Workflow

From your design-system project root (its dependencies must be installed —
prop extraction runs the TypeScript checker against your tsconfig):

```bash
dspack-export init           # detects conventions, writes dspack-export.config.json
# review/edit the config (especially if init printed notes)
dspack-export generate --config dspack-export.config.json
dspack-export validate <your-system>.dspack.json   # also runs automatically on generate
```

Serve the result to an agent:

```bash
npm install -g @aestheticfunction/ds-mcp
ds-mcp --dspack ./your-system.dspack.json
```

Deterministic output (reviewable diffs, golden files): set
`SOURCE_DATE_EPOCH=<seconds>` to pin `metadata.generatedAt`.

## Supported stack (alpha)

| Surface | Supported | Notes |
|---|---|---|
| React function components (incl. `forwardRef`/`memo`) | ✅ | TypeScript; prop types/descriptions from the TS checker + JSDoc |
| cva (class-variance-authority) variants | ✅ | enum values + `defaultVariants`; association via the `<name>Variants` naming convention |
| Tailwind v3 token CSS (`:root`/`.dark`, raw HSL triplets) | ✅ | triplets wrapped as `hsl(...)` |
| Tailwind v4 token CSS (`@theme`, oklch, `@custom-variant dark`) | ✅ | `var()`-reference entries skipped (resolved value taken from `:root`) |
| Relative CSS `@import` | ✅ | one level deep |
| Breakpoints / spacing scale | ✅ | Tailwind defaults, extended by `@theme --breakpoint-*` / `--spacing` |
| Design token files (DTCG JSON) | ✅ | local file import; resolved values only; `color`, `dimension`, `fontFamily`, `fontWeight` — see [Importing design token files](#importing-design-token-files-dtcg) |
| Storybook | ❌ not yet | planned enrichment (stories, snippets); not required |
| Vue / Svelte / CSS Modules / JS `tailwind.config` screens / direct Figma/Tokens Studio/Style Dictionary integration | ❌ | out of scope |

## Importing design token files (DTCG)

If your tokens live in a **DTCG-format JSON file** (the W3C Design Tokens
Community Group format), point the config at it with `tokens`:

```json
{
  "name": "acme-ui",
  "components": ["components/ui/*.tsx"],
  "tokens": ["tokens/tokens.json"],
  "css": ["app/globals.css"],
  "tsconfig": "tsconfig.json"
}
```

This is a **snapshot import path**, not an integration. The file is read from
disk and folded into the snapshot — there is no network call, no Figma API, no
running tool. Several tools can *produce* such a file as an upstream step, and
any of them works as long as the output is DTCG JSON:

- a **Figma** variables export / Figma MCP token dump,
- **Tokens Studio** (export to DTCG),
- **Style Dictionary** (DTCG source files).

dspack-export has no tool-specific logic for any of these — it reads the
resulting file, nothing more.

**What it imports:** `color`, `dimension`, `fontFamily`, and `fontWeight`
tokens with **resolved** values. The top-level group becomes the dspack token
category; nested groups flatten into kebab-cased names.

**What it skips (with a warning):**
- alias/reference values like `"{color.primary}"` — alias resolution is not
  performed in this version; resolve them in your token tool before export,
- other `$types` (typography composites, shadow, duration, …) that have no
  safe single-string dspack mapping.

**Precedence:** if both a token file and CSS define the same token (same
category + name), the **token file wins** — it is the designer's source of
truth, versus values scraped from compiled CSS. Tokens that exist in only one
source are kept from that source.

`css` and `tokens` are each optional, but at least one must be present.

## Config examples

Minimal (what `init` writes for a typical shadcn app):

```json
{
  "name": "acme-ui",
  "version": "2.1.0",
  "components": ["components/ui/*.tsx"],
  "css": ["app/globals.css"],
  "tsconfig": "tsconfig.json"
}
```

Non-default CSS location and extra component globs:

```json
{
  "name": "acme-ui",
  "components": ["src/components/ui/*.tsx", "src/components/forms/*.tsx"],
  "css": ["src/styles/index.css", "src/styles/theme.css"],
  "tsconfig": "tsconfig.json",
  "output": "acme-ui.dspack.json"
}
```

All relative paths resolve against the config file's directory.

## Known limitations

- **Compound components are flat.** `CardHeader`, `AlertDialogAction`, etc.
  appear as top-level components rather than `composition.subComponents`.
- **cva association is convention-bound.** A cva variable that doesn't follow
  `<component>Variants` naming is dropped with a warning (no phantom entries),
  and its defaults are lost.
- **Breakpoints assume Tailwind defaults** unless declared via `@theme`.
  Customized v3 `tailwind.config.js` screens are not read.
- **Component descriptions need JSDoc.** Components without a JSDoc comment
  get a stub description (dspack requires one).
- **Components the TS checker can't see** (excluded from tsconfig, exotic
  typing) fall back to AST discovery: present, but with stub descriptions and
  no props.
- **Hand-authored dspack sections are not generated** (`patterns`,
  `antiPatterns`, `whenToUse`, `accessibility`, `composition`, `constraints`)
  and **regeneration overwrites the output file** — keep hand edits in a
  separate copy for now (a merge workflow is on the roadmap).
- **DTCG import is resolved-values-only.** Alias/reference values are skipped
  (resolve them in your token tool first); only `color`, `dimension`,
  `fontFamily`, and `fontWeight` types are mapped; other types are skipped with
  a warning. Theme/mode import from DTCG files is not supported yet (dark themes
  still come from CSS `.dark` blocks).

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `components: 0` or missing components | Project `node_modules` not installed; component files not covered by the config glob or the project tsconfig `include`/`paths` |
| Props missing, component present with stub description | TS checker couldn't parse the component — check the warning naming the file; verify it compiles in your project |
| `variant`/`size` have values but no `default` | cva call has no `defaultVariants`, or the cva variable name doesn't match `<component>Variants` (see warnings) |
| `tokens: 0` plus a CSS warning | Wrong `css` path, or tokens live behind a package-level `@import` — list the real file(s) explicitly in `css` |
| DTCG tokens skipped with warnings | Values are aliases (`"{…}"` — resolve them before export) or an unsupported `$type` (only `color`/`dimension`/`fontFamily`/`fontWeight` are imported) |
| Dark overrides missing | Dark values not in a `.dark { … }` block (e.g. media-query-only theming is not read yet); DTCG theme import is not supported yet |
| Generation exits non-zero with schema errors | Please report — the generator should never emit invalid documents |

## What's deliberately not here

This tool is the open-source **snapshot** side of the ecosystem. It will not
gain drift detection, snapshot diffing, watch mode, CI enforcement,
reconciliation, or write-back to code/design tools — keeping a design system
*aligned over time* is [Aesthetic Function](https://github.com/aestheticfunction/aesthetic-function),
the commercial product. Feature requests in that direction will be declined
with a pointer, not triaged.

Token import follows the same rule: dspack-export *reads* a token file someone
else produced and folds it into the snapshot. It does not connect to Figma,
call any design-tool API, or write tokens back to a design tool. Direct Figma
integration, drift detection, reconciliation, and write-back remain out of
scope — only the snapshot import direction (token file → dspack) is supported.
