#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 DIY Accounting Ltd
#
# parity.sh — pack this package, install the tarball into a scratch
# project, then run its read-workbook bin over each product's committed
# examples/<product>-latest package and diff the result against the
# committed examples/parity/<product> fixtures (parity-compare.mjs). A
# mismatch means the packed build no longer reproduces what the fixture
# recorded -- fix at source, or refresh the fixture deliberately with
# `npm run parity:refresh` and commit the result.
#
# Usage: diya-gl/parity.sh [scratch-dir]
set -euo pipefail

DIYA_GL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DIYA_GL_DIR/.." && pwd)"
SCRATCH="${1:-$(mktemp -d)}"
mkdir -p "$SCRATCH"
SCRATCH="$(cd "$SCRATCH" && pwd)"

echo "=== diya-gl parity gate ==="
echo "package dir: $DIYA_GL_DIR"
echo "scratch dir: $SCRATCH"

source "$DIYA_GL_DIR/scripts/pack-and-install.sh"
BIN=$(pack_and_install "$DIYA_GL_DIR" "$SCRATCH")

echo "--- zipping the multi-file packages flat ---"
mkdir -p "$SCRATCH/zips"
node "$DIYA_GL_DIR/scripts/zip-package-flat.mjs" "$REPO_ROOT/examples/se-latest" "$SCRATCH/zips/se-package.zip"
node "$DIYA_GL_DIR/scripts/zip-package-flat.mjs" "$REPO_ROOT/examples/ltd-latest" "$SCRATCH/zips/ltd-package.zip"

check_one() {
  local product="$1"
  local input="$2"
  local out="$SCRATCH/actual/$product"
  mkdir -p "$out"
  local start end
  start=$(date +%s)
  "$BIN/diya-gl-read-workbook" --package "$product" --file "$input" --output-dir "$out" >/dev/null
  end=$(date +%s)
  echo "--- $product: $((end - start))s ---"
  node "$DIYA_GL_DIR/scripts/parity-compare.mjs" "$REPO_ROOT/examples/parity/$product" "$out" "$product"
}

check_one bst "$REPO_ROOT/examples/bst-latest/GB_Accounts_Basic_Sole_Trader.xlsx"
check_one taxi "$REPO_ROOT/examples/taxi-latest/GB_Accounts_Taxi_Driver.xlsx"
check_one se "$SCRATCH/zips/se-package.zip"
check_one ltd "$SCRATCH/zips/ltd-package.zip"

echo "=== all four products match their committed parity fixtures ==="
