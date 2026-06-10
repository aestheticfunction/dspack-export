import { describe, it, expect } from 'vitest';
import { dtcgDocToTokens } from '../sources/tokens/designTokens.js';

describe('dtcgDocToTokens — type mapping', () => {
  it('maps color tokens with group-inherited $type and $description', () => {
    const { tokens } = dtcgDocToTokens({
      color: {
        $type: 'color',
        primary: { $value: '#2563eb', $description: 'Brand.' },
        accent: { $value: '#f59e0b' },
      },
    });
    expect(tokens.color.values.primary).toEqual({ value: '#2563eb', type: 'color', description: 'Brand.' });
    expect(tokens.color.values.accent).toEqual({ value: '#f59e0b', type: 'color' });
    expect(tokens.color.tier).toBe('semantic');
  });

  it('maps dimension tokens from both string and { value, unit } object forms', () => {
    const { tokens } = dtcgDocToTokens({
      spacing: {
        $type: 'dimension',
        sm: { $value: '8px' },
        md: { $value: { value: 16, unit: 'px' } },
      },
    });
    expect(tokens.spacing.values.sm).toEqual({ value: '8px', type: 'dimension' });
    expect(tokens.spacing.values.md).toEqual({ value: '16px', type: 'dimension' });
  });

  it('joins fontFamily arrays and stringifies fontWeight', () => {
    const { tokens } = dtcgDocToTokens({
      font: {
        sans: { $type: 'fontFamily', $value: ['Inter', 'system-ui', 'sans-serif'] },
        bold: { $type: 'fontWeight', $value: 700 },
      },
    });
    expect(tokens.font.values.sans.value).toBe('Inter, system-ui, sans-serif');
    expect(tokens.font.values.sans.type).toBe('fontFamily');
    expect(tokens.font.values.bold).toEqual({ value: '700', type: 'fontWeight' });
  });

  it('flattens nested groups into category + kebab name', () => {
    const { tokens } = dtcgDocToTokens({
      color: { $type: 'color', brand: { primary: { $value: '#000' } } },
    });
    expect(tokens.color.values['brand-primary']).toEqual({ value: '#000', type: 'color' });
  });
});

describe('dtcgDocToTokens — skips and warnings', () => {
  it('skips alias/reference values with a warning', () => {
    const { tokens, warnings } = dtcgDocToTokens({
      color: { $type: 'color', alias: { $value: '{color.primary}' } },
    });
    expect(tokens.color?.values.alias).toBeUndefined();
    expect(warnings.some((w) => w.includes('alias/reference'))).toBe(true);
  });

  it('skips unsupported $types with a warning', () => {
    const { tokens, warnings } = dtcgDocToTokens({
      effect: { shadowSm: { $type: 'shadow', $value: { color: '#000', blur: '2px' } } },
    });
    expect(tokens.effect).toBeUndefined();
    expect(warnings.some((w) => w.includes('unsupported $type "shadow"'))).toBe(true);
  });

  it('skips tokens with no resolvable $type', () => {
    const { tokens, warnings } = dtcgDocToTokens({ misc: { x: { $value: 'whatever' } } });
    expect(tokens.misc).toBeUndefined();
    expect(warnings.some((w) => w.includes('no $type'))).toBe(true);
  });

  it('skips a color token whose value is a non-string composite', () => {
    const { warnings } = dtcgDocToTokens({
      color: { $type: 'color', weird: { $value: { r: 1, g: 2, b: 3 } } },
    });
    expect(warnings.some((w) => w.includes('non-scalar or unsupported value'))).toBe(true);
  });

  it('warns when the document is not an object', () => {
    expect(dtcgDocToTokens(null).warnings[0]).toContain('not a JSON object');
    expect(dtcgDocToTokens('nope').warnings[0]).toContain('not a JSON object');
  });
});
