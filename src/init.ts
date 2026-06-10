/**
 * `dspack-export init` — write a starter dspack-export.config.json by
 * detecting common shadcn project conventions. Non-interactive; the output
 * is meant to be hand-edited.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExporterConfig } from './config.js';

const COMPONENT_DIR_CANDIDATES = [
  'components/ui',
  'src/components/ui',
  'app/components/ui',
  'src/components',
];

const CSS_CANDIDATES = [
  'app/globals.css',
  'src/app/globals.css',
  'styles/globals.css',
  'src/styles/globals.css',
  'src/index.css',
];

export interface InitResult {
  configPath: string;
  config: ExporterConfig;
  notes: string[];
}

export function initConfig(projectRoot: string, force = false): InitResult {
  const configPath = join(projectRoot, 'dspack-export.config.json');
  if (existsSync(configPath) && !force) {
    throw new Error(`${configPath} already exists. Re-run with --force to overwrite.`);
  }

  const notes: string[] = [];

  let name = 'My Design System';
  let version: string | undefined;
  const pkgPath = join(projectRoot, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { name?: string; version?: string };
      if (pkg.name) name = pkg.name;
      if (pkg.version) version = pkg.version;
    } catch {
      notes.push('Could not parse package.json; using placeholder name.');
    }
  } else {
    notes.push('No package.json found; using placeholder name.');
  }

  const componentDir = COMPONENT_DIR_CANDIDATES.find((dir) => existsSync(join(projectRoot, dir)));
  if (!componentDir) {
    notes.push(
      `No component directory detected (looked for: ${COMPONENT_DIR_CANDIDATES.join(', ')}); edit "components" before generating.`,
    );
  }

  const css = CSS_CANDIDATES.find((file) => existsSync(join(projectRoot, file)));
  if (!css) {
    notes.push(
      `No token CSS file detected (looked for: ${CSS_CANDIDATES.join(', ')}); edit "css" before generating.`,
    );
  }

  if (!existsSync(join(projectRoot, 'tsconfig.json'))) {
    notes.push('No tsconfig.json found; prop extraction requires one — edit "tsconfig" before generating.');
  }

  const config: ExporterConfig = {
    name,
    ...(version ? { version } : {}),
    components: [`${componentDir ?? 'components/ui'}/*.tsx`],
    css: [css ?? 'app/globals.css'],
    tsconfig: 'tsconfig.json',
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  return { configPath, config, notes };
}
