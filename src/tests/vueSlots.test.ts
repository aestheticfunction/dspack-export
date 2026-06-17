import { describe, it, expect } from 'vitest';
import { parseScriptAst, parseVueSfc } from '../adapters/vue/parseSfc.js';
import {
  slotNamesFromDefineSlots,
  slotNamesFromTemplate,
  buildSlotProps,
  type TemplateNode,
} from '../adapters/vue/extractSlots.js';

function templateSlots(sfc: string): string[] {
  const { descriptor } = parseVueSfc(sfc, 'X.vue');
  const warnings: string[] = [];
  return slotNamesFromTemplate(descriptor.template?.ast as TemplateNode | undefined, warnings);
}

describe('slot extraction', () => {
  it('defineSlots type literal names', () => {
    const ast = parseScriptAst(`defineSlots<{ default(): any; header(p: { title: string }): any }>()`, 'ts');
    expect(slotNamesFromDefineSlots(ast)).toEqual(['default', 'header']);
  });

  it('template <slot> tags (default + named)', () => {
    expect(
      templateSlots(`<template><div><slot /><slot name="header" /><slot name="footer" /></div></template>`),
    ).toEqual(['default', 'header', 'footer']);
  });

  it('treats a non-name binding on <slot> as a default slot', () => {
    expect(templateSlots(`<template><slot :foo="bar" /></template>`)).toEqual(['default']);
  });

  it('skips a dynamic :name slot and warns', () => {
    const { descriptor } = parseVueSfc(`<template><slot :name="dynamic" /></template>`, 'X.vue');
    const warnings: string[] = [];
    const names = slotNamesFromTemplate(descriptor.template?.ast as TemplateNode | undefined, warnings);
    expect(names).toEqual([]);
    expect(warnings.join(' ')).toMatch(/dynamic :name/);
  });

  it('normalizes default → children and named → sorted slot:<name>', () => {
    const { props } = buildSlotProps(['default', 'header', 'footer']);
    expect(Object.keys(props)).toEqual(['children', 'slot:footer', 'slot:header']);
    expect(props.children).toEqual({ type: 'node', propRole: 'slot' });
    expect(props['slot:header']).toEqual({ type: 'node', propRole: 'slot' });
  });

  it('does not collide named slots with real prop names (slot: prefix)', () => {
    const { props } = buildSlotProps(['header']);
    expect(props.header).toBeUndefined();
    expect(props['slot:header']).toBeDefined();
  });
});
