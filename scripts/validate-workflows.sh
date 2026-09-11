#!/bin/bash
# SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
# Copyright (C) 2006-2026 DIY Accounting Limited
#
# Validate GitHub Actions workflow syntax
#
# Usage: ./scripts/validate-workflows.sh
#
# This script validates all workflow files in .github/workflows/
# It uses actionlint if available, otherwise falls back to basic YAML validation.

set -euo pipefail

WORKFLOW_DIR=".github/workflows"
ERRORS=0

echo "=== Validating GitHub Actions Workflows ==="
echo ""

# Check if actionlint is available
if command -v actionlint &> /dev/null; then
    echo "Using actionlint for comprehensive validation..."
    echo ""

    # Run actionlint on all workflow files
    # Filter out shellcheck info-level warnings (SC2086, SC2016, SC2129) which are style
    # suggestions that don't affect workflow execution
    # actionlint exits non-zero whenever it reports anything at all, so `|| true` here is
    # required for `set -e` to let the filtering below run instead of aborting the script.
    OUTPUT=$(actionlint "${WORKFLOW_DIR}"/*.yml 2>&1 || true)
    FILTERED=$(echo "$OUTPUT" | grep -v "SC2086:info" | grep -v "SC2016:info" | grep -v "SC2129:style" || true)

    if [ -n "$FILTERED" ]; then
        echo "$FILTERED"
        # Check if any remaining issues are errors (not just warnings)
        if echo "$FILTERED" | grep -qE "\\[syntax-check\\]|\\[expression\\].*cannot be assigned|\\[action\\]"; then
            ERRORS=1
        else
            echo ""
            echo "Warnings found but no blocking errors"
        fi
    else
        echo ""
        echo "All workflows passed actionlint validation"
    fi
else
    # In CI environments, actionlint must be available — we don't fall back
    if [ "${CI:-}" = "true" ] || [ "${GITHUB_ACTIONS:-}" = "true" ]; then
        echo "FATAL: actionlint not found in CI environment"
        echo "Install actionlint before running this script in CI"
        exit 1
    fi

    echo "actionlint not found - using basic YAML validation"
    echo "For comprehensive validation, install actionlint:"
    echo "  brew install actionlint  # macOS"
    echo "  go install github.com/rhysd/actionlint/cmd/actionlint@latest  # Go"
    echo ""

    # Fall back to node-based YAML validation
    if command -v python3 &> /dev/null; then
        echo "Validating YAML syntax with python3..."
        echo ""

        for workflow in "${WORKFLOW_DIR}"/*.yml; do
            filename=$(basename "$workflow")
            if python3 -c "
import yaml, sys
with open('$workflow') as f:
    yaml.safe_load(f)
print('  ✓ $filename')
" 2>/dev/null; then
                : # Success, already printed
            else
                echo "  ✗ ${filename} - YAML parse error"
                ERRORS=1
            fi
        done
    else
        echo "Neither actionlint nor python3 available for validation"
        ERRORS=1
    fi
fi

echo ""

# Additional checks that actionlint might miss
echo "=== Additional Validation Checks ==="
echo ""

# Check for common issues
for workflow in "${WORKFLOW_DIR}"/*.yml; do
    filename=$(basename "$workflow")

    # Check for tabs (YAML should use spaces)
    if grep -q $'\t' "$workflow"; then
        echo "  ⚠ ${filename}: Contains tabs (YAML prefers spaces)"
    fi

    # Check for trailing whitespace
    if grep -q '[[:space:]]$' "$workflow"; then
        echo "  ⚠ ${filename}: Contains trailing whitespace"
    fi

    # Check for BOM (byte order mark)
    if head -c 3 "$workflow" | grep -q $'\xef\xbb\xbf'; then
        echo "  ✗ ${filename}: Contains BOM (byte order mark)"
        ERRORS=1
    fi
done

echo ""

# Duplicate key check — GitHub rejects workflow files with duplicate mapping keys
# and silently disables all triggers in that file, so this is a critical gate
echo "=== Duplicate Key Check ==="
echo ""

if command -v python3 &> /dev/null; then
    for workflow in "${WORKFLOW_DIR}"/*.yml; do
        filename=$(basename "$workflow")
        if python3 -c "
import sys, yaml
class Strict(yaml.SafeLoader): pass
def no_dup(loader, node, deep=False):
    seen = {}
    for k, v in node.value:
        key = loader.construct_object(k, deep=deep)
        if key in seen:
            raise ValueError('duplicate key %r at line %d' % (key, k.start_mark.line + 1))
        seen[key] = loader.construct_object(v, deep=deep)
    return seen
Strict.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, no_dup)
with open('$workflow') as f:
    yaml.load(f, Strict)
" 2>&1; then
            echo "  ✓ ${filename}"
        else
            echo "  ✗ ${filename}"
            ERRORS=1
        fi
    done
else
    echo "python3 not available for the duplicate key check, which is the check that matters most here"
    ERRORS=1
fi

echo ""

# Summary
WORKFLOW_COUNT=$(ls -1 "${WORKFLOW_DIR}"/*.yml 2>/dev/null | wc -l | tr -d ' ')
if [ "$ERRORS" -eq 0 ]; then
    echo "=== SUCCESS: ${WORKFLOW_COUNT} workflow(s) validated ==="
    exit 0
else
    echo "=== FAILED: Workflow validation errors found ==="
    exit 1
fi
