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
import { buildSheetMap, loadSharedStrings, readCellValue } from "../lib/spreadsheet-runner.js";
import { BANK_ACCOUNT_FILES, BANK_LAYOUTS, nextColumn } from "../lib/ltd-layout.js";

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
