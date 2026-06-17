/**
 * Vue SFC parsing layer.
 *
 * `@vue/compiler-sfc` is the authoritative SFC/macro parser. We use it to
 * split blocks and (via compileScript) to confirm macro behavior, but prefer
 * extracting documented facts — props/emits/slots, comments, source order,
 * literal defaults — from the ORIGINAL `<script>` / `<script setup>` AST, which
 * preserves comment association, declaration order, and literal expressions
 * that compiled output normalizes away.
 *
 * All `@vue/compiler-sfc` access is isolated here so a future Vue minor that
 * shifts AST shape only touches this file.
 */
import { parse as parseSfcImpl, compileScript } from '@vue/compiler-sfc';
import type { SFCDescriptor, SFCScriptBlock } from '@vue/compiler-sfc';
import { parse as parseBabel } from '@babel/parser';
import type { File } from '@babel/types';

export interface ParsedSfc {
  descriptor: SFCDescriptor;
  /** Fatal/parse errors surfaced by the Vue compiler, as messages. */
  errors: string[];
}

export function parseVueSfc(code: string, filename: string): ParsedSfc {
  const { descriptor, errors } = parseSfcImpl(code, { filename });
  return {
    descriptor,
    errors: errors.map((e) => (e instanceof Error ? e.message : String(e))),
  };
}

/**
 * Run the Vue compiler's script analysis. Used only as a macro-analysis aid
 * (e.g. to confirm a setup block compiles); extraction reads the original AST.
 * Returns null when compilation throws, so callers can degrade gracefully.
 */
export function compileScriptSafe(
  descriptor: SFCDescriptor,
  id: string,
): { block: SFCScriptBlock | null; error?: string } {
  try {
    const block = compileScript(descriptor, { id });
    return { block };
  } catch (err) {
    return { block: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Babel-parse a script block's source into an AST, TS-aware by `lang`. */
export function parseScriptAst(content: string, lang: string | undefined): File {
  const plugins: ('typescript' | 'jsx')[] = ['typescript'];
  if (lang === 'tsx' || lang === 'jsx') plugins.push('jsx');
  return parseBabel(content, {
    sourceType: 'module',
    plugins,
    errorRecovery: true,
    attachComment: true,
  });
}
