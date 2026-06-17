/**
 * ReactAdapter — wraps the existing React extractors behind the
 * FrameworkAdapter contract.
 *
 * Phase 0 keeps the React extractors in their original locations
 * (src/sources/docgen.ts, src/sources/ast/*); this adapter only composes them
 * and applies the CVA orphan-drop, preserving byte-identical output.
 */
import { extractWithDocgen } from '../../sources/docgen.js';
import { extractCvaVariants } from '../../sources/ast/cvaVariants.js';
import { extractWithAst } from '../../sources/ast/discovery.js';
import type { SourceFragment } from '../../fragment.js';
import type { FrameworkAdapter, AdapterContext } from '../types.js';

/**
 * A cva fragment id that matches no extracted component means the
 * `<name>Variants` naming convention didn't hold. Emitting it would create a
 * phantom component with a stub description, so drop it and warn.
 */
export function dropOrphanCvaComponents(
  cvaFragment: SourceFragment,
  knownIds: Set<string>,
): void {
  for (const id of Object.keys(cvaFragment.components ?? {})) {
    if (!knownIds.has(id)) {
      delete cvaFragment.components![id];
      cvaFragment.warnings = cvaFragment.warnings ?? [];
      cvaFragment.warnings.push(
        `cva variants for "${id}" matched no extracted component (naming convention mismatch?); variant defaults for it were dropped`,
      );
    }
  }
}

export const reactAdapter: FrameworkAdapter = {
  id: 'react',
  displayName: 'React',
  extensions: ['.tsx', '.jsx', '.ts', '.js'],

  extractComponents(ctx: AdapterContext): SourceFragment[] {
    if (!ctx.tsconfigPath) {
      throw new Error(
        'The React adapter requires a "tsconfig" path in the config (used by react-docgen-typescript).',
      );
    }

    const docgenFragment = extractWithDocgen({
      tsconfigPath: ctx.tsconfigPath,
      files: ctx.files,
      projectRoot: ctx.projectRoot,
    });
    const cvaFragment = extractCvaVariants({ files: ctx.files });
    const astFragment = extractWithAst({ files: ctx.files, projectRoot: ctx.projectRoot });

    const knownIds = new Set([
      ...Object.keys(docgenFragment.components ?? {}),
      ...Object.keys(astFragment.components ?? {}),
    ]);
    dropOrphanCvaComponents(cvaFragment, knownIds);

    return [docgenFragment, cvaFragment, astFragment];
  },
};
