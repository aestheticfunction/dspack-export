/**
 * dspack-export.config.json loader.
 *
 * All relative paths in the config resolve against the config file's
 * directory (the target project root).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import { globSync } from 'node:fs';

export interface ExporterConfig {
  /** Design system name (required by dspack). */
  name: string;
  /** Design system content version (semver recommended). */
  version?: string;
  description?: string;
  /** URL or description of the source repository. */
  source?: string;
  /** Glob(s) for component source files, relative to project root. */
  components: string[];
  /** CSS entry file(s) containing token custom properties. Optional if `tokens` is set. */
  css?: string[];
  /**
   * DTCG design-token JSON file(s) to import (e.g. exported from Figma, Tokens
   * Studio, or Style Dictionary). Optional if `css` is set.
   */
  tokens?: string[];
  /** Path to the project's tsconfig.json. */
  tsconfig: string;
  /** Output file path. Default: <kebab-name>.dspack.json */
  output?: string;
}

export interface ResolvedConfig extends ExporterConfig {
  projectRoot: string;
  componentFiles: string[];
  cssFiles: string[];
  tokensFiles: string[];
  tsconfigPath: string;
  outputPath: string;
}

function resolveFrom(root: string, p: string): string {
  return isAbsolute(p) ? p : resolve(root, p);
}

export function loadConfig(configPath: string): ResolvedConfig {
  const absConfigPath = resolve(configPath);
  let raw: string;
  try {
    raw = readFileSync(absConfigPath, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to read config file ${absConfigPath}: ${err instanceof Error ? err.message : String(err)}`);
  }
  let parsed: ExporterConfig;
  try {
    parsed = JSON.parse(raw) as ExporterConfig;
  } catch (err) {
    throw new Error(`Invalid JSON in config file: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!parsed.name) throw new Error('Config is missing required field "name".');
  if (!parsed.components?.length) throw new Error('Config is missing required field "components" (globs).');
  if (!parsed.css?.length && !parsed.tokens?.length) {
    throw new Error('Config must provide at least one token source: "css" and/or "tokens".');
  }
  if (!parsed.tsconfig) throw new Error('Config is missing required field "tsconfig".');

  const projectRoot = dirname(absConfigPath);
  const componentFiles = parsed.components
    .flatMap((g) => globSync(g, { cwd: projectRoot }))
    .map((f) => resolveFrom(projectRoot, f))
    .sort();
  if (componentFiles.length === 0) {
    throw new Error(`Component globs matched no files: ${parsed.components.join(', ')}`);
  }
  const cssFiles = (parsed.css ?? []).map((f) => resolveFrom(projectRoot, f));
  const tokensFiles = (parsed.tokens ?? []).map((f) => resolveFrom(projectRoot, f));
  const tsconfigPath = resolveFrom(projectRoot, parsed.tsconfig);
  const defaultOutput = `${parsed.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.dspack.json`;
  const outputPath = resolveFrom(projectRoot, parsed.output ?? defaultOutput);

  return { ...parsed, projectRoot, componentFiles, cssFiles, tokensFiles, tsconfigPath, outputPath };
}
