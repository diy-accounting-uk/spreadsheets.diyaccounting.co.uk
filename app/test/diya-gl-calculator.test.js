// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { calculateFromDiyaGl, aggregateByAccountAndMonth } from "../lib/diya-gl-calculator.js";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(__dirname, "..");
const BST_DATA = resolve(ROOT, "examples", "precision-code-ltd", "bst");
const SE_DATA = resolve(ROOT, "examples", "precision-code-ltd", "advanced");
const LTD_DATA = resolve(ROOT, "examples", "precision-code-ltd", "full");
const TAXI_DATA = resolve(ROOT, "examples", "sp-sixty-driving", "taxi");

// Load tax data for 2025-26
const taxData = parseTOML(readFileSync(resolve(APP_DIR, "data", "se-2025-2026.toml"), "utf8"));

// The BST scenario comes from diyaGlToScenario(), the same derivation the
// generator and report.js use, rather than a hand-kept literal: the master
// data's own [stock], [[debtors]] and [[creditors]] tables are the one place
// these figures live.
function bstScenarioFor(book, lines) {
  const scenario = diyaGlToScenario(book, lines, "bst");
  return { ...scenario, ...scenario.expected };
}

describe("aggregateByAccountAndMonth", () => {
  it("groups lines by account and month", () => {
    const lines = [
      { accountMainID: "4000", postingDate: "2025-04-15", amount: 100 },
      { accountMainID: "4000", postingDate: "2025-04-20", amount: 200 },
      { accountMainID: "4000", postingDate: "2025-05-10", amount: 300 },
      { accountMainID: "5000", postingDate: "2025-04-15", amount: 50 },
    ];
    const result = aggregateByAccountAndMonth(lines);
    expect(result.get("4000").get("apr")).toBe(300);
    expect(result.get("4000").get("may")).toBe(300);
    expect(result.get("5000").get("apr")).toBe(50);
  });
});

describe("calculateFromDiyaGl — BST", () => {
  let results;

  it("produces results from diya-gl data", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenarioFor(book, lines));
    expect(results).toBeDefined();
    expect(results["Profit & Loss Acc"]).toBeDefined();
    expect(results["Income Tax"]).toBeDefined();
  });

  // ── P&L checks (compare against committed reconciliation report values) ──

  it("C4: Sales Turnover = 409900", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenarioFor(book, lines));
    expect(results["Profit & Loss Acc"].C4).toBe(409900);
  });

  it("C6: Cost of Sales = 10540", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenarioFor(book, lines));
    expect(results["Profit & Loss Acc"].C6).toBe(10540);
  });

  it("C7: Direct Costs = 8000", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenarioFor(book, lines));
    expect(results["Profit & Loss Acc"].C7).toBe(8000);
  });

  it("C9: Gross Profit = 391360", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenarioFor(book, lines));
    expect(results["Profit & Loss Acc"].C9).toBe(391360);
  });

  it("C12: Premises = 15840", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenarioFor(book, lines));
    expect(results["Profit & Loss Acc"].C12).toBe(15840);
  });

  it("C14: Gen Admin = 1962", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenarioFor(book, lines));
    expect(results["Profit & Loss Acc"].C14).toBe(1962);
  });

  it("C18: Legal & Professional = 4560", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenarioFor(book, lines));
    expect(results["Profit & Loss Acc"].C18).toBe(4560);
  });

  it("C22: Total Expenses = 125852", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenarioFor(book, lines));
    expect(results["Profit & Loss Acc"].C22).toBe(125852);
  });

  it("C24: Net Profit = 265508", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenarioFor(book, lines));
    expect(results["Profit & Loss Acc"].C24).toBe(265508);
  });

  // Net profit less the 39,000 of Annual Investment Allowance the fixture's
  // three fixed asset additions claim in full.
  it("C28: Taxable Profit = 226508 (net profit less capital allowances)", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenarioFor(book, lines));
    expect(results["Profit & Loss Acc"].C28).toBe(226508);
  });

  // ── Monthly sales ──

  it("D4: Apr sales = 33400", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenarioFor(book, lines));
    expect(results["Profit & Loss Acc"].D4).toBe(33400);
  });

  it("O4: Mar sales = 31360", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenarioFor(book, lines));
    expect(results["Profit & Loss Acc"].O4).toBe(31360);
  });

  // ── Income Tax checks ──

  // Income Tax!E5 reads 'SE Short'!D106, the box 27 net business profit, not
  // the P&L's own C28 directly, though the two agree once the boxes only
  // the SA103S carries (other business income, loss brought forward) are nil.
  it("E5: Profit from SE = 226508 (SE Short D106)", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenarioFor(book, lines));
    expect(results["Income Tax"].E5).toBe(226508);
  });

  // 226,508 of profit loses the whole allowance to the taper, so the charge is
  // 37,700 at 20%, 87,440 at 40% and 101,368 at 45%.
  it("E11: Total Income Tax = 88131.60", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenarioFor(book, lines));
    expect(results["Income Tax"].E11).toBeCloseTo(88131.6, 1);
  });

  it("E10: Tax at the additional rate = 45615.60", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenarioFor(book, lines));
    expect(results["Income Tax"].E10).toBeCloseTo(45615.6, 1);
  });

  it("E15: NI Class 4 lower = 2262", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenarioFor(book, lines));
    expect(results["Income Tax"].E15).toBeCloseTo(2262, 0);
  });

  it("E18: Total Tax + NI = 93918.36", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenarioFor(book, lines));
    // 88,131.60 of income tax plus 2,262.00 and 3,524.76 of Class 4 NI.
    expect(results["Income Tax"].E18).toBeCloseTo(93918.36, 1);
  });

  // ── Business Details ──

  it("populates business details from scenario", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenarioFor(book, lines));
    expect(results["Business Details"].C5).toBe("Precision Code Trading");
    expect(results["Business Details"].C10).toBe("Manchester");
  });

  // ── Debtors & Creditors ──

  it("populates opening debtors", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenarioFor(book, lines));
    expect(results["Debtors & Creditors"].C5).toBe(7200);
    expect(results["Debtors & Creditors"].C6).toBe(1200);
    expect(results["Debtors & Creditors"].C7).toBe(2400);
  });

  // ── Stock ──

  it("populates stock values", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenarioFor(book, lines));
    expect(results.PurchasesStock.D5).toBe(10000);
    expect(results.PurchasesStock.D30).toBe(6000);
  });
});

// ── Taxi Calculator ────────────────────────────────────────────────────────
// The detailed, check-by-check assertions live in calculator-taxi.test.js;
// these are the same smoke-and-anchor shape the SE and Ltd sections below use.

function taxiScenarioFor(book, lines) {
  const scenario = diyaGlToScenario(book, lines, "taxi");
  return { ...scenario, ...scenario.expected };
}

describe("calculateFromDiyaGl — Taxi", () => {
  it("produces Taxi results from diya-gl data", () => {
    const { book, lines } = loadDiyaGlData(TAXI_DATA);
    const results = calculateFromDiyaGl(book, lines, "taxi", taxData, taxiScenarioFor(book, lines));
    expect(results["Profit & Loss Acc"]).toBeDefined();
    expect(results["Draft Tax calculation"]).toBeDefined();
  });

  it("B5: Turnover = 38000 (SP Sixty Driving's 180 working days)", () => {
    const { book, lines } = loadDiyaGlData(TAXI_DATA);
    const results = calculateFromDiyaGl(book, lines, "taxi", taxData, taxiScenarioFor(book, lines));
    expect(results["Profit & Loss Acc"].B5).toBe(38000);
  });

  it("B23: Net Profit = 29680, after the mileage claim the workbook takes over the running costs", () => {
    const { book, lines } = loadDiyaGlData(TAXI_DATA);
    const results = calculateFromDiyaGl(book, lines, "taxi", taxData, taxiScenarioFor(book, lines));
    expect(results["Profit & Loss Acc"].B11).toBe(7000);
    expect(results["Profit & Loss Acc"].B23).toBe(29680);
  });

  it("includes VitalTax and Wages Forecast sheets", () => {
    const { book, lines } = loadDiyaGlData(TAXI_DATA);
    const results = calculateFromDiyaGl(book, lines, "taxi", taxData, taxiScenarioFor(book, lines));
    expect(results.VitalTax.G5).toBe(38000);
    expect(results["Wages Forecast"].C30).toBe(results["Profit & Loss Acc"].B23);
  });
});

// ── SE Calculator ──────────────────────────────────────────────────────────

describe("calculateFromDiyaGl — SE", () => {
  // report.js hands the engine the same scenario the package writer gets, so
  // the two sides start from one set of figures. The numbers below are the
  // Precision Code advanced book's own: they move when the book moves and
  // when the arithmetic moves, and nothing else.
  function seResults() {
    const { book, lines } = loadDiyaGlData(SE_DATA);
    const scenario = diyaGlToScenario(book, lines, "se");
    return calculateFromDiyaGl(book, lines, "se", taxData, scenario);
  }

  it("produces SE results from advanced diya-gl data", () => {
    const results = seResults();
    expect(results["Profit & Loss Account"]).toBeDefined();
    expect(results["Income Tax"]).toBeDefined();
  });

  it("B9: sales turnover is the journal's trading lines net of VAT", () => {
    expect(seResults()["Profit & Loss Account"].B9).toBeCloseTo(339200, 2);
  });

  it("B19: gross profit is turnover plus grants less cost of sales", () => {
    const pl = seResults()["Profit & Loss Account"];
    expect(pl.B19).toBeCloseTo(321146.67, 2);
    expect(pl.B19).toBeCloseTo(pl.B9 + pl.B11 - pl.B17, 6);
  });

  it("B39: profit before tax is gross profit less the administrative expenses", () => {
    const pl = seResults()["Profit & Loss Account"];
    expect(pl.B35).toBeCloseTo(149271.275, 3);
    expect(pl.B39).toBeCloseTo(171875.39, 2);
  });

  it("E5: the tax sheet charges the full return's taxable profit", () => {
    const results = seResults();
    expect(results["Income Tax"].E5).toBeCloseTo(121615.39, 2);
    expect(results["Income Tax"].E5).toBe(results["SE Full"].O210);
  });

  it("E11: income tax is charged across the bands with the allowance tapered", () => {
    const tax = seResults()["Income Tax"];
    expect(tax.E6).toBeCloseTo(1762.3, 2);
    expect(tax.E11).toBeCloseTo(40401.24, 2);
    expect(tax.E11).toBeCloseTo(tax.E8 + tax.E9 + tax.E10, 6);
  });

  it("Wagesinterface carries each month's payroll", () => {
    const wages = seResults().Wagesinterface;
    expect(wages.C4).toBeCloseTo(6748, 2);
    expect(wages.H4).toBeCloseTo(577.2, 2);
  });

  it("VitalTax quarters the product sales and the direct costs", () => {
    const vitalTax = seResults().VitalTax;
    expect(vitalTax.G5).toBeCloseTo(335500, 2);
    expect(vitalTax.G5).toBeCloseTo(vitalTax.C5 + vitalTax.D5 + vitalTax.E5 + vitalTax.F5, 6);
    expect(vitalTax.G7).toBeCloseTo(13470.0, 2);
  });

  it("the fixed asset schedule claims the year's capital spend as annual investment allowance", () => {
    expect(seResults()["Fixedassets.xlsx!Schedule"].Q1).toBeCloseTo(52500, 2);
  });
});

// ── Ltd Calculator ─────────────────────────────────────────────────────────
//
// The whole Ltd check set runs in calculator-ltd.test.js. What belongs here
// is the entry point: that calculateFromDiyaGl routes "ltd" to the Ltd engine
// and hands back the cell map every reader downstream expects, with each
// figure anchored to the fixture rather than to another figure the same run
// produced.

const ltdTaxData = parseTOML(readFileSync(resolve(APP_DIR, "data", "ltd-2026.toml"), "utf8"));

function ltdRun() {
  const { book, lines } = loadDiyaGlData(LTD_DATA);
  const scenario = diyaGlToScenario(book, lines, "ltd");
  return calculateFromDiyaGl(book, lines, "ltd", ltdTaxData, scenario);
}

describe("calculateFromDiyaGl — Ltd", () => {
  it("returns a sheet for every workbook the reconciliation reads", () => {
    const results = ltdRun();
    for (const sheet of [
      "Admin",
      "OpenAccounts",
      "TrialBalance",
      "MnthP&L",
      "CorporationTax",
      "CT600",
      "PubP&L",
      "PubBalSht",
      "PubNotes",
      "Report",
      "Stock",
      "WagesInterface",
      "Sales.xlsx!Apr",
      "Purchases.xlsx!Apr",
      "Currentaccount.xlsx!Mar",
      "Fixedassets.xlsx!Schedule",
      "Payslips.xlsx!Payment",
      "Vatreturns.xlsx!Vatinterface",
      "Vatreturns.xlsx!VATQtr1",
      "Companysecretary.xlsx!RegisterofMembers",
      "expensesform.xlsx!Month 01",
    ]) {
      expect(Object.keys(results[sheet] ?? {}).length, sheet).toBeGreaterThan(0);
    }
  });

  it("states the sales turnover the journal invoiced, net of VAT", () => {
    // The five turnover codes invoice 409,540 gross across the year.
    expect(ltdRun()["MnthP&L"].B9).toBeCloseTo(409540 / 1.2, 2);
  });

  it("carries the opening balance sheet into the trial balance's opening column", () => {
    const trialBalance = ltdRun().TrialBalance;
    // The opening journal posts 3,000 of computers and 30,000 of vehicles at
    // cost, against 270 and 9,828 of depreciation.
    expect(trialBalance.D9).toBe(3000);
    expect(trialBalance.D10).toBe(30000);
    expect(trialBalance.D14).toBe(-270);
    expect(trialBalance.D15).toBe(-9828);
    expect(trialBalance.D91).toBeCloseTo(0, 6);
  });

  it("closes the whole chart to nil", () => {
    expect(ltdRun().TrialBalance.EJ91).toBeCloseTo(0, 2);
  });

  it("charges the payroll's own employer National Insurance to the P&L", () => {
    // Twelve months at 577.20.
    expect(ltdRun()["MnthP&L"].B20).toBeCloseTo(6926.4, 2);
  });

  it("depreciates the assets the year bought at the plant and machinery rate", () => {
    // 52,500 of new plant at 10%.
    expect(ltdRun()["MnthP&L"].B40).toBeCloseTo(13740, 2);
  });
});
