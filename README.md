# dspack-export

Generate [dspack](https://github.com/aestheticfunction/dspack) v0.2 design-system
snapshots from React + Tailwind/shadcn codebases, ready to serve to AI agents via
[ds-mcp](https://github.com/aestheticfunction/ds-mcp).

**Status: private alpha** (`0.1.0-alpha.0`). Not published to npm; install from
this repository — see the [handbook](docs/handbook.md) for setup, supported
stack, limitations, and troubleshooting.

```bash
dspack-export init                                    # detect conventions, write config
dspack-export generate --config dspack-export.config.json
dspack-export validate my-system.dspack.json
```

A snapshot answers "what does my design system look like right now": components,
props (including cva variant enums **and their defaults**), semantic color/radius
tokens from CSS custom properties (Tailwind v3 and v4 conventions), dark-theme
overrides, layout breakpoints, and React import bindings.

Validated against real repositories — see [trial results](docs/trials.md):
shadcn-ui/next-template and shadcn-ui/taxonomy with zero config edits,
satnaing/shadcn-admin with one.

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

## License

Apache-2.0
