import { describe, it, expect } from 'vitest';
import { extractCvaFromSource } from '../sources/ast/cvaVariants.js';

describe('extractCvaFromSource', () => {
  it('extracts axes, values, and defaults from a shadcn-style cva call', () => {
    const code = `
      import { cva } from 'class-variance-authority';
      const buttonVariants = cva('base', {
        variants: {
          variant: { default: 'a', destructive: 'b' },
          size: { sm: 'c', lg: 'd' },
        },
        defaultVariants: { variant: 'default', size: 'sm' },
      });
    `;
    const [extraction] = extractCvaFromSource(code);
    expect(extraction.variableName).toBe('buttonVariants');
    expect(extraction.componentGuess).toBe('Button');
    expect(extraction.axes.variant).toEqual({ values: ['default', 'destructive'], default: 'default' });
    expect(extraction.axes.size).toEqual({ values: ['sm', 'lg'], default: 'sm' });
  });

  it('handles boolean variant keys and boolean defaults', () => {
    const code = `
      import { cva } from 'class-variance-authority';
      const alertVariants = cva('base', {
        variants: { inset: { true: 'pl-7', false: '' } },
        defaultVariants: { inset: false },
      });
    `;
    const [extraction] = extractCvaFromSource(code);
    expect(extraction.axes.inset.values).toEqual(['true', 'false']);
    expect(extraction.axes.inset.default).toBe(false);
  });

  it('returns nothing for files without cva calls', () => {
    expect(extractCvaFromSource('export const x = 1;')).toEqual([]);
  });

  it('ignores cva calls without a variants config', () => {
    const code = `
      import { cva } from 'class-variance-authority';
      const plain = cva('base');
    `;
    expect(extractCvaFromSource(code)).toEqual([]);
  });

  it('guesses the component name from the *Variants convention', () => {
    const code = `
      import { cva } from 'class-variance-authority';
      const badgeVariants = cva('base', { variants: { variant: { default: '' } } });
    `;
    expect(extractCvaFromSource(code)[0].componentGuess).toBe('Badge');
  });
});
