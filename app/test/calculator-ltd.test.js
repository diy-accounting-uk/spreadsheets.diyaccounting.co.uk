// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// The Limited Company checks, run against the JS engine instead of a
// recalculated workbook. checkCompliance() states every relation the Excel
// reconciliation asserts, and each one anchors to a figure the fixture
// carries rather than to another figure the same engine produced, so a check
// that passes here is the same evidence it is over there. Running the whole
// set one test at a time names the relation that broke rather than the file.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import * as ltd from "../products/ltd.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(__dirname, "..");

function taxDataFor(years) {
  return parseTOML(readFileSync(resolve(APP_DIR, "data", `${years}.toml`), "utf8"));
}

// One package run: the fixture in, the JS engine's cell map and the verdicts
// checkCompliance() reaches on it out. Mirrors what report.js --data does.
function runFixture({ dataDir, years, offset }) {
  const { book, lines } = loadDiyaGlData(resolve(ROOT, dataDir), offset);
  const taxData = taxDataFor(years);
  const scenario = diyaGlToScenario(book, lines, "ltd");
  const merged = { ...scenario, ...scenario.expected };
  const results = calculateFromDiyaGl(book, lines, "ltd", taxData, scenario);
  const yearEnd = new Date(book.documentInfo.periodCoveredEnd).toISOString().slice(0, 10);
  const checks = ltd.checkCompliance({ ...results }, merged, taxData, calculateExpectedTax, yearEnd);
  return { book, lines, taxData, scenario, merged, results, checks, yearEnd };
}

// The checks the shipped workbook cannot pass, whichever engine computes it.
// Both sides reach the same verdict on each, so the roundtrip scores them
// equal; they are gaps in the templates, not in this engine.
const SHEET_LIMITATION_GAPS = [
  // The printed payslip's payment date reads column R of the block's own
  // header row, where the template holds nothing. The date the wages were
  // paid sits a row below in column M, which is where the period-end cell
  // finds it, so both engines print a nil here and this warning carries the
  // date the page would have shown.
  "Payslips print: the date the scenario paid that month's wages, which the payment date would carry",
];

const FIXTURES = [
  // The Precision Code year the roundtrip job runs, at the March year end and
  // the tax year the package is generated for.
  {
    name: "ltd-scenario-full",
    dataDir: "examples/precision-code-ltd/full",
    years: "ltd-2024",
    offset: "-P1Y",
    knownGaps: SHEET_LIMITATION_GAPS,
  },
  { name: "ltd-brickwork-pro-vat", dataDir: "examples/brickwork-pro/ltd-vat", years: "ltd-2026", knownGaps: SHEET_LIMITATION_GAPS },
  {
    name: "ltd-brickwork-pro-nonvat",
    dataDir: "examples/brickwork-pro/ltd-nonvat",
    years: "ltd-2026",
    knownGaps: SHEET_LIMITATION_GAPS,
  },
];

describe.each(FIXTURES)("Ltd compliance checks on $name", (fixture) => {
  const run = runFixture(fixture);
  const gaps = new Set(fixture.knownGaps);

  it("states a check for every relation the reconciliation asserts", () => {
    expect(run.checks.length).toBeGreaterThan(500);
  });

  it("fails only the checks the scenario has no data for", () => {
    expect(
      run.checks
        .filter((check) => !check.pass)
        .map((check) => check.name)
        .sort(),
    ).toEqual([...gaps].sort());
  });

  it.each(run.checks.map((check, index) => [`${index}. ${check.name}`, check]))("%s", (_name, check) => {
    expect(check.pass).toBe(!gaps.has(check.name));
  });
});

// ── The statutory figures, hand-computed ───────────────────────────────────
//
// Every figure below is worked out from the fixture by hand and cross-checked
// against the recalculated Excel package for the same year, so neither side
// of the comparison is the engine restating itself.
describe("Precision Code Ltd, year ended 31 March 2025", () => {
  const run = runFixture(FIXTURES[0]);
  const ct = run.results.CorporationTax;
  const ct600 = run.results.CT600;
  const pl = run.results["MnthP&L"];

  it("charges the year on the operating profit plus the non-deductible add-backs", () => {
    expect(pl.B43).toBeCloseTo(171840.39, 2);
    expect(ct.K5).toBeCloseTo(171840.39, 2);
    // Goodwill written off 2,500 and depreciation 13,740, the schedule's
    // charge on the van and the laptop brought forward plus the new plant.
    expect(ct.I7).toBeCloseTo(2500, 2);
    expect(ct.I8).toBeCloseTo(13740, 2);
    expect(ct.K10).toBeCloseTo(16240, 2);
    expect(ct.K12).toBeCloseTo(188080.39, 2);
  });

  it("deducts the capital allowances, netting the van's disposal against its own pool", () => {
    // 52,500 of new plant claims the whole cost. The van brought forward a
    // written down value of 24,000; the year's writing down allowance on it
    // is the Admin rate, 18% (4,320), leaving a pool of 19,680, and its sale
    // for 12,500 net of VAT settles that pool as a balancing allowance of
    // 7,180 rather than a charge, because the sale falls short of the pool.
    expect(ct.I15).toBeCloseTo(52500, 2);
    expect(ct.I18).toBeCloseTo(7180, 2);
    expect(ct.K20).toBeCloseTo(64000, 2);
    expect(ct.K22).toBeCloseTo(124080.39, 2);
  });

  it("charges the gross bank interest and credits the tax deducted at source", () => {
    // The accounts carry 275 received; the computation charges 275 / 0.81.
    expect(pl.B44).toBeCloseTo(275, 2);
    expect(ct.K24).toBeCloseTo(339.51, 2);
    expect(ct.K37).toBeCloseTo(64.51, 2);
  });

  it("reaches the chargeable profit the CT600 files", () => {
    expect(ct.K28).toBeCloseTo(124419.9, 2);
    expect(ct600.AJ92).toBeCloseTo(124419.9, 2);
    expect(ct600.AJ110).toBeCloseTo(124419.9, 2);
    expect(ct600.N126).toBeCloseTo(124419.9, 2);
  });

  it("charges one financial year at the main rate less marginal relief", () => {
    expect(ct.A33).toBe(365);
    expect(ct.A34).toBe(0);
    expect(ct.E33).toBe(2024);
    expect(ct.G33).toBe(25);
    // 124,419.90 at 25% is 31,104.97; relief is (250,000 - 124,419.90) x 3/200.
    expect(ct.J33).toBeCloseTo(31104.97, 2);
    expect(ct.L33).toBeCloseTo(1883.7, 2);
    expect(ct.K35).toBeCloseTo(29221.27, 2);
    expect(ct.K39).toBeCloseTo(29156.77, 2);
  });

  it("files the same charge on the CT600 boxes", () => {
    expect(ct600.C126).toBe(2024);
    expect(ct600.AA126).toBe(25);
    expect(ct600.AJ126).toBeCloseTo(ct.J33, 6);
    expect(ct600.AJ131).toBeCloseTo(ct.J33 + ct.J34, 6);
    expect(ct600.Y133).toBeCloseTo(ct.L33 + ct.L34, 6);
    expect(ct600.Y135).toBeCloseTo(29221.27, 2);
    expect(ct600.AJ145).toBeCloseTo(ct.K35, 6);
    expect(ct600.AJ154).toBeCloseTo(ct.K37, 6);
    expect(ct600.AJ159).toBeCloseTo(29156.77, 2);
    expect(ct600.AJ166).toBeCloseTo(29156.77, 2);
    expect(ct600.AK66).toBeCloseTo(341283.33, 2);
    // The effective rate the form states: the charge over the profit.
    expect(ct600.W137).toBeCloseTo(23.49, 2);
  });

  it("publishes the statutory accounts the working sheet feeds", () => {
    const pubPl = run.results["PubP&L"];
    const balanceSheet = run.results.PubBalSht;
    expect(pubPl.F9).toBeCloseTo(341283.33, 2);
    expect(pubPl.F50).toBeCloseTo(29221.27, 2);
    expect(pubPl.F54).toBeCloseTo(127958.62, 2);
    // The land & buildings asset (cost 200,000, depreciation 40,000 brought
    // forward) sits in opening_fixed_assets rather than the year's additions
    // or disposals, and its class depreciates at 0% (ltd-2024.toml), so it
    // carries its whole net book value, 160,000, into this figure with no
    // in-year movement: 48,990 + 160,000 = 208,990.
    expect(balanceSheet.F6).toBeCloseTo(208990, 2);
    expect(balanceSheet.F33).toBeCloseTo(balanceSheet.F39, 6);
  });
});

// ── The trial balance closes ───────────────────────────────────────────────
describe.each(FIXTURES)("Trial balance on $name", (fixture) => {
  const run = runFixture(fixture);

  it("balances to nil across the whole chart", () => {
    expect(run.results.TrialBalance.EJ91).toBeCloseTo(0, 2);
  });

  it("balances the opening column to nil as well", () => {
    expect(run.results.TrialBalance.D91).toBeCloseTo(0, 2);
  });
});

// ── Every check is breakable ───────────────────────────────────────────────
//
// A check that cannot fail is not a check. Each case below corrupts one
// figure the engine reads and asserts the exact set of checks that flips, so
// a relation quietly comparing a value with itself would show up as an empty
// failure set.
describe("a corrupted figure flips the checks that read it, and no others", () => {
  const intact = runFixture(FIXTURES[0]);

  function failuresAfter(mutate) {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, FIXTURES[0].dataDir), FIXTURES[0].offset);
    const taxData = taxDataFor(FIXTURES[0].years);
    const scenario = diyaGlToScenario(book, lines, "ltd");
    const merged = { ...scenario, ...scenario.expected };
    const results = calculateFromDiyaGl(book, lines, "ltd", taxData, scenario);
    mutate(results);
    const yearEnd = new Date(book.documentInfo.periodCoveredEnd).toISOString().slice(0, 10);
    return ltd
      .checkCompliance({ ...results }, merged, taxData, calculateExpectedTax, yearEnd)
      .filter((check) => !check.pass)
      .map((check) => check.name)
      .sort();
  }

  const alreadyFailing = new Set(intact.checks.filter((check) => !check.pass).map((check) => check.name));
  const flippedBy = (mutate) => failuresAfter(mutate).filter((name) => !alreadyFailing.has(name));

  it("names the monthly sales tie when April's net total moves", () => {
    expect(
      flippedBy((results) => {
        results["Sales.xlsx!Apr"].H1 += 1000;
      }),
    ).toEqual(["P&L Apr turnover = Sales.xlsx Apr net less bad debts and asset sales", "Vatinterface D6: Apr sales net = Sales.xlsx Apr"]);
  });

  it("names the tax chain when the corporation tax charge moves", () => {
    expect(
      flippedBy((results) => {
        results.CorporationTax.K35 += 100;
      }),
    ).toEqual([
      "CT600: tax net of marginal relief = the working sheet's charge",
      "CT: Tax outstanding = CT less tax deducted at source",
      "CT: charge for the year = the statutory computation with marginal relief",
      "CT: charge for the year = the two tax rows",
      "Fixed asset note: corporation tax for the year = CT charge",
      "Trial Balance: corporation tax creditor = opening plus the year's charge, less the interest tax credit and the payments coded RT",
    ]);
  });

  it("names the bank echo and the balance sheet when the current account closes elsewhere", () => {
    expect(
      flippedBy((results) => {
        results.TrialBalance.EJ22 += 500;
      }),
    ).toEqual([
      "Published balance sheet: cash at bank = Trial Balance bank account aggregate",
      "Trial Balance: Currentaccount.xlsx closing balance echo (EJ22)",
    ]);
  });

  it("names one month's payroll tie when its employer NI moves", () => {
    expect(
      flippedBy((results) => {
        results.WagesInterface.H4 += 50;
      }),
    ).toEqual(["WagesInterface employees Apr H4 employer NI"]);
  });

  it("names the directors' own payroll tie and the wages line it feeds when the directors block moves", () => {
    expect(
      flippedBy((results) => {
        results.WagesInterface.C17 += 50;
      }),
    ).toEqual(["WagesInterface directors Apr C17 gross pay"]);
  });

  it("names the VAT chain when a quarter's output box moves", () => {
    expect(
      flippedBy((results) => {
        results["Vatreturns.xlsx!VATQtr1"].G9 += 10;
      }),
    ).toEqual(["VAT Q1: box 1 (G9) = Vatinterface quarter VAT due (G8)", "VAT: Q1-Q4 box 1 = Sales VAT"]);
  });

  it("names the net book value identity when the schedule's total cost moves", () => {
    expect(
      flippedBy((results) => {
        results["Fixedassets.xlsx!Schedule"].E1 += 250;
      }),
    ).toEqual(["Fixed assets: closing NBV = cost less disposals, less depreciation carried forward less depreciation on disposals"]);
  });
});
