import { describe, it, expect } from 'vitest';
import { parseScriptAst } from '../adapters/vue/parseSfc.js';
import { extractSetupEmits, extractOptionsEmits } from '../adapters/vue/extractEmits.js';
import { findOptionsObject } from '../adapters/vue/extractProps.js';
import { emitNameToHandlerProp } from '../adapters/vue/astHelpers.js';

function setupEmits(src: string) {
  return extractSetupEmits(parseScriptAst(src, 'ts'));
}

describe('emit name normalization', () => {
  it('maps Vue event names to on<PascalEvent>', () => {
    expect(emitNameToHandlerProp('click')).toBe('onClick');
    expect(emitNameToHandlerProp('row-click')).toBe('onRowClick');
    expect(emitNameToHandlerProp('update:modelValue')).toBe('onUpdateModelValue');
  });
});

describe('defineEmits extraction', () => {
  it('type-literal call-signature form', () => {
    const { events, props } = setupEmits(`
      defineEmits<{
        (e: 'click', payload: MouseEvent): void
        (e: 'update:modelValue', value: string): void
      }>()
    `);
    expect(events).toEqual(['click', 'update:modelValue']);
    expect(props.onClick).toEqual({ type: 'function', propRole: 'handler' });
    expect(props.onUpdateModelValue).toEqual({ type: 'function', propRole: 'handler' });
  });

  it('type-literal property form', () => {
    const { events } = setupEmits(`defineEmits<{ click: [n: number]; 'row-click': [] }>()`);
    expect(events).toEqual(['click', 'row-click']);
  });

  it('runtime array form, deduped in source order', () => {
    const { events, props } = setupEmits(`defineEmits(['click', 'close', 'click'])`);
    expect(events).toEqual(['click', 'close']);
    expect(Object.keys(props)).toEqual(['onClick', 'onClose']);
  });

  it('options API emits array', () => {
    const ast = parseScriptAst(`export default { emits: ['dismiss', 'update:modelValue'] }`, 'ts');
    const { events } = extractOptionsEmits(findOptionsObject(ast)!);
    expect(events).toEqual(['dismiss', 'update:modelValue']);
  });
});
