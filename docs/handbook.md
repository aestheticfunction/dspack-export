# dspack-export — Private Alpha Handbook

Status: **private alpha** (`0.1.0-alpha.0`). Not on npm; install from this
repository. Expect rough edges — please report everything that surprises you.

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

## Installation (private alpha)

```bash
git clone <this-repo> dspack-export
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
| Storybook | ❌ not yet | planned enrichment (stories, snippets); not required |
| Vue / Svelte / CSS Modules / JS `tailwind.config` screens / Figma | ❌ | out of scope for alpha |

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

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `components: 0` or missing components | Project `node_modules` not installed; component files not covered by the config glob or the project tsconfig `include`/`paths` |
| Props missing, component present with stub description | TS checker couldn't parse the component — check the warning naming the file; verify it compiles in your project |
| `variant`/`size` have values but no `default` | cva call has no `defaultVariants`, or the cva variable name doesn't match `<component>Variants` (see warnings) |
| `tokens: 0` plus a CSS warning | Wrong `css` path, or tokens live behind a package-level `@import` — list the real file(s) explicitly in `css` |
| Dark overrides missing | Dark values not in a `.dark { … }` block (e.g. media-query-only theming is not read yet) |
| Generation exits non-zero with schema errors | Please report — the generator should never emit invalid documents |

## What's deliberately not here

This tool is the open-source **snapshot** side of the ecosystem. It will not
gain drift detection, snapshot diffing, watch mode, CI enforcement,
reconciliation, or write-back to code/design tools — keeping a design system
*aligned over time* is [Aesthetic Function](https://github.com/aestheticfunction/aesthetic-function),
the commercial product. Feature requests in that direction will be declined
with a pointer, not triaged.
