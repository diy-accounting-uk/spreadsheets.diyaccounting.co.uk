// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// sa103-mtd-mapping.test.js — proves app/data/hmrc/sa103-mtd-mapping.json
// covers every SA103 box the SE Full and SE Short CELL_MAP names, every box
// row HMRC's own CSV carries, and that the three caveats the research note
// flags on that CSV (box 69 printed live, stale 2022-23 labels, an
// incomplete SA103S column) land on the entries they touch.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const DATA_DIR = resolve(REPO_ROOT, "app", "data", "hmrc");

const mapping = JSON.parse(readFileSync(resolve(DATA_DIR, "sa103-mtd-mapping.json"), "utf8"));
const csvText = readFileSync(resolve(DATA_DIR, "sa103f_mapping_v3.csv"), "utf8");
const seSource = readFileSync(resolve(REPO_ROOT, "app", "products", "se.js"), "utf8");

// A tiny CSV parser good enough for HMRC's file: every field is
// double-quoted, commas inside a field are quoted, and quotes inside a
// field are doubled ("").
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const csvRows = parseCsv(csvText);
const csvHeader = csvRows[0];
const csvData = csvRows.slice(1);
const BOX_COL = csvHeader.indexOf("Box number");
const LABEL_COL = csvHeader.indexOf("Box name");

// Pull the SE Full / SE Short rows straight out of CELL_MAP's own source
// text, the way the T15 brief asks: parse the "(box N)" suffix off each
// label. Cross-checked against se.js's exports elsewhere in the suite;
// here we read the array literal directly so this test does not need to
// import and execute the whole product module.
function cellMapBoxRows(sheetName) {
  const start = seSource.indexOf("export const CELL_MAP = [");
  const end = seSource.indexOf("\n];", start);
  const block = seSource.slice(start, end);
  const rows = [];
  const lineRe = /\["([^"]+)",\s*"([A-Z]+\d+)",\s*"([^"]*)"/g;
  let m;
  while ((m = lineRe.exec(block))) {
    const [, sheet, cell, label] = m;
    if (sheet !== sheetName) continue;
    const boxMatch = label.match(/\(box ([0-9.]+)\)/);
    if (boxMatch) rows.push({ cell, box: boxMatch[1], label });
  }
  return rows;
}

function allCellMapCells(sheetName) {
  const start = seSource.indexOf("export const CELL_MAP = [");
  const end = seSource.indexOf("\n];", start);
  const block = seSource.slice(start, end);
  const cells = new Set();
  const lineRe = /\["([^"]+)",\s*"([A-Z]+\d+)"/g;
  let m;
  while ((m = lineRe.exec(block))) {
    const [, sheet, cell] = m;
    if (sheet === sheetName) cells.add(cell);
  }
  return cells;
}

describe("every SE Full and SE Short CELL_MAP box has an entry", () => {
  const byFormAndCell = new Map(mapping.boxes.map((b) => [`${b.form}!${b.cell}`, b]));

  it("every SE Full CELL_MAP cell carrying a (box N) label has a SA103F entry for that cell", () => {
    const rows = cellMapBoxRows("SE Full");
    expect(rows.length).toBeGreaterThan(0);
    for (const { cell, box, label } of rows) {
      const entry = byFormAndCell.get(`SA103F!SE Full!${cell}`);
      expect(entry, `SE Full!${cell} (${label}) has no SA103F entry`).toBeTruthy();
      expect(entry.box).toBe(box);
    }
  });

  it("every SE Short CELL_MAP cell carrying a (box N) label has a SA103S entry for that cell", () => {
    const rows = cellMapBoxRows("SE Short");
    expect(rows.length).toBeGreaterThan(0);
    for (const { cell, label } of rows) {
      const entry = byFormAndCell.get(`SA103S!SE Short!${cell}`);
      // se.js's own inline "(box N)" labels on SE Short are off by one
      // against the 2026 form (see the caveats on boxes 22, 25, 26, 29 and
      // 30 below) -- so this proves the cell is covered, not that the
      // entry's box number echoes the label's possibly-wrong number.
      expect(entry, `SE Short!${cell} (${label}) has no SA103S entry`).toBeTruthy();
    }
  });
});

describe("every entry with a cell names a real CELL_MAP cell", () => {
  const seFullCells = allCellMapCells("SE Full");
  const seShortCells = allCellMapCells("SE Short");

  it("every SA103F entry's cell is a real SE Full CELL_MAP cell", () => {
    for (const entry of mapping.boxes.filter((b) => b.form === "SA103F" && b.cell)) {
      const cell = entry.cell.replace("SE Full!", "");
      expect(seFullCells.has(cell), `${entry.cell} (box ${entry.box}) is not in SE Full's CELL_MAP`).toBe(true);
    }
  });

  it("every SA103S entry's cell is a real SE Short CELL_MAP cell", () => {
    for (const entry of mapping.boxes.filter((b) => b.form === "SA103S" && b.cell)) {
      const cell = entry.cell.replace("SE Short!", "");
      expect(seShortCells.has(cell), `${entry.cell} (box ${entry.box}) is not in SE Short's CELL_MAP`).toBe(true);
    }
  });
});

describe("every entry has exactly one of field or reason", () => {
  it("no entry carries both or neither", () => {
    for (const entry of mapping.boxes) {
      const hasField = Object.prototype.hasOwnProperty.call(entry, "field");
      const hasReason = Object.prototype.hasOwnProperty.call(entry, "reason");
      expect(hasField !== hasReason, `${entry.form} box ${entry.box} carries field=${hasField} reason=${hasReason}`).toBe(true);
    }
  });

  it("every reason is one HMRC's mapping actually produced", () => {
    const allowed = new Set(["calculated by HMRC", "no API field", "another API"]);
    for (const entry of mapping.boxes.filter((b) => b.reason)) {
      expect(allowed.has(entry.reason), `${entry.form} box ${entry.box} has an unrecognised reason "${entry.reason}"`).toBe(true);
    }
  });

  it("a field entry always names its route", () => {
    for (const entry of mapping.boxes.filter((b) => b.field)) {
      expect(["quarterly", "annual"]).toContain(entry.route);
    }
  });
});

describe("every CSV row's SA103F box number has an entry", () => {
  it("every unique box number in the CSV's own Box number column has a SA103F entry", () => {
    const csvBoxes = new Set(csvData.map((row) => row[BOX_COL]));
    const jsonBoxes = new Set(mapping.boxes.filter((b) => b.form === "SA103F").map((b) => b.box));
    for (const box of csvBoxes) {
      expect(jsonBoxes.has(box), `CSV box ${box} has no SA103F entry`).toBe(true);
    }
  });

  it("every SA103F entry's label matches a CSV row for that box (or the merged box 0 / box 31 pair)", () => {
    const csvLabelsByBox = new Map();
    for (const row of csvData) {
      const box = row[BOX_COL];
      if (!csvLabelsByBox.has(box)) csvLabelsByBox.set(box, []);
      csvLabelsByBox.get(box).push(row[LABEL_COL]);
    }
    for (const entry of mapping.boxes.filter((b) => b.form === "SA103F")) {
      const labels = csvLabelsByBox.get(entry.box);
      expect(labels, `SA103F box ${entry.box} is not a CSV box`).toBeTruthy();
      if (labels.length === 1) expect(entry.label).toBe(labels[0]);
    }
  });
});

describe("the three caveats are recorded on the entries they touch", () => {
  it("box 69 (overlap relief) carries the 'listed as live' caveat", () => {
    const entry = mapping.boxes.find((b) => b.form === "SA103F" && b.box === "69");
    expect(entry).toBeTruthy();
    expect(entry.caveat).toMatch(/live/i);
    expect(entry.caveat).toMatch(/not in use/i);
  });

  it("the two CSV rows still quoting 2022-23 (boxes 7 and 77) carry that caveat", () => {
    for (const box of ["7", "77"]) {
      const entry = mapping.boxes.find((b) => b.form === "SA103F" && b.box === box);
      expect(entry, `box ${box}`).toBeTruthy();
      expect(entry.caveat, `box ${box}`).toMatch(/2022-23/);
    }
  });

  it("every SA103S entry carries the incomplete-SA103S-column caveat", () => {
    const sa103s = mapping.boxes.filter((b) => b.form === "SA103S");
    expect(sa103s.length).toBeGreaterThan(0);
    for (const entry of sa103s) {
      expect(entry.caveat, `SA103S box ${entry.box}`).toMatch(/SA103S column is incomplete/);
    }
  });
});
