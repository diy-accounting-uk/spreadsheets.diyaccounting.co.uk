// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
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
import { calculateLtdResults } from "../lib/calculators/ltd.js";
import { apportionCorporationTax } from "../lib/tax/corporation-tax.js";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import { calculatedResultsFor } from "../bin/export.js";
import { runBookChecks } from "../lib/book-checks.js";
import { toExcelSerial } from "../lib/spreadsheet-runner.js";
import { PAYSLIP_PRINT_PERIOD, PAYSLIP_PRINT_SHEET, PAYSLIP_PRINT_CELLS, payslipsWagesPaidCell } from "../lib/payslips-layout.js";
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
const SHEET_LIMITATION_GAPS = [];

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

// ── The payroll year a book with no tax data derives itself ────────────────
describe("the payroll year a book with no financial year data falls back on", () => {
  function payrollAnchorFor(periodCoveredEnd, taxData = {}) {
    const results = calculateLtdResults({ documentInfo: { periodCoveredEnd } }, [], taxData, {});
    return results["Payslips.xlsx!Admin"].B2;
  }

  it("agrees with the writer's targetStartYear rule for a January, a March and an October year end", () => {
    // cellWrites (app/products/ltd.js) opens the payroll year at
    // targetStartYear for a January to March year end and at
    // targetStartYear + 1 otherwise, where targetStartYear is the year
    // end's own calendar year minus one (product-workbook.js).
    expect(payrollAnchorFor("2026-01-31")).toBe(45753); // 2025-04-06
    expect(payrollAnchorFor("2026-03-31")).toBe(45753); // 2025-04-06
    expect(payrollAnchorFor("2026-10-31")).toBe(46118); // 2026-04-06
  });

  it("takes the payroll year from financial_year.start when the tax data carries one, whatever the year end", () => {
    const taxData = { financial_year: { start: "2024-04-01" } };
    expect(payrollAnchorFor("2026-01-31", taxData)).toBe(45388); // 2024-04-06
    expect(payrollAnchorFor("2026-03-31", taxData)).toBe(45388);
    expect(payrollAnchorFor("2026-10-31", taxData)).toBe(45388);
  });
});

describe("the associated companies count on the derived sheets", () => {
  const taxData = taxDataFor("ltd-2026");
  const book = { documentInfo: { periodCoveredEnd: "2026-03-31" } };

  function derivedFor(associatedCompanies) {
    const scenario = associatedCompanies === undefined ? {} : { business: { associated_companies: associatedCompanies } };
    return calculateLtdResults(book, [], taxData, scenario);
  }

  it("reaches Admin P14 and the two CT600 boxes from the scenario's business block", () => {
    const results = derivedFor(3);
    expect(results.Admin.P14).toBe(3);
    expect(results.CT600.Y118).toBe(3);
  });

  it("is none when the business block does not state one, so a book without the figure is unchanged", () => {
    const results = derivedFor(undefined);
    expect(results.Admin.P14).toBe(0);
    expect(results.CT600.Y118).toBe(0);
  });

  it("divides both marginal relief limits, so a company with associates pays more on the same profit", () => {
    const rates = {
      smallProfitsRatePercent: [19, 19],
      mainRatePercent: 25,
      marginalReliefFraction: 0.015,
      lowerLimit: 50000,
      upperLimit: 250000,
    };
    const years = [{ year: 2025, days: 365 }];
    const alone = apportionCorporationTax(100000, years, 365, rates);
    const withThree = apportionCorporationTax(100000, years, 365, { ...rates, associatedCompanies: 3 });

    // Alone the limits are 50,000 and 250,000, so 100,000 sits in the
    // marginal band and relief is (250,000 - 100,000) x 0.015. With three
    // associates they become 12,500 and 62,500, so the profit is above the
    // upper limit, no relief is due and the whole charge is at the main rate.
    expect(alone.rows[0].marginalRelief).toBeCloseTo(2250, 2);
    expect(withThree.rows[0].marginalRelief).toBe(0);
    expect(withThree.rows[0].tax).toBeGreaterThan(alone.rows[0].tax);
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

// ============================== the VAT periods either side of the year ==============================
// The full book carries the master's own VAT-straddling lines, which belong
// to return periods either side of the accounting year and reach
// Vatreturns.xlsx's out-of-year entry sheets rather than any journal. The
// five return forms read them through the interface table, so a book that
// cannot carry them files a nil fifth quarter. The offset moves the lines
// and the book's period together, so the period labels come out the same as
// the scenario's whichever year the book is read in.

describe("the straddling VAT periods reach the return forms from the book", () => {
  it("files the same five VAT quarters from the book as from the scenario extracted from the same master", () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "precision-code-ltd", "full"), "-P1Y");
    const taxData = taxDataFor("ltd-2024");
    const fromBook = calculateFromDiyaGl(book, lines, "ltd", taxData, diyaGlToScenario(book, lines, "ltd"));
    const fromFixture = calculateFromDiyaGl(
      book,
      lines,
      "ltd",
      taxData,
      loadScenario(resolve(APP_DIR, "test", "fixtures", "ltd-scenario-full.toml")),
    );
    for (let quarter = 1; quarter <= 5; quarter++) {
      const sheet = `Vatreturns.xlsx!VATQtr${quarter}`;
      expect(fromBook[sheet], sheet).toEqual(fromFixture[sheet]);
    }
    // The fifth quarter falls wholly outside the accounting year, so the
    // straddling entries are the only thing that puts a figure on it.
    expect(fromBook["Vatreturns.xlsx!VATQtr5"].G9).toBeGreaterThan(0);
  });
});

// ============================== export.js's shared R for the book checks ==============================
// export.js's writeBookChecksJson and the MCP server's report tool both
// build R through calculatedResultsFor rather than calculateFromDiyaGl
// directly, so a Ltd book's distributable-profits warning sees the same
// calculated accounts either way.

describe("calculatedResultsFor matches the engine's own D-to-R loop", () => {
  it("is the same R calculateFromDiyaGl produces from the same book and lines", () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "precision-code-ltd", "full"), "-P1Y");
    const taxData = taxDataFor("ltd-2024");
    const scenario = diyaGlToScenario(book, lines, "ltd");
    const direct = calculateFromDiyaGl(book, lines, "ltd", taxData, scenario);
    const wired = calculatedResultsFor(book, lines, taxData);
    expect(wired).toEqual(direct);
  });

  it("lets the dividend warning read real distributable profits, not the calculated-accounts placeholder", () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "precision-code-ltd", "full"), "-P1Y");
    const taxData = taxDataFor("ltd-2024");
    const results = calculatedResultsFor(book, lines, taxData);
    const withoutResults = runBookChecks({ book, lines, taxData }).results.find(
      (r) => r.id === "book-ltd-dividend-within-distributable-profits",
    );
    const withResults = runBookChecks({ book, lines, taxData, results }).results.find(
      (r) => r.id === "book-ltd-dividend-within-distributable-profits",
    );
    expect(withoutResults.label).toContain("not known without the calculated accounts");
    expect(withResults.label).toContain("retained profit brought forward plus profit after tax");
  });
});

// ============================== the opening balance sheet's own audit checks ==============================
// E37 and D91 compare a trial balance row to zero and need no [opening_balance]
// table to do it, so they run whether or not diyaGlToScenario found one to
// set -- a book with nothing brought forward (a first year with no opening
// balance sheet at all) still owes the sheet a zero on both rows.

describe("the opening balance sheet's own audit checks run without an [opening_balance] table", () => {
  it("run and pass on the full fixture from the book path even with no such table stated", () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "precision-code-ltd", "full"), "-P1Y");
    const taxData = taxDataFor("ltd-2024");
    const scenario = diyaGlToScenario(book, lines, "ltd");
    const merged = { ...scenario, ...scenario.expected };
    const results = calculateFromDiyaGl(book, lines, "ltd", taxData, scenario);
    const yearEnd = new Date(book.documentInfo.periodCoveredEnd).toISOString().slice(0, 10);

    expect(merged.opening_balance).toBeDefined();
    const withoutOpeningBalance = { ...merged };
    delete withoutOpeningBalance.opening_balance;

    const checks = ltd.checkCompliance({ ...results }, withoutOpeningBalance, taxData, calculateExpectedTax, yearEnd);
    const e37 = checks.find((c) => c.name === "Opening balance sheet: accuracy check (E37)");
    const d91 = checks.find((c) => c.name === "Trial Balance: opening balances audit check (D91)");
    expect(e37).toBeDefined();
    expect(e37.pass).toBe(true);
    expect(d91).toBeDefined();
    expect(d91.pass).toBe(true);
  });
});

// ============================== payroll dates on a year end more than a year from the scenario's own period ==============================
//
// cellWrites() places each scenario month's payroll by shifting its date
// through periodShiftMonths(), which counts whole years as well as months.
// checkCompliance() has to derive the same dates the same way to check them:
// a year end within twelve months of the scenario's own period cannot tell a
// month-only offset from a year-carrying one, since they agree there, so the
// case worth locking down is a year end further out than that.

const LTD_SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fiscalTabsFromYearEndMonth(yearEndMonth) {
  const start = yearEndMonth % 12;
  return Array.from({ length: 12 }, (_, i) => LTD_SHORT_MONTHS[(start + i) % 12]);
}

// checkCompliance() reads dozens of sheets besides the payroll ones, several
// ungated, so the base has to be a whole run's worth of results -- the JS
// engine's own, at the fixture's native period -- with only the payroll
// sheets and the period anchor overridden to what a package built for
// 2027-10-31 would carry. Those overrides come from cellWrites() itself, the
// writer LT-T11 already shifts correctly, not from checkCompliance -- so
// this checks checkCompliance's date expectations against what the writer
// actually puts in the cells, not against another restatement of the same
// arithmetic. Every other sheet stays at the fixture's own native period,
// which is fine: nothing here reads them.
function ltdPayrollResultsAtYearEnd20271031() {
  const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "precision-code-ltd", "full"));
  const taxData = taxDataFor("ltd-2024");
  const scenario = diyaGlToScenario(book, lines, "ltd");
  const merged = { ...scenario, ...scenario.expected };
  const baseResults = calculateFromDiyaGl(book, lines, "ltd", taxData, scenario);

  const targetStartYear = 2026;
  const yearEndMonth = 10;
  const writes = ltd.cellWrites(merged, targetStartYear, yearEndMonth);
  const payslips = writes["Payslips.xlsx"] || {};
  const fiscalTabs = fiscalTabsFromYearEndMonth(yearEndMonth);
  const printedMonthIndex = PAYSLIP_PRINT_PERIOD - 1;
  const printedTab = fiscalTabs[printedMonthIndex];
  const printedDate = payslips[printedTab]?.[payslipsWagesPaidCell(printedMonthIndex)];

  const results = {
    ...baseResults,
    Admin: {
      ...baseResults.Admin,
      B9: toExcelSerial(targetStartYear, yearEndMonth + 1, 1),
      F21: toExcelSerial(targetStartYear + 1, yearEndMonth + 1, 1) - 1,
    },
  };
  results[`Payslips.xlsx!${PAYSLIP_PRINT_SHEET}`] = {
    ...results[`Payslips.xlsx!${PAYSLIP_PRINT_SHEET}`],
    [PAYSLIP_PRINT_CELLS.periodEnd]: printedDate,
    M18: printedDate,
  };
  for (const [tab, cells] of Object.entries(payslips)) {
    if (tab === PAYSLIP_PRINT_SHEET) continue;
    results[`Payslips.xlsx!${tab}`] = { ...results[`Payslips.xlsx!${tab}`], ...cells };
  }
  return { merged, results };
}

const LTD_PAYROLL_DATE_CHECK_NAMES = [
  "Payslips print: the period ends the day the scenario paid that month's wages",
  "Payslips print: the payment date is the day the scenario paid that month's wages",
  "Payslips!Feb M49 wages paid date",
  "Payslips!Mar M49 wages paid date",
];

describe("Ltd payroll date checks on a year end nineteen months from the scenario's own period", () => {
  it("pass when checkCompliance shifts its date expectations the same way cellWrites shifts the cells", () => {
    const { merged, results } = ltdPayrollResultsAtYearEnd20271031();
    const checks = ltd.checkCompliance(results, merged, null, calculateExpectedTax, "2027-10-31");
    for (const name of LTD_PAYROLL_DATE_CHECK_NAMES) {
      const check = checks.find((c) => c.name === name);
      expect(check, `expected a check named "${name}"`).toBeDefined();
      expect(check.pass, `${name}: expected ${check.expected}, got ${check.actual}`).toBe(true);
    }
  });

  it("still fails a schedule date the writer did not actually produce", () => {
    const { merged, results } = ltdPayrollResultsAtYearEnd20271031();
    const marchCell = payslipsWagesPaidCell(4);
    results["Payslips.xlsx!Mar"][marchCell] += 365;
    const checks = ltd.checkCompliance(results, merged, null, calculateExpectedTax, "2027-10-31");
    const mar = checks.find((c) => c.name === "Payslips!Mar M49 wages paid date");
    expect(mar).toBeDefined();
    expect(mar.pass).toBe(false);
  });
});

// A June year end's month tabs run Jul through Jun, so the reference and
// wages-paid-date checks land on Oct/Nov (fiscalTabs' positions 3/4 from a
// July opening) rather than the March-year-end Jul/Aug. The payroll-by-tab
// shift these checks read comes off the book's own Admin!F21 (LT-T28), not
// off a packageYearEnd a caller may omit or get wrong, so they pass here
// with no packageYearEnd argument at all -- payslips-calendar-year-end.test.js's
// June-year-end package never carries one.
function ltdPayrollResultsAtJuneYearEnd() {
  const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "precision-code-ltd", "full"));
  const taxData = taxDataFor("ltd-2026");
  const scenario = diyaGlToScenario(book, lines, "ltd");
  const merged = { ...scenario, ...scenario.expected };
  const baseResults = calculateFromDiyaGl(book, lines, "ltd", taxData, scenario);

  const targetStartYear = 2025;
  const yearEndMonth = 6;
  const writes = ltd.cellWrites(merged, targetStartYear, yearEndMonth);
  const payslips = writes["Payslips.xlsx"] || {};

  const results = {
    ...baseResults,
    Admin: {
      ...baseResults.Admin,
      B9: toExcelSerial(targetStartYear, yearEndMonth + 1, 1),
      F21: toExcelSerial(targetStartYear + 1, yearEndMonth + 1, 1) - 1,
    },
  };
  for (const [tab, cells] of Object.entries(payslips)) {
    results[`Payslips.xlsx!${tab}`] = { ...results[`Payslips.xlsx!${tab}`], ...cells };
  }
  return { merged, results };
}

const LTD_JUNE_YEAR_END_PAYROLL_CHECK_NAMES = [
  "Payslips!Oct S51 reference",
  "Payslips!Oct S52 reference",
  "Payslips!Oct S53 reference",
  "Payslips!Oct M49 wages paid date",
  "Payslips!Nov S51 reference",
  "Payslips!Nov S52 reference",
  "Payslips!Nov S53 reference",
];

describe("Ltd payroll reference and date checks on a June year end, without a packageYearEnd argument", () => {
  it("pass when checkCompliance derives the payroll shift off the book's own Admin!F21", () => {
    const { merged, results } = ltdPayrollResultsAtJuneYearEnd();
    const checks = ltd.checkCompliance(results, merged, null, calculateExpectedTax);
    for (const name of LTD_JUNE_YEAR_END_PAYROLL_CHECK_NAMES) {
      const check = checks.find((c) => c.name === name);
      expect(check, `expected a check named "${name}"`).toBeDefined();
      expect(check.pass, `${name}: expected ${check.expected}, got ${check.actual}`).toBe(true);
    }
  });

  it("still fails a reference the writer did not actually produce", () => {
    const { merged, results } = ltdPayrollResultsAtJuneYearEnd();
    results["Payslips.xlsx!Oct"].S51 = "PAY-EMP001-2025-04";
    const checks = ltd.checkCompliance(results, merged, null, calculateExpectedTax);
    const oct = checks.find((c) => c.name === "Payslips!Oct S51 reference");
    expect(oct).toBeDefined();
    expect(oct.pass).toBe(false);
  });
});

// periodShiftMonths counts years as well as months, so a package year end
// that falls before the scenario's own period start (here 2025-05-31 against
// the "full" fixture's 2025-04-01) returns a negative offset -- report.js
// --data hits this whenever --year-end is given without a matching --offset.
// The payroll block used to index SHORT_MONTHS with that negative offset
// straight off a single JS "%", which stays negative and reads past the
// array's start.
describe("Ltd checkCompliance on a package year end before the scenario's own period", () => {
  it("does not throw when the payroll month wrap goes negative", () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "precision-code-ltd", "full"));
    const taxData = taxDataFor("ltd-2025");
    const scenario = diyaGlToScenario(book, lines, "ltd");
    const merged = { ...scenario, ...scenario.expected };
    const results = calculateFromDiyaGl(book, lines, "ltd", taxData, scenario);
    expect(() => ltd.checkCompliance({ ...results }, merged, taxData, calculateExpectedTax, "2025-05-31")).not.toThrow();
  });
});
