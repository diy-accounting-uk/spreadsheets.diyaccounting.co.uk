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

// Load tax data for 2025-26
const taxData = parseTOML(readFileSync(resolve(APP_DIR, "data", "se-2025-2026.toml"), "utf8"));

// Scenario stock/debtors/creditors (from bst-scenario-basic.toml expected values and extract-scenarios)
const bstScenario = {
  stock: { opening: 10000, closing: 6000 },
  business: {
    name: "Precision Code Trading",
    description: "IT consultancy and software development",
    address: "123 High Street",
    town: "Manchester",
    postcode: "M1 1AA",
  },
  opening_debtors: [
    { customer: "Acme Corp", amount: 7200 },
    { customer: "Beta Systems", amount: 1200 },
    { customer: "Gamma Ltd", amount: 2400 },
  ],
  closing_debtors: [
    { customer: "Acme Corp", amount: 8000 },
    { customer: "TechStart Ltd", amount: 2400 },
  ],
  opening_creditors: [
    { supplier: "WorkSpace Ltd", amount: 1200 },
    { supplier: "Smith & Co", amount: 300 },
    { supplier: "TechParts Ltd", amount: 600 },
    { supplier: "Shell", amount: 120 },
  ],
  closing_creditors: [
    { supplier: "WorkSpace Ltd", amount: 1200 },
    { supplier: "Smith & Co", amount: 300 },
    { supplier: "BT Business", amount: 60 },
    { supplier: "Shell", amount: 150 },
  ],
};

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
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenario);
    expect(results).toBeDefined();
    expect(results["Profit & Loss Acc"]).toBeDefined();
    expect(results["Income Tax"]).toBeDefined();
  });

  // ── P&L checks (compare against committed reconciliation report values) ──

  it("C4: Sales Turnover = 409900", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenario);
    expect(results["Profit & Loss Acc"].C4).toBe(409900);
  });

  it("C6: Cost of Sales = 10540", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenario);
    expect(results["Profit & Loss Acc"].C6).toBe(10540);
  });

  it("C7: Direct Costs = 8000", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenario);
    expect(results["Profit & Loss Acc"].C7).toBe(8000);
  });

  it("C9: Gross Profit = 391360", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenario);
    expect(results["Profit & Loss Acc"].C9).toBe(391360);
  });

  it("C12: Premises = 15840", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenario);
    expect(results["Profit & Loss Acc"].C12).toBe(15840);
  });

  it("C14: Gen Admin = 1962", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenario);
    expect(results["Profit & Loss Acc"].C14).toBe(1962);
  });

  it("C18: Legal & Professional = 4560", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenario);
    expect(results["Profit & Loss Acc"].C18).toBe(4560);
  });

  it("C22: Total Expenses = 125852", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenario);
    expect(results["Profit & Loss Acc"].C22).toBe(125852);
  });

  it("C24: Net Profit = 265508", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenario);
    expect(results["Profit & Loss Acc"].C24).toBe(265508);
  });

  it("C28: Taxable Profit = 265508 (no capital allowances)", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenario);
    expect(results["Profit & Loss Acc"].C28).toBe(265508);
  });

  // ── Monthly sales ──

  it("D4: Apr sales = 33400", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenario);
    expect(results["Profit & Loss Acc"].D4).toBe(33400);
  });

  it("O4: Mar sales = 31360", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenario);
    expect(results["Profit & Loss Acc"].O4).toBe(31360);
  });

  // ── Income Tax checks ──

  it("E5: Profit from SE = 265508", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenario);
    expect(results["Income Tax"].E5).toBe(265508);
  });

  // 265,508 of profit loses the whole allowance to the taper, so the charge is
  // 37,700 at 20%, 87,440 at 40% and 140,368 at 45%.
  it("E11: Total Income Tax = 105681.60 (tolerance 1)", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenario);
    expect(Math.abs(results["Income Tax"].E11 - 105681.6)).toBeLessThanOrEqual(1);
  });

  it("E10: Tax at the additional rate = 63165.60 (tolerance 1)", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenario);
    expect(Math.abs(results["Income Tax"].E10 - 63165.6)).toBeLessThanOrEqual(1);
  });

  it("E15: NI Class 4 lower = 2262", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenario);
    expect(results["Income Tax"].E15).toBeCloseTo(2262, 0);
  });

  it("E18: Total Tax + NI = 112248.36 (tolerance 1)", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenario);
    // 105,681.60 of income tax plus 2,262.00 and 4,304.76 of Class 4 NI.
    expect(Math.abs(results["Income Tax"].E18 - 112248.36)).toBeLessThanOrEqual(1);
  });

  // ── Business Details ──

  it("populates business details from scenario", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenario);
    expect(results["Business Details"].C5).toBe("Precision Code Trading");
    expect(results["Business Details"].C10).toBe("Manchester");
  });

  // ── Debtors & Creditors ──

  it("populates opening debtors", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenario);
    expect(results["Debtors & Creditors"].C5).toBe(7200);
    expect(results["Debtors & Creditors"].C6).toBe(1200);
    expect(results["Debtors & Creditors"].C7).toBe(2400);
  });

  // ── Stock ──

  it("populates stock values", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    results = calculateFromDiyaGl(book, lines, "bst", taxData, bstScenario);
    expect(results.PurchasesStock.D5).toBe(10000);
    expect(results.PurchasesStock.D30).toBe(6000);
  });
});

// ── SE Calculator ──────────────────────────────────────────────────────────

describe("calculateFromDiyaGl — SE", () => {
  it("produces SE results from advanced diya-gl data", () => {
    const { book, lines } = loadDiyaGlData(SE_DATA);
    const results = calculateFromDiyaGl(book, lines, "se", taxData);
    expect(results["Profit & Loss Account"]).toBeDefined();
    expect(results["Income Tax"]).toBeDefined();
  });

  it("B9: Sales Turnover matches Excel (tolerance 1)", () => {
    const { book, lines } = loadDiyaGlData(SE_DATA);
    const results = calculateFromDiyaGl(book, lines, "se", taxData);
    // Excel: 339200
    expect(Math.abs(results["Profit & Loss Account"].B9 - 339200)).toBeLessThanOrEqual(1);
  });

  it("B19: Gross Profit is positive and close to Excel", () => {
    const { book, lines } = loadDiyaGlData(SE_DATA);
    const results = calculateFromDiyaGl(book, lines, "se", taxData);
    // Equipment hire is a direct cost, so it sits above the gross profit line.
    expect(Math.abs(results["Profit & Loss Account"].B19 - 321919.33)).toBeLessThanOrEqual(1);
  });

  it("B37: Operating Profit is positive and reasonable", () => {
    const { book, lines } = loadDiyaGlData(SE_DATA);
    const results = calculateFromDiyaGl(book, lines, "se", taxData);
    // Excel: ~211893 (includes payroll wages in expenses)
    expect(results["Profit & Loss Account"].B37).toBeGreaterThan(180000);
    expect(results["Profit & Loss Account"].B37).toBeLessThan(230000);
  });

  it("E5: Profit from SE matches operating profit", () => {
    const { book, lines } = loadDiyaGlData(SE_DATA);
    const results = calculateFromDiyaGl(book, lines, "se", taxData);
    expect(results["Income Tax"].E5).toBeCloseTo(results["Profit & Loss Account"].B39, 0);
  });

  it("E11: Total Income Tax is reasonable", () => {
    const { book, lines } = loadDiyaGlData(SE_DATA);
    const results = calculateFromDiyaGl(book, lines, "se", taxData);
    // The taper and the additional rate lift the charge well above the
    // two-band figure this profit used to attract.
    expect(results["Income Tax"].E11).toBeGreaterThan(70000);
    expect(results["Income Tax"].E11).toBeLessThan(100000);
  });

  it("includes Wagesinterface sheet", () => {
    const { book, lines } = loadDiyaGlData(SE_DATA);
    const results = calculateFromDiyaGl(book, lines, "se", taxData);
    expect(results.Wagesinterface).toBeDefined();
  });

  it("includes VitalTax sheet with quarterly data", () => {
    const { book, lines } = loadDiyaGlData(SE_DATA);
    const results = calculateFromDiyaGl(book, lines, "se", taxData);
    expect(results.VitalTax).toBeDefined();
    expect(results.VitalTax.G5).toBeGreaterThan(0); // Annual sales
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
    expect(ltdRun()["MnthP&L"].B40).toBeCloseTo(5250, 2);
  });
});
