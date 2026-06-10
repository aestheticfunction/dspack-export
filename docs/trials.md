# Real-repo trials

Goal: verify the exporter on real shadcn-style codebases with **only config
edits** — never repo-specific code in the exporter. If a trial needs an
exporter change, it must be a general capability (or a documented limitation).

## Running a trial

```bash
scripts/trial.sh https://github.com/shadcn-ui/next-template
# or against an existing checkout:
scripts/trial.sh ~/src/some-design-system
```

The target repo's `node_modules` must be installed: prop extraction runs the
TypeScript checker against the repo's own tsconfig. The script installs for
fresh clones (`SKIP_INSTALL=1` to skip).

## Candidate repos

| Repo | Stack | What it exercises |
|---|---|---|
| `shadcn-ui/next-template` | Tailwind v3 | classic `:root`/`.dark` HSL triplets, `styles/globals.css`, forwardRef components |
| `shadcn-ui/taxonomy` | Tailwind v3 | larger app, same conventions at scale |
| `satnaing/shadcn-admin` | Tailwind v4 | `@theme`, `@custom-variant dark`, tokens behind `@import './theme.css'` |

## Results (2026-06-10, exporter 0.1.0-alpha.0)

| Repo | Config edits | Result | Notes |
|---|---|---|---|
| `shadcn-ui/next-template` (TW v3) | **none** | ✅ valid | 1 component, 19 color tokens, 20 dark overrides; Button variants/defaults match upstream cva |
| `satnaing/shadcn-admin` (TW v4) | **one** — `css: ["src/styles/index.css"]` (path not in init candidates) | ✅ valid | 148 components; oklch tokens resolved through `@import './theme.css'`; 23 dark overrides; 19 enum props with cva defaults. Before the edit: graceful degradation (components only + 3 precise warnings) |
| `shadcn-ui/taxonomy` (TW v3, large app) | **none** | ✅ valid | 152 components; `Toaster` missed by docgen but caught by the AST fallback (stub entry); orphan `portalVariants` cva correctly dropped with a warning; Button variants/defaults match upstream |

Observed across trials: component counts include compound sub-parts as flat
entries (known limitation); both degradation paths (docgen miss → AST
fallback, cva naming mismatch → drop + warn) fired in real code and behaved
as designed.

## What to record per trial

1. Did `init` detect the right paths? Which notes were printed?
2. Config edits needed (and whether they're reasonable to ask of users).
3. `generate` summary: component/token/theme counts, warnings.
4. Spot-check: one component's variants/defaults vs. the source cva; one token
   value vs. the CSS; dark overrides present.
5. Schema validation result.
6. Anything that suggests a missing general capability — file as an issue, do
   not patch ad hoc.
