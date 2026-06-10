#!/usr/bin/env bash
# Prototype-gate round-trip: generate the fixture snapshot, then serve it via
# ds-mcp and verify get-component / search-tokens / get-theme answer correctly.
#
# Usage: DS_MCP=/path/to/ds-mcp/dist/index.js scripts/roundtrip.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DS_MCP="${DS_MCP:-../ds-mcp/dist/index.js}"
DSPACK=fixtures/shadcn-demo/shadcn-demo.dspack.json

npm run build > /dev/null
# Pinned epoch (2026-06-10T00:00:00Z) keeps the committed golden file byte-stable.
SOURCE_DATE_EPOCH=1781049600 node dist/cli.js generate --config fixtures/shadcn-demo/dspack-export.config.json
node dist/cli.js validate "$DSPACK"
git diff --quiet -- "$DSPACK" || { echo "FAIL: regeneration changed the committed golden file"; exit 1; }

{
  printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"roundtrip","version":"0.0.1"}}}'
  printf '%s\n' '{"jsonrpc":"2.0","method":"notifications/initialized"}'
  printf '%s\n' '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get-component","arguments":{"id":"button"}}}'
  printf '%s\n' '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search-tokens","arguments":{"query":"primary"}}}'
  printf '%s\n' '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get-theme","arguments":{"id":"dark"}}}'
  sleep 1
} | node "$DS_MCP" --dspack "$DSPACK" 2>/dev/null | python3 -c '
import sys, json
ok = {"component": False, "tokens": False, "theme": False}
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    msg = json.loads(line)
    if "result" not in msg or "content" not in msg.get("result", {}):
        continue
    payload = json.loads(msg["result"]["content"][0]["text"])
    if msg["id"] == 2:
        assert payload["name"] == "Button", payload
        assert payload["props"]["variant"]["values"] == ["default", "destructive", "outline", "secondary", "ghost", "link"], payload
        ok["component"] = True
        print("PASS get-component button (variant enum intact)")
    elif msg["id"] == 3:
        names = {r["name"] for r in (payload if isinstance(payload, list) else payload.get("results", payload.get("matches", [])))}
        assert "primary" in names and "primary-foreground" in names, names
        ok["tokens"] = True
        print(f"PASS search-tokens primary ({sorted(names)})")
    elif msg["id"] == 4:
        assert payload["name"] == "Dark" and len(payload["overrides"]) == 17, payload
        ok["theme"] = True
        print("PASS get-theme dark (17 overrides)")
assert all(ok.values()), f"missing responses: {ok}"
print("ROUND-TRIP GATE: PASS")
'
