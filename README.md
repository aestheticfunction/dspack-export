# dspack-export

Generate [dspack](https://github.com/aestheticfunction/dspack) v0.2 design-system
snapshots from React + Tailwind/shadcn codebases, ready to serve to AI agents via
[ds-mcp](https://github.com/aestheticfunction/ds-mcp).

**Status: prototype.** Not yet published to npm.

```bash
dspack-export generate --config dspack-export.config.json
dspack-export validate my-system.dspack.json
```

A snapshot answers "what does my design system look like right now": components,
props (including cva variant enums), semantic color/radius tokens from CSS custom
properties, dark-theme overrides, and React import bindings.

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
npm run generate:fixture          # generate the fixture snapshot
DS_MCP=../ds-mcp/dist/index.js scripts/roundtrip.sh   # end-to-end gate check
```

## License

Apache-2.0
