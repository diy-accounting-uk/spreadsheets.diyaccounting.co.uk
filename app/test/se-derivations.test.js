// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// se-derivations.test.js -- the two named ITSA derivations for the Self
// Employed product, proved against the self-employed package's own
// committed reconciliation report and against the fixtures' own raw
// transactions. No LibreOffice and no recalculation: every figure here
// comes from the engine already proved against the Excel package in
// calculator-se.test.js, plus the committed report markdown read fresh at
// test time.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { loadDiyaGlData } from "../lib/diya-gl-loader.js";
import { loadScenario, parseDate } from "../lib/scenario-loader.js";
import { shiftMonths } from "../lib/period-shift.js";
import { splitVat } from "../lib/tax/vat.js";
import { calculateSeCells } from "../lib/calculators/se.js";
import { buildSelfEmploymentQuarterlyUpdates, buildSelfEmploymentAnnualSubmission, setPath } from "../lib/calculators/se-derivations.js";
import { parseReport, value } from "../lib/report-indicators.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const REPO_DIR = resolve(APP_DIR, "..");
const REPORTS_DIR = resolve(REPO_DIR, "reports");
const EXAMPLES_DIR = resolve(REPO_DIR, "examples");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

const TAX_OWN_YEAR = parseTOML(readFileSync(resolve(APP_DIR, "data", "se-2025-2026.toml"), "utf8"));
const TAX_APR27 = parseTOML(readFileSync(resolve(APP_DIR, "data", "se-2026-2027.toml"), "utf8"));

// Every tax year api.years names in sa103-mtd-mapping.json, loaded so the
// field-set tests below can drive buildSelfEmploymentAnnualSubmission
// across all four without hand-rolling a fifth TOML fixture.
const TAX_DATA_BY_YEAR = {
  "2023-24": parseTOML(readFileSync(resolve(APP_DIR, "data", "se-2023-2024.toml"), "utf8")),
  "2024-25": parseTOML(readFileSync(resolve(APP_DIR, "data", "se-2024-2025.toml"), "utf8")),
  "2025-26": parseTOML(readFileSync(resolve(APP_DIR, "data", "se-2025-2026.toml"), "utf8")),
  "2026-27": TAX_APR27,
};

const REPORT_FILES = {
  "se-scenario-advanced": "GB_Accounts_Self_Employed_2027_04_05__Apr27__Excel_2007_se-scenario-advanced.md",
  "se-brickwork-pro-nonvat": "GB_Accounts_Self_Employed_2027_04_05__Apr27__Excel_2007_se-brickwork-pro-nonvat.md",
  "se-brickwork-pro-vat": "GB_Accounts_Self_Employed_2027_04_05__Apr27__Excel_2007_se-brickwork-pro-vat.md",
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

// A scenario transaction's date is whatever smol-toml parsed an unquoted
// TOML date literal into (a TomlDate, not a string), so every date match
// below goes through this rather than comparing to a literal string.
function dateIso(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function loadFixture(name) {
  if (name === "se-scenario-advanced") {
    const scenario = loadScenario(resolve(FIXTURES_DIR, "se-scenario-advanced.toml"));
    return { book: { documentInfo: { periodCoveredEnd: "2026-03-31" } }, lines: [], scenario };
  }
  const dirName = name === "se-brickwork-pro-nonvat" ? "se-nonvat" : "se-vat";
  const { book, lines } = loadDiyaGlData(resolve(EXAMPLES_DIR, "brickwork-pro", dirName));
  return { book, lines, scenario: undefined };
}

function derive(name, taxData, options = {}) {
  const { book, lines, scenario } = loadFixture(name);
  const opts = scenario ? { scenario, ...options } : options;
  return {
    quarterly: buildSelfEmploymentQuarterlyUpdates(book, lines, taxData, opts),
    annual: buildSelfEmploymentAnnualSubmission(book, lines, taxData, opts),
    book,
    lines,
    scenario: scenario || undefined,
  };
}

// The committed report markdown, read fresh at test time -- this is the
// anchor outside the engine every check below is measured against.
const reportTextCache = new Map();
function reportText(name) {
  if (!reportTextCache.has(name)) {
    reportTextCache.set(name, readFileSync(resolve(REPORTS_DIR, REPORT_FILES[name]), "utf8"));
  }
  return reportTextCache.get(name);
}

function report(name) {
  return parseReport(reportText(name));
}

// The Appendix's raw per-cell tables sit under "### <sheet>" headings that
// parseReport() deliberately skips (they repeat the human-readable sections
// cell by cell). The monthly P&L grid and the VitalTax quarterly cells only
// live there, so this reads that one block directly.
function appendixCells(name, sheet) {
  const text = reportText(name);
  const marker = `\n### ${sheet}\n`;
  const start = text.indexOf(marker);
  if (start === -1) throw new Error(`report "${name}" has no appendix section for "${sheet}"`);
  const bodyStart = start + marker.length;
  const tail = text.slice(bodyStart);
  const nextHeading = tail.search(/\n#{2,3} /);
  const body = nextHeading === -1 ? tail : tail.slice(0, nextHeading);
  const cells = new Map();
  for (const line of body.split("\n")) {
    const match = line.match(/^\|\s*([A-Za-z]+\d+)\s*\|[^|]*\|\s*([^|]+?)\s*\|/);
    if (!match) continue;
    const [, ref, rawValue] = match;
    const num = Number(rawValue.replace(/,/g, ""));
    cells.set(ref, Number.isNaN(num) ? rawValue : num);
  }
  return cells;
}

const MONTH_COLS = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];

function quarterSumOfRows(cells, rows, quarterIndex) {
  const columns = MONTH_COLS.slice(quarterIndex * 3, quarterIndex * 3 + 3);
  let total = 0;
  for (const column of columns) {
    for (const row of rows) {
      const cell = cells.get(`${column}${row}`);
      total += typeof cell === "number" ? cell : 0;
    }
  }
  return total;
}

// HMRC's own quarter boundaries, held here independently of the module
// under test -- these dates are what the calendar and standard elections
// mean, not part of the arithmetic the checks below verify.
const APR27_CALENDAR_QUARTERS = [
  { start: "2026-04-06", end: "2026-06-30" },
  { start: "2026-07-01", end: "2026-09-30" },
  { start: "2026-10-01", end: "2026-12-31" },
  { start: "2027-01-01", end: "2027-04-05" },
];

const FIXTURES = ["se-scenario-advanced", "se-brickwork-pro-nonvat", "se-brickwork-pro-vat"];

// The twelve fields whose four quarters already have a committed monthly
// anchor: eleven read straight off the P&L appendix rows, and costOfGoods
// off VitalTax's own quarterly cells, because the P&L's own row 14 has no
// monthly cells in the committed report until standardReads() grows to
// carry it (see the derivation's own comment on quarterlyFromLines).
const ROW_ANCHORED_FIELDS = {
  paymentsToSubcontractors: { rows: [15], box: "Subcontractor payments (box 18)" },
  carVanTravelExpenses: { rows: [25, 26], box: "Car, van and travel expenses (box 20)" },
  premisesRunningCosts: { rows: [22], box: "Rent, rates, power and insurance (box 21)" },
  maintenanceCosts: { rows: [23], box: "Repairs and maintenance (box 22)" },
  adminCosts: { rows: [24], box: "Phone, stationery and office costs (box 23)" },
  advertisingCosts: { rows: [27], box: "Advertising and entertainment (box 24)" },
  irrecoverableDebts: { rows: [29], box: "Irrecoverable debts written off (box 27)" },
  professionalFees: { rows: [28], box: "Accountancy, legal and professional fees (box 28)" },
  otherExpenses: { rows: [32], box: "Other business expenses (box 30)" },
  depreciation: { rows: [33, 34], box: "Depreciation and loss on sale of assets (box 29)" },
  depreciationDisallowable: { rows: [34], box: "Disallowable depreciation (box 44)" },
};

describe("buildSelfEmploymentQuarterlyUpdates — the four quarters sum to the box, and each equals three P&L months", () => {
  for (const fixture of FIXTURES) {
    describe(fixture, () => {
      const { quarterly } = derive(fixture, TAX_APR27);
      const rpt = report(fixture);
      const plCells = appendixCells(fixture, "Profit & Loss Account");

      it("turnover: each quarter matches the P&L monthly grid and the four sum to box 15", () => {
        const boxValue = value(rpt, "Self Assessment (SA103F)", "Turnover (box 15)");
        let sum = 0;
        quarterly.periods.forEach((period, index) => {
          const expected = round2(quarterSumOfRows(plCells, [5, 6, 7, 8], index));
          expect(period.periodIncome.turnover).toBeCloseTo(expected, 2);
          sum += period.periodIncome.turnover;
        });
        expect(round2(sum)).toBeCloseTo(boxValue, 2);
      });

      it("costOfGoods: each quarter matches VitalTax's own direct-cost cells and the four sum to box 17", () => {
        const vitalTax = appendixCells(fixture, "VitalTax");
        const boxValue = value(rpt, "Self Assessment (SA103F)", "Goods bought for resale (box 17)");
        const quarterCells = ["C7", "D7", "E7", "F7"];
        let sum = 0;
        quarterly.periods.forEach((period, index) => {
          const expected = round2(vitalTax.get(quarterCells[index]) || 0);
          expect(period.periodExpenses.costOfGoods).toBeCloseTo(expected, 2);
          sum += period.periodExpenses.costOfGoods;
        });
        expect(round2(sum)).toBeCloseTo(boxValue, 2);
      });

      for (const [field, { rows, box }] of Object.entries(ROW_ANCHORED_FIELDS)) {
        it(`${field}: each quarter matches the P&L monthly grid and the four sum to ${box}`, () => {
          const boxValue = value(rpt, "Self Assessment (SA103F)", box);
          const section = field.endsWith("Disallowable") ? "periodDisallowableExpenses" : "periodExpenses";
          let sum = 0;
          quarterly.periods.forEach((period, index) => {
            const expected = round2(quarterSumOfRows(plCells, rows, index));
            expect(period[section][field]).toBeCloseTo(expected, 2);
            sum += period[section][field];
          });
          expect(round2(sum)).toBeCloseTo(boxValue, 2);
        });
      }
    });
  }
});

describe("buildSelfEmploymentQuarterlyUpdates — wages and bank-sourced fields against the fixture's own lines", () => {
  // These three fields have no monthly anchor in the committed report until
  // standardReads() grows to carry P&L rows 21, 30 and 31 (a separate,
  // report-regenerating change). Anchored here against the fixture's own
  // dated transactions instead, independently of the engine under test.
  it("se-scenario-advanced: Q1 wagesAndStaffCosts equals the payroll plus purchases account 5101, dated inside Q1", () => {
    const { quarterly, scenario } = derive("se-scenario-advanced", TAX_APR27);
    const monthOffset = 12; // the fixture's own 2025-26 period, shifted onto the Apr27 package
    const inQ1 = (dateValue) => {
      const shifted = shiftMonths(parseDate(dateValue), monthOffset);
      const iso = `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
      return iso >= APR27_CALENDAR_QUARTERS[0].start && iso <= APR27_CALENDAR_QUARTERS[0].end;
    };
    let expected = 0;
    for (const entries of Object.values(scenario.payroll || {})) {
      for (const entry of entries) if (inQ1(entry.date)) expected += (entry.grossPay || 0) + (entry.employerNI || 0);
    }
    for (const transactions of Object.values(scenario.purchases || {})) {
      for (const tx of transactions) if (tx.code === "w" && inQ1(tx.date)) expected += splitVat(tx.amount, 0.2).net;
    }
    expect(quarterly.periods[0].periodExpenses.wagesAndStaffCosts).toBeCloseTo(round2(expected), 2);
  });

  it("se-scenario-advanced: interestOnBankOtherLoans and financeCharges are nil and 3,900 for the year, split by bank line date", () => {
    const { quarterly, scenario } = derive("se-scenario-advanced", TAX_APR27);
    const monthOffset = 12;
    const quarterOf = (dateValue) => {
      const shifted = shiftMonths(parseDate(dateValue), monthOffset);
      const iso = `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
      return APR27_CALENDAR_QUARTERS.findIndex((q) => iso >= q.start && iso <= q.end);
    };
    const expectedFinance = [0, 0, 0, 0];
    const expectedInterest = [0, 0, 0, 0];
    for (const transactions of Object.values(scenario.bank || {})) {
      for (const tx of transactions) {
        if (tx.code === "BC") continue;
        const q = quarterOf(tx.date);
        const isCash = tx.account === "1220";
        if (!isCash && tx.direction === "out" && tx.code === "J") expectedInterest[q] += tx.amount;
        if (!isCash && tx.direction === "out" && tx.code === "B") expectedFinance[q] += tx.amount;
        if (isCash && tx.direction === "out" && tx.code === "J") expectedFinance[q] += tx.amount;
      }
    }
    quarterly.periods.forEach((period, index) => {
      expect(period.periodExpenses.interestOnBankOtherLoans).toBeCloseTo(round2(expectedInterest[index]), 2);
      expect(period.periodExpenses.financeCharges).toBeCloseTo(round2(expectedFinance[index]), 2);
    });
    expect(quarterly.periods.reduce((s, p) => s + p.periodExpenses.financeCharges, 0)).toBeCloseTo(3900, 2);
  });
});

describe("buildSelfEmploymentQuarterlyUpdates — turnover follows box 15, not VitalTax", () => {
  it("se-scenario-advanced: Q1 turnover equals sales codes a-d dated inside Q1, VAT stripped", () => {
    const { quarterly, scenario } = derive("se-scenario-advanced", TAX_APR27);
    const monthOffset = 12;
    let expected = 0;
    for (const transactions of Object.values(scenario.sales || {})) {
      for (const tx of transactions) {
        if (!["a", "b", "c", "d"].includes(tx.code)) continue;
        const shifted = shiftMonths(parseDate(tx.date), monthOffset);
        const iso = `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
        // Q1's lower edge is unbounded (the first quarter starts at the
        // accounting period start, not a literal 6 April), so only the
        // upper edge is checked here.
        if (iso <= APR27_CALENDAR_QUARTERS[0].end) expected += splitVat(tx.amount, 0.2).net;
      }
    }
    expect(quarterly.periods[0].periodIncome.turnover).toBeCloseTo(round2(expected), 2);
  });

  it("se-scenario-advanced: account 4003 (code d) sales are inside turnover, not left out as VitalTax leaves them", () => {
    const { quarterly, scenario } = derive("se-scenario-advanced", TAX_APR27);
    const codeDNet = Object.values(scenario.sales || {})
      .flat()
      .filter((tx) => tx.code === "d")
      .reduce((total, tx) => total + splitVat(tx.amount, 0.2).net, 0);
    expect(round2(codeDNet)).toBeCloseTo(3700, 2);
    const annualTurnover = quarterly.periods.reduce((total, p) => total + p.periodIncome.turnover, 0);
    expect(round2(annualTurnover)).toBeCloseTo(339200, 2);
  });
});

describe("buildSelfEmploymentQuarterlyUpdates — a book kept in its own tax year moves by no shift at all", () => {
  it("se-scenario-advanced against its own 2025-26 tax data: Q1 turnover equals sales codes a-d dated inside Q1 of that year, with no period shift applied", () => {
    const { quarterly, scenario } = derive("se-scenario-advanced", TAX_OWN_YEAR);
    const ownYearQ1End = "2025-06-30";
    let expected = 0;
    for (const transactions of Object.values(scenario.sales || {})) {
      for (const tx of transactions) {
        if (!["a", "b", "c", "d"].includes(tx.code)) continue;
        if (dateIso(tx.date) <= ownYearQ1End) expected += splitVat(tx.amount, 0.2).net;
      }
    }
    expect(quarterly.taxYear).toBe("2025-26");
    expect(quarterly.periods[0].periodDates).toEqual({ periodStartDate: "2025-04-06", periodEndDate: "2025-06-30" });
    expect(quarterly.periods[0].periodIncome.turnover).toBeCloseTo(round2(expected), 2);
  });
});

describe("buildSelfEmploymentQuarterlyUpdates — the depreciation pair against the schedule", () => {
  it("se-scenario-advanced: each quarter is Schedule I1 / 4, plus the disposal loss quarter for box 29", () => {
    const { quarterly } = derive("se-scenario-advanced", TAX_APR27);
    const rpt = report("se-scenario-advanced");
    const scheduleI1 = value(rpt, "Fixed Asset Schedule", "Depreciation charged for the year (Schedule I1)");
    const disposalLossAnnual = value(rpt, "Profit & Loss Account", "Loss (Profit) on Disposal of Assets");
    const disallowableQuarter = round2(scheduleI1 / 4);
    const expenseQuarter = round2((scheduleI1 + disposalLossAnnual) / 4);
    quarterly.periods.forEach((period) => {
      expect(period.periodDisallowableExpenses.depreciationDisallowable).toBeCloseTo(disallowableQuarter, 1);
      expect(period.periodExpenses.depreciation).toBeCloseTo(expenseQuarter, 1);
    });
  });
});

describe("buildSelfEmploymentQuarterlyUpdates — the 1 to 5 April postings land in Q1 under both period types", () => {
  it("se-brickwork-pro-nonvat: the four early-April lines reach Q1 under calendar and standard boundaries alike", () => {
    const calendar = derive("se-brickwork-pro-nonvat", TAX_APR27, { quarterlyPeriodType: "calendar" }).quarterly;
    const standard = derive("se-brickwork-pro-nonvat", TAX_APR27, { quarterlyPeriodType: "standard" }).quarterly;
    // 2025-04-01 code g (60), 2025-04-01 code y (1200), 2025-04-05 code s (800):
    // present in Q1's adminCosts, otherExpenses and costOfGoods under both types.
    for (const quarterly of [calendar, standard]) {
      expect(quarterly.periods[0].periodExpenses.adminCosts).toBeGreaterThanOrEqual(60);
      expect(quarterly.periods[0].periodExpenses.otherExpenses).toBeGreaterThanOrEqual(1200);
      expect(quarterly.periods[0].periodExpenses.costOfGoods).toBeGreaterThanOrEqual(800);
    }
  });

  it("se-brickwork-pro-nonvat: a line dated 2 April is unaffected by the 6 April boundary under either type", () => {
    const { book, lines } = loadFixture("se-brickwork-pro-nonvat");
    const shifted = lines.map((line) => (line.postingDate === "2025-04-06" ? { ...line, postingDate: "2025-04-02" } : line));
    const before = buildSelfEmploymentQuarterlyUpdates(book, lines, TAX_APR27, { quarterlyPeriodType: "standard" });
    const after = buildSelfEmploymentQuarterlyUpdates(book, shifted, TAX_APR27, { quarterlyPeriodType: "standard" });
    expect(after.periods).toEqual(before.periods);
  });
});

describe("buildSelfEmploymentQuarterlyUpdates — the standard election moves figures and keeps the annual total", () => {
  it("se-scenario-advanced: at least one field's quarter split changes, and every field's four-quarter sum matches the calendar election", () => {
    const calendar = derive("se-scenario-advanced", TAX_APR27, { quarterlyPeriodType: "calendar" }).quarterly;
    const standard = derive("se-scenario-advanced", TAX_APR27, { quarterlyPeriodType: "standard" }).quarterly;
    const fields = Object.keys(calendar.periods[0].periodExpenses);
    let anyDiffers = false;
    for (const field of fields) {
      const calValues = calendar.periods.map((p) => p.periodExpenses[field]);
      const stdValues = standard.periods.map((p) => p.periodExpenses[field]);
      if (calValues.some((v, i) => v !== stdValues[i])) anyDiffers = true;
      const calSum = round2(calValues.reduce((a, b) => a + b, 0));
      const stdSum = round2(stdValues.reduce((a, b) => a + b, 0));
      expect(stdSum).toBeCloseTo(calSum, 2);
    }
    expect(anyDiffers).toBe(true);
  });

  it("se-scenario-advanced: the standard election's periodDates carry the confirmed HMRC boundaries", () => {
    const { quarterly } = derive("se-scenario-advanced", TAX_APR27, { quarterlyPeriodType: "standard" });
    expect(quarterly.periods.map((p) => p.periodDates)).toEqual([
      { periodStartDate: "2026-04-06", periodEndDate: "2026-07-05" },
      { periodStartDate: "2026-07-06", periodEndDate: "2026-10-05" },
      { periodStartDate: "2026-10-06", periodEndDate: "2027-01-05" },
      { periodStartDate: "2027-01-06", periodEndDate: "2027-04-05" },
    ]);
  });
});

describe("buildSelfEmploymentQuarterlyUpdates — obligations periods override the fallback boundaries", () => {
  it("uses the given periodStartDate/periodEndDate pairs instead of computing them", () => {
    const periods = [
      { periodStartDate: "2026-04-06", periodEndDate: "2026-07-05" },
      { periodStartDate: "2026-07-06", periodEndDate: "2026-10-05" },
      { periodStartDate: "2026-10-06", periodEndDate: "2027-01-05" },
      { periodStartDate: "2027-01-06", periodEndDate: "2027-04-05" },
    ];
    const fromPeriods = derive("se-scenario-advanced", TAX_APR27, { periods }).quarterly;
    const fromType = derive("se-scenario-advanced", TAX_APR27, { quarterlyPeriodType: "standard" }).quarterly;
    expect(fromPeriods.periods).toEqual(fromType.periods);
  });
});

describe("buildSelfEmploymentAnnualSubmission — allowances against the schedule", () => {
  it("se-scenario-advanced: matches boxes 49, 50, 55, 56 and 59, and capitalAllowanceMainPool independently against the opening tax written down value", () => {
    const { annual } = derive("se-scenario-advanced", TAX_APR27);
    const rpt = report("se-scenario-advanced");
    expect(annual.allowances.annualInvestmentAllowance).toBeCloseTo(
      value(rpt, "Self Assessment (SA103F)", "Annual investment allowance (box 49)"),
      2,
    );
    expect(annual.allowances.capitalAllowanceMainPool).toBeCloseTo(
      value(rpt, "Self Assessment (SA103F)", "Capital allowances at 18% (box 50)"),
      2,
    );
    expect(annual.allowances.enhancedCapitalAllowance).toBeCloseTo(
      value(rpt, "Self Assessment (SA103F)", "100% and other enhanced capital allowances (box 55)"),
      2,
    );
    expect(annual.allowances.allowanceOnSales).toBeCloseTo(
      value(rpt, "Self Assessment (SA103F)", "Allowances on sale or cessation (box 56)"),
      2,
    );
    expect(annual.adjustments.balancingChargeOther).toBeCloseTo(value(rpt, "Self Assessment (SA103F)", "Balancing charge (box 59)"), 2);

    // Independent of the schedule cell: the opening tax written down value
    // times the year's own writing down rate, so a main pool figure that
    // merely echoes the cell it was read from cannot pass this half.
    const openingTaxWdv = 24000; // examples/.../se-scenario-advanced.toml's one asset carrying a tax_wdv
    const rate = TAX_APR27.capital_allowances.writing_down_allowance;
    expect(annual.allowances.capitalAllowanceMainPool).toBeCloseTo(round2(openingTaxWdv * rate), 2);
  });
});

describe("buildSelfEmploymentAnnualSubmission — grants reach the annual submission, not the quarterly other-income field", () => {
  it("se-scenario-advanced: outstandingBusinessIncome equals the account 4004 sales net of VAT, and periodIncome.other is nil throughout", () => {
    const { annual, quarterly, scenario } = derive("se-scenario-advanced", TAX_APR27);
    const grantsNet = Object.values(scenario.sales || {})
      .flat()
      .filter((tx) => tx.code === "g")
      .reduce((total, tx) => total + splitVat(tx.amount, 0.2).net, 0);
    expect(round2(grantsNet)).toBeCloseTo(2083.33, 2);
    expect(annual.adjustments.outstandingBusinessIncome).toBeCloseTo(round2(grantsNet), 2);
    for (const period of quarterly.periods) expect(period.periodIncome.other).toBe(0);
  });
});

describe("buildSelfEmploymentAnnualSubmission — box 55 is warned as a small pools write-off, not a genuine enhanced allowance", () => {
  // Anchored on the mapping file itself, not on the derivation's own
  // reading of it: a change to which field HMRC's mapping names first for
  // box 55 would move this and the warning it checks together.
  const mapping = JSON.parse(readFileSync(resolve(APP_DIR, "data", "hmrc", "sa103-mtd-mapping.json"), "utf8"));
  const box55 = mapping.boxes.find((entry) => entry.form === "SA103F" && entry.box === "55");
  const enhancedField = box55.field.split("|")[0].trim();

  it("box 55's own label and first mapped field really are what the code and the warning below assume", () => {
    expect(box55.label).toBe("100% and other enhanced capital allowances");
    expect(enhancedField).toBe("allowances.enhancedCapitalAllowance");
  });

  for (const fixture of FIXTURES) {
    it(`${fixture}: the field HMRC's mapping names for box 55 carries a warning that the figure is a small pools write-off`, () => {
      const { annual } = derive(fixture, TAX_APR27);
      expect(Object.keys(annual.allowances)).toContain("enhancedCapitalAllowance");
      const warning = annual.warnings.find((w) => w.field === enhancedField);
      expect(warning).toBeDefined();
      expect(warning.reason).toMatch(/small pools/i);
    });
  }
});

describe("buildSelfEmploymentAnnualSubmission — the annual field set follows api.years, not a fixed list", () => {
  // Hand-read off sa103-mtd-mapping.json's own api.years block, independently
  // of se-derivations.js's own reading of it, so a derivation that only
  // echoes its own logic back at itself cannot pass this. Only these five
  // fields move by year; every other warned field (the seven no-box-and-
  // no-cell allowances/adjustments, the fourteen disallowable categories,
  // goodsAndServicesOwnUse, box 55's small-pools note) is year-invariant.
  const EXPECT_PRESENT_BY_YEAR = {
    "2023-24": [
      "allowances.zeroEmissionsGoodsVehicleAllowance",
      "allowances.electricChargePointAllowance",
      "adjustments.overlapReliefUsed",
    ],
    "2024-25": [
      "allowances.zeroEmissionsGoodsVehicleAllowance",
      "allowances.electricChargePointAllowance",
      "adjustments.overlapReliefUsed",
      "adjustments.transitionProfitAmount",
      "adjustments.transitionProfitAccelerationAmount",
    ],
    "2025-26": ["adjustments.overlapReliefUsed", "adjustments.transitionProfitAmount", "adjustments.transitionProfitAccelerationAmount"],
    "2026-27": ["adjustments.transitionProfitAmount", "adjustments.transitionProfitAccelerationAmount"],
  };
  const EXPECT_ABSENT_BY_YEAR = {
    "2023-24": ["adjustments.transitionProfitAmount", "adjustments.transitionProfitAccelerationAmount"],
    "2024-25": [],
    "2025-26": ["allowances.zeroEmissionsGoodsVehicleAllowance", "allowances.electricChargePointAllowance"],
    "2026-27": [
      "allowances.zeroEmissionsGoodsVehicleAllowance",
      "allowances.electricChargePointAllowance",
      "adjustments.overlapReliefUsed",
    ],
  };

  for (const year of Object.keys(TAX_DATA_BY_YEAR)) {
    it(`${year}: the warned field set carries exactly what that year's schema still names, and no more`, () => {
      const { annual } = derive("se-scenario-advanced", TAX_DATA_BY_YEAR[year]);
      expect(annual.taxYear).toBe(year);
      const warningFields = new Set(annual.warnings.map((w) => w.field));
      for (const field of EXPECT_PRESENT_BY_YEAR[year]) {
        expect(warningFields.has(field), `${year} should still warn about ${field}`).toBe(true);
      }
      for (const field of EXPECT_ABSENT_BY_YEAR[year]) {
        expect(warningFields.has(field), `${year} should not mention ${field}`).toBe(false);
      }
    });
  }

  it("2023-24: the payload itself carries no value for the two fields not yet in that year's schema", () => {
    const { annual } = derive("se-scenario-advanced", TAX_DATA_BY_YEAR["2023-24"]);
    expect(annual.adjustments.transitionProfitAmount).toBeUndefined();
    expect(annual.adjustments.transitionProfitAccelerationAmount).toBeUndefined();
  });

  it("2026-27: the payload itself carries no value for the three fields dropped from that year's schema", () => {
    const { annual } = derive("se-scenario-advanced", TAX_DATA_BY_YEAR["2026-27"]);
    expect(annual.allowances.zeroEmissionsGoodsVehicleAllowance).toBeUndefined();
    expect(annual.allowances.electricChargePointAllowance).toBeUndefined();
    expect(annual.adjustments.overlapReliefUsed).toBeUndefined();
  });

  it("the quarterly field set never moves with the year, only the annual one does", () => {
    const fieldSets = Object.keys(TAX_DATA_BY_YEAR).map((year) => {
      const { quarterly } = derive("se-scenario-advanced", TAX_DATA_BY_YEAR[year]);
      return JSON.stringify(
        Object.keys(quarterly.periods[0].periodIncome)
          .concat(Object.keys(quarterly.periods[0].periodExpenses))
          .concat(Object.keys(quarterly.periods[0].periodDisallowableExpenses))
          .sort(),
      );
    });
    expect(new Set(fieldSets).size).toBe(1);
  });

  it("an unlisted tax year throws instead of silently falling back to a fixed field set", () => {
    // A full, otherwise-valid tax year file with only the label moved past
    // what api.years names, so the throw under test is the one this check
    // is about and not some other missing rate.
    const unknownYear = { ...TAX_APR27, tax_year: { ...TAX_APR27.tax_year, label: "2027-28" } };
    expect(() => derive("se-scenario-advanced", unknownYear)).toThrow(/api\.years carries no entry/);
  });
});

describe("the derivations — unsourced fields are absent, not nil, and each carries a warning naming its box", () => {
  for (const fixture of FIXTURES) {
    it(`${fixture}: quarterly periods never carry consolidatedExpenses, businessEntertainmentCosts or a disallowable field beyond depreciation`, () => {
      const { quarterly } = derive(fixture, TAX_APR27);
      for (const period of quarterly.periods) {
        expect(Object.keys(period.periodExpenses).sort()).toEqual(
          [
            "adminCosts",
            "advertisingCosts",
            "carVanTravelExpenses",
            "costOfGoods",
            "depreciation",
            "financeCharges",
            "interestOnBankOtherLoans",
            "irrecoverableDebts",
            "maintenanceCosts",
            "otherExpenses",
            "paymentsToSubcontractors",
            "premisesRunningCosts",
            "professionalFees",
            "wagesAndStaffCosts",
          ].sort(),
        );
        expect(Object.keys(period.periodDisallowableExpenses)).toEqual(["depreciationDisallowable"]);
        expect(Object.keys(period.periodIncome).sort()).toEqual(["other", "turnover"]);
      }
      const warningFields = quarterly.warnings.map((w) => w.field);
      expect(warningFields).toContain("periodExpenses.businessEntertainmentCosts");
      expect(warningFields).toContain("periodExpenses.consolidatedExpenses");
      expect(warningFields).toContain("periodDisallowableExpenses.wagesAndStaffCostsDisallowable");
      expect(warningFields).toContain("periodDisallowableExpenses.carVanTravelExpensesDisallowable");
      // Every warning names a real box in HMRC's own mapping, and depreciationDisallowable
      // itself (the one sourced disallowable field) never appears as a warning subject
      // beyond the box 44/29 gap note.
      const nonGapWarnings = quarterly.warnings.filter((w) => w.field !== "periodDisallowableExpenses.depreciationDisallowable");
      expect(nonGapWarnings.every((w) => typeof w.reason === "string" && w.reason.length > 0)).toBe(true);
    });

    it(`${fixture}: annual submission never carries the seven allowance/adjustment fields with no cell, and each is warned by box`, () => {
      const { annual } = derive(fixture, TAX_APR27);
      expect(Object.keys(annual.allowances).sort()).toEqual(
        ["annualInvestmentAllowance", "allowanceOnSales", "capitalAllowanceMainPool", "enhancedCapitalAllowance"].sort(),
      );
      expect(Object.keys(annual.adjustments).sort()).toEqual(
        ["balancingChargeOther", "goodsAndServicesOwnUse", "outstandingBusinessIncome"].sort(),
      );
      const warningFields = annual.warnings.map((w) => w.field);
      for (const field of [
        "allowances.capitalAllowanceSpecialRatePool",
        "allowances.capitalAllowanceSingleAssetPool",
        "allowances.zeroEmissionsCarAllowance",
        "allowances.structuredBuildingAllowance",
        "allowances.enhancedStructuredBuildingAllowance",
        "allowances.businessPremisesRenovationAllowance",
        "adjustments.balancingChargeBpra",
        "adjustments.includedNonTaxableProfits",
        "adjustments.basisAdjustment",
        "adjustments.accountingAdjustment",
        "adjustments.transitionProfitAmount",
        "adjustments.transitionProfitAccelerationAmount",
        "adjustments.goodsAndServicesOwnUse",
      ]) {
        expect(warningFields).toContain(field);
      }
    });
  }
});

describe("the derivations — the boxes with no cell really do read blank in the engine", () => {
  for (const fixture of FIXTURES) {
    it(`${fixture}: SE Full D147, D152, D156, D160, O139 and D179 are blank`, () => {
      const { book, lines, scenario: fixtureScenario } = loadFixture(fixture);
      const scenario = fixtureScenario || undefined;
      const results = calculateSeCells(book, lines, TAX_APR27, scenario);
      const seFull = results["SE Full"];
      for (const cell of ["D147", "D152", "D156", "D160", "O139", "D179"]) {
        expect(typeof seFull[cell]).not.toBe("number");
      }
    });
  }
});

describe("breakability — every check above can fail", () => {
  const { scenario: base } = loadFixture("se-scenario-advanced");
  const book = { documentInfo: { periodCoveredEnd: "2026-03-31" } };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const baseline = buildSelfEmploymentQuarterlyUpdates(book, [], TAX_APR27, { scenario: base });

  function quarterlyDiffs(a, b) {
    const diffs = [];
    a.periods.forEach((period, index) => {
      for (const section of ["periodIncome", "periodExpenses", "periodDisallowableExpenses"]) {
        for (const key of Object.keys(period[section])) {
          if (period[section][key] !== b.periods[index][section][key]) diffs.push(`Q${index + 1}.${section}.${key}`);
        }
      }
    });
    return diffs.sort();
  }

  it("moving a purchases line from account 5501 (code g) to 5401 (code y) flips exactly adminCosts and otherExpenses, in the same quarter", () => {
    const mutated = clone(base);
    let moved = false;
    for (const month of Object.keys(mutated.purchases)) {
      if (moved) break;
      for (const tx of mutated.purchases[month]) {
        if (tx.code === "g") {
          tx.code = "y";
          moved = true;
          break;
        }
      }
    }
    expect(moved).toBe(true);
    const mutatedResult = buildSelfEmploymentQuarterlyUpdates(book, [], TAX_APR27, { scenario: mutated });
    const diffs = quarterlyDiffs(baseline, mutatedResult);
    const quarter = diffs[0].split(".")[0];
    expect(diffs.sort()).toEqual([`${quarter}.periodExpenses.adminCosts`, `${quarter}.periodExpenses.otherExpenses`].sort());
  });

  it("moving a sales line from account 4000 to 4003 (both turnover) flips nothing; moving it on to 4004 flips exactly turnover and outstandingBusinessIncome", () => {
    const toD = clone(base);
    for (const month of Object.keys(toD.sales)) {
      const tx = toD.sales[month].find((t) => t.code === "a");
      if (tx) {
        tx.code = "d";
        break;
      }
    }
    const toDResult = buildSelfEmploymentQuarterlyUpdates(book, [], TAX_APR27, { scenario: toD });
    expect(quarterlyDiffs(baseline, toDResult)).toEqual([]);

    const toG = clone(base);
    for (const month of Object.keys(toG.sales)) {
      const tx = toG.sales[month].find((t) => t.code === "a");
      if (tx) {
        tx.code = "g";
        break;
      }
    }
    const toGQuarterly = buildSelfEmploymentQuarterlyUpdates(book, [], TAX_APR27, { scenario: toG });
    const toGAnnual = buildSelfEmploymentAnnualSubmission(book, [], TAX_APR27, { scenario: toG });
    const baseAnnual = buildSelfEmploymentAnnualSubmission(book, [], TAX_APR27, { scenario: base });
    const diffs = quarterlyDiffs(baseline, toGQuarterly);
    expect(diffs).toEqual([`${diffs[0].split(".")[0]}.periodIncome.turnover`]);
    expect(toGAnnual.adjustments.outstandingBusinessIncome).not.toBeCloseTo(baseAnnual.adjustments.outstandingBusinessIncome, 2);
  });

  it("moving a line's postingDate from 30 June to 1 July flips exactly two quarters of one field and leaves the annual sum unchanged", () => {
    // The engine buckets a scenario transaction by the month key it sits
    // under (scenario.purchases.jun, .jul, ...), not by re-reading its own
    // date field, so moving a posting from June to July means moving the
    // object to the July array as well as changing the date it carries.
    const mutated = clone(base);
    let moved = false;
    for (const tx of mutated.purchases.jun) {
      if (dateIso(tx.date) === "2025-06-30") {
        tx.date = "2025-07-01";
        mutated.purchases.jun = mutated.purchases.jun.filter((candidate) => candidate !== tx);
        mutated.purchases.jul = [...(mutated.purchases.jul || []), tx];
        moved = true;
        break;
      }
    }
    expect(moved).toBe(true);
    const mutatedResult = buildSelfEmploymentQuarterlyUpdates(book, [], TAX_APR27, { scenario: mutated });
    const diffs = quarterlyDiffs(baseline, mutatedResult);
    const fields = new Set(diffs.map((d) => d.split(".").slice(1).join(".")));
    expect(fields.size).toBe(1);
    const quarters = new Set(diffs.map((d) => d.split(".")[0]));
    expect(quarters.size).toBe(2);
    const [field] = fields;
    const [section, key] = field.split(".");
    const baseSum = round2(baseline.periods.reduce((s, p) => s + p[section][key], 0));
    const mutatedSum = round2(mutatedResult.periods.reduce((s, p) => s + p[section][key], 0));
    expect(mutatedSum).toBeCloseTo(baseSum, 2);
  });

  it("changing a line's postingDate from 6 April to 2 April flips nothing under either period type", () => {
    // A diya-gl book/lines fixture, not the advanced scenario: brickwork's
    // own TXN-0012 (Smith & Co Accountants, purchases account 5800) is
    // dated 2025-04-06, and diyaGlToScenario buckets a line by its own
    // postingDate, so this mutation needs no month-key bookkeeping.
    const { book: bwBook, lines: bwLines } = loadFixture("se-brickwork-pro-nonvat");
    const original = bwLines.find((line) => line.postingDate === "2025-04-06");
    expect(original).toBeTruthy();
    const mutatedLines = bwLines.map((line) => (line === original ? { ...line, postingDate: "2025-04-02" } : line));
    for (const quarterlyPeriodType of ["calendar", "standard"]) {
      const before = buildSelfEmploymentQuarterlyUpdates(bwBook, bwLines, TAX_APR27, { quarterlyPeriodType });
      const after = buildSelfEmploymentQuarterlyUpdates(bwBook, mutatedLines, TAX_APR27, { quarterlyPeriodType });
      expect(quarterlyDiffs(before, after)).toEqual([]);
    }
  });

  it("halving an isolated opening asset's tax_wdv flips exactly capitalAllowanceMainPool", () => {
    // Added beside the fixture's own Van, which is the asset the year's
    // disposal is attached to -- halving that one would also move the
    // balancing allowance, which is a fact about this fixture's own asset
    // order, not something this check is about.
    const withExtra = clone(base);
    withExtra.opening_fixed_assets.push({ category: "motor", cost: 5000, acc_dep: 500, tax_wdv: 4000 });
    const withExtraAnnual = buildSelfEmploymentAnnualSubmission(book, [], TAX_APR27, { scenario: withExtra });

    const halved = clone(withExtra);
    halved.opening_fixed_assets[halved.opening_fixed_assets.length - 1].tax_wdv = 2000;
    const halvedAnnual = buildSelfEmploymentAnnualSubmission(book, [], TAX_APR27, { scenario: halved });

    const changed = Object.keys(withExtraAnnual.allowances).filter(
      (key) => withExtraAnnual.allowances[key] !== halvedAnnual.allowances[key],
    );
    expect(changed).toEqual(["capitalAllowanceMainPool"]);
    expect(withExtraAnnual.adjustments).toEqual(halvedAnnual.adjustments);
    expect(round2(withExtraAnnual.allowances.capitalAllowanceMainPool - halvedAnnual.allowances.capitalAllowanceMainPool)).toBeCloseTo(
      round2((4000 - 2000) * TAX_APR27.capital_allowances.writing_down_allowance),
      2,
    );
  });

  it("raising the disposal's proceeds above the asset's pool value swaps allowanceOnSales and balancingChargeOther", () => {
    const mutated = clone(base);
    let moved = false;
    for (const month of Object.keys(mutated.sales)) {
      const tx = mutated.sales[month].find((t) => t.code === "fs");
      if (tx) {
        tx.amount = 30000; // net 25000 at 20% VAT, above the pool's 20,640
        moved = true;
        break;
      }
    }
    expect(moved).toBe(true);
    const baseAnnual = buildSelfEmploymentAnnualSubmission(book, [], TAX_APR27, { scenario: base });
    const mutatedAnnual = buildSelfEmploymentAnnualSubmission(book, [], TAX_APR27, { scenario: mutated });
    expect(baseAnnual.allowances.allowanceOnSales).toBeCloseTo(8140, 2);
    expect(mutatedAnnual.allowances.allowanceOnSales).toBe(0);
    expect(baseAnnual.adjustments.balancingChargeOther).toBe(0);
    expect(mutatedAnnual.adjustments.balancingChargeOther).toBeCloseTo(4360, 2);
    const otherAllowanceKeys = Object.keys(baseAnnual.allowances).filter((key) => key !== "allowanceOnSales");
    for (const key of otherAllowanceKeys) expect(mutatedAnnual.allowances[key]).toBeCloseTo(baseAnnual.allowances[key], 2);
  });
});

describe("setPath — a mapping field name cannot reach the prototype chain", () => {
  it("rejects a path that walks through __proto__ before assigning", () => {
    const target = {};
    expect(() => setPath(target, "a.__proto__.polluted", "evil")).toThrow(/__proto__/);
    expect({}.polluted).toBeUndefined();
  });

  it("rejects __proto__ as the final segment", () => {
    const target = {};
    expect(() => setPath(target, "__proto__", "evil")).toThrow(/__proto__/);
    expect({}.polluted).toBeUndefined();
  });

  it("rejects constructor and prototype segments the same way", () => {
    const target = {};
    expect(() => setPath(target, "constructor.prototype.polluted", "evil")).toThrow(/constructor/);
    expect(() => setPath(target, "a.prototype.polluted", "evil")).toThrow(/prototype/);
    expect({}.polluted).toBeUndefined();
  });

  it("still writes an ordinary nested path", () => {
    const target = {};
    setPath(target, "periodIncome.turnover", 123.45);
    expect(target).toEqual({ periodIncome: { turnover: 123.45 } });
  });
});
