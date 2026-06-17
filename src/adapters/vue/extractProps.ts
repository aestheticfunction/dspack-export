/**
 * Vue prop extraction.
 *
 * Handles, conservatively (omit + warn on anything unsafe):
 *  - `<script setup>` type-based   `defineProps<T>()` (+ `withDefaults`)
 *  - `<script setup>` runtime      `defineProps({ ... })` / `defineProps([...])`
 *  - Options API                   `{ props: { ... } }` / `defineComponent({ props })`
 */
import * as t from '@babel/types';
import type { File } from '@babel/types';
import type { PropDescriptor } from '../../types.js';
import {
  getTraverse,
  literalValue,
  descriptionFromComments,
  tsTypeToShape,
  constructorToType,
  inferPropRole,
  type TypeShape,
} from './astHelpers.js';

const traverse = getTraverse();

export interface PropExtraction {
  props: Record<string, PropDescriptor>;
  warnings: string[];
}

/** Build a dspack PropDescriptor from the gathered pieces, in a stable key order. */
function buildDescriptor(
  name: string,
  shape: TypeShape,
  opts: { required?: boolean; description?: string; hasDefault?: boolean; defaultValue?: unknown },
): PropDescriptor {
  const descriptor: PropDescriptor = { type: shape.type };
  if (opts.description) descriptor.description = opts.description;
  if (shape.values) descriptor.values = shape.values;
  if (opts.hasDefault) descriptor.default = opts.defaultValue;
  if (opts.required) descriptor.required = true;
  const role = inferPropRole(name, shape);
  if (role) descriptor.propRole = role;
  return descriptor;
}

function findCall(ast: File, calleeName: string): t.CallExpression | undefined {
  let found: t.CallExpression | undefined;
  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee;
      if (t.isIdentifier(callee) && callee.name === calleeName && !found) {
        found = path.node;
      }
    },
  });
  return found;
}

/** Collect same-file type/interface declarations for resolving `defineProps<T>()`. */
function collectTypeDecls(ast: File): Map<string, t.TSTypeElement[]> {
  const map = new Map<string, t.TSTypeElement[]>();
  for (const stmt of ast.program.body) {
    const node = t.isExportNamedDeclaration(stmt) && stmt.declaration ? stmt.declaration : stmt;
    if (t.isTSInterfaceDeclaration(node)) {
      map.set(node.id.name, node.body.body);
    } else if (t.isTSTypeAliasDeclaration(node) && t.isTSTypeLiteral(node.typeAnnotation)) {
      map.set(node.id.name, node.typeAnnotation.members);
    }
  }
  return map;
}

function resolveTypeMembers(
  typeArg: t.TSType,
  decls: Map<string, t.TSTypeElement[]>,
): t.TSTypeElement[] | null {
  if (t.isTSTypeLiteral(typeArg)) return typeArg.members;
  if (t.isTSTypeReference(typeArg) && t.isIdentifier(typeArg.typeName)) {
    return decls.get(typeArg.typeName.name) ?? null;
  }
  if (t.isTSIntersectionType(typeArg)) {
    const out: t.TSTypeElement[] = [];
    for (const part of typeArg.types) {
      const members = resolveTypeMembers(part, decls);
      if (!members) return null;
      out.push(...members);
    }
    return out;
  }
  return null;
}

/** Read withDefaults(..., { key: literal }) into a name→value map (literals only). */
function readWithDefaults(
  ast: File,
  warnings: string[],
  label: string,
): Map<string, unknown> {
  const map = new Map<string, unknown>();
  const call = findCall(ast, 'withDefaults');
  const defaultsArg = call?.arguments[1];
  if (!defaultsArg || !t.isObjectExpression(defaultsArg)) return map;
  for (const prop of defaultsArg.properties) {
    if (!t.isObjectProperty(prop)) continue;
    const key = t.isIdentifier(prop.key) ? prop.key.name : t.isStringLiteral(prop.key) ? prop.key.value : undefined;
    if (!key) continue;
    const lit = literalValue(prop.value as t.Node);
    if (lit.ok) map.set(key, lit.value);
    else warnings.push(`prop "${key}" on ${label} has a non-literal default; default omitted`);
  }
  return map;
}

function extractTypeBasedProps(
  ast: File,
  propsCall: t.CallExpression,
  label: string,
): PropExtraction {
  const warnings: string[] = [];
  const props: Record<string, PropDescriptor> = {};
  const typeArg = propsCall.typeParameters?.params[0];
  if (!typeArg) return { props, warnings };

  const members = resolveTypeMembers(typeArg, collectTypeDecls(ast));
  if (!members) {
    warnings.push(`defineProps<T>() on ${label} references a type that could not be resolved in-file; props omitted`);
    return { props, warnings };
  }
  const defaults = readWithDefaults(ast, warnings, label);

  for (const member of members) {
    if (!t.isTSPropertySignature(member) || !t.isIdentifier(member.key)) {
      warnings.push(`a prop on ${label} uses an unsupported declaration form and was skipped`);
      continue;
    }
    const name = member.key.name;
    const shape = tsTypeToShape(member.typeAnnotation?.typeAnnotation);
    if (shape.unresolved) {
      warnings.push(`prop "${name}" on ${label} has a type that could not be safely resolved (kept as "${shape.type}")`);
    }
    const hasDefault = defaults.has(name);
    props[name] = buildDescriptor(name, shape, {
      required: !member.optional,
      description: descriptionFromComments(member),
      hasDefault,
      defaultValue: hasDefault ? defaults.get(name) : undefined,
    });
  }
  return { props, warnings };
}

/** Shape from a runtime prop `type:` value (constructor identifier or array of them). */
function runtimeTypeShape(node: t.Node | undefined, name: string, label: string, warnings: string[]): TypeShape {
  if (node && t.isIdentifier(node)) {
    const shape = constructorToType(node.name);
    if (shape) return shape;
    warnings.push(`prop "${name}" on ${label} has an unrecognized type constructor "${node.name}"`);
    return { type: 'unknown', unresolved: true };
  }
  if (node && t.isArrayExpression(node)) {
    const ctors = node.elements.filter((e): e is t.Identifier => t.isIdentifier(e));
    if (ctors.length === 1) return constructorToType(ctors[0].name) ?? { type: 'unknown', unresolved: true };
    return { type: 'union' };
  }
  return { type: 'unknown', unresolved: true };
}

function extractRuntimeObjectProps(obj: t.ObjectExpression, label: string): PropExtraction {
  const warnings: string[] = [];
  const props: Record<string, PropDescriptor> = {};

  for (const prop of obj.properties) {
    if (!t.isObjectProperty(prop)) {
      warnings.push(`a prop on ${label} uses spread/method syntax and was skipped`);
      continue;
    }
    const name = t.isIdentifier(prop.key) ? prop.key.name : t.isStringLiteral(prop.key) ? prop.key.value : undefined;
    if (!name) continue;
    const description = descriptionFromComments(prop);

    // Shorthand: `name: String` or `name: [String, Number]`.
    if (t.isIdentifier(prop.value) || t.isArrayExpression(prop.value)) {
      const shape = runtimeTypeShape(prop.value, name, label, warnings);
      props[name] = buildDescriptor(name, shape, { description });
      continue;
    }

    // Full descriptor: `name: { type, required, default, validator }`.
    if (t.isObjectExpression(prop.value)) {
      let typeNode: t.Node | undefined;
      let required = false;
      let hasDefault = false;
      let defaultValue: unknown;
      for (const field of prop.value.properties) {
        if (!t.isObjectProperty(field) || !t.isIdentifier(field.key)) continue;
        if (field.key.name === 'type') typeNode = field.value as t.Node;
        else if (field.key.name === 'required') {
          const lit = literalValue(field.value as t.Node);
          if (lit.ok && typeof lit.value === 'boolean') required = lit.value;
        } else if (field.key.name === 'default') {
          const lit = literalValue(field.value as t.Node);
          if (lit.ok) {
            hasDefault = true;
            defaultValue = lit.value;
          } else {
            warnings.push(`prop "${name}" on ${label} has a non-literal default; default omitted`);
          }
        }
      }
      const shape = runtimeTypeShape(typeNode, name, label, warnings);
      props[name] = buildDescriptor(name, shape, { required, description, hasDefault, defaultValue });
      continue;
    }

    warnings.push(`prop "${name}" on ${label} uses an unsupported value form and was skipped`);
  }
  return { props, warnings };
}

/** `defineProps(['a','b'])` — no type info available. */
function extractArrayProps(arr: t.ArrayExpression, label: string): PropExtraction {
  const warnings: string[] = [];
  const props: Record<string, PropDescriptor> = {};
  for (const el of arr.elements) {
    if (!t.isStringLiteral(el)) continue;
    props[el.value] = { type: 'unknown' };
  }
  if (Object.keys(props).length > 0) {
    warnings.push(`props on ${label} are declared as a string array; no type information is available`);
  }
  return { props, warnings };
}

/** Find the Options API options object: `export default { ... }` or `defineComponent({ ... })`. */
export function findOptionsObject(ast: File): t.ObjectExpression | undefined {
  let result: t.ObjectExpression | undefined;
  traverse(ast, {
    ExportDefaultDeclaration(path) {
      const decl = path.node.declaration;
      if (t.isObjectExpression(decl)) result = decl;
      else if (
        t.isCallExpression(decl) &&
        t.isIdentifier(decl.callee) &&
        decl.callee.name === 'defineComponent' &&
        t.isObjectExpression(decl.arguments[0])
      ) {
        result = decl.arguments[0];
      }
    },
  });
  return result;
}

function getOptionsProperty(obj: t.ObjectExpression, key: string): t.Node | undefined {
  for (const prop of obj.properties) {
    if (t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === key) {
      return prop.value as t.Node;
    }
  }
  return undefined;
}

/** Extract props from `<script setup>` macros. */
export function extractSetupProps(setupAst: File, label: string): PropExtraction {
  const propsCall = findCall(setupAst, 'defineProps');
  if (!propsCall) return { props: {}, warnings: [] };
  if (propsCall.typeParameters?.params[0]) return extractTypeBasedProps(setupAst, propsCall, label);
  const arg = propsCall.arguments[0];
  if (arg && t.isObjectExpression(arg)) return extractRuntimeObjectProps(arg, label);
  if (arg && t.isArrayExpression(arg)) return extractArrayProps(arg, label);
  return { props: {}, warnings: [] };
}

/** Extract props from an Options API options object. */
export function extractOptionsProps(optionsObj: t.ObjectExpression, label: string): PropExtraction {
  const propsNode = getOptionsProperty(optionsObj, 'props');
  if (!propsNode) return { props: {}, warnings: [] };
  if (t.isObjectExpression(propsNode)) return extractRuntimeObjectProps(propsNode, label);
  if (t.isArrayExpression(propsNode)) return extractArrayProps(propsNode, label);
  return { props: {}, warnings: [] };
}

export { getOptionsProperty };
