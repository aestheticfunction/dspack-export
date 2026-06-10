/**
 * Layout primitives source (narrow, Tailwind-stack assumptions).
 *
 * Breakpoints: Tailwind's defaults are the project's breakpoints unless the
 * Tailwind v4 `@theme` block overrides or extends them via --breakpoint-*.
 * Spacing scale: Tailwind's 0.25rem base unit, overridable via @theme --spacing.
 * Tailwind-v3 JS-config screens are intentionally not parsed in this slice.
 */
import type { SourceFragment } from '../../fragment.js';
import type { BreakpointEntry } from '../../types.js';
import { parseCssVars } from './cssVariables.js';

export interface LayoutOptions {
  cssFiles: string[];
}

/** Tailwind default screens (v3 and v4 share these). */
const TAILWIND_DEFAULT_BREAKPOINTS: Record<string, BreakpointEntry> = {
  sm: { minWidth: '640px', description: 'Small devices and large phones in landscape.' },
  md: { minWidth: '768px', description: 'Tablets.' },
  lg: { minWidth: '1024px', description: 'Laptops and small desktops.' },
  xl: { minWidth: '1280px', description: 'Desktops.' },
  '2xl': { minWidth: '1536px', description: 'Large desktops.' },
};

const DEFAULT_SPACING_BASE = '0.25rem';

export function extractLayout(options: LayoutOptions): SourceFragment {
  const { themeVars, warnings } = parseCssVars(options.cssFiles);

  const breakpoints: Record<string, BreakpointEntry> = { ...TAILWIND_DEFAULT_BREAKPOINTS };
  for (const [name, raw] of themeVars) {
    const match = name.match(/^breakpoint-(.+)$/);
    if (!match) continue;
    const value = raw.trim();
    if (value.includes('var(')) continue;
    breakpoints[match[1]] = {
      minWidth: value,
      ...(breakpoints[match[1]]?.description ? { description: breakpoints[match[1]].description } : {}),
    };
  }

  const spacingVar = themeVars.get('spacing');
  const baseUnit = spacingVar && !spacingVar.includes('var(') ? spacingVar.trim() : DEFAULT_SPACING_BASE;

  return {
    provenance: 'tailwind-layout',
    precedence: 100,
    confidence: 'medium',
    layout: {
      breakpoints,
      spacingScale: {
        baseUnit,
        description: `Spacing follows a ${baseUnit} base unit; use integer multiples of the scale.`,
      },
    },
    warnings,
  };
}
