# Maintainership Guidelines — Scope Protection

This document is the maintainer's playbook for keeping dspack-export focused.
It exists because the most predictable failure mode of a tool like this is
not bad code — it is accretion of nearby features until the snapshot
generator becomes a monitoring platform nobody can audit.

## The one-sentence test

> dspack-export answers "what does my design system look like **right now**."
> Aesthetic Function answers "how do I keep it aligned **over time**."

If a request requires remembering a previous run, comparing two states, or
changing anything outside the output file, it fails the test.

## Likely requests and standing responses

| Request (expected phrasing) | Response | Rationale |
|---|---|---|
| "Add a `diff` command for two snapshots" / "fail CI when the dspack changes" / "watch mode" | **Decline.** Close with pointer to CONTRIBUTING scope section and Aesthetic Function. | Commercial boundary. Also architectural: no comparison code path exists, deliberately. |
| "Write tokens back to my CSS" / "fix my code from the dspack" | **Decline.** Same pointer. | Write-back is AF's domain; this tool writes one output file, ever (see SECURITY.md invariants). |
| "Preserve my hand-edits when regenerating" (`--merge`) | **Defer to roadmap.** Label `roadmap`, link the tracking issue. | In scope (still snapshot-shaped), highest-value next feature; needs careful design so it never becomes three-way reconciliation. |
| "Group CardHeader under Card" (compound components) | **Defer to roadmap.** | In scope; data already exists; design discussion welcome on the issue. |
| "Read my Storybook stories/descriptions" | **Defer to roadmap.** | Planned as optional enrichment from the static manifest only (no dev-server/addon dependency). |
| "Support Vue / Svelte / Angular" | **Require an RFC-style proposal first**; don't accept drive-by adapter PRs. | Each framework is a permanent maintenance commitment. The `SourceFragment` seam makes it *possible*; the proposal must show who maintains it. |
| "Parse my customized tailwind.config.js screens" | **Defer; lean no.** | v3 JS-config parsing was deliberately cut; `@theme` covers v4 and the config escape hatch covers the rest. Revisit only with evidence of frequent real-world need. |
| "Import my **DTCG token file**" / "read my exported design tokens JSON" | **Supported.** This is the file-based token import path (`tokens` config). | Snapshot-only, file-in: a token file someone else produced is folded into the snapshot. Stays on the safe side of the line — see the import-vs-integration distinction below. |
| "Connect directly to **Figma** / call the Figma API / live-sync Figma variables" | **Decline.** | That is integration, not file import — it crosses into design-tool reading and AF territory. The supported path is: export a DTCG file from Figma, then point `tokens` at it. No direct API, ever, in this repo. |
| "Add **Tokens Studio / Style Dictionary**-specific parsing" | **Decline / require justification.** | We import the *common* DTCG format only. Tool-specific formats (`$themes`, token sets, SD transforms) would multiply maintenance. If a tool emits DTCG, it already works. |
| "Resolve token **aliases** (`{color.primary}`) during import" | **Defer; lean cautious.** | Resolution is a small graph engine that grows quickly (cross-file refs, cycles, modes). Today aliases are skipped with a warning; resolve them in the upstream tool. Revisit only with strong demand and a tight spec. |
| "Publish my dspack to a registry/CDN" | **Decline.** | Distribution of generated files is the user's concern; ds-mcp covers agent serving. |

### Import vs. integration (the token-file line)

Importing a **token file** is supported and on the right side of the boundary:
a file produced elsewhere is read once and folded into the snapshot — no
network, no design-tool API, no write-back. **Integration** (calling Figma,
syncing live variables, writing tokens back) is not, and never will be in this
repo. The test is direction and statefulness: *file → dspack, once* is fine;
*talk to a tool / remember a prior state / write outward* is not.

## How to decline well

- Always name the boundary, not just "out of scope": link the CONTRIBUTING
  table row so the reasoning is public and consistent.
- Acknowledge the need is real. "Keeping snapshots in sync over time is a
  real problem — it's the problem Aesthetic Function exists to solve" reads
  better than "wontfix."
- Convert what's convertible: a diff request sometimes hides an extraction
  bug ("the snapshot changed and I don't know why"). Ask for the two configs
  before closing.
- Close decisively. A "maybe later" label on a boundary-crossing request is
  how scope dies.

## Commercial boundary, restated for maintainers

The exporter must remain excellent and genuinely useful standalone — it is
the ecosystem's front door, not crippleware. The boundary is drawn by
*capability class* (snapshot vs. time), not by quality. Nothing in this repo
should ever check for a license, phone home, or degrade to upsell. The
upsell is simply that real teams eventually want the time dimension, and
that is a different product.
