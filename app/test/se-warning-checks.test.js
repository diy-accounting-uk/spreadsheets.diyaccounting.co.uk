// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// se-warning-checks.test.js — proves the checks that flag a gap the shipped
// Self Employed template cannot close on its own: each one warns rather than
// fails while the gap exists, carries the size of the gap a hand computation
// would name, and reads live figures rather than a fixed outcome -- so
// corrupting a copy of one cell it reads flips it.
//
// No LibreOffice: the engine never opens a workbook.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { loadScenario } from "../lib/scenario-loader.js";
import { calculateSeResults } from "../lib/calculators/se.js";
import { checkCompliance } from "../products/se.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import { vatRateForScenario, salesNetByCode, bankReceiptsByCode, depreciationAndDisposalLoss } from "./helpers/se-fixture-figures.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");
const TAX_DATA = parseTOML(readFileSync(resolve(APP_DIR, "data", "se-2025-2026.toml"), "utf8"));

function loadFixture(name) {
  const scenario = loadScenario(resolve(FIXTURES_DIR, `${name}.toml`));
  const results = calculateSeResults({}, [], TAX_DATA, scenario);
  const expected = { ...scenario, ...scenario.expected };
  return { results, expected };
}

function runChecks(results, expected) {
  return checkCompliance(results, expected, TAX_DATA, calculateExpectedTax, null);
}

function find(checks, name) {
  const row = checks.find((c) => c.name === name);
  if (!row) throw new Error(`no check named ${name}`);
  return row;
}

// Which check names flip pass/fail between two runs, and which appear or
// disappear outright (a category-netting row that only prints once its
// category carries a non-zero figure). A corruption proof asserts all three
// sets exactly, so a check that moves for an unnamed reason is caught.
function compareChecks(before, after) {
  const beforeMap = new Map(before.map((c) => [c.name, c.pass]));
  const afterMap = new Map(after.map((c) => [c.name, c.pass]));
  const flipped = [];
  for (const [name, pass] of afterMap) {
    if (beforeMap.has(name) && beforeMap.get(name) !== pass) flipped.push(name);
  }
  return {
    flipped: flipped.sort(),
    appeared: [...afterMap.keys()].filter((name) => !beforeMap.has(name)).sort(),
    disappeared: [...beforeMap.keys()].filter((name) => !afterMap.has(name)).sort(),
  };
}

describe("SA103F box 44 leaves the loss on disposal out of the disallowable total box 29 carries", () => {
  const CHECK_NAME =
    "SA103F box 44 disallowable depreciation (O114) leaves the loss on disposal (row 33) out of the disallowable total that box 29 (D114) carries";

  it("warns of the exact gap on the fixture with a disposal, and finds no gap on the two without one", () => {
    const advanced = loadFixture("se-scenario-advanced");
    const advancedRow = find(runChecks(advanced.results, advanced.expected), CHECK_NAME);
    expect(advancedRow.pass).toBe(false);
    expect(advancedRow.severity).toBe("warning");
    // Box 44 (actual) is the year's depreciation charge alone; box 29
    // (expected) adds the loss on disposal of the van, sold in October for
    // less than its written down value. Both sides derived independently
    // from the fixture's own asset and disposal rows, not read back off the
    // engine.
    const rate = vatRateForScenario(advanced.expected, TAX_DATA);
    const { totalDepreciation, disposalLoss } = depreciationAndDisposalLoss(advanced.expected, TAX_DATA, rate);
    expect(advancedRow.actual).toBeCloseTo(totalDepreciation, 2);
    expect(advancedRow.expected).toBeCloseTo(totalDepreciation + disposalLoss, 2);
    expect(advancedRow.diff).toBeCloseTo(-disposalLoss, 2);

    for (const name of ["se-brickwork-pro-vat", "se-brickwork-pro-nonvat"]) {
      const fixture = loadFixture(name);
      const row = find(runChecks(fixture.results, fixture.expected), CHECK_NAME);
      expect(row.pass).toBe(true);
      expect(row.diff).toBe(0);
    }
  });

  it("is breakable: corrupting a copy of box 44's own cached figure flips it and its one sibling, nothing else", () => {
    const { results, expected } = loadFixture("se-brickwork-pro-nonvat");
    const before = runChecks(results, expected);
    const corrupted = { ...results, "SE Full": { ...results["SE Full"], O114: results["SE Full"].O114 - 300 } };
    const after = runChecks(corrupted, expected);

    const { flipped, appeared, disappeared } = compareChecks(before, after);
    expect(appeared).toEqual([]);
    expect(disappeared).toEqual([]);
    expect(flipped).toEqual(
      [
        CHECK_NAME,
        "SA103F box 44 disallowable depreciation (O114) = the profit and loss account",
        "SA103F box 46 total disallowable expenses (O122) = boxes 32 to 45",
      ].sort(),
    );
    expect(find(after, CHECK_NAME).pass).toBe(false);
    expect(find(after, CHECK_NAME).diff).toBeCloseTo(-300, 2);
  });
});

describe("VitalTax annual sales excludes the Other Income sales that SA103F box 15 includes", () => {
  const CHECK_NAME = "VitalTax annual sales (G5) excludes the Other Income sales that SA103F box 15 (D55) includes";

  it("warns of the exact gap on the fixture with Other Income sales, and finds no gap on the two without any", () => {
    const advanced = loadFixture("se-scenario-advanced");
    const advancedRow = find(runChecks(advanced.results, advanced.expected), CHECK_NAME);
    expect(advancedRow.pass).toBe(false);
    expect(advancedRow.severity).toBe("warning");
    // VitalTax (actual) pools sales codes a, b and c; box 15 (expected) adds
    // code d, the "Other Income" turnover row. Derived independently from
    // the fixture's own sales journal.
    const rate = vatRateForScenario(advanced.expected, TAX_DATA);
    const net = salesNetByCode(advanced.expected, rate);
    expect(advancedRow.actual).toBeCloseTo((net.a || 0) + (net.b || 0) + (net.c || 0), 2);
    expect(advancedRow.expected).toBeCloseTo((net.a || 0) + (net.b || 0) + (net.c || 0) + (net.d || 0), 2);
    expect(advancedRow.diff).toBeCloseTo(-(net.d || 0), 2);

    for (const name of ["se-brickwork-pro-vat", "se-brickwork-pro-nonvat"]) {
      const fixture = loadFixture(name);
      const row = find(runChecks(fixture.results, fixture.expected), CHECK_NAME);
      expect(row.pass).toBe(true);
      expect(row.diff).toBe(0);
    }
  });

  it("is breakable: corrupting a copy of VitalTax's own cached annual sales figure flips it and its one sibling, nothing else", () => {
    const { results, expected } = loadFixture("se-brickwork-pro-nonvat");
    const before = runChecks(results, expected);
    const corrupted = { ...results, VitalTax: { ...results.VitalTax, G5: results.VitalTax.G5 - 1000 } };
    const after = runChecks(corrupted, expected);

    const { flipped, appeared, disappeared } = compareChecks(before, after);
    expect(appeared).toEqual([]);
    expect(disappeared).toEqual([]);
    expect(flipped).toEqual([CHECK_NAME, "VitalTax: annual product sales = P&L Products A+B+C"].sort());
    expect(find(after, CHECK_NAME).pass).toBe(false);
    expect(find(after, CHECK_NAME).diff).toBeCloseTo(-1000, 2);
  });
});

describe("VitalTax other income folds Investment Grants in where SA103F reports them apart", () => {
  const CHECK_NAME =
    "VitalTax other income (rows 8, 11 and 38 folded together) treats Investment Grants as ordinary other income, while SA103F reports them apart at box 75 (O204) rather than box 16 (O55)";

  it("warns of the exact grant on the fixture that carries one, and finds no gap on the two without any", () => {
    const advanced = loadFixture("se-scenario-advanced");
    const advancedRow = find(runChecks(advanced.results, advanced.expected), CHECK_NAME);
    expect(advancedRow.pass).toBe(false);
    expect(advancedRow.severity).toBe("warning");
    // VitalTax's other-income row (actual) folds sales code d ("Other
    // Income"), code g (Investment Grants) and Bank.xlsx code K (interest
    // received) together; box 75/16 (expected) carries code d and the bank
    // interest alone, so the gap is the Investment Grants sale. Derived
    // independently from the fixture's own sales and bank journals.
    const rate = vatRateForScenario(advanced.expected, TAX_DATA);
    const net = salesNetByCode(advanced.expected, rate);
    const bankInterest = bankReceiptsByCode(advanced.expected, "K");
    expect(advancedRow.actual).toBeCloseTo((net.d || 0) + (net.g || 0) + bankInterest, 2);
    expect(advancedRow.expected).toBeCloseTo((net.d || 0) + bankInterest, 2);
    expect(advancedRow.diff).toBeCloseTo(net.g || 0, 2);

    for (const name of ["se-brickwork-pro-vat", "se-brickwork-pro-nonvat"]) {
      const fixture = loadFixture(name);
      const row = find(runChecks(fixture.results, fixture.expected), CHECK_NAME);
      expect(row.pass).toBe(true);
      expect(row.diff).toBe(0);
    }
  });

  it("is breakable: corrupting a copy of the cached grants figure flips it, its downstream checks, and brings in the category-netting row a nil grant carries no check for", () => {
    const { results, expected } = loadFixture("se-brickwork-pro-nonvat");
    const before = runChecks(results, expected);
    const corrupted = { ...results, "Profit & Loss Account": { ...results["Profit & Loss Account"], B11: 400 } };
    const after = runChecks(corrupted, expected);

    const { flipped, appeared, disappeared } = compareChecks(before, after);
    expect(disappeared).toEqual([]);
    expect(appeared).toEqual([
      "Category netting: Investment Grants received (sales g) net reaches Profit & Loss Account!B11 with no residue",
    ]);
    expect(flipped).toEqual(
      [
        CHECK_NAME,
        "Accounting profit to tax profit bridge closes to zero",
        "Forecast: investment grants = P&L investment grants",
        "P&L: Gross = Turnover + Grants - CoS",
        "SA103F box 75 other business income (O204) = the profit and loss account",
      ].sort(),
    );
    expect(find(after, CHECK_NAME).pass).toBe(false);
    expect(find(after, CHECK_NAME).diff).toBeCloseTo(400, 2);
  });
});
