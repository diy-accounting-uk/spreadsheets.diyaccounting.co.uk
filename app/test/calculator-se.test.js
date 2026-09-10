// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// calculator-se.test.js — The Self Employed JS engine against the same
// figures the Excel reconciliation runs on.
//
// Every compliance check the product module makes of a recalculated package is
// made here of the engine's own results, so the two implementations are held to
// one standard rather than two. Each check is anchored in the fixture's own
// transactions, so an engine that is merely self-consistent fails.
//
// Beside them sit the statutory identities the return forms carry but the
// sheet's own formulas never state: a total expenses box that is the sum of
// the expense boxes above it, a net profit that is turnover less those
// expenses, and a taxable profit that is the net profit with the capital
// allowances taken off.
//
// No LibreOffice: the engine never opens a workbook.

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { loadScenario, MONTH_SHEETS } from "../lib/scenario-loader.js";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { calculateSeCells, calculateSeResults } from "../lib/calculators/se.js";
import { checkCompliance, cellLabels, standardReads, multiFileOptions, vatRateFor, unitFor, cellWrites } from "../products/se.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import {
  payslipsWagesPaidCell,
  PAYSLIP_PRINT_SHEET,
  PAYSLIP_PRINT_PERIOD,
  PAYSLIP_PRINT_CELLS,
  PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES,
} from "../lib/payslips-layout.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const REPO_DIR = resolve(APP_DIR, "..");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

const TAX_DATA = parseTOML(readFileSync(resolve(APP_DIR, "data", "se-2025-2026.toml"), "utf8"));

// The three Self Employed fixtures the reconciliation runs, and the number of
// compliance checks each one raises today. The count is asserted so a mirror
// cannot quietly empty itself: a check that stops being raised fails here
// rather than passing by absence.
const FIXTURES = [
  { name: "se-scenario-advanced", checkCount: 872 },
  { name: "se-brickwork-pro-vat", checkCount: 806 },
  { name: "se-brickwork-pro-nonvat", checkCount: 795 },
];

function loadFixture(name) {
  const scenario = loadScenario(resolve(FIXTURES_DIR, `${name}.toml`));
  const results = calculateSeResults({}, [], TAX_DATA, scenario);
  return { scenario, expected: { ...scenario, ...scenario.expected }, results };
}

function failures(checks) {
  return checks.filter((check) => !check.pass && check.severity !== "warning");
}

function describeFailure(check) {
  return `${check.name}: computed ${check.actual}, the book says ${check.expected}`;
}

// A journal's net-of-VAT total for one code letter, taken off the fixture's own
// transactions rather than off anything the engine produced.
function fixtureNet(journal, codes, rate) {
  const wanted = new Set(codes);
  let total = 0;
  for (const transactions of Object.values(journal || {})) {
    for (const tx of transactions) {
      if (!wanted.has(tx.code)) continue;
      total += tx.amount - (tx.amount * rate) / (1 + rate);
    }
  }
  return total;
}

describe("Self Employed engine: every compliance check the Excel reconciliation makes", () => {
  for (const fixture of FIXTURES) {
    describe(fixture.name, () => {
      let checks;

      beforeAll(() => {
        const { expected, results } = loadFixture(fixture.name);
        checks = checkCompliance(results, expected, TAX_DATA, calculateExpectedTax);
      });

      it("raises the whole check set", () => {
        expect(checks.length).toBe(fixture.checkCount);
      });

      it("passes every one of them", () => {
        expect(failures(checks).map(describeFailure)).toEqual([]);
      });
    });
  }
});

// se.js's cellWrites shifts every posting date onto the package's own tax
// year (period-shift.js) before it ever reaches a cell; checkCompliance has
// to derive its own expectation the same way, from the packageYearEnd it is
// given, or a package generated for a year other than the scenario's own
// fails these checks by exactly the gap between the two years. cellWrites
// writes literal date serials for the cells these checks read (no formula
// sits between the write and the read), so its own output stands in for the
// LibreOffice-recalculated package without opening one.
describe("Self Employed engine: payslip dates against a package generated years past the scenario's own", () => {
  const PACKAGE_YEAR_END = "2028-04-05";
  const TARGET_START_YEAR = parseInt(PACKAGE_YEAR_END.slice(0, 4), 10) - 1; // 2027, two years past the fixture's own 2025-04 opening
  const scenario = loadScenario(resolve(FIXTURES_DIR, "se-scenario-advanced.toml"));
  const expected = { ...scenario, ...scenario.expected };
  const DATE_CHECK_PATTERN = /wages paid date$|paid that month's wages$/;

  // The month tab order se.js's own MONTH_KEYS keeps (not exported): the
  // package's twelve calendar months from the tax year's April opening.
  const MONTH_KEYS = ["apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "jan", "feb", "mar"];

  // The engine's own-year results give every sheet checkCompliance reads
  // besides Payslips.xlsx; those are overlaid, cell by cell, with the
  // literal values cellWrites would put on the package it generates for
  // TARGET_START_YEAR, so only the payroll dates this test cares about move.
  // The printed page's I9/M18 are INDIRECT formulas onto the joined month
  // tab's own wages-paid cell (se.js's own comment on the check), so a real
  // recalculated package carries the shift there too even though cellWrites
  // never writes I9/M18 directly -- this reproduces that join by hand.
  function shiftedPayslipsResults() {
    const base = calculateSeResults({}, [], TAX_DATA, scenario);
    const writes = cellWrites(scenario, TARGET_START_YEAR);
    const results = { ...base };
    for (const [sheet, cells] of Object.entries(writes["Payslips.xlsx"])) {
      const key = `Payslips.xlsx!${sheet}`;
      results[key] = { ...(base[key] || {}), ...cells };
    }
    const printedTab = MONTH_SHEETS[MONTH_KEYS[PAYSLIP_PRINT_PERIOD - 1]];
    const wagesPaidOn = results[`Payslips.xlsx!${printedTab}`][payslipsWagesPaidCell(PAYSLIP_PRINT_PERIOD - 1)];
    const printSheetKey = `Payslips.xlsx!${PAYSLIP_PRINT_SHEET}`;
    results[printSheetKey] = { ...results[printSheetKey], [PAYSLIP_PRINT_CELLS.periodEnd]: wagesPaidOn, M18: wagesPaidOn };
    return results;
  }

  it("raises exactly the four date checks the writer's shift touches", () => {
    const checks = checkCompliance(shiftedPayslipsResults(), expected, TAX_DATA, calculateExpectedTax, PACKAGE_YEAR_END);
    const dateChecks = checks.filter((check) => DATE_CHECK_PATTERN.test(check.name));
    expect(dateChecks.length).toBe(4);
  });

  it("passes every one of them, matching the package the writer would have produced", () => {
    const checks = checkCompliance(shiftedPayslipsResults(), expected, TAX_DATA, calculateExpectedTax, PACKAGE_YEAR_END);
    const dateChecks = checks.filter((check) => DATE_CHECK_PATTERN.test(check.name));
    expect(failures(dateChecks).map(describeFailure)).toEqual([]);
  });

  it("still fails when a written wages-paid date is bent by a day", () => {
    const results = shiftedPayslipsResults();
    const julDateCell = payslipsWagesPaidCell(3); // MONTH_KEYS index 3 = jul
    results["Payslips.xlsx!Jul"][julDateCell] += 1;
    const checks = checkCompliance(results, expected, TAX_DATA, calculateExpectedTax, PACKAGE_YEAR_END);
    const bent = checks.find((check) => check.name === `Payslips!Jul ${julDateCell} wages paid date`);
    expect(bent).toBeDefined();
    expect(bent.pass).toBe(false);
  });

  // The calculator asked for the package's own tax year lands the same dates
  // the writer does, so the engine's cells and the package's agree without
  // an overlay: the four cells checkCompliance reads, and I9/M18's join onto
  // the printed month's wages-paid cell, all come out shifted.
  it("emits the writer's shifted wages-paid dates when given the package's own tax year", () => {
    const taxData = { ...TAX_DATA, tax_year: { ...TAX_DATA.tax_year, start: `${TARGET_START_YEAR}-04-06` } };
    const results = calculateSeResults({}, [], taxData, scenario);
    const ownYear = calculateSeResults({}, [], TAX_DATA, scenario);
    const writes = cellWrites(scenario, TARGET_START_YEAR)["Payslips.xlsx"];
    // The two month tabs the engine carries cell by cell, both of which the
    // fixture pays wages in.
    for (const index of PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES) {
      expect((scenario.payroll?.[MONTH_KEYS[index]] || []).length).toBeGreaterThan(0);
      const tab = MONTH_SHEETS[MONTH_KEYS[index]];
      const cell = payslipsWagesPaidCell(index);
      expect(results[`Payslips.xlsx!${tab}`][cell], `${tab}!${cell}`).toBe(writes[tab][cell]);
      expect(
        results[`Payslips.xlsx!${tab}`][cell] - ownYear[`Payslips.xlsx!${tab}`][cell],
        `${tab}!${cell} moved by two years`,
      ).toBeGreaterThanOrEqual(730);
    }
    const printedTab = MONTH_SHEETS[MONTH_KEYS[PAYSLIP_PRINT_PERIOD - 1]];
    const printed = results[`Payslips.xlsx!${PAYSLIP_PRINT_SHEET}`];
    expect(printed[PAYSLIP_PRINT_CELLS.periodEnd]).toBe(writes[printedTab][payslipsWagesPaidCell(PAYSLIP_PRINT_PERIOD - 1)]);
    expect(printed.M18).toBe(printed[PAYSLIP_PRINT_CELLS.periodEnd]);
    expect(
      failures(
        checkCompliance(results, expected, TAX_DATA, calculateExpectedTax, PACKAGE_YEAR_END).filter((check) =>
          DATE_CHECK_PATTERN.test(check.name),
        ),
      ),
    ).toEqual([]);
  });

  // se-profit-forecast-checks.test.js built a package this way -- cellWrites
  // given a targetStartYear years past the scenario's own -- while its call
  // to checkCompliance carried no packageYearEnd at all, leaving these date
  // checks comparing the writer's shifted package against an unshifted
  // expectation. Proves the omission is what broke it, on the engine alone.
  it("fails those same date checks when checkCompliance is not told the package's own year end", () => {
    const checks = checkCompliance(shiftedPayslipsResults(), expected, TAX_DATA, calculateExpectedTax);
    const dateChecks = checks.filter((check) => DATE_CHECK_PATTERN.test(check.name));
    expect(failures(dateChecks).map(describeFailure)).not.toEqual([]);
  });
});

describe("Self Employed engine: the return boxes against the statutory computation", () => {
  for (const fixture of FIXTURES) {
    describe(fixture.name, () => {
      let scenario;
      let results;
      let rate;

      beforeAll(() => {
        ({ scenario, results } = loadFixture(fixture.name));
        rate = vatRateFor(scenario);
      });

      it("SA103F box 15 turnover is the sales journal's trading lines net of VAT", () => {
        const traded = fixtureNet(scenario.sales, ["a", "b", "c", "d"], rate);
        expect(results["SE Full"].D55).toBeCloseTo(traded, 6);
      });

      it("SA103F box 31 total expenses is the sum of boxes 17 to 30", () => {
        const full = results["SE Full"];
        const expenseBoxes = ["D66", "D70", "D74", "D78", "D82", "D86", "D90", "D94", "D98", "D102", "D106", "D110", "D114", "D118"];
        const summed = expenseBoxes.reduce((total, box) => total + full[box], 0);
        expect(full.D122).toBeCloseTo(summed, 6);
      });

      it("SA103F box 47 net profit is turnover plus other business income less total expenses", () => {
        const full = results["SE Full"];
        expect(full.D129 - full.O129).toBeCloseTo(full.D55 + full.O55 - full.D122, 6);
      });

      it("SA103F box 64 taxable profit is the net profit with the disallowables added and the allowances taken off", () => {
        const full = results["SE Full"];
        expect(full.O174 - full.O179).toBeCloseTo(full.D129 - full.O129 + full.D174 - full.O169, 6);
      });

      it("SA103F box 76 total taxable profits is the adjusted profit less losses brought forward plus other income", () => {
        const full = results["SE Full"];
        expect(full.O210).toBeCloseTo(full.O194 - full.O199 + full.O204, 6);
      });

      it("SA103S box 20 total expenses is the sum of the nine expense boxes above it", () => {
        const short = results["SE Short"];
        const expenseBoxes = ["D46", "D51", "D55", "D60", "D64", "O46", "O51", "O55", "O60"];
        const summed = expenseBoxes.reduce((total, box) => total + (typeof short[box] === "number" ? short[box] : 0), 0);
        // Below the small-business turnover limit the return states one total
        // and leaves the analysis blank, so there is nothing to add up.
        if (typeof short.D46 !== "number") return;
        // The short return takes depreciation back out of its total; the boxes
        // above it carry the depreciation-free figures already.
        expect(short.O64).toBeCloseTo(summed, 6);
      });

      it("SA103S box 21 net profit is turnover plus other business income less total expenses", () => {
        const short = results["SE Short"];
        expect(short.D71 - short.O71).toBeCloseTo(short.D38 + short.O38 - short.O64, 6);
      });

      it("SA103S box 28 net business profit is the net profit with the capital allowances taken off", () => {
        const short = results["SE Short"];
        const allowances = short.D80 + short.D85 + short.O80;
        const chargeable = short.D71 - short.O71 + short.O85 + short.D94 - allowances;
        expect(short.D99).toBeCloseTo(Math.max(0, chargeable), 6);
      });

      it("the nine expense boxes are filled only when turnover clears the VAT threshold", () => {
        const short = results["SE Short"];
        const threshold = TAX_DATA.vat.registration_threshold;
        const expenseBoxes = ["D46", "D51", "D55", "D60", "D64", "O46", "O51", "O55", "O60"];
        const filled = results["Profit & Loss Account"].B9 > threshold;
        for (const box of expenseBoxes) {
          expect(typeof short[box] === "number", `${box} with turnover ${results["Profit & Loss Account"].B9}`).toBe(filled);
        }
        // The total the boxes roll into is stated either way.
        expect(typeof short.O64).toBe("number");
      });

      it("SA103S box 35 total loss to carry forward is the figure the customer enters", () => {
        expect(results["SE Short"].D124).toBe(0);
      });

      it("the annual investment allowance is the year's capital spend, which claims it in full", () => {
        const capitalSpend = fixtureNet(scenario.purchases, ["fa"], rate);
        // The schedule holds each asset's cost rounded to the penny.
        expect(results["SE Full"].D139).toBeCloseTo(Math.round(capitalSpend * 100) / 100, 2);
        expect(results["SE Short"].D80).toBeCloseTo(results["SE Full"].D139, 6);
      });

      it("SE Short prints business name at C8", () => {
        const short = results["SE Short"];
        expect(short.C8).toBe(scenario.business?.name || " ");
      });

      it("SE Short prints accounting date at S17", () => {
        const short = results["SE Short"];
        const full = results["SE Full"];
        // S17 references Q2 (accounting period end), which also appears in SE Full
        expect(short.S17).toBe(full.Q2);
      });

      it("SE Short prints turnover note at A33", () => {
        const short = results["SE Short"];
        const vatThreshold = TAX_DATA.vat.registration_threshold;
        const expectedNote =
          short.D38 > vatThreshold
            ? `SELF-EMPLOYMENT FULL RETURN REQUIRED AS TURNOVER EXCEEDS £${vatThreshold} VAT threshold`
            : `Business income - if your annual turnover was below £${vatThreshold} VAT threshold`;
        expect(short.A33).toBe(expectedNote);
      });
    });
  }
});

describe("Self Employed engine: the checks are breakable", () => {
  // Moving one cell has to fail the checks that read it and leave the rest
  // alone. A check that cannot fail is not a check.
  const CORRUPTIONS = [
    {
      what: "the wages line on the profit and loss account",
      corrupt: (results) => {
        results["Profit & Loss Account"].B21 += 1000;
      },
      failing: [
        "P&L: Admin lines sum = Total",
        "P&L: Wages & Salaries (B21) = Purchases w-coded net + payroll gross + employer NI",
        "SA103F box 19 wages, salaries and staff costs (D74) = the profit and loss account",
      ],
    },
    {
      what: "a month's VAT on the sales journal",
      corrupt: (results) => {
        results["Sales.xlsx!Jun"].H1 += 100;
      },
      failing: ["Vatinterface F8: Jun output VAT = Sales.xlsx Jun"],
    },
    {
      what: "a month's CIS certificates total",
      corrupt: (results) => {
        results["Purchases.xlsx!Jun"].AD1 += 250;
      },
      failing: ["Purchases.xlsx Jun: CIS tax withheld reaches the certificates column (AD1)"],
    },
    {
      what: "the fixed asset schedule's depreciation charge",
      corrupt: (results) => {
        results["Fixedassets.xlsx!Schedule"].I1 += 600;
      },
      failing: ["P&L: Depreciation (row 34, summed) = Schedule I1"],
    },
  ];

  for (const corruption of CORRUPTIONS) {
    it(`fails on ${corruption.what} and nothing else`, () => {
      const { expected, results } = loadFixture("se-scenario-advanced");
      const intact = failures(checkCompliance(results, expected, TAX_DATA, calculateExpectedTax));
      expect(intact).toEqual([]);

      corruption.corrupt(results);
      const broken = failures(checkCompliance(results, expected, TAX_DATA, calculateExpectedTax)).map((check) => check.name);
      expect(broken.sort()).toEqual([...corruption.failing].sort());
    });
  }
});

// se-loss-no-expected carries no [expected] table and nets to a loss on
// every trading month: SE Short's D71 (net profit) and the SE Full/Income
// Tax chain it feeds all floor at nil the way the template's own IF()
// formulas do, and only O71 (net loss) and the SE Full loss boxes carry a
// live figure. Before the SE-T27 fix, checkCompliance raised four mismatches
// on this book that were artefacts of the check arithmetic, not the sheet:
// D71's identity check and the SA103F box 47 counterpart it feeds compared
// an unclamped turnover-less-expenses figure against D71's own clamped
// value; the box 65/box 106 counterpart compared against SE Short!O106,
// which was never in CELL_MAP so it always read as 0; the profit bridge
// subtracted SE Short!O71 on top of Profit & Loss Account!B39 already
// carrying that same loss, double-counting it; and the Forecast personal
// allowance check compared the sheet's own IF(C39<=0,0,...) floor against
// calculateExpectedTax's unfloored figure.
//
// A fifth, related bug surfaced once the engine's own Income Tax!E6 was
// floored to match the template's IF(E5<=0,0,...): the JS engine had never
// applied that floor, always handing back the unfloored personal allowance,
// and checkCompliance's own "Tax: Personal allowance after taper" check
// compared against that same unfloored figure -- two wrongs that agreed with
// each other on every loss-making book, so the check could not fail no
// matter which side was wrong. Flooring the engine's E6 alone (without
// flooring the check) turned that silent agreement into a false failure on
// this very fixture; flooring both is what makes the check test anything.
describe("Self Employed engine: a loss-making book with no [expected] table", () => {
  it("reports no compliance mismatches", () => {
    const { scenario, expected, results } = loadFixture("se-loss-no-expected");
    const pl = results["Profit & Loss Account"];
    expect(pl.B39).toBeLessThan(0);
    expect(scenario.expected).toBeUndefined();

    expect(failures(checkCompliance(results, expected, TAX_DATA, calculateExpectedTax)).map(describeFailure)).toEqual([]);
  });

  it("still reports a real mismatch when the book carries an [expected] table", () => {
    const { expected, results } = loadFixture("se-loss-no-expected");
    const pl = results["Profit & Loss Account"];
    const wrongExpected = { ...expected, total_sales: pl.B9 + 12345 };

    const broken = failures(checkCompliance(results, wrongExpected, TAX_DATA, calculateExpectedTax)).map((check) => check.name);
    expect(broken).toEqual(["Total Sales"]);
  });

  it("fails on the net loss identity and nothing else", () => {
    const { expected, results } = loadFixture("se-loss-no-expected");
    expect(failures(checkCompliance(results, expected, TAX_DATA, calculateExpectedTax))).toEqual([]);

    results["SE Short"].O71 += 500;
    const broken = failures(checkCompliance(results, expected, TAX_DATA, calculateExpectedTax)).map((check) => check.name);
    expect(broken.sort()).toEqual(
      [
        "SA103S: net loss = total expenses - turnover - other business income",
        "SA103F box 48 net loss: full return (O129) = short return (O71)",
      ].sort(),
    );
  });

  it("fails on the profit bridge and the box 63 deduction total when SE Full's box 62 is corrupted", () => {
    const { expected, results } = loadFixture("se-loss-no-expected");
    expect(failures(checkCompliance(results, expected, TAX_DATA, calculateExpectedTax))).toEqual([]);

    results["SE Full"].D179 = 500;
    const broken = failures(checkCompliance(results, expected, TAX_DATA, calculateExpectedTax)).map((check) => check.name);
    expect(broken.sort()).toEqual(
      [
        "Accounting profit to tax profit bridge closes to zero",
        "SA103F box 63 total deductions from net profit (O169) = boxes 57 and 62",
      ].sort(),
    );
  });

  it("fails on the Income Tax personal allowance and nothing else", () => {
    const { expected, results } = loadFixture("se-loss-no-expected");
    expect(failures(checkCompliance(results, expected, TAX_DATA, calculateExpectedTax))).toEqual([]);

    results["Income Tax"].E6 += 500;
    const broken = failures(checkCompliance(results, expected, TAX_DATA, calculateExpectedTax)).map((check) => check.name);
    expect(broken).toEqual(["Tax: Personal allowance after taper"]);
  });
});

describe("Self Employed engine: the read scope", () => {
  it("computes a value for every cell the reconciliation reads", () => {
    const { results } = loadFixture("se-scenario-advanced");
    const scope = { ...standardReads() };
    for (const [file, sheets] of Object.entries(multiFileOptions().additionalReads)) {
      for (const [sheet, cells] of Object.entries(sheets)) scope[`${file}!${sheet}`] = cells;
    }
    const missing = [];
    for (const [sheet, cells] of Object.entries(scope)) {
      for (const cell of cells) if (results[sheet]?.[cell] === undefined) missing.push(`${sheet}!${cell}`);
    }
    expect(missing).toEqual([]);
    // A cell the workbook itself leaves empty is computed as the blank it
    // holds, so both engines carry nothing there rather than one carrying nil.
    const blanks = [];
    for (const [sheet, cells] of Object.entries(results)) {
      for (const [cell, value] of Object.entries(cells)) if (value === " ") blanks.push(`${sheet}!${cell}`);
    }
    expect(blanks.sort()).toEqual(
      [
        "SE Full!D147",
        "SE Full!D152",
        "SE Full!D156",
        "SE Full!D160",
        "SE Full!D179",
        "SE Full!O139",
        "Vat.xlsx!Vatinterface!E4",
        "Vat.xlsx!Vatinterface!E5",
        "Vat.xlsx!Vatinterface!G4",
        "Vat.xlsx!Vatinterface!G5",
        "Vat.xlsx!Vatinterface!I4",
        "Vat.xlsx!Vatinterface!I5",
        "Vat.xlsx!Vatinterface!K4",
        "Vat.xlsx!Vatinterface!K5",
        // The tax code column: the three employees on the payroll each carry
        // a code, so only the two rows no employee sits on keep the
        // placeholder space the template ships there.
        "Payslips.xlsx!Jul!D54",
        "Payslips.xlsx!Jul!D55",
        "Payslips.xlsx!Aug!D54",
        "Payslips.xlsx!Aug!D55",
        // A monthly block row no employee sits on: the template ships the
        // name, gross pay, net pay and reference columns empty and the three
        // beside them as a literal zero.
        "Payslips.xlsx!Jul!F54",
        "Payslips.xlsx!Jul!M54",
        "Payslips.xlsx!Jul!R54",
        "Payslips.xlsx!Jul!S54",
        "Payslips.xlsx!Jul!F55",
        "Payslips.xlsx!Jul!M55",
        "Payslips.xlsx!Jul!R55",
        "Payslips.xlsx!Jul!S55",
        "Payslips.xlsx!Aug!F54",
        "Payslips.xlsx!Aug!M54",
        "Payslips.xlsx!Aug!R54",
        "Payslips.xlsx!Aug!S54",
        "Payslips.xlsx!Aug!F55",
        "Payslips.xlsx!Aug!M55",
        "Payslips.xlsx!Aug!R55",
        "Payslips.xlsx!Aug!S55",
        // The weekly employee line and the payslip total the following
        // month would bring forward, neither of which a monthly payroll
        // ever fills.
        "Payslips.xlsx!Jul!F11",
        "Payslips.xlsx!Jul!F12",
        "Payslips.xlsx!Jul!F13",
        "Payslips.xlsx!Jul!F14",
        "Payslips.xlsx!Jul!F15",
        "Payslips.xlsx!Aug!M11",
        "Payslips.xlsx!Aug!M12",
        "Payslips.xlsx!Aug!M13",
        "Payslips.xlsx!Aug!M14",
        "Payslips.xlsx!Aug!M15",
      ].sort(),
    );
  });

  it("declares a unit for every cell it computes", () => {
    const { results } = loadFixture("se-scenario-advanced");
    const labels = cellLabels();
    const undeclared = [];
    for (const [sheet, cells] of Object.entries(results)) {
      for (const cell of Object.keys(cells)) if (!labels[`${sheet}!${cell}`]?.unit) undeclared.push(`${sheet}!${cell}`);
    }
    expect(undeclared).toEqual([]);
  });

  // Payslips!Payment's B and C columns hold the tax month's end and due
  // dates as Excel day serials, one row per month (WAGES_MONTH_ROWS, 4 to
  // 15); D, E and I are the amounts the schedule pays. A serial carrying the
  // money unit compares to the penny like any other amount instead of the
  // day it names, which a reconciliation comparing R against a rendered
  // page can never satisfy for a date.
  it("gives Payslips.xlsx!Payment its date columns and money columns their own unit", () => {
    for (let row = 4; row <= 15; row++) {
      expect(unitFor("Payslips.xlsx!Payment", `B${row}`)).toBe("date");
      expect(unitFor("Payslips.xlsx!Payment", `C${row}`)).toBe("date");
      expect(unitFor("Payslips.xlsx!Payment", `D${row}`)).toBe("money");
      expect(unitFor("Payslips.xlsx!Payment", `E${row}`)).toBe("money");
      expect(unitFor("Payslips.xlsx!Payment", `I${row}`)).toBe("money");
    }
  });
});

// The leaf cells a sibling workbook's link addresses, each anchored to the
// fixture's own lines rather than to anything the engine produced.
describe("Self Employed engine: the leaf cells a link addresses", () => {
  const { scenario } = loadFixture("se-scenario-advanced");
  const rate = vatRateFor(scenario);
  const cells = calculateSeCells({}, [], TAX_DATA, scenario);
  const net = (amount) => amount - (amount * rate) / (1 + rate);

  it("totals April's product sales (code a) in Sales.xlsx!Apr!P1", () => {
    const april = scenario.sales.apr.filter((tx) => !tx.mileage && (tx.code || "a") === "a");
    expect(april.length).toBeGreaterThan(0);
    expect(cells["Sales.xlsx!Apr"].P1).toBeCloseTo(
      april.reduce((sum, tx) => sum + net(tx.amount), 0),
      6,
    );
  });

  it("runs the fixed asset purchases (code fa) to the year's total in Purchases.xlsx!Mar!AB2", () => {
    const yearTotal = fixtureNet(scenario.purchases, ["fa"], rate);
    expect(yearTotal).toBeGreaterThan(0);
    expect(cells["Purchases.xlsx!Mar"].AB2).toBeCloseTo(yearTotal, 6);
  });

  it("totals April's debtor receipts (code DR) in Bank.xlsx!Apr!H1", () => {
    const receipts = scenario.bank.apr.filter((tx) => (tx.account || "1200") === "1200" && tx.direction === "in" && tx.code === "DR");
    expect(receipts.length).toBeGreaterThan(0);
    expect(cells["Bank.xlsx!Apr"].H1).toBe(receipts.reduce((sum, tx) => sum + tx.amount, 0));
  });

  it("totals April's gross pay in Payslips.xlsx!Apr!M1", () => {
    const april = scenario.payroll.apr;
    expect(april.length).toBeGreaterThan(0);
    expect(cells["Payslips.xlsx!Apr"].M1).toBe(april.reduce((sum, entry) => sum + entry.grossPay, 0));
  });

  // The Company's cash top-up moves money from the current account to the
  // cash float mid-year, coded "X" once it reaches SE rather than the "BC"
  // the Company gives its own opening balances -- bankBook() (calculators/
  // se.js) takes any "BC"-coded line as a fresh opening balance on whatever
  // tab it lands on, replacing the running balance carried forward from the
  // month before, so a transfer carrying that letter would reset June's
  // opening to the transfer's own amount instead of adding it to the year's
  // receipts and payments.
  it("keeps Bank.xlsx's opening balance in Apr!A1, and carries the balance into June instead of re-opening it at the transfer's own amount", () => {
    const opening = scenario.bank.apr.find((tx) => (tx.account || "1200") === "1200" && tx.code === "BC");
    expect(opening).toBeDefined();
    expect(cells["Bank.xlsx!Apr"].A1).toBe(opening.amount);

    const transfer = scenario.bank.jun.find((tx) => (tx.account || "1200") === "1200" && tx.code === "X" && tx.direction === "out");
    expect(transfer).toBeDefined();
    expect(cells["Bank.xlsx!Jun"].A1).toBe(cells["Bank.xlsx!May"].A2);
    expect(cells["Bank.xlsx!Jun"].A1).not.toBe(transfer.amount);
  });
});

describe("Self Employed engine: from the diya-gl book", () => {
  it("passes every compliance check on the Precision Code advanced book", () => {
    const { book, lines } = loadDiyaGlData(resolve(REPO_DIR, "examples", "precision-code-ltd", "advanced"));
    const scenario = diyaGlToScenario(book, lines, "se");
    const results = calculateFromDiyaGl(book, lines, "se", TAX_DATA, scenario);
    const checks = checkCompliance(results, { ...scenario, ...scenario.expected }, TAX_DATA, calculateExpectedTax);
    expect(failures(checks).map(describeFailure)).toEqual([]);
  });

  // The book carries the master's own VAT-straddling lines, which belong to
  // return periods either side of the accounting year and reach Vat.xlsx's
  // out-of-year entry sheets rather than any journal. The five return forms
  // read them through the interface table, so a book that cannot carry them
  // files a nil fifth quarter. Comparing box for box against the scenario
  // extracted from the same master anchors the figures outside the book.
  it("files the same five VAT quarters from the book as from the scenario extracted from the same master", () => {
    const { book, lines } = loadDiyaGlData(resolve(REPO_DIR, "examples", "precision-code-ltd", "advanced"));
    const fromBook = calculateFromDiyaGl(book, lines, "se", TAX_DATA, diyaGlToScenario(book, lines, "se"));
    const fromFixture = calculateFromDiyaGl(book, lines, "se", TAX_DATA, loadScenario(resolve(FIXTURES_DIR, "se-scenario-advanced.toml")));
    for (let quarter = 1; quarter <= 5; quarter++) {
      const sheet = `Vat.xlsx!VATQtr${quarter}`;
      expect(fromBook[sheet], sheet).toEqual(fromFixture[sheet]);
    }
    // The fifth quarter falls wholly outside the accounting year, so the
    // straddling entries are the only thing that puts a figure on it.
    expect(fromBook["Vat.xlsx!VATQtr5"].G9).toBeGreaterThan(0);
  });
});
