// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readXlsxCellValues, findXlsx } from "../lib/xlsx-reader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const BST_LATEST = resolve(ROOT, "examples", "bst-latest");

// Skip tests if no populated example exists
const hasBstLatest = existsSync(BST_LATEST) && findXlsx(BST_LATEST) !== null;

describe.skipIf(!hasBstLatest)("readXlsxCellValues — BST latest example", () => {
  let results;

  beforeAll(async () => {
    const xlsxFile = findXlsx(BST_LATEST);
    const xlsxBuffer = readFileSync(resolve(BST_LATEST, xlsxFile));
    results = await readXlsxCellValues(xlsxBuffer, {
      "Profit & Loss Acc": ["C4", "C9", "C24"],
      "Income Tax": ["E5", "E10", "E18"],
    });
  });

  it("returns results for requested sheets", () => {
    expect(results).toHaveProperty("Profit & Loss Acc");
    expect(results).toHaveProperty("Income Tax");
  });

  it("reads numeric cell values from P&L", () => {
    const pl = results["Profit & Loss Acc"];
    expect(pl.C4).toBeTypeOf("number");
    expect(pl.C4).toBeGreaterThan(0);
  });

  it("reads total sales > gross profit > net profit", () => {
    const pl = results["Profit & Loss Acc"];
    expect(pl.C4).toBeGreaterThan(pl.C9);
    expect(pl.C9).toBeGreaterThan(pl.C24);
  });

  it("reads income tax values", () => {
    const tax = results["Income Tax"];
    expect(tax.E5).toBeTypeOf("number");
    expect(tax.E5).toBeGreaterThan(0);
    expect(tax.E18).toBeGreaterThan(0);
  });
});

describe("findXlsx", () => {
  it("returns null for empty directory", () => {
    // Use a directory that exists but has no xlsx
    expect(findXlsx(resolve(ROOT, "app", "lib"))).toBeNull();
  });

  it.skipIf(!hasBstLatest)("finds xlsx in bst-latest", () => {
    const xlsxFile = findXlsx(BST_LATEST);
    expect(xlsxFile).not.toBeNull();
    expect(xlsxFile).toMatch(/\.xlsx$/);
  });
});
