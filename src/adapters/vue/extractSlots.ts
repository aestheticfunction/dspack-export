/**
 * Vue slot extraction → normalized slot props.
 *
 * Sources: `defineSlots<{ ... }>()` (type-literal members) and `<slot>` tags in
 * the template. Names are normalized deterministically:
 *   default slot → `children`   (matches React's convention)
 *   named slot   → `slot:<name>` (namespaced to avoid colliding with real props)
 * Each slot is a `propRole: "slot"` / `type: "node"` prop. Named slots are
 * sorted lexically for stable output regardless of compiler iteration order.
 */
import * as t from '@babel/types';
import type { File } from '@babel/types';
import type { PropDescriptor } from '../../types.js';
import { getTraverse } from './astHelpers.js';

const traverse = getTraverse();

export interface SlotExtraction {
  props: Record<string, PropDescriptor>;
  warnings: string[];
}

/** Slot names declared via `defineSlots<{ default(...): ...; header(...): ... }>()`. */
export function slotNamesFromDefineSlots(setupAst: File): string[] {
  let call: t.CallExpression | undefined;
  traverse(setupAst, {
    CallExpression(path) {
      const callee = path.node.callee;
      if (t.isIdentifier(callee) && callee.name === 'defineSlots' && !call) call = path.node;
    },
  });
  const typeArg = call?.typeParameters?.params[0];
  if (!typeArg || !t.isTSTypeLiteral(typeArg)) return [];
  const names: string[] = [];
  for (const member of typeArg.members) {
    if (t.isTSPropertySignature(member) || t.isTSMethodSignature(member)) {
      const key = t.isIdentifier(member.key)
        ? member.key.name
        : t.isStringLiteral(member.key)
          ? member.key.value
          : undefined;
      if (key) names.push(key);
    }
  }
  return names;
}

// Minimal structural typing over the compiler-dom template AST (kept loose so a
// Vue minor bump only affects this isolated walk).
interface TemplateNode {
  type: number;
  tag?: string;
  props?: Array<{ type: number; name?: string; value?: { content?: string } }>;
  children?: TemplateNode[];
}

const NODE_ELEMENT = 1;
const ATTR_STATIC = 6;

/** Walk a template AST root and collect `<slot>` names ("default" for unnamed). */
export function slotNamesFromTemplate(root: TemplateNode | undefined, warnings: string[]): string[] {
  const names: string[] = [];
  if (!root) return names;

  const visit = (node: TemplateNode): void => {
    if (node.type === NODE_ELEMENT && node.tag === 'slot') {
      const nameAttr = (node.props ?? []).find((p) => p.type === ATTR_STATIC && p.name === 'name');
      if (nameAttr) {
        const content = nameAttr.value?.content;
        if (content) names.push(content);
      } else {
        // Either an unnamed (default) slot, or a dynamically-named one (:name).
        const dynamicName = (node.props ?? []).some((p) => p.type !== ATTR_STATIC && p.name === 'bind');
        if (dynamicName) warnings.push('a <slot> uses a dynamic name and was skipped');
        else names.push('default');
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
  return names;
}

/** Combine declared + template slot names into normalized slot props. */
export function buildSlotProps(allNames: string[]): SlotExtraction {
  const set = new Set(allNames);
  const props: Record<string, PropDescriptor> = {};

  if (set.has('default')) {
    props['children'] = { type: 'node', propRole: 'slot' };
    set.delete('default');
  }
  for (const name of [...set].sort()) {
    props[`slot:${name}`] = { type: 'node', propRole: 'slot' };
  }
  return { props, warnings: [] };
}

export type { TemplateNode };
