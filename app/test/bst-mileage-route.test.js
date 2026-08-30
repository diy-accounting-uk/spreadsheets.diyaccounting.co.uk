// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// bst-mileage-route.test.js — a Basic Sole Trader package charging business
// miles at the approved rate rather than an amount someone worked out by
// hand. The mileage-log entries reach the Purchases sheet as miles in column
// F; the workbook bands them at the Admin rates, files the claim under the
// motor code and charges it in Motor Expenses, which moves the profit the
// Income Tax sheet is worked on.
//
// Both engines run here: the recalculated workbook through LibreOffice, and
// the pure JS calculator on the same book.

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { runSpreadsheet, hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { calculateBstResults } from "../lib/calculators/bst.js";
import { cellWrites, standardReads, checkCompliance } from "../products/bst.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import { calculateMileageAllowance } from "../lib/tax/mileage.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(__dirname, "..");
const BST_DIR = resolve(APP_DIR, "templates", "bst");
const FIXTURE = resolve(APP_DIR, "test", "fixtures", "bst-sp-sixty.toml");
const BOOK_DIR = resolve(ROOT, "examples", "sp-sixty-driving", "bst");

const taxData = parseTOML(readFileSync(resolve(APP_DIR, "data", "se-2025-2026.toml"), "utf8"));

// SP Sixty Driving's March, the month claimed on the mileage basis.
const CLAIM_MILES = 1674;
const CLAIM = CLAIM_MILES * taxData.mileage.higher_rate_pence;

// The scenario with every mileage-log entry stripped back to the amount it
// was claimed for: the actual-cost route, for comparison.
function withoutMiles(scenario) {
  const purchases = Object.fromEntries(
    Object.entries(scenario.purchases).map(([month, txns]) => [month, txns.map(({ mileage, ...tx }) => tx)]),
  );
  return { ...scenario, purchases };
}

// The same scenario with the mileage-log entry gone: nothing entered for the
// month claimed on the mileage basis, neither miles nor an amount.
function withoutTheMileageEntry(scenario) {
  const purchases = Object.fromEntries(
    Object.entries(scenario.purchases).map(([month, txns]) => [month, txns.filter((tx) => !tx.mileage)]),
  );
  return { ...scenario, purchases };
}

const SKIP = !hasLibreOffice();
const describeExcel = SKIP ? describe.skip : describe;

describeExcel("BST mileage route — the recalculated workbook", () => {
  let claimed;
  let asAnAmount;
  let noClaimRun;
  let scenario;

  beforeAll(async () => {
    const template = readFileSync(resolve(BST_DIR, "bst-excel.xlsx"));
    const productMeta = parseTOML(readFileSync(resolve(BST_DIR, "meta.toml"), "utf8"));
    const xlsxBuffer = await generateSpreadsheet(template, taxData, productMeta.sheets);

    scenario = loadScenario(FIXTURE);
    const reads = standardReads();
    claimed = await runSpreadsheet(xlsxBuffer, cellWrites(scenario), reads);
    asAnAmount = await runSpreadsheet(xlsxBuffer, cellWrites(withoutMiles(scenario)), reads);
    noClaimRun = await runSpreadsheet(xlsxBuffer, cellWrites(withoutTheMileageEntry(scenario)), reads);
  }, 300000);

  it("carries the miles the journals recorded", () => {
    expect(claimed.PurchasesMar.C1).toBe(CLAIM_MILES);
  });

  it("prices them at the Admin sheet's own approved rates", () => {
    expect(claimed.PurchasesMar.A1).toBeCloseTo(CLAIM, 2);
    expect(CLAIM).toBe(calculateMileageAllowance(CLAIM_MILES, taxData.mileage));
  });

  it("charges the claim in Motor Expenses beside the motoring paid for in cash", () => {
    const cashMotor = Object.values(scenario.purchases)
      .flat()
      .filter((tx) => tx.code === "m" && !tx.mileage)
      .reduce((sum, tx) => sum + tx.amount, 0);
    // The P&L rounds each expense line to the pound (C15 = ROUND(SUM(D15:O15),0)).
    expect(claimed["Profit & Loss Acc"].C15).toBe(Math.round(cashMotor + CLAIM));
  });

  it("reaches the same profit and tax as the amount the entries were claimed for", () => {
    // The book claims each mileage-log entry at the same approved rate the
    // sheet bands it at, so the two routes land on the same figures. What
    // changes is which side worked the claim out.
    expect(claimed["Profit & Loss Acc"].C24).toBeCloseTo(asAnAmount["Profit & Loss Acc"].C24, 2);
    expect(claimed["Income Tax"].E5).toBeCloseTo(asAnAmount["Income Tax"].E5, 2);
    expect(claimed["Income Tax"].E11).toBeCloseTo(asAnAmount["Income Tax"].E11, 2);
    expect(claimed["Income Tax"].E18).toBeCloseTo(asAnAmount["Income Tax"].E18, 2);
  });

  it("without the entry at all, the profit is higher by the claim and so is the tax", () => {
    const withoutTheClaim = noClaimRun;
    expect(withoutTheClaim.PurchasesMar.A1).toBe(0);
    expect(withoutTheClaim["Profit & Loss Acc"].C24 - claimed["Profit & Loss Acc"].C24).toBeCloseTo(CLAIM, 0);
    expect(withoutTheClaim["Income Tax"].E11).toBeGreaterThan(claimed["Income Tax"].E11);
    expect(withoutTheClaim["Income Tax"].E18).toBeGreaterThan(claimed["Income Tax"].E18);
  });

  it("reconciles, and the mileage checks are the ones the miles carry", () => {
    const merged = { ...scenario, ...scenario.expected };
    const checks = checkCompliance({ ...claimed }, merged, taxData, calculateExpectedTax, "2026-04-05");
    expect(checks.filter((c) => !c.pass)).toEqual([]);

    const noMiles = { ...merged, ...withoutMiles(merged), total_mileage: 0 };
    const withoutMileageChecks = checkCompliance({ ...claimed }, noMiles, taxData, calculateExpectedTax, "2026-04-05");
    const dropped = checks.map((c) => c.name).filter((name) => !withoutMileageChecks.some((c) => c.name === name));
    expect(dropped.sort()).toEqual([
      "P&L: Motor Expenses = motoring paid for + the mileage claimed",
      "Purchases: business miles carried = the journals' miles",
      "Purchases: mileage claimed = those miles at the tax year's approved rates",
    ]);
  });
});

describe("BST mileage route — the JS calculator", () => {
  const { book, lines } = loadDiyaGlData(BOOK_DIR);
  const scenario = diyaGlToScenario(book, lines, "bst");
  const merged = { ...scenario, ...scenario.expected };
  const results = calculateBstResults(book, lines, taxData, merged);

  it("carries the miles the journals recorded", () => {
    expect(merged.total_mileage).toBe(CLAIM_MILES);
    expect(results.PurchasesMar.C1).toBe(CLAIM_MILES);
  });

  it("prices them at the tax year's approved rates", () => {
    expect(results.PurchasesMar.A1).toBeCloseTo(CLAIM, 2);
  });

  it("charges the claim in Motor Expenses", () => {
    const cashMotor = Object.values(merged.purchases)
      .flat()
      .filter((tx) => tx.code === "m" && !tx.mileage)
      .reduce((sum, tx) => sum + tx.amount, 0);
    expect(results["Profit & Loss Acc"].C15).toBe(Math.round(cashMotor + CLAIM));
  });

  it("the claim reaches the Income Tax sheet through the profit", () => {
    const withMiles = results["Income Tax"].E11;
    const noMileageLines = lines.filter((l) => !(l.sourceJournalID === "purchases" && l.measurableUnitOfMeasure === "miles"));
    const noMileageScenario = diyaGlToScenario(book, noMileageLines, "bst");
    const withoutClaim = calculateBstResults(book, noMileageLines, taxData, {
      ...noMileageScenario,
      ...noMileageScenario.expected,
    });
    expect(withoutClaim.PurchasesMar.A1).toBe(0);
    expect(withoutClaim["Profit & Loss Acc"].C24 - results["Profit & Loss Acc"].C24).toBe(Math.round(CLAIM));
    expect(withoutClaim["Income Tax"].E11).toBeGreaterThan(withMiles);
  });

  it("the checks it passes fail when a mileage-log entry loses its miles", () => {
    const before = checkCompliance(results, merged, taxData, calculateExpectedTax, "2026-04-05");
    expect(before.filter((c) => !c.pass)).toEqual([]);

    const shortByTenMiles = lines.map((l) =>
      l.measurableUnitOfMeasure === "miles" ? { ...l, measurableQuantity: l.measurableQuantity - 10 } : l,
    );
    const mutated = diyaGlToScenario(book, shortByTenMiles, "bst");
    const mutatedMerged = { ...mutated, ...mutated.expected };
    const after = checkCompliance(
      calculateBstResults(book, shortByTenMiles, taxData, mutatedMerged),
      merged,
      taxData,
      calculateExpectedTax,
      "2026-04-05",
    );

    expect(
      after
        .filter((c) => !c.pass)
        .map((c) => c.name)
        .sort(),
    ).toEqual([
      "Net Profit",
      "P&L: Motor Expenses = motoring paid for + the mileage claimed",
      "Purchases: business miles carried = the journals' miles",
      "Purchases: mileage claimed = those miles at the tax year's approved rates",
    ]);
  });
});
