import { describe, it, expect } from 'vitest';
import { dropOrphanCvaComponents } from '../generate.js';
import type { SourceFragment } from '../fragment.js';

function cvaFragment(ids: string[]): SourceFragment {
  return {
    provenance: 'cva-ast',
    precedence: 50,
    confidence: 'high',
    components: Object.fromEntries(
      ids.map((id) => [id, { name: id, description: `${id} component.`, props: {} }]),
    ),
    warnings: [],
  };
}

describe('dropOrphanCvaComponents', () => {
  it('keeps cva entries that match an extracted component', () => {
    const fragment = cvaFragment(['button']);
    dropOrphanCvaComponents(fragment, new Set(['button', 'badge']));
    expect(Object.keys(fragment.components!)).toEqual(['button']);
    expect(fragment.warnings).toEqual([]);
  });

  it('drops and warns on cva entries that match no component', () => {
    const fragment = cvaFragment(['button', 'action-styles']);
    dropOrphanCvaComponents(fragment, new Set(['button']));
    expect(Object.keys(fragment.components!)).toEqual(['button']);
    expect(fragment.warnings).toHaveLength(1);
    expect(fragment.warnings![0]).toContain('"action-styles"');
    expect(fragment.warnings![0]).toContain('naming convention mismatch');
  });
});
