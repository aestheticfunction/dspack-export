/**
 * @aesthetic-function/watcher - ast/parseIntentFromReactAst.ts
 *
 * Read-only AST-based analyzer for React TSX using Babel.
 *
 * WHY: Extracts literal semantics from JSX to produce structured reports
 * that can be diffed against markers and design overrides. This enables
 * deeper code understanding beyond regex-based marker parsing.
 *
 * SCOPE:
 * - Literals only (StringLiteral, NumericLiteral, BooleanLiteral)
 * - No inference from variables
 * - No className parsing
 * - No evaluation
 * - Read-only (never modifies source)
 *
 * ARCHITECTURE:
 * - Uses @babel/parser for TSX parsing
 * - Uses @babel/traverse for AST walking
 * - Extracts components (function declarations & arrow functions)
 * - Collects JSX text, prop literals, and inline style literals
 */

import { parse } from '@babel/parser';
import * as babelTraverse from '@babel/traverse';
import type { TraverseOptions } from '@babel/traverse';
import * as t from '@babel/types';

// Handle ESM/CJS interop for @babel/traverse
// At runtime, babelTraverse may be { default: function } or { default: { default: function } }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTraverseFunction(): (parent: t.Node, opts?: TraverseOptions<unknown>) => void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = babelTraverse as any;
  if (typeof mod === 'function') {
    return mod;
  }
  if (typeof mod.default === 'function') {
    return mod.default;
  }
  if (mod.default && typeof mod.default.default === 'function') {
    return mod.default.default;
  }
  throw new Error('Could not resolve @babel/traverse function');
}

const traverse = getTraverseFunction();
import type {
  AstIntentReport,
  AstComponentReport,
  JsxTextLiteral,
  JsxPropLiteral,
  InlineStyleLiteral,
  SourceLocation,
  Anchor,
  AnchoredAstReport,
  AnchorExtracted,
  ComponentSemanticIntent,
  SemanticValue,
  TextSemantics,
  BooleanSemantics,
  LayoutSemantics,
  FlexSemantics,
  VisualSemantics,
} from './astTypes.js';
import { computeComponentKey, resolveSourceRoot } from './astTypes.js';

// Adapter imports (Phase 10A)

// Canonical normalization imports (Phase 10E)

// =============================================================================
// HEX COLOR REGEX
// =============================================================================

/**
 * Matches hex color values (3 or 6 hex digits).
 * Used to identify backgroundColor values that can map to Figma fills.
 */
const HEX_COLOR_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert Babel location to our SourceLocation.
 */
function toSourceLocation(loc: t.SourceLocation | null | undefined): SourceLocation {
  if (!loc) {
    return { startLine: 0, endLine: 0 };
  }
  return {
    startLine: loc.start.line,
    endLine: loc.end.line,
    startColumn: loc.start.column,
    endColumn: loc.end.column,
  };
}

/**
 * Check if a node is a React component (starts with uppercase).
 * React convention: components start with uppercase, elements are lowercase.
 */
function isComponentName(name: string): boolean {
  return /^[A-Z]/.test(name);
}

/**
 * Extract the element name from a JSXOpeningElement.
 */
function getJsxElementName(node: t.JSXOpeningElement): string {
  if (t.isJSXIdentifier(node.name)) {
    return node.name.name;
  }
  if (t.isJSXMemberExpression(node.name)) {
    // e.g., Foo.Bar -> "Foo.Bar"
    const parts: string[] = [];
    let current: t.JSXMemberExpression | t.JSXIdentifier = node.name;
    while (t.isJSXMemberExpression(current)) {
      parts.unshift(current.property.name);
      current = current.object as t.JSXMemberExpression | t.JSXIdentifier;
    }
    if (t.isJSXIdentifier(current)) {
      parts.unshift(current.name);
    }
    return parts.join('.');
  }
  return 'unknown';
}

/**
 * Extract literal value from an AST node.
 * Returns undefined for non-literal nodes.
 */
function getLiteralValue(
  node: t.Node | null | undefined
): string | number | boolean | undefined {
  if (!node) return undefined;

  if (t.isStringLiteral(node)) {
    return node.value;
  }
  if (t.isNumericLiteral(node)) {
    return node.value;
  }
  if (t.isBooleanLiteral(node)) {
    return node.value;
  }
  // Handle JSX expression container with literal inside
  if (t.isJSXExpressionContainer(node) && t.isExpression(node.expression)) {
    return getLiteralValue(node.expression);
  }

  return undefined;
}

// =============================================================================
// COMPONENT COLLECTOR
// =============================================================================

interface ComponentBounds {
  name: string;
  isExported: boolean;
  startLine: number;
  endLine: number;
  node: t.Node;
}

/**
 * Collect all component definitions in the file.
 *
 * Finds:
 * - export function Foo() {}
 * - export const Foo = () => {}
 * - function Foo() {} with separate export
 * - const Foo = () => {} with separate export
 */
function collectComponents(ast: t.File): ComponentBounds[] {
  const components: ComponentBounds[] = [];
  const exportedNames = new Set<string>();

  // First pass: collect all export names
  traverse(ast, {
    ExportNamedDeclaration(path) {
      // export { Foo, Bar }
      for (const spec of path.node.specifiers) {
        if (t.isExportSpecifier(spec) && t.isIdentifier(spec.exported)) {
          exportedNames.add(spec.exported.name);
        }
      }
      // export function Foo() {} or export const Foo = ...
      if (path.node.declaration) {
        if (t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id) {
          exportedNames.add(path.node.declaration.id.name);
        }
        if (t.isVariableDeclaration(path.node.declaration)) {
          for (const decl of path.node.declaration.declarations) {
            if (t.isIdentifier(decl.id)) {
              exportedNames.add(decl.id.name);
            }
          }
        }
      }
    },
    ExportDefaultDeclaration(path) {
      // export default function Foo() {} or export default Foo
      if (t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id) {
        exportedNames.add(path.node.declaration.id.name);
      }
      if (t.isIdentifier(path.node.declaration)) {
        exportedNames.add(path.node.declaration.name);
      }
    },
  });

  // Second pass: collect component definitions
  traverse(ast, {
    FunctionDeclaration(path) {
      const name = path.node.id?.name;
      if (name && isComponentName(name)) {
        const loc = path.node.loc;
        if (loc) {
          components.push({
            name,
            isExported: exportedNames.has(name),
            startLine: loc.start.line,
            endLine: loc.end.line,
            node: path.node,
          });
        }
      }
    },
    VariableDeclarator(path) {
      // const Foo = () => {} or const Foo = function() {}
      if (!t.isIdentifier(path.node.id)) return;
      const name = path.node.id.name;
      if (!isComponentName(name)) return;

      const init = path.node.init;
      if (!init) return;

      // Check if it's a function expression or arrow function
      // Spike patch: unwrap React.forwardRef(...) / memo(...) wrappers
      let unwrapped = init;
      if (t.isCallExpression(init)) {
        const callee = init.callee;
        const calleeName = t.isIdentifier(callee)
          ? callee.name
          : t.isMemberExpression(callee) && t.isIdentifier(callee.property)
            ? callee.property.name
            : undefined;
        if ((calleeName === 'forwardRef' || calleeName === 'memo') && init.arguments.length > 0) {
          const arg = init.arguments[0];
          if (t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) {
            unwrapped = arg;
          }
        }
      }
      if (t.isArrowFunctionExpression(unwrapped) || t.isFunctionExpression(unwrapped)) {
        // Use the VariableDeclaration (parent of VariableDeclarator) for location
        // path.parent is the VariableDeclaration
        const parent = path.parent;
        if (t.isVariableDeclaration(parent) && parent.loc) {
          components.push({
            name,
            isExported: exportedNames.has(name),
            startLine: parent.loc.start.line,
            endLine: parent.loc.end.line,
            node: parent, // Use the full VariableDeclaration for traversal
          });
        }
      }
    },
  });

  // Sort by start line
  return components.sort((a, b) => a.startLine - b.startLine);
}

// =============================================================================
// JSX LITERAL EXTRACTORS
// =============================================================================

interface LiteralCollector {
  textLiterals: JsxTextLiteral[];
  propLiterals: JsxPropLiteral[];
  styleLiterals: InlineStyleLiteral[];
}

// =============================================================================
// SEMANTIC PROP/STYLE CATEGORIES (Phase 6B)
// =============================================================================

/** Text-related prop names to extract */

// ---- Slim discovery-only entry (spike) ----
export interface DiscoveredComponent {
  componentName: string;
  componentKey?: string;
  isExported: boolean;
  loc: SourceLocation;
}

export function discoverComponents(
  code: string,
  filePath: string,
  sourceRoots: string[] = ['src']
): DiscoveredComponent[] {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
    errorRecovery: true,
  });
  return collectComponents(ast).map((c) => ({
    componentName: c.name,
    componentKey: computeComponentKey(filePath, c.name, resolveSourceRoot(filePath, sourceRoots)),
    isExported: c.isExported,
    loc: toSourceLocation(c.node.loc),
  }));
}
