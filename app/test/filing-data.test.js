// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// Structural checks on the Filing data (T19): the CT600 (2026) Version 3 box
// list, the HMRC computation format v1.1 lines and the FRS 105 micro-entity
// accounts headings in app/data/filing/. These files carry the box numbers,
// XBRL tags and sheet cells the Filing phase and the look-alike forms will
// share; the checks here are about the data's own shape, not about what a
// generated workbook computes.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";

import { CELL_MAP, standardReads } from "../products/ltd.js";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILING_DIR = resolve(APP_DIR, "data/filing");

const ct600 = parseTOML(readFileSync(resolve(FILING_DIR, "ct600-v3.toml"), "utf8"));
const computation = parseTOML(readFileSync(resolve(FILING_DIR, "ct-computation-v1.1.toml"), "utf8"));
const frs105 = parseTOML(readFileSync(resolve(FILING_DIR, "frs105-formats.toml"), "utf8"));

// Every cell the product already reads, sheet-qualified as "Sheet!Cell".
// standardReads() folds CELL_MAP into its own output, so the union is the
// same as standardReads() alone; both are checked because the brief names
// both.
function knownCells() {
  const known = new Set();
  for (const [sheet, cell] of CELL_MAP) known.add(`${sheet}!${cell}`);
  for (const [sheet, cells] of Object.entries(standardReads())) {
    for (const cell of cells) known.add(`${sheet}!${cell}`);
  }
  return known;
}

// A sheetCell value looks like "Financialaccounts.xlsx!CT600!AK66", or, for
// a heading the template builds from more than one cell,
// "Financialaccounts.xlsx!MnthP&L!B18+B19+B20". Split off the workbook name
// and return the sheet plus each individual cell reference.
function sheetCellRefs(sheetCell) {
  const parts = sheetCell.split("!");
  const sheet = parts[parts.length - 2];
  const cells = parts[parts.length - 1].split("+");
  return { sheet, cells };
}

describe("filing data", () => {
  it("box numbers are unique and ascending", () => {
    const numbers = ct600.box.map((box) => box.number);
    const ascending = [...numbers].sort((a, b) => a - b);
    expect(numbers).toEqual(ascending);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("every sheetCell names a cell in CELL_MAP or standardReads()", () => {
    const known = knownCells();
    const offenders = [];
    const check = (sheetCell, where) => {
      const { sheet, cells } = sheetCellRefs(sheetCell);
      for (const cell of cells) {
        if (!known.has(`${sheet}!${cell}`)) offenders.push(`${where}: ${sheet}!${cell}`);
      }
    };
    for (const box of ct600.box) if (box.sheetCell) check(box.sheetCell, `ct600-v3.toml box ${box.number}`);
    for (const line of computation.line)
      if (line.sheetCell) check(line.sheetCell, `ct-computation-v1.1.toml "${line.label}"`);
    for (const heading of frs105.heading)
      if (heading.sheetCell) check(heading.sheetCell, `frs105-formats.toml ${heading.statement} ${heading.letter}`);
    expect(offenders).toEqual([]);
  });

  it("every computation line with a sheetCell has an xbrl tag or an explicit empty string", () => {
    for (const line of computation.line) {
      if (line.sheetCell) {
        expect(line).toHaveProperty("xbrl");
        expect(typeof line.xbrl).toBe("string");
      }
    }
  });

  it("every box the CT600 form layout renders is in ct600-v3.toml", () => {
    const layoutPath = resolve(APP_DIR, "data/hmrc/form-layouts/ltd.json");
    if (!existsSync(layoutPath)) {
      // T8 (the Ltd forms view manifest) has not landed yet, so this file
      // does not exist. T19's data does not wait on T8; only this coverage
      // check does, per the wave 0 note in PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md.
      return;
    }
    const layout = JSON.parse(readFileSync(layoutPath, "utf8"));
    const boxNumbers = new Set(ct600.box.map((box) => box.number));
    const renderedBoxes = Array.isArray(layout.boxes) ? layout.boxes : (layout.ct600?.boxes ?? []);
    const missing = renderedBoxes.filter((number) => !boxNumbers.has(number));
    expect(missing).toEqual([]);
  });
});
