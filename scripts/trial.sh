#!/usr/bin/env bash
# Real-repo trial: run dspack-export against a real shadcn-style repository.
# No repo-specific hacks live in the exporter — anything a trial needs beyond
# `init` defaults should be expressed by editing the generated config.
#
# Usage:
#   scripts/trial.sh <git-url>            # shallow-clones into /tmp/dspack-trials
#   scripts/trial.sh <local-dir>          # uses an existing checkout
#
# The target repo's dependencies must be installed (prop extraction runs the
# TypeScript checker, which needs the repo's node_modules). The script runs
# `npm install` for fresh clones; pass SKIP_INSTALL=1 to skip.
set -euo pipefail
EXPORTER_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

TARGET="${1:?usage: scripts/trial.sh <git-url|local-dir>}"

if [[ -d "$TARGET" ]]; then
  REPO_DIR="$(cd "$TARGET" && pwd)"
else
  mkdir -p /tmp/dspack-trials
  REPO_DIR="/tmp/dspack-trials/$(basename "$TARGET" .git)"
  if [[ ! -d "$REPO_DIR" ]]; then
    git clone --depth 1 "$TARGET" "$REPO_DIR"
  fi
  if [[ "${SKIP_INSTALL:-}" != "1" ]]; then
    (cd "$REPO_DIR" && npm install --no-audit --no-fund --legacy-peer-deps)
  fi
fi

(cd "$EXPORTER_ROOT" && npm run build > /dev/null)

cd "$REPO_DIR"
if [[ ! -f dspack-export.config.json ]]; then
  node "$EXPORTER_ROOT/dist/cli.js" init
fi
node "$EXPORTER_ROOT/dist/cli.js" generate --config dspack-export.config.json
OUTPUT="$(node -e "const c=require('./dspack-export.config.json'); console.log(c.output ?? c.name.toLowerCase().replace(/[^a-z0-9]+/g,'-') + '.dspack.json')")"
node "$EXPORTER_ROOT/dist/cli.js" validate "$OUTPUT"
echo
echo "Trial output: $REPO_DIR/$OUTPUT"
