# dspack-export v0.2.0-alpha.0

Released: 2026-06-22

## What's new

**First-class Vue 3 + Vuetify 3 support**, delivered on a new
**framework-adapter architecture**. dspack-export is no longer React-only: it is
a framework-agnostic, deterministic, source-driven snapshot generator with React
and Vue adapters today and a clean path to Svelte next.

### Framework-adapter architecture

Component extraction now runs through a `FrameworkAdapter`
(`src/adapters/types.ts`, see [docs/adapters.md](../docs/adapters.md)). Adapters
own everything framework-specific and emit the same normalized `SourceFragment`s
the pipeline already consumed. Token extraction, assembly, provenance, warnings,
validation, deterministic output, and the single output-file write stay shared
and unchanged.

- The React path was refactored **in place** behind a `ReactAdapter` — same
  fragments, same precedence, **byte-identical golden output**.
- `frameworkBindings` is namespaced per adapter (`frameworkBindings.react`,
  `frameworkBindings.vue`).
- Adapter selection: optional `framework: "react" | "vue"` config field, inferred
  from component file extensions when omitted, **hard error before extraction**
  on mixed/ambiguous input (nothing is written).

### Vue 3 extraction

- **`<script setup>`** — type-based `defineProps<T>()` + `withDefaults`, runtime
  `defineProps({ ... })` / `defineProps([...])`. Types, required flags, literal
  defaults, enum-like union values, and JSDoc descriptions are read from the
  **original script AST** (`@vue/compiler-sfc` is the authoritative SFC/macro
  parser; `compileScript` is the macro-analysis aid).
- **Options API** — `defineComponent({ props, emits })` / `export default {}`,
  including the `name` option.
- **Emits** — `defineEmits` (type and array forms) and Options `emits`,
  normalized to `on<PascalEvent>` handler props (`update:modelValue` →
  `onUpdateModelValue`); raw event names preserved in `frameworkBindings.vue`.
- **Slots** — `defineSlots` and template `<slot>`: default → `children`, named →
  `slot:<name>` (namespaced to avoid prop collisions).
- **Vuetify 3 usage** — conservative allowlist detection (`v-btn`, `v-card`,
  `v-text-field`, `v-select`, `v-data-table`, `v-tabs`, `v-dialog`, …), surfaced
  additively as component `tags` and binding `guidance`.

### Conservative by default

Anything partial, ambiguous, or unsafe — computed/factory defaults, spread
props, dynamic emit/slot lists, cross-file imported prop types — is **omitted
with a provenance-tagged warning**, never guessed.

## Scope

- **No schema change.** The dspack v0.2 `frameworkBindings` map already accepts
  any framework id; slots/events reuse the existing `propRole` encoding.
- **One new runtime dependency:** `@vue/compiler-sfc` (Vue's own compiler —
  required for `<script setup>` macros; `vue-docgen-api` was rejected for a
  larger dep tree and less deterministic control). `@babel/parser` (already a
  dep) handles script bodies. `vue` is a devDependency for fixtures.
- **Unchanged invariants:** no network, no shell, no design-tool API, no watch,
  no drift detection, no reconciliation, no write-back beyond the output file.

## Stats

- Tests: 92 passing (was 51) + 1 skipped (ds-mcp round-trip).
- React extraction unchanged: the only golden diff is the `metadata.generatedBy`
  version stamp (regenerated for the `0.2.0-alpha.0` bump). New Vue golden
  fixture: `fixtures/vuetify-demo`.
- Goldens regenerate with `npm run generate:fixture` / `npm run generate:fixture:vue`
  (and the shadcn-v4 / DTCG configs via the CLI with `SOURCE_DATE_EPOCH=1781049600`).
