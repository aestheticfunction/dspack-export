/**
 * Curated allowlist of Vuetify 3 components we detect by template usage.
 *
 * Conservative on purpose: detection only covers well-known primitives. An
 * unrecognized `v-*` tag is ignored rather than guessed at.
 */
export const VUETIFY_COMPONENTS: readonly string[] = [
  'v-alert',
  'v-app-bar',
  'v-autocomplete',
  'v-avatar',
  'v-badge',
  'v-banner',
  'v-btn',
  'v-card',
  'v-checkbox',
  'v-chip',
  'v-combobox',
  'v-data-table',
  'v-dialog',
  'v-divider',
  'v-expansion-panels',
  'v-form',
  'v-icon',
  'v-list',
  'v-menu',
  'v-navigation-drawer',
  'v-pagination',
  'v-progress-circular',
  'v-progress-linear',
  'v-radio-group',
  'v-select',
  'v-sheet',
  'v-slider',
  'v-snackbar',
  'v-switch',
  'v-tabs',
  'v-text-field',
  'v-textarea',
  'v-toolbar',
  'v-tooltip',
];

const VUETIFY_SET = new Set(VUETIFY_COMPONENTS);

/** Normalize a template tag (PascalCase or kebab) to kebab-case. */
export function tagToKebab(tag: string): string {
  if (tag.includes('-')) return tag.toLowerCase();
  return tag
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

export function isVuetifyTag(tag: string): boolean {
  return VUETIFY_SET.has(tagToKebab(tag));
}
