#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Copyright (C) 2006-2026 DIY Accounting Limited
#
# smoke.sh — pack this package, install the tarball into a scratch project,
# and run each of the four bins once against a fixture from the parent
# repository's examples/ directory (never shipped in the tarball itself).
# CI runs this after `npm run build:provenance-data`; a local run works the
# same way. Fails on the first bin that errors or writes nothing.
#
# Usage: diya-gl/smoke.sh [scratch-dir]
set -euo pipefail

DIYA_GL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DIYA_GL_DIR/.." && pwd)"
SCRATCH="${1:-$(mktemp -d)}"
mkdir -p "$SCRATCH"
SCRATCH="$(cd "$SCRATCH" && pwd)"

echo "=== diya-gl smoke test ==="
echo "package dir: $DIYA_GL_DIR"
echo "scratch dir: $SCRATCH"

source "$DIYA_GL_DIR/scripts/pack-and-install.sh"
BIN=$(pack_and_install "$DIYA_GL_DIR" "$SCRATCH")

echo "--- recalc ---"
"$BIN/diya-gl-recalc" --package bst --data "$REPO_ROOT/examples/precision-code-ltd/bst" --years se-2025-2026 \
  --output-dir "$SCRATCH/recalc-out"
test -f "$SCRATCH/recalc-out/report.json"

echo "--- read-workbook ---"
"$BIN/diya-gl-read-workbook" --file "$REPO_ROOT/examples/bst-latest/GB_Accounts_Basic_Sole_Trader.xlsx" \
  --output-dir "$SCRATCH/read-out"
test -f "$SCRATCH/read-out/book.toml"
test -f "$SCRATCH/read-out/lines.jsonl"

echo "--- write-workbook ---"
"$BIN/diya-gl-write-workbook" --data "$REPO_ROOT/examples/precision-code-ltd/bst" --output-dir "$SCRATCH/write-out"
test -n "$(ls -A "$SCRATCH/write-out")"

echo "--- mcp ---"
RESPONSE=$(echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}' \
  | timeout 5 "$BIN/diya-gl-mcp")
echo "$RESPONSE" | grep -q '"serverInfo"'

echo "=== all four bins ran from the packed tarball ==="
