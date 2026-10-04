#!/usr/bin/env bash
# SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
# Copyright (C) 2006-2026 DIY Accounting Limited
#
# Stamps the engine version the way the publish workflow does, runs the pack
# smoke test, then puts the committed provenance file back so the working
# tree is as it was.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
STAMP_FILE=app/lib/provenance-data.js
SAVED=$(mktemp)
cp "$STAMP_FILE" "$SAVED"
node scripts/build-provenance-data.mjs --release && diya-gl/smoke.sh "$@"
STATUS=$?
cp "$SAVED" "$STAMP_FILE"
rm -f "$SAVED"
exit $STATUS
