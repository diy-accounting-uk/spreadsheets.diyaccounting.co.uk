#!/bin/bash
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 DIY Accounting Ltd
#
# Sync Playwright container image tags in workflow files to match
# the resolved @playwright/test version in package-lock.json.

set -euo pipefail

VERSION=$(node -e "const lock = require('./package-lock.json'); console.log(lock.packages['node_modules/@playwright/test'].version)")

if [ -z "$VERSION" ]; then
  echo "Could not determine @playwright/test version from package-lock.json"
  exit 1
fi

echo "Playwright version: $VERSION"

for f in .github/workflows/*.yml; do
  if grep -q "mcr.microsoft.com/playwright:" "$f"; then
    sed -i.bak "s|mcr.microsoft.com/playwright:v[0-9.]*-jammy|mcr.microsoft.com/playwright:v${VERSION}-jammy|g" "$f"
    rm -f "$f.bak"
    echo "Updated $f"
  fi
done
