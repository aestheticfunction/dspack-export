import { describe, it, expect } from 'vitest';
import { parseVueSfc } from '../adapters/vue/parseSfc.js';
import { detectVuetifyUsage } from '../adapters/vue/vuetifyUsage.js';
import { isVuetifyTag, tagToKebab } from '../adapters/vue/vuetifyComponents.js';
import type { TemplateNode } from '../adapters/vue/extractSlots.js';

function usage(template: string): string[] {
  const { descriptor } = parseVueSfc(`<template>${template}</template>`, 'X.vue');
  return detectVuetifyUsage(descriptor.template?.ast as TemplateNode | undefined);
}

describe('vuetify tag matching', () => {
  it('normalizes PascalCase to kebab', () => {
    expect(tagToKebab('VBtn')).toBe('v-btn');
    expect(tagToKebab('VDataTable')).toBe('v-data-table');
  });

  it('matches allowlisted components, kebab or Pascal', () => {
    expect(isVuetifyTag('v-btn')).toBe(true);
    expect(isVuetifyTag('VBtn')).toBe(true);
    expect(isVuetifyTag('v-not-a-real-component')).toBe(false);
    expect(isVuetifyTag('div')).toBe(false);
  });
});

describe('detectVuetifyUsage', () => {
  it('returns sorted unique allowlisted components used in the template', () => {
    expect(
      usage(`<v-card><v-btn /><v-text-field /><v-btn /><custom-thing /></v-card>`),
    ).toEqual(['v-btn', 'v-card', 'v-text-field']);
  });

  it('ignores non-Vuetify and unknown v-* tags', () => {
    expect(usage(`<div><v-mystery /><span /></div>`)).toEqual([]);
  });
});
