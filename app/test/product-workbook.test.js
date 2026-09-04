// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// The writer on a product whose package is a set of workbooks rather than one.
// bst-workbook.test.js holds the single-file proof, byte for byte against the
// generate path; this file covers what a multi-file package adds: the product
// read off the book, the tax file each regime names, the refusal to hand back
// one workbook, and the zip the nine files land in.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";

import {
  saveWorkbook,
  saveWorkbookFiles,
  savePackageZip,
  productOf,
  taxYearFileName,
  SingleFileOnlyError,
} from "../lib/product-workbook.js";
import { loadDiyaGlData } from "../lib/diya-gl-loader.js";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(APP_DIR, "..");

const SE_BOOK = "examples/precision-code-ltd/advanced";
const SE_DIR_NAME = "GB Accounts Self Employed 2026-04-05 (Apr26) Excel 2007";

function bookAt(dir) {
  return loadDiyaGlData(resolve(ROOT, dir));
}

describe("productOf", () => {
  const DECLARED = [
    ["bst", "examples/precision-code-ltd/bst"],
    ["taxi", "examples/basic-taxi-driver/taxi"],
    ["se", SE_BOOK],
    ["ltd", "examples/precision-code-ltd/full"],
  ];

  for (const [product, dir] of DECLARED) {
    it(`reads ${product} off the book's own product field`, () => {
      const { book } = bookAt(dir);
      expect(productOf(book)).toBe(product);
    });
  }

  it("fails by name when the book declares no product", () => {
    const { book } = bookAt(SE_BOOK);
    delete book.entityInformation["diya-gl:product"];
    expect(() => productOf(book)).toThrow('entityInformation."diya-gl:product"');
  });
});

describe("taxYearFileName", () => {
  it("names a company's file for the year its period ends in", () => {
    expect(taxYearFileName(new Date("2026-03-31"), "ltd")).toBe("ltd-2026");
    expect(taxYearFileName(new Date("2026-06-30"), "ltd")).toBe("ltd-2026");
  });

  it("still names a self-employment file for the year that opened the April before", () => {
    expect(taxYearFileName(new Date("2026-03-31"), "se")).toBe("se-2025-2026");
  });
});

describe("saveWorkbook on a product whose package is a set", () => {
  it("refuses by product name rather than handing back one of the files", async () => {
    const { book, lines } = bookAt(SE_BOOK);
    await expect(saveWorkbook(book, lines)).rejects.toThrow(SingleFileOnlyError);
    await expect(saveWorkbook(book, lines)).rejects.toThrow("Self Employed");
  }, 180000);
});

describe("saveWorkbookFiles", () => {
  it("writes the nine Self Employed workbooks, each asking to recalculate on open", async () => {
    const { book, lines } = bookAt(SE_BOOK);
    const meta = parseTOML(readFileSync(resolve(APP_DIR, "templates/se/meta.toml"), "utf8"));

    const { product, dirName, files } = await saveWorkbookFiles(book, lines);

    expect(product).toBe("se");
    expect(dirName).toBe(SE_DIR_NAME);
    expect(files).toHaveLength(9);
    expect(files.map((file) => file.name)).toEqual(meta.template.files);

    for (const file of files) {
      const zip = await JSZip.loadAsync(file.bytes);
      const workbookXml = await zip.file("xl/workbook.xml").async("string");
      expect(workbookXml, `${file.name} does not ask the spreadsheet app to recalculate`).toContain('fullCalcOnLoad="1"');
    }
  }, 300000);

  it("carries one line's changed amount into the sales workbook and nowhere else", async () => {
    const { book, lines } = bookAt(SE_BOOK);
    const before = await saveWorkbookFiles(book, lines);

    const changed = lines.map((line) => (line.entryNumber === "TXN-0029" ? { ...line, amount: line.amount + 111 } : line));
    const after = await saveWorkbookFiles(book, changed);

    const moved = before.files
      .filter((file, index) => Buffer.compare(Buffer.from(file.bytes), Buffer.from(after.files[index].bytes)) !== 0)
      .map((file) => file.name);
    expect(moved).toEqual(["Sales.xlsx"]);
  }, 300000);
});

describe("savePackageZip on a product whose package is a set", () => {
  it("nests every workbook under the package's own directory", async () => {
    const { book, lines } = bookAt(SE_BOOK);
    const { zip: bytes, filename } = await savePackageZip(book, lines);

    expect(filename).toBe(`${SE_DIR_NAME}.zip`);

    const zip = await JSZip.loadAsync(bytes);
    const entries = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
    expect(entries).toHaveLength(9);
    for (const entry of entries) {
      expect(entry.startsWith(`${SE_DIR_NAME}/`)).toBe(true);
    }
    expect(entries).toContain(`${SE_DIR_NAME}/Financialaccounts.xlsx`);
  }, 300000);

  it("writes the same bytes on a second call", async () => {
    const { book, lines } = bookAt(SE_BOOK);
    const first = await savePackageZip(book, lines);
    const second = await savePackageZip(book, lines);
    expect(Buffer.compare(Buffer.from(first.zip), Buffer.from(second.zip))).toBe(0);
  }, 300000);
});
