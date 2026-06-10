/**
 * Babel AST discovery fragment (fallback / cross-check source).
 *
 * Wraps the discovery layer trimmed from Aesthetic Function's
 * parseIntentFromReactAst.ts. Lower precedence than react-docgen-typescript:
 * it contributes minimal component entries only for exported components the
 * TS-checker pass missed (e.g. files excluded from tsconfig), and stable
 * component keys for diagnostics.
 */
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { SourceFragment } from '../../fragment.js';
import { toDspackId } from '../../fragment.js';
import type { ComponentEntry } from '../../types.js';
import { discoverComponents } from './parseComponents.js';

export interface AstDiscoveryOptions {
  files: string[];
  projectRoot: string;
  sourceRoots?: string[];
}

export function extractWithAst(options: AstDiscoveryOptions): SourceFragment {
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
    const relPath = relative(options.projectRoot, file).replace(/\\/g, '/');
    let discovered;
    try {
      discovered = discoverComponents(code, relPath, options.sourceRoots ?? ['src', 'components', 'app']);
    } catch (err) {
      warnings.push(`AST parse failed for ${relPath}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    for (const comp of discovered) {
      if (!comp.isExported) continue;
      const id = toDspackId(comp.componentName);
      components[id] = {
        name: comp.componentName,
        description: `${comp.componentName} component.`,
        ...(comp.componentKey ? { 'x-componentKey': comp.componentKey } : {}),
      };
    }
  }

  return {
    provenance: 'babel-ast-discovery',
    precedence: 10,
    confidence: 'medium',
    components,
    warnings,
  };
}
