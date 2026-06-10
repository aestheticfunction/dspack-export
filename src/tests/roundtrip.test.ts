/**
 * Round-trip test: serve the committed golden snapshot via a local ds-mcp
 * build and verify the reference consumer answers correctly. Skipped when
 * ds-mcp is not checked out next to this repo (set DS_MCP to override).
 */
import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const GOLDEN_PATH = join(REPO_ROOT, 'fixtures', 'shadcn-demo', 'shadcn-demo.dspack.json');
const DS_MCP = process.env.DS_MCP ?? resolve(REPO_ROOT, '..', 'ds-mcp', 'dist', 'index.js');

interface JsonRpcResponse {
  id?: number;
  result?: { content?: Array<{ type: string; text: string }> };
}

function callDsMcp(requests: object[]): Promise<Map<number, unknown>> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('node', [DS_MCP, '--dspack', GOLDEN_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', () => {
      const byId = new Map<number, unknown>();
      for (const line of stdout.split('\n')) {
        if (!line.trim()) continue;
        const msg = JSON.parse(line) as JsonRpcResponse;
        if (msg.id !== undefined && msg.result?.content?.[0]?.text) {
          byId.set(msg.id, JSON.parse(msg.result.content[0].text));
        }
      }
      if (byId.size === 0) reject(new Error(`no tool responses from ds-mcp; stderr: ${stderr}`));
      else resolvePromise(byId);
    });

    const messages = [
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'dspack-export-tests', version: '0.0.1' },
        },
      },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      ...requests,
    ];
    for (const msg of messages) child.stdin.write(JSON.stringify(msg) + '\n');
    setTimeout(() => child.stdin.end(), 500);
  });
}

describe.skipIf(!existsSync(DS_MCP))('ds-mcp round-trip', () => {
  it('serves the generated snapshot through the reference consumer', async () => {
    const responses = await callDsMcp([
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get-component', arguments: { id: 'button' } } },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'search-tokens', arguments: { query: 'primary' } } },
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'get-theme', arguments: { id: 'dark' } } },
    ]);

    const button = responses.get(2) as {
      name: string;
      props: Record<string, { values?: string[]; default?: unknown }>;
    };
    expect(button.name).toBe('Button');
    expect(button.props.variant.values).toEqual([
      'default',
      'destructive',
      'outline',
      'secondary',
      'ghost',
      'link',
    ]);
    expect(button.props.variant.default).toBe('default');

    const tokens = responses.get(3) as Array<{ name: string }>;
    expect(tokens.map((token) => token.name)).toEqual(
      expect.arrayContaining(['primary', 'primary-foreground']),
    );

    const theme = responses.get(4) as { name: string; overrides: Record<string, string> };
    expect(theme.name).toBe('Dark');
    expect(Object.keys(theme.overrides)).toHaveLength(17);
  }, 15000);
});
