// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// Import a book, save it as a workbook the
// way the browser save button does, then re-import that workbook and prove
// the report computed from it is unchanged. This is the save path's own
// correctness rung: a byte-identity test proves the writer reproduces the
// CLI's bytes, but only a round trip through the reader proves those bytes
// still carry the book.

import { describe, it, expect } from "vitest";
import { writeFileSync, mkdtempSync, rmSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";

import { loadDiyaGlData } from "../lib/diya-gl-loader.js";
import { saveWorkbook } from "../lib/product-workbook.js";
import { extractBookFromFile, buildFileReportDocument } from "../bin/export.js";
import * as bst from "../products/bst.js";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(APP_DIR, "..");

// The two ledger-bearing fixtures round-trip cell for cell: every value the
// report computes from the re-imported book matches the value it computed
// from the original. sp-sixty-driving's mileage-only scenario carries no
// sales/purchases ledger for the exporter to read back a Debtors & Creditors
// position from, so its round trip is covered separately, by line count
// only, until that read-back is built.
const ROUND_TRIPPING_FIXTURES = [
  ["precision-code-ltd", "examples/precision-code-ltd/bst"],
  ["brickwork-pro", "examples/brickwork-pro/bst-nonvat"],
];

async function saveAndReimport(dir) {
  const { book, lines } = loadDiyaGlData(resolve(ROOT, dir));
  const { workbook } = await saveWorkbook(book, lines);

  const stageDir = mkdtempSync(join(tmpdir(), "bst-save-roundtrip-"));
  try {
    const xlsxPath = resolve(stageDir, "book.xlsx");
    writeFileSync(xlsxPath, workbook);
    const reimported = await extractBookFromFile(xlsxPath, { product: "bst" });
    return { book, lines, reimported };
  } finally {
    rmSync(stageDir, { recursive: true, force: true });
  }
}

function valuesByKey(document) {
  return Object.fromEntries(document.values.map((entry) => [entry.key, entry.value]));
}

describe("saveWorkbook round trip: import -> save -> re-import", () => {
  for (const [name, dir] of ROUND_TRIPPING_FIXTURES) {
    it(`recomputes the same figures for ${name} after the workbook is saved and re-imported`, async () => {
      const { book, lines, reimported } = await saveAndReimport(dir);

      expect(reimported.lines.length, "no transaction line is dropped or duplicated").toBe(lines.length);

      const before = buildFileReportDocument(book, lines, "bst", bst);
      const after = reimported.document;

      // A check that only compared totals could pass while individual cells
      // moved in opposite directions, so every cell, section and check
      // value the report carries is compared by name.
      expect(after.values.length, "the same number of report values are produced").toBe(before.values.length);
      expect(valuesByKey(after)).toEqual(valuesByKey(before));
    }, 120000);
  }

  it("carries every sp-sixty-driving transaction line through the round trip", async () => {
    const { lines, reimported } = await saveAndReimport("examples/sp-sixty-driving/bst");
    expect(reimported.lines.length).toBe(lines.length);
  }, 120000);
});
