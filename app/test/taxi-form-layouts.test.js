// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// taxi-form-layouts.test.js — proves app/data/hmrc/form-layouts/taxi.json
// against the form it prints and the workbook it reads: the 2026 SA103S box
// list box for box, every cell it names a CELL_MAP SE Short cell that exists
// on the shipped template, every CELL_MAP SE Short row named by exactly one
// box, and every derived rule either a resolver the forms module declares or
// a Profit & Loss Account pattern over cells CELL_MAP carries.

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { buildSheetMap } from "../lib/xlsx-parts.js";
import { parseCells } from "../lib/template-formula-map.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

const layout = JSON.parse(readFileSync(resolve(REPO_ROOT, "app", "data", "hmrc", "form-layouts", "taxi.json"), "utf8"));
const sa103s = layout.forms.sa103s;
const taxiSource = readFileSync(resolve(REPO_ROOT, "app", "products", "taxi.js"), "utf8");

// The CELL_MAP array literal, read as source text rather than importing and
// executing the module — the same approach se-form-layouts.test.js takes, so
// this test needs nothing from the product module beyond its cells.
function cellMapCells(sheetName) {
  const start = taxiSource.indexOf("export const CELL_MAP = [");
  const end = taxiSource.indexOf("\n];", start);
  const block = taxiSource.slice(start, end);
  const cells = new Set();
  const lineRe = /\[(?:"([^"]+)"|(TAX_SHEET)|(FORECAST_SHEET)),\s*"([A-Z]+\d+)"/g;
  let m;
  while ((m = lineRe.exec(block))) {
    const [, literalSheet, taxSheet, forecastSheet, cell] = m;
    const sheet = literalSheet || (taxSheet && "Draft Tax calculation") || (forecastSheet && "Wages Forecast");
    if (sheet === sheetName) cells.add(cell);
  }
  return cells;
}

const seShortCellMapCells = cellMapCells("SE Short");
const plCellMapCells = cellMapCells("Profit & Loss Acc");

const boxes = sa103s.sections.flatMap((section) => section.boxes);

// The forms module is a classic script that assigns one global, so it is
// evaluated for its side effect and read back off globalThis. It must reach
// neither fetch nor document at load: this environment has no document at
// all, and a layout fetch here would resolve against nothing.
const globalsBefore = new Set(Object.keys(globalThis));
await import(resolve(REPO_ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public", "books", "products", "taxi-forms.js"));
const globalsAfter = Object.keys(globalThis).filter((key) => !globalsBefore.has(key));
const forms = globalThis.DiyaGlTaxiForms;

let seShortSheetCells;

beforeAll(async () => {
  const buf = readFileSync(resolve(REPO_ROOT, "app", "templates", "taxi", "taxi-excel.xlsx"));
  const zip = await JSZip.loadAsync(buf);
  const sheetMap = await buildSheetMap(zip);
  const path = sheetMap.get(sa103s.sheet);
  expect(path, `sheet "${sa103s.sheet}" is not on the template`).toBeTruthy();
  seShortSheetCells = parseCells(await zip.file(path).async("string"));
});

describe("the 2026 SA103S box list", () => {
  it("is exactly 9, 10, 10.1, 11 to 20, 21, 22, 23, 24, 24.1, 25, 25.1, 25.2, 26 to 38, in that order", () => {
    expect(boxes.map((box) => box.box)).toEqual([
      "9",
      "10",
      "10.1",
      "11",
      "12",
      "13",
      "14",
      "15",
      "16",
      "17",
      "18",
      "19",
      "20",
      "21",
      "22",
      "23",
      "24",
      "24.1",
      "25",
      "25.1",
      "25.2",
      "26",
      "27",
      "28",
      "29",
      "30",
      "31",
      "32",
      "33",
      "34",
      "35",
      "36",
      "37",
      "38",
    ]);
  });

  it("gives every box a label, and either a cell, a derived rule or neither, never both", () => {
    for (const box of boxes) {
      expect(box.label, `box ${box.box} carries no label`).toBeTruthy();
      expect(Object.prototype.hasOwnProperty.call(box, "cell"), `box ${box.box} declares no cell`).toBe(true);
      expect(box.cell === null || !box.derived, `box ${box.box} carries both a cell and a derived rule`).toBe(true);
    }
  });
});

describe("every cell the layout names", () => {
  const cellBoxes = boxes.filter((box) => box.cell);

  it("is a bare A1 reference on the form's own sheet", () => {
    expect(cellBoxes).toHaveLength(13);
    for (const box of cellBoxes) expect(box.cell, `box ${box.box}`).toMatch(/^[A-Z]+\d+$/);
  });

  it("is a CELL_MAP SE Short cell", () => {
    for (const box of cellBoxes) {
      expect(seShortCellMapCells.has(box.cell), `box ${box.box} (${box.cell}) is not in CELL_MAP`).toBe(true);
    }
  });

  it("exists on the shipped template", () => {
    for (const box of cellBoxes) {
      expect(seShortSheetCells.has(box.cell), `box ${box.box} (${box.cell}) is not on the template`).toBe(true);
    }
  });
});

describe("every CELL_MAP SE Short row is named by exactly one box", () => {
  it("thirteen rows, thirteen boxes", () => {
    const named = boxes.filter((box) => box.cell).map((box) => box.cell);
    expect(new Set(named).size).toBe(named.length);
    expect(seShortCellMapCells.size).toBe(13);
    for (const cell of seShortCellMapCells) {
      expect(named.includes(cell), `SE Short!${cell} is in CELL_MAP but no box names it`).toBe(true);
    }
  });
});

describe("every derived rule", () => {
  const derived = boxes.filter((box) => box.derived).map((box) => box.derived);

  it("is a resolver the forms module declares or a Profit & Loss pattern", () => {
    expect(derived.length).toBeGreaterThan(0);
    for (const rule of derived) {
      const known = forms.DERIVED_NAMES.includes(rule) || /^pl:B\d+$/.test(rule) || /^sum:B\d+(,B\d+)+$/.test(rule);
      expect(known, `derived rule "${rule}" is neither a known name nor a P&L pattern`).toBe(true);
    }
  });

  it("names only Profit & Loss Account cells CELL_MAP carries", () => {
    for (const rule of derived) {
      const cells = rule.startsWith("pl:") ? [rule.slice(3)] : rule.startsWith("sum:") ? rule.slice(4).split(",") : [];
      for (const cell of cells) {
        expect(plCellMapCells.has(cell), `derived rule "${rule}" names Profit & Loss Acc!${cell}, which is not in CELL_MAP`).toBe(true);
      }
    }
  });
});

describe("the forms module", () => {
  it("defines DiyaGlTaxiForms and nothing else on the global", () => {
    expect(globalsAfter).toEqual(["DiyaGlTaxiForms"]);
    expect(Object.keys(forms).sort()).toEqual(["DERIVED_NAMES", "renderSa103s"]);
    expect(forms.DERIVED_NAMES).toEqual(["goodsForResale", "vehicleTravel", "repairs", "totalExpenses"]);
  });
});
