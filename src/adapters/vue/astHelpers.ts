/**
 * Shared AST helpers for the Vue adapter: babel-traverse interop, JSDoc/comment
 * extraction, TS-type → dspack-prop mapping, and literal-value reading.
 *
 * Everything here is conservative: when a shape can't be read safely it returns
 * a signal the caller turns into an omit-and-warn, never a guess.
 */
import * as babelTraverse from '@babel/traverse';
import type { TraverseOptions } from '@babel/traverse';
import * as t from '@babel/types';

// Same ESM/CJS interop shim as src/sources/ast/cvaVariants.ts.
export function getTraverse(): (parent: t.Node, opts?: TraverseOptions<unknown>) => void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = babelTraverse as any;
  if (typeof mod === 'function') return mod;
  if (typeof mod.default === 'function') return mod.default;
  if (mod.default && typeof mod.default.default === 'function') return mod.default.default;
  throw new Error('Could not resolve @babel/traverse function');
}

/** Read a literal node into its JS value. Returns { ok:false } for non-literals. */
export function literalValue(node: t.Node | null | undefined): { ok: true; value: unknown } | { ok: false } {
  if (!node) return { ok: false };
  if (t.isStringLiteral(node)) return { ok: true, value: node.value };
  if (t.isNumericLiteral(node)) return { ok: true, value: node.value };
  if (t.isBooleanLiteral(node)) return { ok: true, value: node.value };
  if (t.isNullLiteral(node)) return { ok: true, value: null };
  // `-1` etc.
  if (t.isUnaryExpression(node) && node.operator === '-' && t.isNumericLiteral(node.argument)) {
    return { ok: true, value: -node.argument.value };
  }
  return { ok: false };
}

/**
 * Extract a cleaned JSDoc/description from a node's leading comments.
 * Mirrors the spirit of react-docgen descriptions: strip `*` gutters and trim.
 */
export function descriptionFromComments(node: t.Node | null | undefined): string | undefined {
  const comments = node?.leadingComments;
  if (!comments || comments.length === 0) return undefined;
  // Use the last leading comment (closest to the declaration).
  const raw = comments[comments.length - 1];
  if (raw.type !== 'CommentBlock') return undefined;
  const cleaned = raw.value
    .split('\n')
    .map((line) => line.replace(/^\s*\*?\s?/, '').trimEnd())
    .join('\n')
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export interface TypeShape {
  type: string;
  values?: unknown[];
  /** True when the type is exactly `boolean` (drives propRole flag). */
  isBoolean?: boolean;
  /** True when the type is a function/handler signature. */
  isFunction?: boolean;
  /** True when we could not read the type safely (caller may warn). */
  unresolved?: boolean;
}

/** Map a TS type annotation node to a dspack prop shape. Conservative. */
export function tsTypeToShape(node: t.TSType | null | undefined): TypeShape {
  if (!node) return { type: 'unknown', unresolved: true };

  if (t.isTSStringKeyword(node)) return { type: 'string' };
  if (t.isTSNumberKeyword(node)) return { type: 'number' };
  if (t.isTSBooleanKeyword(node)) return { type: 'boolean', isBoolean: true };
  if (t.isTSFunctionType(node)) return { type: 'function', isFunction: true };
  if (t.isTSArrayType(node)) return { type: 'array' };

  if (t.isTSUnionType(node)) {
    const literals: unknown[] = [];
    let allStringLiterals = true;
    for (const member of node.types) {
      if (t.isTSLiteralType(member) && t.isStringLiteral(member.literal)) {
        literals.push(member.literal.value);
      } else if (
        // tolerate `| null | undefined` without breaking the enum
        t.isTSNullKeyword(member) ||
        t.isTSUndefinedKeyword(member)
      ) {
        continue;
      } else {
        allStringLiterals = false;
        break;
      }
    }
    if (allStringLiterals && literals.length > 0) {
      return { type: 'enum', values: literals };
    }
    return { type: 'union', unresolved: true };
  }

  if (t.isTSLiteralType(node) && t.isStringLiteral(node.literal)) {
    return { type: 'enum', values: [node.literal.value] };
  }

  if (t.isTSTypeReference(node) && t.isIdentifier(node.typeName)) {
    const name = node.typeName.name;
    if (name === 'Array' || name === 'ReadonlyArray') return { type: 'array' };
    if (name === 'Function') return { type: 'function', isFunction: true };
    // Unknown named type: surface the name but flag as not deeply resolved.
    return { type: name, unresolved: true };
  }

  if (t.isTSObjectKeyword(node) || t.isTSTypeLiteral(node)) return { type: 'object' };

  return { type: 'unknown', unresolved: true };
}

/** Map a Vue runtime constructor identifier (String/Number/...) to a dspack type. */
export function constructorToType(name: string): TypeShape | undefined {
  switch (name) {
    case 'String':
      return { type: 'string' };
    case 'Number':
      return { type: 'number' };
    case 'Boolean':
      return { type: 'boolean', isBoolean: true };
    case 'Array':
      return { type: 'array' };
    case 'Object':
      return { type: 'object' };
    case 'Function':
      return { type: 'function', isFunction: true };
    case 'Date':
      return { type: 'date' };
    case 'Symbol':
      return { type: 'symbol' };
    default:
      return undefined;
  }
}

/** Assign a conservative propRole from type shape + prop name, mirroring React. */
export function inferPropRole(name: string, shape: TypeShape): PropRole | undefined {
  if (shape.isBoolean) return 'flag';
  if (shape.isFunction) return 'handler';
  if (shape.type === 'enum') {
    if (name === 'variant') return 'choice';
    if (name === 'size' || name === 'density') return 'dimension';
    return 'choice';
  }
  if (name === 'variant') return 'choice';
  if (name === 'size' || name === 'density') return 'dimension';
  if (/^on[A-Z]/.test(name)) return 'handler';
  return undefined;
}

export type PropRole = 'flag' | 'dimension' | 'choice' | 'slot' | 'handler' | 'content' | 'state';

/** Vue emit name → React-style handler prop name. `update:modelValue` → `onUpdateModelValue`. */
export function emitNameToHandlerProp(eventName: string): string {
  const pascal = eventName
    .split(/[:\-]/)
    .filter(Boolean)
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join('');
  return `on${pascal}`;
}
