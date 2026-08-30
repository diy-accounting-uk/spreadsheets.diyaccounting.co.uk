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
// Requires: LibreOffice installed (brew install --cask libreoffice)

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

// Overwrites a cell's cached <v> content in place, leaving any <f> formula
// tag untouched -- the way a stale or corrupted cached value would reach a
// reader that only ever sees the last-saved cell. A box the return leaves
// empty holds no cached value to overwrite, so it gets one: the same
// corruption from the other side, a figure appearing in a box that should
// carry nothing.
function corruptCellValue(xml, cellRef, newValue) {
  const cached = new RegExp(`(<c r="${cellRef}"[^>]*>(?:(?!</c>).)*?<v>)([^<]*)(</v>)`, "s");
  if (cached.test(xml)) return xml.replace(cached, (_match, pre, _old, post) => `${pre}${newValue}${post}`);
  const empty = new RegExp(`<c r="${cellRef}"([^>]*?)\\s*/>`, "s");
  if (empty.test(xml))
    return xml.replace(empty, (_match, attrs) => `<c r="${cellRef}"${attrs.replace(/\s+t="[^"]*"/, "")}><v>${newValue}</v></c>`);
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
  "O144",
  "O149",
  "D174",
  "O169",
  "O174",
  "O194",
  "O204",
  "O210",
];

// Each corruption and the exact set of checks it must flip.
const SA103F_CORRUPTIONS = [
  [
    "D55",
    340200,
    [
      "SA103F box 14 turnover (D55) = the profit and loss account",
      "SA103F box 46 net profit (D129) = boxes 14 and 15 less box 30",
      "SA103F box 14 turnover: full return (D55) = short return (D38)",
    ],
  ],
  [
    "O55",
    1000,
    [
      "SA103F box 15 other business income (O55) = the profit and loss account",
      "SA103F box 46 net profit (D129) = boxes 14 and 15 less box 30",
      "SA103F box 15 other business income: full return (O55) = short return (O38)",
    ],
  ],
  ["D66", 14470, ["SA103F box 16 goods bought for resale (D66) = the profit and loss account"]],
  ["D70", 7666.66666666667, ["SA103F box 17 subcontractor payments (D70) = the profit and loss account"]],
  [
    "D74",
    93735.7333333333,
    [
      "SA103F box 18 wages, salaries and staff costs (D74) = the profit and loss account",
      "SA103F box 18 wages, salaries and staff costs: full return (D74) = short return (D55)",
    ],
  ],
  [
    "D78",
    8881.875,
    [
      "SA103F box 19 car, van and travel expenses (D78) = the profit and loss account",
      "SA103F box 19 car, van and travel expenses: full return (D78) = short return (D51)",
    ],
  ],
  [
    "D82",
    14200,
    [
      "SA103F box 20 rent, rates, power and insurance (D82) = the profit and loss account",
      "SA103F box 20 rent, rates, power and insurance: full return (D82) = short return (D60)",
    ],
  ],
  [
    "D86",
    1950,
    [
      "SA103F box 21 repairs and renewals (D86) = the profit and loss account",
      "SA103F box 21 repairs and renewals: full return (D86) = short return (D64)",
    ],
  ],
  [
    "D90",
    4035,
    [
      "SA103F box 22 telephone, stationery and office costs (D90) = the profit and loss account",
      "SA103F box 22 telephone, stationery and office costs: full return (D90) = short return (O55)",
    ],
  ],
  ["D94", 4800, ["SA103F box 23 advertising and entertainment (D94) = the profit and loss account"]],
  ["D98", 1000, ["SA103F box 24 interest on bank and other loans (D98) = the profit and loss account"]],
  ["D102", 1800, ["SA103F box 25 bank, credit card and finance charges (D102) = the profit and loss account"]],
  ["D106", 700, ["SA103F box 26 irrecoverable debts written off (D106) = the profit and loss account"]],
  [
    "D110",
    7925,
    [
      "SA103F box 27 accountancy, legal and professional fees (D110) = the profit and loss account",
      "SA103F box 27 accountancy, legal and professional fees: full return (D110) = short return (O46)",
    ],
  ],
  ["D114", 12912, ["SA103F box 28 depreciation and loss on sale of assets (D114) = the profit and loss account"]],
  ["D118", 4231.666666666661, ["SA103F box 29 other business expenses (D118) = the profit and loss account"]],
  [
    "D122",
    165307.941666667,
    [
      "SA103F box 30 total expenses (D122) = the profit and loss account",
      "SA103F box 46 net profit (D129) = boxes 14 and 15 less box 30",
      "SA103F box 30 total expenses (D122) = the short return's total expenses with box 45 disallowable depreciation added back",
    ],
  ],
  ["O114", 12740, ["SA103F box 43 disallowable depreciation (O114) = the profit and loss account"]],
  [
    "O122",
    12740,
    [
      "SA103F box 45 total disallowable expenses (O122) = the profit and loss account",
      "SA103F box 60 total additions to net profit (D174) = boxes 45, 57, 58 and 59",
      "SA103F box 30 total expenses (D122) = the short return's total expenses with box 45 disallowable depreciation added back",
      "SA103F box 46 net profit (D129) = the short return's net profit less box 45 disallowable depreciation",
    ],
  ],
  [
    "O204",
    3083.33333333333,
    [
      "SA103F box 74 other business income (O204) = the profit and loss account",
      "SA103F box 75 total taxable profits (O210) = box 72 less box 73 plus box 74",
      "SA103F box 74 other business income: full return (O204) = short return (O99)",
    ],
  ],
  [
    "D129",
    175892.058333333,
    [
      "SA103F box 46 net profit (D129) = boxes 14 and 15 less box 30",
      "SA103F box 63 net business profit for tax purposes (O174) = box 46 or box 47, plus box 60, less box 62",
      "SA103F box 46 net profit (D129) = the short return's net profit less box 45 disallowable depreciation",
    ],
  ],
  ["O129", 1000, ["SA103F box 47 net loss: full return (O129) = short return (O71)"]],
  [
    "D139",
    33500,
    [
      "SA103F box 56 total capital allowances (O149) = boxes 48 to 55",
      "SA103F box 48 annual investment allowance (D139) = Schedule Q1",
      "SA103F box 48 annual investment allowance: full return (D139) = short return (D80)",
    ],
  ],
  [
    "D144",
    1000,
    [
      "SA103F box 56 total capital allowances (O149) = boxes 48 to 55",
      "SA103F box 49 writing down allowances (D144) = Schedule R1",
      "SA103F box 49 writing down allowances (D144) = the scenario's opening tax written-down values at the Admin writing down rate",
    ],
  ],
  [
    "D152",
    4000,
    [
      "SA103F box 56 total capital allowances (O149) = boxes 48 to 55",
      "SA103F box 51 restricted car allowances (D152) is nil",
    ],
  ],
  [
    "O139",
    1000,
    [
      "SA103F box 56 total capital allowances (O149) = boxes 48 to 55",
      "SA103F box 54 enhanced and other capital allowances (O139) = Schedule S1 while the small pool balance is under £1,000",
      "SA103F box 54 enhanced and other capital allowances: full return (O139) = short return (D85)",
    ],
  ],
  [
    "O144",
    9500,
    [
      "SA103F box 56 total capital allowances (O149) = boxes 48 to 55",
      "SA103F box 55 allowances on sale or cessation (O144) = Schedule Y1",
    ],
  ],
  [
    "O149",
    45000,
    [
      "SA103F box 56 total capital allowances (O149) = boxes 48 to 55",
      "SA103F box 62 total deductions from net profit (O169) = boxes 56 and 61",
      "SA103F box 56 total capital allowances (O149) = the short return's allowance boxes 22, 23 and 24",
    ],
  ],
  [
    "O160",
    1000,
    [
      "SA103F box 60 total additions to net profit (D174) = boxes 45, 57, 58 and 59",
      "SA103F box 58 balancing charge (O160) = Schedule Z1",
      "SA103F box 58 balancing charge: full return (O160) = short return (O85)",
    ],
  ],
  [
    "D169",
    1000,
    [
      "SA103F box 60 total additions to net profit (D174) = boxes 45, 57, 58 and 59",
      "SA103F box 59 goods and services for own use: full return (D169) = short return (D94)",
    ],
  ],
  [
    "D174",
    12740,
    [
      "SA103F box 60 total additions to net profit (D174) = boxes 45, 57, 58 and 59",
      "SA103F box 63 net business profit for tax purposes (O174) = box 46 or box 47, plus box 60, less box 62",
    ],
  ],
  [
    "O169",
    45000,
    [
      "SA103F box 62 total deductions from net profit (O169) = boxes 56 and 61",
      "SA103F box 63 net business profit for tax purposes (O174) = box 46 or box 47, plus box 60, less box 62",
    ],
  ],
  [
    "O174",
    143632.058333333,
    [
      "SA103F box 63 net business profit for tax purposes (O174) = box 46 or box 47, plus box 60, less box 62",
      "SA103F box 72 adjusted profit (O194) = box 63",
      "SA103F box 63 net business profit for tax purposes: full return (O174) = short return (D99)",
    ],
  ],
  ["O179", 1000, ["SA103F box 64 net business loss for tax purposes: full return (O179) = short return (O106)"]],
  [
    "O194",
    143632.058333333,
    ["SA103F box 72 adjusted profit (O194) = box 63", "SA103F box 75 total taxable profits (O210) = box 72 less box 73 plus box 74"],
  ],
  [
    "O199",
    1000,
    [
      "SA103F box 75 total taxable profits (O210) = box 72 less box 73 plus box 74",
      "SA103F box 73 loss brought forward set against this year: full return (O199) = short return (O94)",
    ],
  ],
  [
    "O210",
    145715.391666666,
    [
      "SA103F box 75 total taxable profits (O210) = box 72 less box 73 plus box 74",
      "SA103F box 75 total taxable profits: full return (O210) = short return (D106)",
    ],
  ],
  ["D231", 1000, ["SA103F box 80 contractor deductions taken off: full return (D231) = short return (O124)"]],
  ["Q2", 46753, ["SA103F: the period the return covers starts on the Admin tax year start (Q2 = B4)"]],
  ["V2", 47117, ["SA103F: the period the return covers ends on the Admin tax year end (V2 = B17)"]],
  ["H136", 1001, ["SA103F: the annual investment allowance rate the return prints (H136) = the Admin rate (G4)"]],
  ["G141", 1000.18, ["SA103F: the writing down allowance rate the return prints (G141) = the Admin rate (G5)"]],
  ["J280", 13570, ["SA103F: the Class 4 threshold the return prints (J280) = the Admin personal allowance (N4)"]],
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
    results = await runMultiFileSpreadsheet(fileBuffers, seCellWrites(scenario), seReads(), "Financialaccounts.xlsx", {
      ...seOptions(),
      saveRecalculatedTo: savedDir,
    });
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
