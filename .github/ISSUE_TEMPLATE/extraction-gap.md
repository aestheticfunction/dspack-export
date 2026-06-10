---
name: Extraction gap
about: The tool ran, but something in your design system was missed or extracted incorrectly
labels: extraction-gap
---

**What was missed or wrong** (component, prop, token, theme, breakpoint)

**Minimal source snippet** (the component or CSS as it appears in your repo)

```tsx
```

**What the generated output contains** (or omits)

```json
```

**Setup**
- dspack-export version:
- Tailwind version (v3 / v4):
- Your config:

```json
```

- Warnings printed by `generate`:

```
```

> Tip: warnings are designed to explain gaps — `cva variants for "x" matched
> no extracted component`, `found no components in <file>`, and CSS-path
> warnings each point at a specific known cause (see
> [docs/handbook.md](../../docs/handbook.md) troubleshooting).
