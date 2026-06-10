/**
 * Primary component/prop source: react-docgen-typescript.
 *
 * Spike-validated (2026-06-10): resolves cva VariantProps to exact literal
 * unions (e.g. variant: "default" | "destructive" | "outline" | "ghost"),
 * which plain react-docgen and Storybook's manifest docgen cannot see.
 */
import { withCustomConfig, type PropItem } from 'react-docgen-typescript';
import { relative } from 'node:path';
import type { SourceFragment } from '../fragment.js';
import { toDspackId } from '../fragment.js';
import type { ComponentEntry, PropDescriptor, FrameworkBinding } from '../types.js';

export interface DocgenOptions {
  /** Absolute path to the target project's tsconfig.json. */
  tsconfigPath: string;
  /** Absolute paths of component files to parse. */
  files: string[];
  /** Project root, used to derive import paths for frameworkBindings. */
  projectRoot: string;
}

const ENUM_UNION = /^"[^"]*"(\s*\|\s*("[^"]*"|null|undefined))*$/;

function toPropDescriptor(prop: PropItem): PropDescriptor {
  const descriptor: PropDescriptor = { type: 'string' };
  const typeName = prop.type.name.trim();

  if (typeName === 'boolean') {
    descriptor.type = 'boolean';
    descriptor.propRole = 'flag';
  } else if (typeName === 'number') {
    descriptor.type = 'number';
  } else if (ENUM_UNION.test(typeName)) {
    descriptor.type = 'enum';
    descriptor.values = typeName
      .split('|')
      .map((v) => v.trim())
      .filter((v) => v !== 'null' && v !== 'undefined')
      .map((v) => v.replace(/^"|"$/g, ''));
  } else if (typeName.startsWith('(') && typeName.includes('=>')) {
    descriptor.type = 'function';
    descriptor.propRole = 'handler';
  } else if (/ReactNode|ReactElement|JSX\.Element/.test(typeName)) {
    descriptor.type = 'node';
    descriptor.propRole = 'slot';
  } else {
    descriptor.type = typeName === 'string' ? 'string' : typeName;
  }

  if (prop.description) descriptor.description = prop.description;
  if (prop.required) descriptor.required = true;
  if (prop.defaultValue && prop.defaultValue.value !== null && prop.defaultValue.value !== undefined) {
    descriptor.default = prop.defaultValue.value;
  }

  // Role heuristics by conventional prop name (only when not already set)
  if (!descriptor.propRole) {
    if (prop.name === 'variant') descriptor.propRole = 'choice';
    else if (prop.name === 'size' || prop.name === 'density') descriptor.propRole = 'dimension';
    else if (prop.name === 'children') descriptor.propRole = 'slot';
    else if (/^on[A-Z]/.test(prop.name)) descriptor.propRole = 'handler';
  }
  return descriptor;
}

export function extractWithDocgen(options: DocgenOptions): SourceFragment {
  const warnings: string[] = [];
  const parser = withCustomConfig(options.tsconfigPath, {
    shouldExtractLiteralValuesFromEnum: true,
    shouldRemoveUndefinedFromOptional: true,
    propFilter: (prop) =>
      !(prop.parent && prop.parent.fileName.includes('node_modules/@types/react')),
  });

  const components: Record<string, ComponentEntry> = {};
  const reactBinding: FrameworkBinding = { name: 'React', components: {} };

  for (const file of options.files) {
    const parsed = parser.parse(file);
    if (parsed.length === 0) {
      warnings.push(`react-docgen-typescript found no components in ${file}`);
      continue;
    }
    for (const comp of parsed) {
      if (!comp.displayName) continue;
      const id = toDspackId(comp.displayName);
      const props: Record<string, PropDescriptor> = {};
      for (const [propName, prop] of Object.entries(comp.props)) {
        props[propName] = toPropDescriptor(prop);
      }
      components[id] = {
        name: comp.displayName,
        // description is REQUIRED by dspack v0.2; fall back to a stub.
        description: comp.description || `${comp.displayName} component.`,
        ...(Object.keys(props).length > 0 ? { props } : {}),
      };
      const importPath =
        './' + relative(options.projectRoot, file).replace(/\\/g, '/').replace(/\.(tsx|ts|jsx|js)$/, '');
      reactBinding.components![id] = {
        importPath,
        exportName: comp.displayName,
      };
    }
  }

  return {
    provenance: 'react-docgen-typescript',
    precedence: 100,
    confidence: 'high',
    components,
    frameworkBindings: { react: reactBinding },
    warnings,
  };
}
