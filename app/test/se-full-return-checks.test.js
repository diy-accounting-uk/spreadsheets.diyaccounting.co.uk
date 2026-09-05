// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// Proves the SA103F checks catch a broken workbook. SE Full is a live HMRC
// return sharing Financialaccounts.xlsx with SE Short: every box is
// formula-fed from the profit and loss account, the fixed asset schedule or
// the Admin sheet, and nothing read any of it back, so the full return could
// carry a different figure from the short return beside it and no check
// would notice.
//
// Each check runs against a real LibreOffice-recalculated multi-file package,
// then again after corrupting one SE Full cell's cached value in a copy of
// Financialaccounts.xlsx via JSZip. Every corruption names the exact set of
// checks it is expected to flip, so a check that fires on the wrong cell
// fails here too.
//
// The short return's own box numbers, gates and captions are read straight
// out of the shipped template's XML at the foot of this file, with no
// LibreOffice: they are printed text, not computed figures.
//
// Requires: LibreOffice installed (brew install --cask libreoffice) for the
// recalculated half.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, mkdtempSync, rmSync } from "fs";
import { resolve, dirname, join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { runMultiFileSpreadsheet, hasLibreOffice, buildSheetMap, readCellValue, loadSharedStrings } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import {
  cellWrites as seCellWrites,
  standardReads as seReads,
  multiFileOptions as seOptions,
  checkCompliance as seCheckCompliance,
} from "../products/se.js";
import { parse as parseTOML } from "smol-toml";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const SE_DIR = resolve(APP_DIR, "templates", "se");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

// The year the tax year a package was built for opens in, which is the payroll
// year the Employee sheet's start dates are read against.
const seTaxYearStart = (taxData) => new Date(taxData.tax_year.start).getUTCFullYear();

// Overwrites a cell's cached <v> content in place, leaving any <f> formula
// tag untouched -- the way a stale or corrupted cached value would reach a
// reader that only ever sees the last-saved cell. A box the return leaves
// empty holds no cached value to overwrite, so it gets one: the same
// corruption from the other side, a figure appearing in a box that should
// carry nothing.
function corruptCellValue(xml, cellRef, newValue) {
  // The empty form is matched first: an empty cell closes itself, so a search
  // for its cached value runs on past it and lands on the next cell that has
  // one.
  const empty = new RegExp(`<c r="${cellRef}"([^>]*?)\\s*/>`, "s");
  if (empty.test(xml))
    return xml.replace(empty, (_match, attrs) => `<c r="${cellRef}"${attrs.replace(/\s+t="[^"]*"/, "")}><v>${newValue}</v></c>`);
  const cached = new RegExp(`(<c r="${cellRef}"[^>]*>(?:(?!</c>).)*?<v>)([^<]*)(</v>)`, "s");
  if (cached.test(xml)) return xml.replace(cached, (_match, pre, _old, post) => `${pre}${newValue}${post}`);
  throw new Error(`corruptCellValue: cell ${cellRef} not found in sheet XML`);
}

// Loads a recalculated package file via JSZip, overwrites one cell's cached
// value, round-trips the archive and reads the cell back -- a real mutation
// of a copy of the workbook, not a string edit on the in-memory results.
async function readCorruptedCell(savedDir, fileName, sheetName, cellRef, newValue) {
  const zip = await JSZip.loadAsync(readFileSync(resolve(savedDir, fileName)));
  const sheetMap = await buildSheetMap(zip);
  const sheetPath = sheetMap.get(sheetName);
  if (!sheetPath) throw new Error(`readCorruptedCell: sheet ${sheetName} not found in ${fileName}`);
  const xml = await zip.file(sheetPath).async("string");
  zip.file(sheetPath, corruptCellValue(xml, cellRef, newValue));

  const corruptedBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const reloadedZip = await JSZip.loadAsync(corruptedBuffer);
  const sharedStrings = await loadSharedStrings(reloadedZip);
  const reloadedXml = await reloadedZip.file(sheetPath).async("string");
  return readCellValue(reloadedXml, cellRef, sharedStrings);
}

function failureNames(checks) {
  return checks.filter((c) => !c.pass && c.severity !== "warning").map((c) => c.name);
}

// The boxes carrying a figure on this scenario. The rest of the return's
// boxes are nil here -- a trader with no loss, no own-use adjustment and no
// contractor deductions -- so their checks are proved by the corruption
// table below rather than by the value they hold.
const SA103F_BOXES_WITH_A_FIGURE = [
  "D55",
  "D66",
  "D70",
  "D74",
  "D78",
  "D82",
  "D86",
  "D90",
  "D94",
  "D102",
  "D106",
  "D110",
  "D114",
  "D118",
  "D122",
  "O114",
  "O122",
  "D129",
  "D139",
  "D144",
  "O149",
  "O154",
  "D174",
  "O169",
  "O174",
  "O194",
  "O204",
  "O210",
];

const TOTAL_CAPITAL_ALLOWANCES = "SA103F box 57 total capital allowances (O154) = boxes 49 to 56";
const NET_PROFIT = "SA103F box 47 net profit (D129) = boxes 15 and 16 less box 31";
const TOTAL_ADDITIONS = "SA103F box 61 total additions to net profit (D174) = boxes 46, 59 and 60";
const TOTAL_DEDUCTIONS = "SA103F box 63 total deductions from net profit (O169) = boxes 57 and 62";
const TAXABLE_PROFIT = "SA103F box 64 net business profit for tax purposes (O174) = box 47 or box 48, plus box 61, less box 63";
const ADJUSTED_PROFIT = "SA103F box 73 adjusted profit (O194) = box 64";
const TOTAL_TAXABLE_PROFITS = "SA103F box 76 total taxable profits (O210) = box 73 less box 74 plus box 75";
const SHORT_TOTAL_EXPENSES =
  "SA103F box 31 total expenses (D122) = the short return's total expenses with box 46 disallowable depreciation added back";
const SHORT_NET_PROFIT = "SA103F box 47 net profit (D129) = the short return's net profit less box 46 disallowable depreciation";

// Each corruption and the exact set of checks it must flip.
const SA103F_CORRUPTIONS = [
  [
    "D55",
    340200,
    [
      "SA103F box 15 turnover (D55) = the profit and loss account",
      NET_PROFIT,
      "SA103F box 15 turnover: full return (D55) = short return (D38)",
    ],
  ],
  [
    "O55",
    1000,
    [
      "SA103F box 16 other business income (O55) = the profit and loss account",
      NET_PROFIT,
      "SA103F box 16 other business income: full return (O55) = short return (O38)",
    ],
  ],
  ["D66", 14470, ["SA103F box 17 goods bought for resale (D66) = the profit and loss account"]],
  ["D70", 7666.66666666667, ["SA103F box 18 subcontractor payments (D70) = the profit and loss account"]],
  [
    "D74",
    93735.7333333333,
    [
      "SA103F box 19 wages, salaries and staff costs (D74) = the profit and loss account",
      "SA103F box 19 wages, salaries and staff costs: full return (D74) = short return (D55)",
    ],
  ],
  [
    "D78",
    8881.875,
    [
      "SA103F box 20 car, van and travel expenses (D78) = the profit and loss account",
      "SA103F box 20 car, van and travel expenses: full return (D78) = short return (D51)",
    ],
  ],
  [
    "D82",
    14200,
    [
      "SA103F box 21 rent, rates, power and insurance (D82) = the profit and loss account",
      "SA103F box 21 rent, rates, power and insurance: full return (D82) = short return (D60)",
    ],
  ],
  [
    "D86",
    1950,
    [
      "SA103F box 22 repairs and maintenance (D86) = the profit and loss account",
      "SA103F box 22 repairs and maintenance: full return (D86) = short return (D64)",
    ],
  ],
  [
    "D90",
    4035,
    [
      "SA103F box 23 phone, stationery and office costs (D90) = the profit and loss account",
      "SA103F box 23 phone, stationery and office costs: full return (D90) = short return (O55)",
    ],
  ],
  ["D94", 4800, ["SA103F box 24 advertising and entertainment (D94) = the profit and loss account"]],
  ["D98", 1000, ["SA103F box 25 interest on bank and other loans (D98) = the profit and loss account"]],
  ["D102", 1800, ["SA103F box 26 bank, credit card and finance charges (D102) = the profit and loss account"]],
  ["D106", 700, ["SA103F box 27 irrecoverable debts written off (D106) = the profit and loss account"]],
  [
    "D110",
    7925,
    [
      "SA103F box 28 accountancy, legal and professional fees (D110) = the profit and loss account",
      "SA103F box 28 accountancy, legal and professional fees: full return (D110) = short return (O46)",
    ],
  ],
  ["D114", 12912, ["SA103F box 29 depreciation and loss on sale of assets (D114) = the profit and loss account"]],
  ["D118", 4231.666666666661, ["SA103F box 30 other business expenses (D118) = the profit and loss account"]],
  ["D122", 165307.941666667, ["SA103F box 31 total expenses (D122) = the profit and loss account", NET_PROFIT, SHORT_TOTAL_EXPENSES]],
  ["O114", 12740, ["SA103F box 44 disallowable depreciation (O114) = the profit and loss account"]],
  [
    "O122",
    12740,
    [
      "SA103F box 46 total disallowable expenses (O122) = the profit and loss account",
      TOTAL_ADDITIONS,
      SHORT_TOTAL_EXPENSES,
      SHORT_NET_PROFIT,
    ],
  ],
  [
    "O204",
    3083.33333333333,
    [
      "SA103F box 75 other business income (O204) = the profit and loss account",
      TOTAL_TAXABLE_PROFITS,
      "SA103F box 75 other business income: full return (O204) = short return (O99)",
    ],
  ],
  ["D129", 175892.058333333, [NET_PROFIT, TAXABLE_PROFIT, SHORT_NET_PROFIT]],
  ["O129", 1000, ["SA103F box 48 net loss: full return (O129) = short return (O71)"]],
  [
    "D139",
    33500,
    [
      TOTAL_CAPITAL_ALLOWANCES,
      "SA103F box 49 annual investment allowance (D139) = Schedule Q1",
      "SA103F box 49 annual investment allowance: full return (D139) = short return (D80)",
    ],
  ],
  [
    "D144",
    1000,
    [
      TOTAL_CAPITAL_ALLOWANCES,
      "SA103F box 50 capital allowances at 18% (D144) = Schedule R1",
      "SA103F box 50 capital allowances at 18% (D144) = the scenario's opening tax written-down values at the year's writing down rate",
    ],
  ],
  ["D147", 4000, [TOTAL_CAPITAL_ALLOWANCES, "SA103F box 51 capital allowances at 6% (D147) is nil"]],
  ["D152", 4000, [TOTAL_CAPITAL_ALLOWANCES]],
  ["D156", 4000, [TOTAL_CAPITAL_ALLOWANCES]],
  ["D160", 4000, [TOTAL_CAPITAL_ALLOWANCES]],
  ["O139", 4000, [TOTAL_CAPITAL_ALLOWANCES]],
  [
    "O144",
    1000,
    [
      TOTAL_CAPITAL_ALLOWANCES,
      "SA103F box 55 100% and other enhanced capital allowances (O144) = Schedule S1 while the small pool balance is under £1,000",
      "SA103F box 55 100% and other enhanced capital allowances: full return (O144) = short return (D85)",
    ],
  ],
  ["O149", 9500, [TOTAL_CAPITAL_ALLOWANCES, "SA103F box 56 allowances on sale or cessation (O149) = Schedule Y1"]],
  [
    "O154",
    45000,
    [
      TOTAL_CAPITAL_ALLOWANCES,
      TOTAL_DEDUCTIONS,
      "SA103F box 57 total capital allowances (O154) = the short return's allowance boxes 23, 24 and 25",
    ],
  ],
  [
    "O160",
    1000,
    [
      TOTAL_ADDITIONS,
      "SA103F box 59 balancing charge (O160) = Schedule Z1",
      "SA103F box 59 balancing charge: full return (O160) = short return (O85)",
    ],
  ],
  ["D169", 1000, [TOTAL_ADDITIONS, "SA103F box 60 goods and services for own use: full return (D169) = short return (D94)"]],
  ["D174", 12740, [TOTAL_ADDITIONS, TAXABLE_PROFIT]],
  ["O169", 45000, [TOTAL_DEDUCTIONS, TAXABLE_PROFIT]],
  [
    "O174",
    143632.058333333,
    [TAXABLE_PROFIT, ADJUSTED_PROFIT, "SA103F box 64 net business profit for tax purposes: full return (O174) = short return (D99)"],
  ],
  ["O179", 1000, ["SA103F box 65 net business loss for tax purposes: full return (O179) = short return (O106)"]],
  ["O194", 143632.058333333, [ADJUSTED_PROFIT, TOTAL_TAXABLE_PROFITS]],
  [
    "O199",
    1000,
    [TOTAL_TAXABLE_PROFITS, "SA103F box 74 loss brought forward set against this year: full return (O199) = short return (O94)"],
  ],
  ["O210", 145715.391666666, [TOTAL_TAXABLE_PROFITS, "SA103F box 76 total taxable profits: full return (O210) = short return (D106)"]],
  [
    "D231",
    1000,
    [
      "SA103F box 81 contractor deductions taken off: full return (D231) = short return (O124)",
      "SA103F box 81 contractor deductions taken off (D231) = the year's CIS suffered on the sales journal",
    ],
  ],
  ["Q2", 46753, ["SA103F: the period the return covers starts on the Admin tax year start (Q2 = B4)"]],
  ["V2", 47117, ["SA103F: the period the return covers ends on the Admin tax year end (V2 = B17)"]],
  ["G141", 1000.18, ["SA103F: the writing down allowance rate the return prints (G141) = the Admin rate (G5)"]],
  ["J280", 13570, ["SA103F: the Class 4 threshold the return prints (J280) = the Admin Class 4 lower limit (N20)"]],
  [
    "G1",
    "COPY DETAILS TO HMRC FORM          Submit HMRC RETURN ONLINE                   by 31st January 1900",
    ["SA103F: the online filing deadline banner (G1) names 31 January the year after the tax year ends"],
  ],
];

describeCalc("SA103F checks catch a broken full return", () => {
  let results;
  let checks;
  let taxData;
  let expected;
  let savedDir;

  function checksWithCorruptedCell(resultKey, cellRef, value) {
    const corrupted = { ...results, [resultKey]: { ...results[resultKey], [cellRef]: value } };
    return seCheckCompliance(corrupted, expected, taxData, calculateExpectedTax);
  }

  beforeAll(async () => {
    taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(SE_DIR, "meta.toml"), "utf8"));

    const fileBuffers = {};
    for (const templateFile of productMeta.template.files) {
      const templateBuffer = readFileSync(resolve(SE_DIR, templateFile));
      const fileKey = templateFile.replace(".xlsx", "").toLowerCase();
      const sheetsConfig = productMeta.sheets?.[fileKey];
      fileBuffers[templateFile] =
        sheetsConfig && Object.keys(sheetsConfig).length > 0
          ? await generateSpreadsheet(templateBuffer, taxData, sheetsConfig)
          : templateBuffer;
    }

    const scenario = loadScenario(resolve(FIXTURES_DIR, "se-scenario-advanced.toml"));
    expected = { ...scenario, ...scenario.expected };

    savedDir = mkdtempSync(join(tmpdir(), "se-full-return-checks-"));
    results = await runMultiFileSpreadsheet(
      fileBuffers,
      seCellWrites(scenario, seTaxYearStart(taxData)),
      seReads(),
      "Financialaccounts.xlsx",
      {
        ...seOptions(),
        saveRecalculatedTo: savedDir,
      },
    );
    checks = seCheckCompliance(results, expected, taxData, calculateExpectedTax);
  }, 300000);

  afterAll(() => {
    if (savedDir) rmSync(savedDir, { recursive: true, force: true });
  });

  it("reads the SE Full sheet at all -- a prerequisite every check below depends on", () => {
    expect(results["SE Full"]).toBeDefined();
    expect(results["SE Full"].D55).toBeGreaterThan(0);
  });

  it("passes every SA103F check on the intact book", () => {
    const sa103f = checks.filter((c) => c.name.startsWith("SA103F"));
    expect(sa103f.length).toBeGreaterThan(0);
    for (const check of sa103f) {
      expect(check.pass, `${check.name}: expected ${check.expected}, actual ${check.actual}`).toBe(true);
    }
  });

  it("carries a figure on every box the scenario reaches, so those checks are not a nil against a nil", () => {
    for (const cell of SA103F_BOXES_WITH_A_FIGURE) {
      expect(Math.abs(results["SE Full"][cell]), `SE Full!${cell} was nil`).toBeGreaterThan(0);
    }
  });

  it("covers every SA103F check with at least one corruption", () => {
    const asserted = new Set(SA103F_CORRUPTIONS.flatMap(([, , failures]) => failures));
    const missing = checks
      .filter((c) => c.name.startsWith("SA103F") && c.severity !== "warning" && !asserted.has(c.name))
      .map((c) => c.name);
    expect(missing).toEqual([]);
  });

  it.each(SA103F_CORRUPTIONS)(
    "corrupting SE Full!%s via JSZip fails exactly the checks that read it",
    async (cellRef, corruptedValue, expectedFailures) => {
      for (const name of expectedFailures) {
        expect(checks.find((c) => c.name === name)?.pass, `${name} was already failing`).toBe(true);
      }

      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "SE Full", cellRef, corruptedValue);
      expect(value).toBe(corruptedValue);
      expect(failureNames(checksWithCorruptedCell("SE Full", cellRef, value))).toEqual(expectedFailures);
    },
  );
});

// ── The shipped SE Short sheet ──────────────────────────────────────────────
//
// The SA103S look-alike prints its box numbers as literals in columns A and L
// and gates its expense analysis on the VAT threshold. Both are in the
// template as saved, so this half reads the file rather than recalculating it.

// The 2026 form's numbering, cell by cell. Boxes 1 to 7 are the business
// details; box 8 is the traditional-accounting tick the sheet has no cell
// for, so the sheet jumps from 7 to 9.
const SE_SHORT_BOX_CELLS = {
  A12: 1,
  A20: 2,
  A24: 3,
  L12: 4,
  L17: 5,
  L23: 6,
  L28: 7,
  A35: 9,
  L35: 10,
  A44: 11,
  A48: 12,
  A53: 13,
  A57: 14,
  A62: 15,
  L44: 16,
  L48: 17,
  L53: 18,
  L57: 19,
  L62: 20,
  A68: 21,
  L68: 22,
  A78: 23,
  A82: 24,
  L78: 25,
  L82: 26,
  A91: 27,
  A96: 28,
  L91: 29,
  L96: 30,
  A103: 31,
  L103: 32,
  A111: 33,
  A116: 34,
  A121: 35,
  L111: 36,
  L116: 37,
  L121: 38,
};

// The nine expense cells, and the note above them, each gated on the
// threshold rather than on a figure of its own.
const SE_SHORT_GATED_CELLS = ["D46", "O46", "D51", "O51", "D55", "O55", "D60", "O60", "D64", "A33"];

// Every caption on the sheet that names a box number.
const SE_SHORT_CAPTIONS = {
  N35: "Any other business income not included in box 9",
  A42: "you may just put your total expenses in box 20, rather than filling in the whole section.",
  N62: "Total allowable expenses - total of boxes 11 to 19",
  C69: "expenses (box 9 + box 10 minus box 20)",
  N69: "income (box 9 + box 10 minus box 20 is negative)",
  N92: "this year's profits - up to the amount in box 28",
  C96: "Net business profit for tax purposes (if box 21 + box 26 +",
  C97: "box 27 minus boxes 22 to 25) is positive)",
  N96: "Any other business income not included in boxes 9 or 10",
  N103: "Net business loss for tax purposes (if boxes 22 to 25",
  C104: "if box 28 + box 30 minus box 29 is positive",
  N104: "minus (box 21 + box 26 + box 27) is positive)",
  A109: "If you have made a loss for tax purposes (box 32), read page SESN 7 of the notes and fill in boxes 33 to 35 as appropriate.",
};

function formulaAt(xml, cellRef) {
  const cell = xml.match(new RegExp(`<c\\s+r="${cellRef}"(?=[\\s/>])[^>]*>.*?</c>`, "s"));
  if (!cell) throw new Error(`SE Short!${cellRef} not found`);
  const formula = cell[0].match(/<f[^>]*>(.*?)<\/f>/s);
  if (!formula) throw new Error(`SE Short!${cellRef} carries no formula`);
  return formula[1].replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
}

describe("the shipped SE Short sheet", () => {
  let xml;
  let sharedStrings;

  beforeAll(async () => {
    const zip = await JSZip.loadAsync(readFileSync(resolve(SE_DIR, "Financialaccounts.xlsx")));
    const sheetMap = await buildSheetMap(zip);
    sharedStrings = await loadSharedStrings(zip);
    xml = await zip.file(sheetMap.get("SE Short")).async("string");
  });

  it("prints the 2026 SA103S box numbers", () => {
    for (const [cell, box] of Object.entries(SE_SHORT_BOX_CELLS)) {
      expect(readCellValue(xml, cell, sharedStrings), `SE Short!${cell}`).toBe(box);
    }
  });

  it("numbers its boxes once each, 1 to 7 and 9 to 38", () => {
    const printed = Object.values(SE_SHORT_BOX_CELLS).sort((a, b) => a - b);
    const expected = [1, 2, 3, 4, 5, 6, 7];
    for (let box = 9; box <= 38; box++) expected.push(box);
    expect(printed).toEqual(expected);
  });

  it("gates the expense analysis and the turnover note on Admin!F26", () => {
    for (const cell of SE_SHORT_GATED_CELLS) {
      expect(formulaAt(xml, cell), `SE Short!${cell}`).toContain("Admin!F26");
    }
    expect(xml).not.toContain("30000");
    expect(xml).not.toContain("67000");
  });

  it("prints captions that name the boxes beside them", () => {
    for (const [cell, caption] of Object.entries(SE_SHORT_CAPTIONS)) {
      expect(readCellValue(xml, cell, sharedStrings), `SE Short!${cell}`).toBe(caption);
    }
  });
});
