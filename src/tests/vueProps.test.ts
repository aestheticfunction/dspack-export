import { describe, it, expect } from 'vitest';
import { parseScriptAst } from '../adapters/vue/parseSfc.js';
import { extractSetupProps, extractOptionsProps, findOptionsObject } from '../adapters/vue/extractProps.js';

function setupProps(src: string) {
  return extractSetupProps(parseScriptAst(src, 'ts'), '"X"');
}
function optionsProps(src: string) {
  const ast = parseScriptAst(src, 'ts');
  const obj = findOptionsObject(ast)!;
  return extractOptionsProps(obj, '"X"');
}

describe('vue props — script setup', () => {
  it('type-based defineProps<T> with withDefaults', () => {
    const { props, warnings } = setupProps(`
      interface Props {
        /** The label. */
        label: string
        variant?: 'a' | 'b'
        disabled?: boolean
      }
      withDefaults(defineProps<Props>(), { variant: 'a', disabled: false })
    `);
    expect(warnings).toEqual([]);
    expect(props.label).toEqual({ type: 'string', description: 'The label.', required: true });
    expect(props.variant).toEqual({ type: 'enum', values: ['a', 'b'], default: 'a', propRole: 'choice' });
    expect(props.disabled).toEqual({ type: 'boolean', default: false, propRole: 'flag' });
  });

  it('inline type-literal defineProps without defaults', () => {
    const { props } = setupProps(`defineProps<{ kind: 'text' | 'select'; required?: boolean }>()`);
    expect(props.kind).toEqual({ type: 'enum', values: ['text', 'select'], required: true, propRole: 'choice' });
    expect(props.required).toEqual({ type: 'boolean', propRole: 'flag' });
  });

  it('runtime object defineProps with type/required/default', () => {
    const { props } = setupProps(`
      defineProps({
        title: { type: String, required: true },
        count: { type: Number, default: 0 },
      })
    `);
    expect(props.title).toEqual({ type: 'string', required: true });
    expect(props.count).toEqual({ type: 'number', default: 0 });
  });

  it('array defineProps yields unknown-typed props and a warning', () => {
    const { props, warnings } = setupProps(`defineProps(['a', 'b'])`);
    expect(props.a).toEqual({ type: 'unknown' });
    expect(props.b).toEqual({ type: 'unknown' });
    expect(warnings.join(' ')).toMatch(/no type information/);
  });

  it('omits a non-literal default and warns', () => {
    const { props, warnings } = setupProps(`
      defineProps({ rows: { type: Array, default: () => [] } })
    `);
    expect(props.rows).toEqual({ type: 'array' });
    expect(props.rows.default).toBeUndefined();
    expect(warnings.join(' ')).toMatch(/non-literal default/);
  });

  it('warns when defineProps<T> references an unresolvable type', () => {
    const { props, warnings } = setupProps(`defineProps<ExternalProps>()`);
    expect(Object.keys(props)).toHaveLength(0);
    expect(warnings.join(' ')).toMatch(/could not be resolved/);
  });
});

describe('vue props — options API', () => {
  it('extracts props from defineComponent', () => {
    const { props } = optionsProps(`
      export default defineComponent({
        name: 'Badge',
        props: { label: { type: String, required: true }, variant: { type: String, default: 'info' } },
      })
    `);
    expect(props.label).toEqual({ type: 'string', required: true });
    expect(props.variant.default).toBe('info');
    expect(props.variant.propRole).toBe('choice');
  });
});
