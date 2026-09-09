#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Copyright (C) 2006-2026 DIY Accounting Limited
#
# image-smoke.sh — run the built diya-gl image against the same fixture
# smoke.sh uses for recalc, mounting the repo's examples/ read-only and
# writing to a mounted scratch dir. CI and a developer run this same
# script so a built image is proven the same way in both places.
#
# Usage: diya-gl/image-smoke.sh IMAGE_REF REPO_ROOT [scratch-dir]
set -euo pipefail

IMAGE="${1:?Usage: image-smoke.sh IMAGE_REF REPO_ROOT [scratch-dir]}"
REPO_ROOT="${2:?Usage: image-smoke.sh IMAGE_REF REPO_ROOT [scratch-dir]}"
REPO_ROOT="$(cd "$REPO_ROOT" && pwd)"
SCRATCH="${3:-$(mktemp -d)}"
mkdir -p "$SCRATCH"
SCRATCH="$(cd "$SCRATCH" && pwd)"

echo "=== diya-gl image smoke test ==="
echo "image: $IMAGE"
echo "repo root: $REPO_ROOT"
echo "scratch dir: $SCRATCH"

# diya-gl with no arguments prints its usage to stderr and exits 1 (there
# is no --help flag that exits 0); the image's ENTRYPOINT/CMD must do the
# same, so this is the honest check rather than assuming success.
echo "--- usage on no args ---"
set +e
USAGE_OUTPUT=$(docker run --rm "$IMAGE" 2>&1)
USAGE_STATUS=$?
set -e
echo "$USAGE_OUTPUT"
if [ "$USAGE_STATUS" -ne 1 ]; then
  echo "expected exit 1 printing usage, got $USAGE_STATUS" >&2
  exit 1
fi
echo "$USAGE_OUTPUT" | grep -q "Usage: diya-gl"

echo "--- recalc ---"
docker run --rm \
  -v "$REPO_ROOT/examples:/examples:ro" \
  -v "$SCRATCH:/out" \
  "$IMAGE" recalc --package bst --data /examples/precision-code-ltd/bst --years se-2025-2026 \
  --output-dir /out/recalc-out
test -f "$SCRATCH/recalc-out/report.json"

echo "=== the image ran recalc and produced report.json ==="
