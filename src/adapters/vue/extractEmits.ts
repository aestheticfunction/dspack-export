/**
 * Vue emits extraction → normalized handler props.
 *
 * Handles `defineEmits` (type-literal call-signature form, type-literal
 * property form, and runtime array form) and the Options API `emits` option.
 * Each event becomes a `propRole: "handler"` / `type: "function"` prop named
 * `on<PascalEvent>`; the raw event names are returned for frameworkBindings.
 */
import * as t from '@babel/types';
import type { File } from '@babel/types';
import type { PropDescriptor } from '../../types.js';
import { getTraverse, emitNameToHandlerProp } from './astHelpers.js';
import { getOptionsProperty } from './extractProps.js';

const traverse = getTraverse();

export interface EmitExtraction {
  /** Raw Vue event names in source order (deduped). */
  events: string[];
  /** Normalized handler props keyed by `on<PascalEvent>`. */
  props: Record<string, PropDescriptor>;
  warnings: string[];
}

function eventsFromTypeLiteral(lit: t.TSTypeLiteral): string[] {
  const events: string[] = [];
  for (const member of lit.members) {
    // Form: (e: 'click', ...) => void
    if (t.isTSCallSignatureDeclaration(member)) {
      const first = member.parameters[0];
      if (first && t.isIdentifier(first) && first.typeAnnotation && t.isTSTypeAnnotation(first.typeAnnotation)) {
        const ta = first.typeAnnotation.typeAnnotation;
        if (t.isTSLiteralType(ta) && t.isStringLiteral(ta.literal)) events.push(ta.literal.value);
      }
      continue;
    }
    // Form: { click: [payload]; 'row-click': [] }
    if (t.isTSPropertySignature(member)) {
      const key = t.isIdentifier(member.key)
        ? member.key.name
        : t.isStringLiteral(member.key)
          ? member.key.value
          : undefined;
      if (key) events.push(key);
    }
  }
  return events;
}

function eventsFromArray(arr: t.ArrayExpression): string[] {
  return arr.elements.filter((e): e is t.StringLiteral => t.isStringLiteral(e)).map((e) => e.value);
}

function buildExtraction(rawEvents: string[]): EmitExtraction {
  const seen = new Set<string>();
  const events: string[] = [];
  for (const e of rawEvents) {
    if (!seen.has(e)) {
      seen.add(e);
      events.push(e);
    }
  }
  const props: Record<string, PropDescriptor> = {};
  for (const e of events) {
    props[emitNameToHandlerProp(e)] = { type: 'function', propRole: 'handler' };
  }
  return { events, props, warnings: [] };
}

export function extractSetupEmits(setupAst: File): EmitExtraction {
  let call: t.CallExpression | undefined;
  traverse(setupAst, {
    CallExpression(path) {
      const callee = path.node.callee;
      if (t.isIdentifier(callee) && callee.name === 'defineEmits' && !call) call = path.node;
    },
  });
  if (!call) return { events: [], props: {}, warnings: [] };

  const typeArg = call.typeParameters?.params[0];
  if (typeArg && t.isTSTypeLiteral(typeArg)) return buildExtraction(eventsFromTypeLiteral(typeArg));

  const arg = call.arguments[0];
  if (arg && t.isArrayExpression(arg)) return buildExtraction(eventsFromArray(arg));

  return { events: [], props: {}, warnings: [] };
}

export function extractOptionsEmits(optionsObj: t.ObjectExpression): EmitExtraction {
  const node = getOptionsProperty(optionsObj, 'emits');
  if (!node) return { events: [], props: {}, warnings: [] };
  if (t.isArrayExpression(node)) return buildExtraction(eventsFromArray(node));
  // Object form: { 'event': validator } — keys are event names.
  if (t.isObjectExpression(node)) {
    const events: string[] = [];
    for (const prop of node.properties) {
      if (!t.isObjectProperty(prop)) continue;
      const key = t.isIdentifier(prop.key) ? prop.key.name : t.isStringLiteral(prop.key) ? prop.key.value : undefined;
      if (key) events.push(key);
    }
    return buildExtraction(events);
  }
  return { events: [], props: {}, warnings: [] };
}
