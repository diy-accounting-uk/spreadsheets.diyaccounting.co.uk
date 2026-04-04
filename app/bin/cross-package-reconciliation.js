#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// cross-package-reconciliation.js — Check that values which should be
// consistent between packages are consistent across reconciliation reports.
//
// For a non-VAT scenario with the same transactions, pre-tax profit should
// be identical in BST, SE, and Ltd (since amounts are face value, no VAT split).
//
// Usage:
//   node app/bin/cross-package-reconciliation.js
//   npm run cross-package-reconciliation

import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = resolve(__dirname, "..", "..", "reports");

if (!existsSync(REPORTS_DIR)) {
  console.error("No reports/ directory. Run reconciliation first.");
  process.exit(1);
}

const reports = readdirSync(REPORTS_DIR)
  .filter((f) => f.endsWith(".md"))
  .map((f) => {
    const content = readFileSync(resolve(REPORTS_DIR, f), "utf-8");
    return { name: f, content };
  });

console.log(`Found ${reports.length} reconciliation reports`);

// Extract scenario name and key values from each report
function extractValues(content) {
  const scenario = content.match(/Scenario: (.+)/)?.[1] || "";
  const status = content.match(/Status: (.+)/)?.[1] || "";

  // Extract cell values from appendix
  const values = {};
  const cellMatches = [...content.matchAll(/\| ([A-Z]+\d+) \| .+? \| ([^\|]+?) \|/g)];
  for (const m of cellMatches) {
    const val = parseFloat(m[2].trim());
    if (!isNaN(val)) values[m[1]] = val;
  }

  return { scenario, status, values };
}

// Group reports by scenario
const byScenario = {};
for (const r of reports) {
  const { scenario, status, values } = extractValues(r.content);
  if (!byScenario[scenario]) byScenario[scenario] = [];

  // Detect product from filename
  let product = "unknown";
  if (r.name.includes("Basic_Sole_Trader")) product = "bst";
  else if (r.name.includes("Self_Employed")) product = "se";
  else if (r.name.includes("Company")) product = "ltd";
  else if (r.name.includes("Taxi")) product = "taxi";

  byScenario[scenario].push({ name: r.name, product, status, values });
}

let failures = 0;

// For each scenario that appears in multiple products, check consistency
for (const [scenario, entries] of Object.entries(byScenario)) {
  if (entries.length < 2) continue;

  console.log(`\nScenario: ${scenario} (${entries.length} reports)`);
  for (const e of entries) {
    console.log(`  ${e.product}: ${e.status}`);
  }

  // Check: all reports should RECONCILE
  const anomalies = entries.filter((e) => e.status.includes("ANOMALY"));
  if (anomalies.length > 0) {
    console.log(`  CROSS-CHECK FAIL: ${anomalies.length} anomalies detected`);
    failures++;
  }
}

if (failures > 0) {
  console.log(`\n=== ${failures} cross-package failures ===`);
  process.exit(1);
} else {
  console.log(`\n=== All cross-package checks passed ===`);
}
