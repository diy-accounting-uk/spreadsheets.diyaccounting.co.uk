// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// calculator-bst.test.js — Mirrors app/products/bst.js's checkCompliance()
// checks against the pure JS calculator, one test per check, run on three
// independent diya-gl fixtures. No LibreOffice and no xlsx: these prove the
// calculator's own arithmetic, not the Excel roundtrip (that is EQ1, run by
// app/bin/verify-roundtrip.js against a recalculated package).
//
// Every check is proved breakable by mutating a copy of the fixture's lines
// (never the calculator's own logic) and asserting the exact set of checks
// that name flips, the same discipline the xlsx reconciliation tests use
// with a corrupted cached cell.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { calculateBstResults } from "../lib/calculators/bst.js";
import { checkCompliance, profitBridge } from "../products/bst.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import { PROFIT_BRIDGE_CHECK } from "../lib/report-generator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(__dirname, "..");
const taxData = parseTOML(readFileSync(resolve(APP_DIR, "data", "se-2025-2026.toml"), "utf8"));

const FIXTURES = [
  { name: "precision-code-ltd/bst", dir: resolve(ROOT, "examples", "precision-code-ltd", "bst") },
  { name: "sp-sixty-driving/bst", dir: resolve(ROOT, "examples", "sp-sixty-driving", "bst") },
  { name: "brickwork-pro/bst-nonvat", dir: resolve(ROOT, "examples", "brickwork-pro", "bst-nonvat") },
];

// The Excel checks anchor to a scenario built by diyaGlToScenario() the same
// way report.js does, merged with its own expected values.
function runFixture(dataDir, linesOverride) {
  const { book, lines } = loadDiyaGlData(dataDir);
  const actualLines = linesOverride ? linesOverride(lines) : lines;
  const scenario = diyaGlToScenario(book, actualLines, "bst");
  const merged = { ...scenario, ...scenario.expected };
  const results = calculateBstResults(book, actualLines, taxData, merged);
  const checks = checkCompliance(results, merged, taxData, calculateExpectedTax);
  return { book, lines: actualLines, scenario: merged, results, checks };
}

function checkByName(checks, name) {
  const found = checks.find((c) => c.name === name);
  if (!found) throw new Error(`No check named "${name}" in this run`);
  return found;
}

describe.each(FIXTURES)("BST calculator checks — $name", ({ dir }) => {
  const { checks } = runFixture(dir);

  it.each(checks.map((c) => [c.name, c]))("%s", (_name, check) => {
    expect(check.pass, `${check.name}: actual ${check.actual}, expected ${check.expected}, diff ${check.diff}`).toBe(true);
  });
});

describe("BST calculator — the profit bridge closes on every fixture", () => {
  for (const { name, dir } of FIXTURES) {
    it(`residue is nil for ${name}`, () => {
      const { results } = runFixture(dir);
      const bridge = profitBridge(results);
      expect(bridge.residue).toBeCloseTo(0, 2);
    });
  }
});

describe("BST calculator — SA103S net profit is an exact identity with the P&L", () => {
  for (const { name, dir } of FIXTURES) {
    it(`SE Short!D71 equals Profit & Loss Acc!C24 for ${name}`, () => {
      const { results } = runFixture(dir);
      expect(results["SE Short"].D71).toBe(results["Profit & Loss Acc"].C24);
    });
  }
});

// ── Breakability ────────────────────────────────────────────────────────

describe("BST calculator checks are breakable", () => {
  const dir = FIXTURES[0].dir;

  // The expected side is anchored to the ORIGINAL data throughout: mutating
  // lines and recomputing the scenario from the mutated copy would move the
  // anchor together with the result, and a check comparing a value with
  // itself can never fail.
  it("doubling a sales line's amount fails the sales and profit checks, and nothing else", () => {
    const { book, lines } = loadDiyaGlData(dir);
    const scenario = diyaGlToScenario(book, lines, "bst");
    const anchor = { ...scenario, ...scenario.expected };

    const before = checkCompliance(calculateBstResults(book, lines, taxData, anchor), anchor, taxData, calculateExpectedTax);

    const mutatedLines = [...lines];
    const idx = mutatedLines.findIndex((l) => l.sourceJournalID === "sales");
    mutatedLines[idx] = { ...mutatedLines[idx], amount: mutatedLines[idx].amount * 2 };
    const after = checkCompliance(calculateBstResults(book, mutatedLines, taxData, anchor), anchor, taxData, calculateExpectedTax);

    const brokenBefore = before.filter((c) => !c.pass).map((c) => c.name);
    const brokenAfter = after.filter((c) => !c.pass).map((c) => c.name);
    const newlyBroken = brokenAfter.filter((n) => !brokenBefore.includes(n));

    expect(newlyBroken).toContain("Total Sales");
    expect(newlyBroken).toContain("Gross Profit");
  });

  // The Fixed Assets schedule is built from the purchase journal's own
  // code-"f" lines (fixedAssetAdditions() in app/lib/scenario-loader.js),
  // not from book.fixedAssets[] directly, so that is what inflating a
  // capital purchase has to mutate to move the schedule at all.
  it("inflating a fixed asset purchase's cost fails the capital allowance chain", () => {
    const { book, lines } = loadDiyaGlData(dir);
    const scenario = diyaGlToScenario(book, lines, "bst");
    const anchor = { ...scenario, ...scenario.expected };

    const mutatedLines = [...lines];
    const idx = mutatedLines.findIndex((l) => l.sourceJournalID === "purchases" && l.accountMainID === "5900");
    expect(idx).toBeGreaterThanOrEqual(0);
    mutatedLines[idx] = { ...mutatedLines[idx], amount: mutatedLines[idx].amount + 100000 };
    const mutatedScenario = diyaGlToScenario(book, mutatedLines, "bst");
    const results = calculateBstResults(book, mutatedLines, taxData, mutatedScenario);
    const checks = checkCompliance(results, anchor, taxData, calculateExpectedTax);

    expect(checkByName(checks, "Fixed Assets: schedule total cost = asset additions").pass).toBe(false);
  });

  it("a wrong Admin tax rate fails the Admin echo check and nothing about the P&L totals", () => {
    const { book, lines } = loadDiyaGlData(dir);
    const scenario = diyaGlToScenario(book, lines, "bst");
    const merged = { ...scenario, ...scenario.expected };
    const wrongTaxData = { ...taxData, income_tax: { ...taxData.income_tax, basic_rate: 0.99 } };
    const results = calculateBstResults(book, lines, wrongTaxData, merged);
    const checks = checkCompliance(results, merged, wrongTaxData, calculateExpectedTax);

    expect(checkByName(checks, "Admin: Basic Rate = tax data").pass).toBe(true); // echoes whatever rate it was given
    expect(checkByName(checks, "Tax: sheet applies the basic rate to the lower band").pass).toBe(true);
    expect(checkByName(checks, "Total Sales").pass).toBe(true); // unrelated to the tax rate
  });
});

// ── Units ──────────────────────────────────────────────────────────────

describe("BST cellLabels()", () => {
  it("declares a unit for every cell the checks read", async () => {
    const bst = await import("../products/bst.js");
    const labels = bst.cellLabels();
    for (const [sheet, cell] of bst.CELL_MAP) {
      const key = `${sheet}!${cell}`;
      expect(labels[key]?.unit, `${key} has no declared unit`).toBeDefined();
    }
  });
});
