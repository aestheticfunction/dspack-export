/**
 * Conservative Vuetify 3 usage detection.
 *
 * Walks the template AST and records which allowlisted Vuetify components a
 * local component composes. Detection only — we never infer Vuetify's own prop
 * semantics into the local component. Returns a sorted, unique list for stable
 * output.
 */
import { isVuetifyTag, tagToKebab } from './vuetifyComponents.js';
import type { TemplateNode } from './extractSlots.js';

const NODE_ELEMENT = 1;

export function detectVuetifyUsage(root: TemplateNode | undefined): string[] {
  if (!root) return [];
  const found = new Set<string>();

  const visit = (node: TemplateNode): void => {
    if (node.type === NODE_ELEMENT && node.tag && isVuetifyTag(node.tag)) {
      found.add(tagToKebab(node.tag));
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);

  return [...found].sort();
}
