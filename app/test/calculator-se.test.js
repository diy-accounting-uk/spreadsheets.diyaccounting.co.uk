// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
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
import { loadScenario } from "../lib/scenario-loader.js";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { calculateSeResults } from "../lib/calculators/se.js";
import { checkCompliance, cellLabels, standardReads, multiFileOptions, vatRateFor } from "../products/se.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";

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
  { name: "se-scenario-advanced", checkCount: 677 },
  { name: "se-brickwork-pro-vat", checkCount: 643 },
  { name: "se-brickwork-pro-nonvat", checkCount: 643 },
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

      it("SA103F box 14 turnover is the sales journal's trading lines net of VAT", () => {
        const traded = fixtureNet(scenario.sales, ["a", "b", "c", "d"], rate);
        expect(results["SE Full"].D55).toBeCloseTo(traded, 6);
      });

      it("SA103F box 30 total expenses is the sum of boxes 16 to 29", () => {
        const full = results["SE Full"];
        const expenseBoxes = ["D66", "D70", "D74", "D78", "D82", "D86", "D90", "D94", "D98", "D102", "D106", "D110", "D114", "D118"];
        const summed = expenseBoxes.reduce((total, box) => total + full[box], 0);
        expect(full.D122).toBeCloseTo(summed, 6);
      });

      it("SA103F box 46 net profit is turnover plus other business income less total expenses", () => {
        const full = results["SE Full"];
        expect(full.D129 - full.O129).toBeCloseTo(full.D55 + full.O55 - full.D122, 6);
      });

      it("SA103F box 63 taxable profit is the net profit with the disallowables added and the allowances taken off", () => {
        const full = results["SE Full"];
        expect(full.O174 - full.O179).toBeCloseTo(full.D129 - full.O129 + full.D174 - full.O169, 6);
      });

      it("SA103F box 75 total taxable profits is the adjusted profit less losses brought forward plus other income", () => {
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

      it("SA103S box 31 taxable profit is the net profit with the capital allowances taken off", () => {
        const short = results["SE Short"];
        const allowances = short.D80 + short.D85 + short.O80;
        const chargeable = short.D71 - short.O71 + short.O85 + short.D94 - allowances;
        expect(short.D99).toBeCloseTo(Math.max(0, chargeable), 6);
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
        "SA103F box 18 wages, salaries and staff costs (D74) = the profit and loss account",
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
        "SE Full!D156",
        "SE Full!D160",
        "SE Full!D179",
        "SE Full!O154",
        "Vat.xlsx!Vatinterface!E4",
        "Vat.xlsx!Vatinterface!E5",
        "Vat.xlsx!Vatinterface!G4",
        "Vat.xlsx!Vatinterface!G5",
        "Vat.xlsx!Vatinterface!I4",
        "Vat.xlsx!Vatinterface!I5",
        "Vat.xlsx!Vatinterface!K4",
        "Vat.xlsx!Vatinterface!K5",
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
});

describe("Self Employed engine: from the diya-gl book", () => {
  it("passes every compliance check on the Precision Code advanced book", () => {
    const { book, lines } = loadDiyaGlData(resolve(REPO_DIR, "examples", "precision-code-ltd", "advanced"));
    const scenario = diyaGlToScenario(book, lines, "se");
    const results = calculateFromDiyaGl(book, lines, "se", TAX_DATA, scenario);
    const checks = checkCompliance(results, { ...scenario, ...scenario.expected }, TAX_DATA, calculateExpectedTax);
    expect(failures(checks).map(describeFailure)).toEqual([]);
  });
});
