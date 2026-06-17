# Framework adapters

dspack-export separates **framework-specific component extraction** from the
**shared snapshot pipeline**. Component extraction is the only framework-aware
stage; everything else — token extraction, assembly, provenance, warnings,
schema validation, deterministic output — is shared and identical across
frameworks.

## The contract

An adapter implements `FrameworkAdapter` (`src/adapters/types.ts`):

```ts
interface FrameworkAdapter {
  readonly id: string;             // also the frameworkBindings namespace key, ^[a-z][a-z0-9-]*$
  readonly displayName: string;    // FrameworkBinding.name, e.g. "Vue 3"
  readonly extensions: readonly string[]; // for auto-detection, e.g. [".vue"]
  extractComponents(ctx: AdapterContext): SourceFragment[];
}
```

`AdapterContext` is read-only: the already-resolved, sorted component file
paths, the project root, and (React only) a tsconfig path. **Adapters must be
pure** — they read only the listed source files. No network, no shell, no design
tool access, no writes. The shared layer owns the single output-file write.

`extractComponents` returns one or more normalized `SourceFragment`s — the same
shape every existing extractor emits. A fragment carries `components`,
`frameworkBindings`, and `warnings`, plus a `precedence`/`confidence`. The
assembler (`src/emit/assemble.ts`) merges fragments by precedence and never
references an adapter by name.

## Selection

`resolveAdapter(config)` (`src/adapters/registry.ts`) picks exactly one adapter
per run:

1. explicit `config.framework` wins (and warns, non-fatally, about files whose
   extension the adapter doesn't claim);
2. otherwise the framework is **inferred** from component file extensions
   (`.tsx/.jsx/.ts/.js` → `react`, `.vue` → `vue`);
3. mixed, empty, or unknown extensions are a **hard error before extraction** —
   nothing is written — instructing the maintainer to set `framework` explicitly.

One snapshot describes one component framework. Token sources (CSS variables,
DTCG, Tailwind layout) are framework-independent and run regardless of adapter.

## Shared vs. framework-specific

| Shared (never per-framework) | Framework-specific (in an adapter) |
|---|---|
| `SourceFragment` + `toDspackId` | component/prop/slot/event extraction |
| assembly, merge, warning aggregation | `frameworkBindings.<id>` production |
| schema validation + bundled schema | parser/compiler choice |
| output write + serialization | naming/role heuristics |
| determinism scaffolding (glob sort, `SOURCE_DATE_EPOCH`) | |
| token sources (CSS / DTCG / layout) | |

## Normalization conventions (cross-framework)

So consumers see a uniform surface regardless of framework:

- **Slots** → `PropDescriptor` with `propRole: "slot"`, `type: "node"`. Default
  slot is named `children`; named slots are `slot:<name>` (prefixed to avoid
  colliding with real props like `header`/`item`).
- **Events** → `PropDescriptor` with `propRole: "handler"`, `type: "function"`,
  named `on<PascalEvent>` (`click` → `onClick`, `update:modelValue` →
  `onUpdateModelValue`). The framework's raw event name is preserved in that
  framework's binding.
- **Conservative by default:** anything partial, ambiguous, or unsafe is omitted
  with a provenance-tagged warning, never guessed.

## Adding an adapter

1. Implement `FrameworkAdapter` under `src/adapters/<id>/`.
2. Emit normalized `SourceFragment`s and a `frameworkBindings.<id>` namespace.
3. Register it in `src/adapters/registry.ts` (one entry).
4. Add a fixture + golden test mirroring `fixtures/vuetify-demo` and
   `src/tests/vueGolden.test.ts`.

No pipeline, schema, or assembly changes are required. See the existing
`react` and `vue` adapters for reference.
