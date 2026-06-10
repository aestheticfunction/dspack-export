/**
 * cva() variant source (class-variance-authority).
 *
 * react-docgen-typescript resolves VariantProps unions but reports cva
 * `defaultVariants` as null, so this Babel pass supplies the true defaults
 * (and variant values as a fallback for components the TS pass missed).
 *
 * Association heuristic: shadcn convention `const buttonVariants = cva(...)`
 * → component "Button". If a file has exactly one cva call and exactly one
 * component entry, the convention mismatch is tolerated via that pairing at
 * the call site (see discovery cross-check in generate.ts warnings).
 */
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import * as babelTraverse from '@babel/traverse';
import type { TraverseOptions } from '@babel/traverse';
import * as t from '@babel/types';
import type { SourceFragment } from '../../fragment.js';
import { toDspackId } from '../../fragment.js';
import type { ComponentEntry, PropDescriptor } from '../../types.js';

// Same ESM/CJS interop shim as parseComponents.ts
function getTraverseFunction(): (parent: t.Node, opts?: TraverseOptions<unknown>) => void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = babelTraverse as any;
  if (typeof mod === 'function') return mod;
  if (typeof mod.default === 'function') return mod.default;
  if (mod.default && typeof mod.default.default === 'function') return mod.default.default;
  throw new Error('Could not resolve @babel/traverse function');
}

const traverse = getTraverseFunction();

export interface CvaAxis {
  values: string[];
  default?: string | boolean;
}

export interface CvaExtraction {
  /** Variable the cva call is assigned to, e.g. "buttonVariants". */
  variableName: string;
  /** Component name guessed from the variable name, e.g. "Button". */
  componentGuess: string;
  axes: Record<string, CvaAxis>;
}

function literalKeyName(key: t.ObjectProperty['key']): string | undefined {
  if (t.isIdentifier(key)) return key.name;
  if (t.isStringLiteral(key)) return key.value;
  if (t.isBooleanLiteral(key)) return String(key.value);
  if (t.isNumericLiteral(key)) return String(key.value);
  return undefined;
}

function guessComponentName(variableName: string): string {
  const stem = variableName.replace(/Variants?$/, '') || variableName;
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}

export function extractCvaFromSource(code: string): CvaExtraction[] {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
    errorRecovery: true,
  });

  const extractions: CvaExtraction[] = [];

  traverse(ast, {
    VariableDeclarator(path) {
      const { id, init } = path.node;
      if (!t.isIdentifier(id) || !t.isCallExpression(init)) return;
      if (!t.isIdentifier(init.callee) || init.callee.name !== 'cva') return;
      const configArg = init.arguments[1];
      if (!configArg || !t.isObjectExpression(configArg)) return;

      const axes: Record<string, CvaAxis> = {};

      const variantsProp = configArg.properties.find(
        (p): p is t.ObjectProperty => t.isObjectProperty(p) && literalKeyName(p.key) === 'variants',
      );
      if (variantsProp && t.isObjectExpression(variantsProp.value)) {
        for (const axisProp of variantsProp.value.properties) {
          if (!t.isObjectProperty(axisProp)) continue;
          const axisName = literalKeyName(axisProp.key);
          if (!axisName || !t.isObjectExpression(axisProp.value)) continue;
          const values: string[] = [];
          for (const valueProp of axisProp.value.properties) {
            if (!t.isObjectProperty(valueProp)) continue;
            const valueName = literalKeyName(valueProp.key);
            if (valueName !== undefined) values.push(valueName);
          }
          if (values.length > 0) axes[axisName] = { values };
        }
      }

      const defaultsProp = configArg.properties.find(
        (p): p is t.ObjectProperty => t.isObjectProperty(p) && literalKeyName(p.key) === 'defaultVariants',
      );
      if (defaultsProp && t.isObjectExpression(defaultsProp.value)) {
        for (const defProp of defaultsProp.value.properties) {
          if (!t.isObjectProperty(defProp)) continue;
          const axisName = literalKeyName(defProp.key);
          if (!axisName) continue;
          let defValue: string | boolean | undefined;
          if (t.isStringLiteral(defProp.value)) defValue = defProp.value.value;
          else if (t.isBooleanLiteral(defProp.value)) defValue = defProp.value.value;
          if (defValue === undefined) continue;
          if (axes[axisName]) axes[axisName].default = defValue;
          else axes[axisName] = { values: [], default: defValue };
        }
      }

      if (Object.keys(axes).length > 0) {
        extractions.push({
          variableName: id.name,
          componentGuess: guessComponentName(id.name),
          axes,
        });
      }
    },
  });

  return extractions;
}

export interface CvaOptions {
  files: string[];
}

export function extractCvaVariants(options: CvaOptions): SourceFragment {
  const warnings: string[] = [];
  const components: Record<string, ComponentEntry> = {};

  for (const file of options.files) {
    let code: string;
    try {
      code = readFileSync(file, 'utf-8');
    } catch {
      warnings.push(`Could not read source file: ${file}`);
      continue;
    }
    let extractions: CvaExtraction[];
    try {
      extractions = extractCvaFromSource(code);
    } catch (err) {
      warnings.push(`cva parse failed for ${file}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    for (const extraction of extractions) {
      const id = toDspackId(extraction.componentGuess);
      const props: Record<string, PropDescriptor> = {};
      for (const [axisName, axis] of Object.entries(extraction.axes)) {
        const descriptor: PropDescriptor = { type: 'enum' };
        if (axis.values.length > 0) descriptor.values = axis.values;
        if (axis.default !== undefined) descriptor.default = axis.default;
        if (axisName === 'variant') descriptor.propRole = 'choice';
        else if (axisName === 'size' || axisName === 'density') descriptor.propRole = 'dimension';
        props[axisName] = descriptor;
      }
      components[id] = {
        name: extraction.componentGuess,
        description: `${extraction.componentGuess} component.`,
        props,
      };
    }
  }

  return {
    provenance: 'cva-ast',
    precedence: 50, // above AST discovery (10), below react-docgen-typescript (100)
    confidence: 'high',
    components,
    warnings,
  };
}
