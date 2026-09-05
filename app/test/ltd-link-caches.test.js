// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// The Limited Company package is thirteen workbooks that read each other
// across external links, and each reading workbook keeps a cached copy of
// every leaf cell it reads. A cache is only as good as the figure behind it,
// so the calculator has to hold a value for every leaf cell any link
// addresses. These tests hold it to that.
//
// app/test/fixtures/ltd-link-cells.json pins the addressed list itself, so a
// template change that moves a link fails here by name rather than showing up
// later as a cache nobody refreshed.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";
import { buildSheetMap, loadSharedStrings, readCellValue } from "../lib/spreadsheet-runner.js";
import { ltdAdminBColumnSerial } from "../lib/generator.js";
import { canonicalValue } from "../lib/report-serializer.js";
import { calculateLtdCells, calculateLtdResults } from "../lib/calculators/ltd.js";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { BANK_ACCOUNT_FILES, BANK_LAYOUTS, nextColumn } from "../lib/ltd-layout.js";
import * as ltd from "../products/ltd.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const TEMPLATES = resolve(ROOT, "app", "templates", "ltd");

async function firstTabOf(fileName) {
  const zip = await JSZip.loadAsync(readFileSync(resolve(TEMPLATES, fileName)));
  const sheetMap = await buildSheetMap(zip);
  const sharedStrings = await loadSharedStrings(zip);
  const xml = await zip.file(sheetMap.get([...sheetMap.keys()][0])).async("string");
  return (cellRef) => readCellValue(xml, cellRef, sharedStrings);
}

// Row 5 of a bank month tab names the code letter each analysis column
// totals, so it is the template's own statement of the layout row 1 is
// written against. The order the four transfer codes take across it is not
// the order BANK_TRANSFER_CODES declares them in, which is what this catches.
describe("the bank layouts match row 5 of the four templates", () => {
  // The analysis block a template declares: every column from the one after
  // the amount column up to the first that names no code.
  function codedRunAfter(cell, amountColumn) {
    const run = [];
    for (let column = nextColumn(amountColumn); ; column = nextColumn(column)) {
      const code = cell(`${column}5`);
      if (code === null) return run;
      run.push([code, column]);
    }
  }

  it.each(Object.values(BANK_ACCOUNT_FILES))("%s", async (fileName) => {
    const cell = await firstTabOf(fileName);
    const layout = BANK_LAYOUTS[fileName];
    // The amount column heads its block and carries no code of its own.
    expect(cell(`${layout.receipt.amount}5`)).toBeNull();
    expect(cell(`${layout.payment.amount}5`)).toBeNull();
    expect(codedRunAfter(cell, layout.receipt.amount)).toEqual(layout.receiptColumns);
    expect(codedRunAfter(cell, layout.payment.amount)).toEqual(layout.paymentColumns);
  });
});

const HUB = "Financialaccounts.xlsx";
const FIXTURE = JSON.parse(readFileSync(resolve(__dirname, "fixtures", "ltd-link-cells.json"), "utf8"));

// The package the roundtrip job runs: the Precision Code year at the March
// year end, written for the tax year the package is generated for.
function precisionCode() {
  const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "precision-code-ltd", "full"), "-P1Y");
  const taxData = parseTOML(readFileSync(resolve(ROOT, "app", "data", "ltd-2024.toml"), "utf8"));
  const scenario = diyaGlToScenario(book, lines, "ltd");
  return {
    scenario,
    cells: calculateLtdCells(book, lines, taxData, scenario),
    report: calculateLtdResults(book, lines, taxData, scenario),
    writes: ltd.cellWrites(scenario, 2024, 3),
  };
}

// Every cell an engine holds, keyed the way a link addresses it: the leaf
// file, the sheet on it, and the cell.
function addressKeys(results) {
  const keys = new Map();
  for (const [key, sheet] of Object.entries(results)) {
    const prefix = key.includes("!") ? key : `${HUB}!${key}`;
    for (const [cell, value] of Object.entries(sheet)) keys.set(`${prefix}!${cell}`, value);
  }
  return keys;
}

// One cell as the sheet XML holds it, self-closing or with a body, or null
// when the sheet does not carry the cell at all.
function cellTag(xml, cell) {
  const selfClosing = xml.match(new RegExp(`<c r="${cell}"[^>]*/>`));
  if (selfClosing) return selfClosing[0];
  const withBody = xml.match(new RegExp(`<c r="${cell}"[^>]*?>[\\s\\S]*?</c>`));
  return withBody ? withBody[0] : null;
}

function writtenKeys(writes) {
  const keys = new Map();
  for (const [file, sheets] of Object.entries(writes)) {
    for (const [sheet, cells] of Object.entries(sheets)) {
      for (const [cell, value] of Object.entries(cells)) keys.set(`${file}!${sheet}!${cell}`, value);
    }
  }
  return keys;
}

describe("every pinned cell is a calculator output, a writer input or a declared blank", () => {
  const run = precisionCode();
  const emitted = addressKeys(run.cells);
  const written = writtenKeys(run.writes);
  const blank = new Map(FIXTURE.blank.map((entry) => [entry.key, entry]));

  it("leaves no addressed cell uncovered", () => {
    expect(FIXTURE.addressed.filter((key) => !emitted.has(key) && !blank.has(key))).toEqual([]);
  });

  it("emits every addressed formula cell", () => {
    expect(FIXTURE.addressed.filter((key) => !blank.has(key)).length).toBe(2105);
    expect(FIXTURE.addressed.filter((key) => !blank.has(key) && emitted.has(key)).length).toBe(2105);
  });

  it("emits an addressed input cell exactly when the writer fills it", () => {
    expect(blank.size).toBe(109);
    const disagreements = [];
    let filled = 0;
    for (const [key, entry] of blank) {
      if (!entry.writer) {
        if (emitted.has(key) || written.has(key)) disagreements.push(`${key}: filled, but the fixture says it never is`);
        continue;
      }
      if (emitted.has(key) !== written.has(key)) {
        disagreements.push(`${key}: emitted ${emitted.has(key)}, written ${written.has(key)}`);
        continue;
      }
      if (!emitted.has(key)) continue;
      filled += 1;
      if (canonicalValue(emitted.get(key)) !== canonicalValue(written.get(key))) {
        disagreements.push(`${key}: emitted ${emitted.get(key)}, written ${written.get(key)}`);
      }
    }
    expect(disagreements).toEqual([]);
    expect(filled).toBe(25);
  });

  it("holds one value for a cell the report and the link cells both carry", () => {
    const reported = addressKeys(run.report);
    expect([...reported].filter(([key, value]) => !Object.is(emitted.get(key), value)).map(([key]) => key)).toEqual([]);
  });

  it("rolls the Admin date chain the way the generator rolls the cached one", () => {
    const yearEnd = run.cells.Admin.B32;
    for (let row = 6; row <= 40; row++) {
      expect([row, run.cells.Admin[`B${row}`]]).toEqual([row, ltdAdminBColumnSerial(yearEnd, row)]);
    }
  });

  it.each([...new Set(FIXTURE.blank.map((entry) => entry.key.split("!")[0]))])("%s leaves its blank cells blank", async (fileName) => {
    const zip = await JSZip.loadAsync(readFileSync(resolve(TEMPLATES, fileName)));
    const sheetMap = await buildSheetMap(zip);
    const sheetXml = new Map();
    const holding = [];
    for (const entry of FIXTURE.blank) {
      const [file, sheet, cell] = entry.key.split("!");
      if (file !== fileName) continue;
      if (!sheetXml.has(sheet)) sheetXml.set(sheet, await zip.file(sheetMap.get(sheet)).async("string"));
      const tag = cellTag(sheetXml.get(sheet), cell);
      if (tag !== null && (tag.includes("<f") || tag.includes("<v>"))) holding.push(`${entry.key}: ${tag}`);
    }
    expect(holding).toEqual([]);
  });
});

describe("the report's cells do not move", () => {
  const run = precisionCode();
  const reported = addressKeys(run.report);

  it("holds 262 of the addressed cells", () => {
    expect(FIXTURE.addressed.filter((key) => reported.has(key)).length).toBe(262);
  });

  it.each([
    ["a bank book's receipts total", "Currentaccount.xlsx!Apr!F1"],
    ["a Sales tab's gross total", "Sales.xlsx!Apr!F1"],
    ["a Purchases tab's gross total", "Purchases.xlsx!Apr!F1"],
    ["a Payslips tab's gross pay", "Payslips.xlsx!Apr!M1"],
    ["the Admin date chain", `${HUB}!Admin!B6`],
    ["a Schedule new-asset allowance", "Fixedassets.xlsx!Schedule!Q67"],
    ["an OpenAccounts opening cost", `${HUB}!OpenAccounts!G13`],
  ])("keeps %s out of the report", (_name, key) => {
    expect(reported.has(key)).toBe(false);
  });
});
