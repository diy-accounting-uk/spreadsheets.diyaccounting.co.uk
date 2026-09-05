// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// bst-se-short-sheet.test.js — proves the shipped BST template's SE Short
// sheet prints the 2026 SA103S box numbers, the same renumber SE's
// Financialaccounts.xlsx got (se-full-return-checks.test.js runs the same
// proof there). Read straight from the template's XML via JSZip: printed
// box numbers and captions are static text, not a computed figure, so no
// LibreOffice is needed.

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { buildSheetMap, readCellValue, loadSharedStrings } from "../lib/spreadsheet-runner.js";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE_PATH = resolve(APP_DIR, "templates", "bst", "bst-excel.xlsx");

// Every cell the sheet prints a bare box number in, column A and L, keyed to
// the 2026 number that cell now carries.
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
  L44: 16,
  A48: 12,
  L48: 17,
  A53: 13,
  L53: 18,
  A57: 14,
  L57: 19,
  A62: 15,
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
  A120: 35,
  L111: 36,
  L116: 37,
  L120: 38,
};

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

describe("the shipped BST template's SE Short sheet", () => {
  let xml;
  let sharedStrings;

  beforeAll(async () => {
    const zip = await JSZip.loadAsync(readFileSync(TEMPLATE_PATH));
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

  it("prints captions that name the boxes beside them", () => {
    for (const [cell, caption] of Object.entries(SE_SHORT_CAPTIONS)) {
      expect(readCellValue(xml, cell, sharedStrings), `SE Short!${cell}`).toBe(caption);
    }
  });
});
