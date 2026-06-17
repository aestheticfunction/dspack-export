import { describe, it, expect } from 'vitest';
import { resolveAdapter } from '../adapters/registry.js';
import type { ResolvedConfig } from '../config.js';

function cfg(over: Partial<ResolvedConfig>): ResolvedConfig {
  return {
    name: 'Test',
    components: ['x'],
    projectRoot: '/p',
    componentFiles: [],
    cssFiles: [],
    tokensFiles: [],
    outputPath: '/p/out.dspack.json',
    ...over,
  } as ResolvedConfig;
}

describe('resolveAdapter', () => {
  it('uses the explicit framework when set', () => {
    const { adapter, warnings } = resolveAdapter(
      cfg({ framework: 'react', componentFiles: ['/p/Button.tsx'] }),
    );
    expect(adapter.id).toBe('react');
    expect(warnings).toEqual([]);
  });

  it('auto-detects react from .tsx/.ts files', () => {
    const { adapter } = resolveAdapter(
      cfg({ componentFiles: ['/p/Button.tsx', '/p/utils.ts'] }),
    );
    expect(adapter.id).toBe('react');
  });

  it('auto-detects react from .jsx files', () => {
    const { adapter } = resolveAdapter(cfg({ componentFiles: ['/p/Button.jsx'] }));
    expect(adapter.id).toBe('react');
  });

  it('fails fast on mixed React + Vue input', () => {
    expect(() =>
      resolveAdapter(cfg({ componentFiles: ['/p/Button.tsx', '/p/Card.vue'] })),
    ).toThrow(/set "framework" explicitly/i);
  });

  it('fails fast on empty component file list', () => {
    expect(() => resolveAdapter(cfg({ componentFiles: [] }))).toThrow(
      /set "framework" explicitly/i,
    );
  });

  it('fails fast on unknown extensions', () => {
    expect(() =>
      resolveAdapter(cfg({ componentFiles: ['/p/Widget.svelte'] })),
    ).toThrow(/set "framework" explicitly/i);
  });

  it('warns (non-fatal) when explicit framework does not claim a file extension', () => {
    const { adapter, warnings } = resolveAdapter(
      cfg({ framework: 'react', componentFiles: ['/p/Button.tsx', '/p/Card.vue'] }),
    );
    expect(adapter.id).toBe('react');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('.vue');
  });
});
