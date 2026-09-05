// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// se-form-layouts.test.js — proves app/data/hmrc/form-layouts/se.json: every
// SA103S and SA103F cell it names is either a CELL_MAP row or a real cell on
// the shipped template, every CELL_MAP SE Short and SE Full row is named by
// one box, box numbers run unique and ascending within each form, and the
// 2026 SA103S box list is exactly the one the form prints.

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { buildSheetMap } from "../lib/xlsx-parts.js";
import { parseCells } from "../lib/template-formula-map.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

const layout = JSON.parse(readFileSync(resolve(REPO_ROOT, "app", "data", "hmrc", "form-layouts", "se.json"), "utf8"));
const seSource = readFileSync(resolve(REPO_ROOT, "app", "products", "se.js"), "utf8");

// The CELL_MAP array literal, read as source text rather than importing and
// executing the module -- the same approach app/test/sa103-mtd-mapping.test.js
// takes, so this test needs nothing from the product module beyond its cells.
function allCellMapCells(sheetName) {
  const start = seSource.indexOf("export const CELL_MAP = [");
  const end = seSource.indexOf("\n];", start);
  const block = seSource.slice(start, end);
  const cells = new Set();
  // A row's sheet is either a quoted literal ("SE Short") or one of the two
  // symbols the source declares beside CELL_MAP (TAX_SHEET = "Income Tax",
  // FORECAST_SHEET = "Profit Forecast").
  const lineRe = /\[(?:"([^"]+)"|(TAX_SHEET)|(FORECAST_SHEET)),\s*"([A-Z]+\d+)"/g;
  let m;
  while ((m = lineRe.exec(block))) {
    const [, literalSheet, taxSheet, forecastSheet, cell] = m;
    const sheet = literalSheet || (taxSheet && "Income Tax") || (forecastSheet && "Profit Forecast");
    if (sheet === sheetName) cells.add(cell);
  }
  return cells;
}

const seShortCellMapCells = allCellMapCells("SE Short");
const seFullCellMapCells = allCellMapCells("SE Full");

// "<file>!<sheet>!<cell>" -> { sheet, cell }, the sheet name stripped of the
// hub file prefix the layout carries even on a hub sheet.
function parseRef(ref) {
  const idx = ref.lastIndexOf("!");
  const cell = ref.slice(idx + 1);
  const sheetPart = ref.slice(0, idx);
  const sheet = sheetPart.startsWith("Financialaccounts.xlsx!") ? sheetPart.slice("Financialaccounts.xlsx!".length) : sheetPart;
  return { sheet, cell };
}

// Every box in a form, its own section boxes flattened, plus any rule's
// referenced cells (a rule's "#N" entries name a sibling box, not a cell).
function flattenBoxes(form) {
  const out = [];
  for (const section of form.sections) {
    for (const box of section.boxes) {
      out.push(box);
      if (box.rule) {
        for (const ref of box.rule.cells) {
          if (ref.charAt(0) !== "#") out.push({ box: box.box + " (rule)", cell: ref });
        }
      }
    }
  }
  return out;
}

let seShortSheetCells;
let seFullSheetCells;

beforeAll(async () => {
  const buf = readFileSync(resolve(REPO_ROOT, "app", "templates", "se", "Financialaccounts.xlsx"));
  const zip = await JSZip.loadAsync(buf);
  const sheetMap = await buildSheetMap(zip);
  async function cellsOf(sheetName) {
    const path = sheetMap.get(sheetName);
    expect(path, `sheet "${sheetName}" is not on the template`).toBeTruthy();
    const xml = await zip.file(path).async("string");
    return parseCells(xml);
  }
  seShortSheetCells = await cellsOf("SE Short");
  seFullSheetCells = await cellsOf("SE Full");
});

describe("every SA103S and SA103F cell the layout names is in CELL_MAP or exists on the template", () => {
  it("SA103S", () => {
    const boxes = flattenBoxes(layout.forms.sa103s).filter((b) => b.cell);
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) {
      const { sheet, cell } = parseRef(box.cell);
      expect(sheet).toBe("SE Short");
      const inCellMap = seShortCellMapCells.has(cell);
      const onTemplate = seShortSheetCells.has(cell);
      expect(inCellMap || onTemplate, `SA103S box ${box.box} (${box.cell}) is in neither CELL_MAP nor the template`).toBe(true);
    }
  });

  it("SA103F", () => {
    const boxes = flattenBoxes(layout.forms.sa103f).filter((b) => b.cell && parseRef(b.cell).sheet === "SE Full");
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) {
      const { cell } = parseRef(box.cell);
      const inCellMap = seFullCellMapCells.has(cell);
      const onTemplate = seFullSheetCells.has(cell);
      expect(inCellMap || onTemplate, `SA103F box ${box.box} (${box.cell}) is in neither CELL_MAP nor the template`).toBe(true);
    }
  });

  it("the SA103F balance sheet's leaf-file cells are declared, not asserted against this template", () => {
    // Fixedassets.xlsx, Sales.xlsx, Bank.xlsx, Cash.xlsx and Purchases.xlsx
    // are separate workbooks this test does not open; the boxes reading
    // them directly (not through a rule) are 83, 85 to 88 and 91.
    const leafBoxes = [];
    for (const section of layout.forms.sa103f.sections) {
      for (const box of section.boxes) {
        if (box.cell && parseRef(box.cell).sheet !== "SE Full") leafBoxes.push(box.box);
      }
    }
    expect(leafBoxes.sort()).toEqual(["83", "85", "86", "87", "88", "91"]);
  });
});

describe("every CELL_MAP SE Short and SE Full row is named by one box", () => {
  it("SE Short", () => {
    const layoutCells = new Set(flattenBoxes(layout.forms.sa103s).filter((b) => b.cell).map((b) => parseRef(b.cell).cell));
    for (const cell of seShortCellMapCells) {
      // Business Details rows (C8, S17) and the turnover note (A33) are not
      // pound boxes; the form layout has nothing to name them with.
      if (["C8", "S17", "A33"].includes(cell)) continue;
      expect(layoutCells.has(cell), `SE Short!${cell} is in CELL_MAP but no SA103S box names it`).toBe(true);
    }
  });

  it("SE Full", () => {
    const layoutCells = new Set(flattenBoxes(layout.forms.sa103f).filter((b) => b.cell && parseRef(b.cell).sheet === "SE Full").map((b) => parseRef(b.cell).cell));
    for (const cell of seFullCellMapCells) {
      expect(layoutCells.has(cell), `SE Full!${cell} is in CELL_MAP but no SA103F box names it`).toBe(true);
    }
  });
});

describe("box numbers are unique and ascending within a form", () => {
  function boxNumbersOf(form) {
    const out = [];
    for (const section of form.sections) for (const box of section.boxes) out.push(box.box);
    return out;
  }

  function assertUniqueAscending(boxNumbers) {
    const seen = new Set();
    let previous = -Infinity;
    for (const box of boxNumbers) {
      expect(seen.has(box), `box ${box} is repeated`).toBe(false);
      seen.add(box);
      const value = parseFloat(box);
      expect(value, `box ${box} does not sort after ${previous}`).toBeGreaterThan(previous);
      previous = value;
    }
  }

  it("SA103S", () => assertUniqueAscending(boxNumbersOf(layout.forms.sa103s)));
  it("SA103F", () => assertUniqueAscending(boxNumbersOf(layout.forms.sa103f)));
  it("VAT", () => assertUniqueAscending(layout.forms.vat.boxes.map((b) => b.box)));
});

describe("the 2026 SA103S list is exactly 9, 10, 10.1, 11 to 20, 21, 22, 23, 24, 24.1, 25, 25.1, 25.2, 26 to 38", () => {
  it("matches box for box", () => {
    const expected = [
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
    ];
    const actual = [];
    for (const section of layout.forms.sa103s.sections) for (const box of section.boxes) actual.push(box.box);
    expect(actual).toEqual(expected);
  });
});

describe("the layout's own shape", () => {
  it("every box carries exactly one of cell or rule, and cell is null only where notInUse is not set without a reason", () => {
    for (const formName of ["sa103s", "sa103f"]) {
      for (const section of layout.forms[formName].sections) {
        for (const box of section.boxes) {
          const hasCell = Object.prototype.hasOwnProperty.call(box, "cell");
          const hasRule = Object.prototype.hasOwnProperty.call(box, "rule");
          expect(hasCell !== hasRule, `${formName} box ${box.box} carries cell=${hasCell} rule=${hasRule}`).toBe(true);
        }
      }
    }
  });

  it("a rule's own cells are fully-qualified references or a sibling box reference", () => {
    for (const formName of ["sa103s", "sa103f"]) {
      for (const section of layout.forms[formName].sections) {
        for (const box of section.boxes) {
          if (!box.rule) continue;
          expect(box.rule.why, `${formName} box ${box.box}'s rule carries no why`).toBeTruthy();
          for (const ref of box.rule.cells) {
            if (ref.charAt(0) === "#") continue;
            expect(ref.split("!").length).toBeGreaterThanOrEqual(2);
          }
        }
      }
    }
  });
});

describe("the computation follows the SA110 working sheet's own cells", () => {
  it("every line with a cell names an Income Tax CELL_MAP cell", () => {
    const incomeTaxCells = allCellMapCells("Income Tax");
    for (const line of layout.forms.computation.lines) {
      if (!line.cell) continue;
      const { sheet, cell } = parseRef(line.cell);
      expect(sheet).toBe("Income Tax");
      expect(incomeTaxCells.has(cell), `computation line "${line.ref}" (${line.cell}) is not in Income Tax's CELL_MAP`).toBe(true);
    }
  });
});

describe("the VAT block names its file once and its boxes carry the bare cell", () => {
  it("every box's cell is a bare A1 reference, not a full reference key", () => {
    for (const box of layout.forms.vat.boxes) {
      if (!box.cell) continue;
      expect(box.cell).toMatch(/^[A-Z]+\d+$/);
    }
  });
});
