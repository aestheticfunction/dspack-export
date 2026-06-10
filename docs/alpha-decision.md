# Alpha Decision Report (2026-06-10)

## What works (evidence-backed)

- **End-to-end pipeline on real repos**: three trials (next-template, taxonomy,
  shadcn-admin) all produced schema-valid dspack v0.2; two needed zero config
  edits, one needed a single documented `css` path edit. See docs/trials.md.
- **The hard extraction problem**: cva `VariantProps` resolved to exact enum
  values with true defaults from `defaultVariants` — the data plain react-docgen
  and Storybook's manifest cannot see.
- **Both Tailwind generations**: v3 `:root`/`.dark` HSL triplets (normalized to
  `hsl()`) and v4 `@theme`/oklch/`@custom-variant` (with `var()`-reference
  skipping), including tokens behind relative `@import`s.
- **Designed degradation, observed in the wild**: docgen miss → AST fallback
  entry (taxonomy `Toaster`); cva naming mismatch → dropped with warning, no
  phantom (taxonomy `portalVariants`).
- **Engineering hygiene**: deterministic output (`SOURCE_DATE_EPOCH`), 35
  tests including byte-stable golden files and a live ds-mcp round-trip,
  generation hard-fails on schema invalidity.

## What does not work (known, accepted for alpha)

- Compound components emit flat (148/152 counts include sub-parts) — noisy for
  agent consumers; the strongest candidate for the first post-alpha feature.
- cva association requires the `<name>Variants` convention; defaults are lost
  (with a warning) otherwise.
- Customized Tailwind-v3 `tailwind.config.js` screens are ignored (defaults
  asserted); media-query-only dark theming is not read; component descriptions
  require JSDoc; regeneration overwrites hand edits (no merge yet).

## What should remain out of scope

Permanently (commercial boundary, enforced by absence of code paths):
drift detection, diffing, watch/monitoring, CI enforcement, reconciliation,
write-back, Figma reading. Deferred (roadmap, not alpha blockers): `--merge`,
Storybook enrichment, compound grouping, additional frameworks, v3 config
parsing.

## Recommendation: create the public GitHub repo next — after private feedback

Proceed in two steps:

1. **Now**: share this repo privately with 3–5 friendly design-system teams
   using docs/handbook.md. The riskiest unknowns left are *other people's
   repos and expectations*, which private alpha exists to surface cheaply,
   before issues/PRs are public.
2. **Public repo gate** (target: after the feedback round, ~2 weeks): no
   trial-blocking bugs from alpha users; CONTRIBUTING.md + SECURITY.md written
   (scope guardrails from the plan, §12); ds-mcp/dspack README funnel PRs
   prepared to land the same day so the public repo arrives with its
   distribution story attached.

Nothing technical blocks going public today — the gate is purely about
arriving once, with feedback incorporated and the funnel ready.
