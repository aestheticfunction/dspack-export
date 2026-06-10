import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initConfig } from '../init.js';

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'dspack-export-init-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('initConfig', () => {
  it('detects shadcn conventions and writes an editable config', () => {
    writeFileSync(join(projectRoot, 'package.json'), JSON.stringify({ name: 'acme-ui', version: '2.1.0' }));
    writeFileSync(join(projectRoot, 'tsconfig.json'), '{}');
    mkdirSync(join(projectRoot, 'components', 'ui'), { recursive: true });
    mkdirSync(join(projectRoot, 'app'), { recursive: true });
    writeFileSync(join(projectRoot, 'app', 'globals.css'), ':root { --primary: #000; }');

    const result = initConfig(projectRoot);
    expect(result.notes).toEqual([]);
    const written = JSON.parse(readFileSync(result.configPath, 'utf-8'));
    expect(written).toEqual({
      name: 'acme-ui',
      version: '2.1.0',
      components: ['components/ui/*.tsx'],
      css: ['app/globals.css'],
      tsconfig: 'tsconfig.json',
    });
  });

  it('writes placeholders with notes when nothing is detected', () => {
    const result = initConfig(projectRoot);
    expect(result.config.name).toBe('My Design System');
    expect(result.notes.length).toBeGreaterThanOrEqual(3);
  });

  it('refuses to overwrite an existing config without --force', () => {
    initConfig(projectRoot);
    expect(() => initConfig(projectRoot)).toThrow(/--force/);
    expect(() => initConfig(projectRoot, true)).not.toThrow();
  });
});
