/**
 * VueAdapter — Vue 3 SFC + Vuetify 3 extraction.
 *
 * Mirrors the React path's "extract → normalized fragment" shape. Conservative
 * and source-driven: props/emits/slots come from the original `<script>` /
 * `<script setup>` AST (compileScript is the macro-analysis aid). Anything
 * partial, ambiguous, or unsafe is omitted with a provenance-tagged warning.
 *
 * Vuetify usage is detected (template allowlist) and surfaced additively as
 * component `tags` plus binding `guidance`. It is computed in this single pass
 * because the assembler merges frameworkBindings per-component shallowly, so a
 * second fragment writing the same binding would clobber importPath/emits.
 */
import { readFileSync } from 'node:fs';
import { relative, basename } from 'node:path';
import type { File } from '@babel/types';
import type { SourceFragment } from '../../fragment.js';
import { toDspackId } from '../../fragment.js';
import type { ComponentEntry, FrameworkBinding, PropDescriptor } from '../../types.js';
import type { FrameworkAdapter, AdapterContext } from '../types.js';
import { parseVueSfc, parseScriptAst, compileScriptSafe } from './parseSfc.js';
import { descriptionFromComments } from './astHelpers.js';
import {
  extractSetupProps,
  extractOptionsProps,
  findOptionsObject,
  getOptionsProperty,
} from './extractProps.js';
import { extractSetupEmits, extractOptionsEmits, type EmitExtraction } from './extractEmits.js';
import {
  slotNamesFromDefineSlots,
  slotNamesFromTemplate,
  buildSlotProps,
  type TemplateNode,
} from './extractSlots.js';
import { detectVuetifyUsage } from './vuetifyUsage.js';
import * as t from '@babel/types';

function pascalFromFilename(file: string): string {
  const base = basename(file, '.vue');
  return base
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/** A block comment at the top of the script block, if any. */
function scriptDescription(ast: File | undefined): string | undefined {
  const first = ast?.program.body[0];
  return first ? descriptionFromComments(first) : undefined;
}

/** Component `name:` option, if present (Options API). */
function optionsName(optionsObj: t.ObjectExpression | undefined): string | undefined {
  if (!optionsObj) return undefined;
  const node = getOptionsProperty(optionsObj, 'name');
  return node && t.isStringLiteral(node) ? node.value : undefined;
}

/** Insert slot/emit props without clobbering real props; warn on collision. */
function mergeExtraProps(
  target: Record<string, PropDescriptor>,
  extra: Record<string, PropDescriptor>,
  label: string,
  kind: string,
  warnings: string[],
): void {
  for (const [name, descriptor] of Object.entries(extra)) {
    if (target[name]) {
      warnings.push(`${kind} "${name}" on ${label} collides with an existing prop; ${kind} mapping skipped`);
      continue;
    }
    target[name] = descriptor;
  }
}

export const vueAdapter: FrameworkAdapter = {
  id: 'vue',
  displayName: 'Vue 3',
  extensions: ['.vue'],

  extractComponents(ctx: AdapterContext): SourceFragment[] {
    const warnings: string[] = [];
    const components: Record<string, ComponentEntry> = {};
    const binding: FrameworkBinding = { name: 'Vue 3', components: {} };

    for (const file of ctx.files) {
      let code: string;
      try {
        code = readFileSync(file, 'utf-8');
      } catch {
        warnings.push(`Could not read source file: ${file}`);
        continue;
      }

      const { descriptor, errors } = parseVueSfc(code, file);
      for (const err of errors) warnings.push(`SFC parse issue in ${relative(ctx.projectRoot, file)}: ${err}`);

      const fallbackName = pascalFromFilename(file);
      let setupAst: File | undefined;
      let scriptAst: File | undefined;
      try {
        if (descriptor.scriptSetup) setupAst = parseScriptAst(descriptor.scriptSetup.content, descriptor.scriptSetup.lang);
        if (descriptor.script) scriptAst = parseScriptAst(descriptor.script.content, descriptor.script.lang);
      } catch (err) {
        warnings.push(`script parse failed for "${fallbackName}": ${err instanceof Error ? err.message : String(err)}`);
      }

      const optionsObj = scriptAst ? findOptionsObject(scriptAst) : undefined;
      const name = optionsName(optionsObj) ?? fallbackName;
      const id = toDspackId(name);
      const label = `"${name}"`;

      // Macro-analysis aid: confirm the setup block compiles (errors → warnings).
      if (descriptor.scriptSetup) {
        const { error } = compileScriptSafe(descriptor, id);
        if (error) warnings.push(`compileScript failed for ${label}: ${error}`);
      }

      // --- props ---
      const props: Record<string, PropDescriptor> = {};
      if (setupAst) {
        const r = extractSetupProps(setupAst, label);
        Object.assign(props, r.props);
        warnings.push(...r.warnings);
      }
      if (optionsObj) {
        const r = extractOptionsProps(optionsObj, label);
        Object.assign(props, r.props);
        warnings.push(...r.warnings);
      }

      // --- emits ---
      let emits: EmitExtraction = { events: [], props: {}, warnings: [] };
      if (setupAst) emits = extractSetupEmits(setupAst);
      if (emits.events.length === 0 && optionsObj) emits = extractOptionsEmits(optionsObj);
      mergeExtraProps(props, emits.props, label, 'event', warnings);

      // --- slots ---
      const slotNames = [
        ...(setupAst ? slotNamesFromDefineSlots(setupAst) : []),
        ...slotNamesFromTemplate(descriptor.template?.ast as TemplateNode | undefined, warnings),
      ];
      const slots = buildSlotProps(slotNames);
      mergeExtraProps(props, slots.props, label, 'slot', warnings);

      if (!descriptor.scriptSetup && !descriptor.script) {
        warnings.push(`${label} has no <script> or <script setup> block; only a framework binding was emitted`);
      }

      // --- component entry ---
      const entry: ComponentEntry = {
        name,
        description: scriptDescription(setupAst) ?? scriptDescription(scriptAst) ?? `${name} component.`,
        ...(Object.keys(props).length > 0 ? { props } : {}),
      };

      // --- Vuetify usage (additive) ---
      const vuetify = detectVuetifyUsage(descriptor.template?.ast as TemplateNode | undefined);
      if (vuetify.length > 0) entry.tags = vuetify.map((v) => `vuetify:${v}`);

      components[id] = entry;

      const importPath = './' + relative(ctx.projectRoot, file).replace(/\\/g, '/');
      binding.components![id] = {
        importPath,
        exportName: name,
        ...(emits.events.length > 0 ? { emits: emits.events } : {}),
        ...(vuetify.length > 0 ? { guidance: `Composes Vuetify components: ${vuetify.join(', ')}.` } : {}),
      };
    }

    return [
      {
        provenance: 'vue-sfc-docgen',
        precedence: 100,
        confidence: 'high',
        components,
        frameworkBindings: { vue: binding },
        warnings,
      },
    ];
  },
};
