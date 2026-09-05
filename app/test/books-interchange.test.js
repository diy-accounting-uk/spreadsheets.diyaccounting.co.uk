// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// books-interchange.test.js — detectBookSource sniffs six byte kinds by
// content, readBookSource turns each into D, writeBookJson/writeDiyaGlZip
// write it back out. Every kind is built here from the same real workbook
// (examples/bst-latest), so a reader's D is checked against a reference
// this file captures with canonicalBookToml/canonicalLinesJsonl -- the same
// form export.js compares by -- rather than against itself.

import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, readdirSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import {
  detectBookSource,
  readBookSource,
  writeBookJson,
  writeDiyaGlZip,
  UnknownBookSourceError,
  XlsBookSourceError,
  InvalidDiyaGlBookError,
  InvalidDiyaGlJsonError,
  BstAnchorError,
  PackagePartError,
  ProductNotAvailableError,
} from "../lib/books-interchange.js";
import { canonicalBookToml, canonicalLinesJsonl } from "../lib/diya-gl-canonical.js";
import { buildFileReportDocument } from "../bin/export.js";
import * as bst from "../products/bst.js";
import * as taxi from "../products/taxi.js";
import * as se from "../products/se.js";
import * as ltd from "../products/ltd.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const BST_XLSX_PATH = resolve(ROOT, "examples", "bst-latest", "GB_Accounts_Basic_Sole_Trader.xlsx");
const BST_XLSX_BYTES = readFileSync(BST_XLSX_PATH);
const SE_PACKAGE_DIR = resolve(ROOT, "examples", "se-latest");
const LTD_PACKAGE_DIR = resolve(ROOT, "examples", "ltd-latest");
const SE_TEMPLATE_DIR = resolve(ROOT, "app", "templates", "se");
const EVERY_PRODUCT = { bst, taxi, se, ltd };

async function zipOf(entries) {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(entries)) zip.file(name, content);
  return zip.generateAsync({ type: "uint8array" });
}

// A package zip the way a customer's own download ships: every workbook in
// the directory, optionally under the package's own folder name.
async function packageZipOf(dir, folder) {
  const entries = {};
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".xlsx"))) {
    entries[folder ? `${folder}/${name}` : name] = readFileSync(resolve(dir, name));
  }
  return zipOf(entries);
}

// One sheet renamed in a workbook's own xl/workbook.xml, which is where the
// product sniff reads the sheet list from.
async function withSheetRenamed(bytes, from, to) {
  const escape = (name) => name.replace(/&/g, "&amp;");
  const zip = await JSZip.loadAsync(bytes);
  const workbookXml = await zip.file("xl/workbook.xml").async("string");
  const patched = workbookXml.replace(`name="${escape(from)}"`, `name="${escape(to)}"`);
  expect(patched, `sheet "${from}" is on this workbook`).not.toBe(workbookXml);
  zip.file("xl/workbook.xml", patched);
  return zip.generateAsync({ type: "uint8array" });
}

// Read once, shared by every test below: the reference D and its canonical
// text, and the JSON/diya-gl-zip forms built from it.
const workbookSource = await readBookSource(BST_XLSX_BYTES, "GB_Accounts_Basic_Sole_Trader.xlsx");
const referenceBookToml = canonicalBookToml(workbookSource.book);
const referenceLinesJsonl = canonicalLinesJsonl(workbookSource.lines);
const referenceReport = buildFileReportDocument(workbookSource.book, workbookSource.lines, "bst", bst);
const referenceJson = writeBookJson(workbookSource.book, workbookSource.lines);
const referenceDiyaGlZipBytes = await writeDiyaGlZip({
  book: workbookSource.book,
  lines: workbookSource.lines,
  report: referenceReport,
  overtyped: workbookSource.overtyped,
});

// The reference book with one field changed: which product it says it is.
// Everything else about it stays the book every other test here reads.
function bookDeclaring(schemaName) {
  return {
    ...workbookSource.book,
    entityInformation: { ...workbookSource.book.entityInformation, "diya-gl:product": schemaName },
  };
}

function expectSameBook(source) {
  expect(canonicalBookToml(source.book)).toBe(referenceBookToml);
  expect(canonicalLinesJsonl(source.lines)).toBe(referenceLinesJsonl);
}

describe("detectBookSource: content, never the name a file arrived under", () => {
  it("detects a workbook by xl/workbook.xml", async () => {
    expect(await detectBookSource(BST_XLSX_BYTES, "anything.bin")).toBe("workbook");
  });

  it("detects a package zip by its single .xlsx entry and no lines.jsonl", async () => {
    const bytes = await zipOf({ "GB_Accounts_Basic_Sole_Trader.xlsx": BST_XLSX_BYTES });
    expect(await detectBookSource(bytes, "package.zip")).toBe("package-zip");
  });

  it("still detects a package zip when it is named .xlsx -- content decides, not the extension", async () => {
    const bytes = await zipOf({ "GB_Accounts_Basic_Sole_Trader.xlsx": BST_XLSX_BYTES });
    expect(await detectBookSource(bytes, "renamed.xlsx")).toBe("package-zip");
  });

  it("detects a diya-gl zip by lines.jsonl", async () => {
    const bytes = await zipOf({ "book.toml": referenceBookToml, "lines.jsonl": referenceLinesJsonl });
    expect(await detectBookSource(bytes, "book.zip")).toBe("diya-gl-zip");
  });

  it("detects a zipped JSON file by its one .json entry", async () => {
    const bytes = await zipOf({ "book.json": referenceJson });
    expect(await detectBookSource(bytes, "book.json.zip")).toBe("json-zip");
  });

  it("detects JSON text starting with {, past a BOM and leading whitespace", async () => {
    const withBom = new TextEncoder().encode(`﻿  \n${referenceJson}`);
    expect(await detectBookSource(withBom, "book.json")).toBe("json");
  });

  it("detects the legacy .xls container by its OLE magic number", async () => {
    const oleBytes = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]);
    expect(await detectBookSource(oleBytes, "old.xls")).toBe("xls");
  });

  it("detects anything else as unknown", async () => {
    expect(await detectBookSource(new TextEncoder().encode("hello"), "not-a-book.txt")).toBe("unknown");
  });

  it("detects a corrupted zip-shaped byte array as unknown rather than throwing", async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
    expect(await detectBookSource(bytes, "broken.zip")).toBe("unknown");
  });
});

describe("readBookSource: every kind reaches the same D", () => {
  it("reads a workbook: the anchor guard first, the as-read overtype sidecar alongside it", async () => {
    const source = await readBookSource(BST_XLSX_BYTES, "GB_Accounts_Basic_Sole_Trader.xlsx");
    expect(source.kind).toBe("workbook");
    expectSameBook(source);
    expect(source.overtyped).toBeDefined();
    expect(source.product).toBe("bst");
  });

  it("returns the workbook set for a workbook and for a package set, and none for a diya-gl zip", async () => {
    const workbook = await readBookSource(BST_XLSX_BYTES, "GB_Accounts_Basic_Sole_Trader.xlsx");
    expect(workbook.workbookSet.names()).toEqual(["GB_Accounts_Basic_Sole_Trader.xlsx"]);

    const packageSet = await readBookSource(await packageZipOf(SE_PACKAGE_DIR), "se.zip", { products: EVERY_PRODUCT });
    expect(packageSet.workbookSet.names()).toContain("Financialaccounts.xlsx");
    expect(packageSet.workbookSet.names()).toContain("Bank.xlsx");

    const diyaGlZip = await readBookSource(referenceDiyaGlZipBytes, "book-diya-gl.zip");
    expect(diyaGlZip.workbookSet).toBeUndefined();
  }, 60000);

  it("reads a package zip to the same D as the workbook inside it", async () => {
    const bytes = await zipOf({ "GB_Accounts_Basic_Sole_Trader.xlsx": BST_XLSX_BYTES });
    const source = await readBookSource(bytes, "package.zip");
    expect(source.kind).toBe("package-zip");
    expectSameBook(source);
  });

  it("reads a diya-gl zip to the same D, ignoring report.json/overtyped.json alongside it", async () => {
    const bytes = await zipOf({
      "book.toml": referenceBookToml,
      "lines.jsonl": referenceLinesJsonl,
      "report.json": JSON.stringify(referenceReport),
      "overtyped.json": "{}",
    });
    const source = await readBookSource(bytes, "book.zip");
    expect(source.kind).toBe("diya-gl-zip");
    expectSameBook(source);
    expect(source.overtyped).toBeUndefined();
  });

  it("reads a JSON file to the same D", async () => {
    const bytes = new TextEncoder().encode(referenceJson);
    const source = await readBookSource(bytes, "book.json");
    expect(source.kind).toBe("json");
    expectSameBook(source);
  });

  it("reads a zipped JSON file to the same D", async () => {
    const bytes = await zipOf({ "book.json": referenceJson });
    const source = await readBookSource(bytes, "book.json.zip");
    expect(source.kind).toBe("json-zip");
    expectSameBook(source);
  });

  it("reads a diya-gl zip's own writeDiyaGlZip output back to the same D", async () => {
    const source = await readBookSource(referenceDiyaGlZipBytes, "book-diya-gl.zip");
    expectSameBook(source);
  });

  it("refuses the legacy .xls format, naming it and the fix", async () => {
    const oleBytes = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]);
    await expect(readBookSource(oleBytes, "old.xls")).rejects.toThrow(XlsBookSourceError);
    await expect(readBookSource(oleBytes, "old.xls")).rejects.toThrow(/older \.xls format/);
  });

  it("refuses anything else, naming the accepted kinds", async () => {
    const bytes = new TextEncoder().encode("hello");
    await expect(readBookSource(bytes, "not-a-book.txt")).rejects.toThrow(UnknownBookSourceError);
    await expect(readBookSource(bytes, "not-a-book.txt")).rejects.toThrow(/not one of the kinds diya-gl reads/);
  });

  it("propagates BstAnchorError, by name, for a workbook that fails the anchor guard", async () => {
    const zip = await JSZip.loadAsync(BST_XLSX_BYTES);
    const workbookXml = await zip.file("xl/workbook.xml").async("string");
    const patched = workbookXml.replace('name="SalesApr"', 'name="SalesAprRenamed"');
    expect(patched).not.toBe(workbookXml);
    zip.file("xl/workbook.xml", patched);
    const badBytes = await zip.generateAsync({ type: "uint8array" });

    await expect(readBookSource(badBytes, "renamed.xlsx")).rejects.toThrow(BstAnchorError);
    await expect(readBookSource(badBytes, "renamed.xlsx")).rejects.toThrow(/sheet "SalesApr" not found/);
  });
});

describe("a multi-file package, sniffed by the files and sheets it carries", () => {
  it("detects an SE package zip as a package set", async () => {
    expect(await detectBookSource(await packageZipOf(SE_PACKAGE_DIR), "se.zip")).toBe("package-set");
  });

  it("detects it the same way when its entries sit under the package's directory", async () => {
    const bytes = await packageZipOf(SE_PACKAGE_DIR, "GB_Accounts_Self_Employed");
    expect(await detectBookSource(bytes, "se.zip")).toBe("package-set");
  });

  it("reads an SE package zip to the same D as export.js --package se --source-dir", async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "books-interchange-se-"));
    execFileSync(process.execPath, ["app/bin/export.js", "--package", "se", "--source-dir", SE_PACKAGE_DIR, "--output-dir", outputDir], {
      cwd: ROOT,
      stdio: "pipe",
    });

    const source = await readBookSource(await packageZipOf(SE_PACKAGE_DIR), "se.zip", { products: EVERY_PRODUCT });
    expect(source.kind).toBe("package-set");
    expect(source.product).toBe("se");
    expect(canonicalBookToml(source.book)).toBe(readFileSync(join(outputDir, "book.toml"), "utf-8"));
    expect(canonicalLinesJsonl(source.lines)).toBe(readFileSync(join(outputDir, "lines.jsonl"), "utf-8"));
  }, 120000);

  it("sniffs the product from the files a set carries", async () => {
    const seSource = await readBookSource(await packageZipOf(SE_PACKAGE_DIR), "se.zip", { products: EVERY_PRODUCT });
    expect(seSource.product).toBe("se");

    const ltdSource = await readBookSource(await packageZipOf(LTD_PACKAGE_DIR), "ltd.zip", { products: EVERY_PRODUCT });
    expect(ltdSource.product).toBe("ltd");

    const bstSource = await readBookSource(BST_XLSX_BYTES, "bst.xlsx", { products: EVERY_PRODUCT });
    expect(bstSource.product).toBe("bst");
  }, 120000);

  it("refuses a lone hub workbook, naming the package", async () => {
    const bytes = readFileSync(resolve(SE_TEMPLATE_DIR, "Financialaccounts.xlsx"));
    await expect(readBookSource(bytes, "Financialaccounts.xlsx", { products: EVERY_PRODUCT })).rejects.toThrow(PackagePartError);
    await expect(readBookSource(bytes, "Financialaccounts.xlsx", { products: EVERY_PRODUCT })).rejects.toThrow(
      '"Financialaccounts.xlsx" is the hub workbook of a nine-file Self Employed package; upload the package zip.',
    );
  });

  it("refuses a zip whose only workbook is Payslips.xlsx, naming the payslip package", async () => {
    const bytes = await zipOf({ "Payslips.xlsx": readFileSync(resolve(SE_TEMPLATE_DIR, "Payslips.xlsx")) });
    expect(await detectBookSource(bytes, "payslips.zip")).toBe("package-zip");
    await expect(readBookSource(bytes, "payslips.zip", { products: EVERY_PRODUCT })).rejects.toThrow(
      '"Payslips.xlsx" is the payslips workbook of a package, or of the Payslip package; upload the package zip.',
    );
  });

  it("refuses a bank book, which carries twelve month tabs and nothing else", async () => {
    const bytes = readFileSync(resolve(SE_TEMPLATE_DIR, "Bank.xlsx"));
    await expect(readBookSource(bytes, "Bank.xlsx", { products: EVERY_PRODUCT })).rejects.toThrow(
      '"Bank.xlsx" is a bank or cash book of a multi-file package; upload the package zip.',
    );
  });

  it("refuses an SE package when only the Basic Sole Trader module is available", async () => {
    const bytes = await packageZipOf(SE_PACKAGE_DIR);
    await expect(readBookSource(bytes, "se.zip")).rejects.toThrow(ProductNotAvailableError);
    await expect(readBookSource(bytes, "se.zip")).rejects.toThrow(
      '"se.zip" is a Self Employed package; this build reads Basic Sole Trader books only.',
    );
  }, 60000);

  it("reads the sheet list, not the file name", async () => {
    const hub = readFileSync(resolve(SE_TEMPLATE_DIR, "Financialaccounts.xlsx"));
    for (const sheet of ["Business Details", "SE Full", "Profit & Loss Account", "Wagesinterface", "StockControl"]) {
      const patched = await withSheetRenamed(hub, sheet, `${sheet}x`);
      const read = readBookSource(patched, "Financialaccounts.xlsx", { products: EVERY_PRODUCT });
      await expect(read, `renaming "${sheet}" takes the hub out of the package-part list`).rejects.toThrow(BstAnchorError);
    }

    // Every sheet left alone, the same bytes are still refused as the hub.
    await expect(readBookSource(hub, "Financialaccounts.xlsx", { products: EVERY_PRODUCT })).rejects.toThrow(PackagePartError);
  });
});

describe("breakability: a corrupted diya-gl book fails validation by name", () => {
  it("fails a diya-gl zip whose lines.jsonl carries an account no chart declares, naming the violation", async () => {
    const brokenLines = referenceLinesJsonl.replace(/"accountMainID":"?\d+"?/, '"accountMainID":"9999"');
    expect(brokenLines).not.toBe(referenceLinesJsonl);
    const bytes = await zipOf({ "book.toml": referenceBookToml, "lines.jsonl": brokenLines });

    let caught;
    try {
      await readBookSource(bytes, "broken.zip");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(InvalidDiyaGlBookError);
    expect(caught.errors.some((e) => e.includes("9999") && e.includes("not declared"))).toBe(true);

    // Every other book the same lines.jsonl still parses to reads clean --
    // the one corrupted account is the only thing that fails.
    const cleanBytes = await zipOf({ "book.toml": referenceBookToml, "lines.jsonl": referenceLinesJsonl });
    await expect(readBookSource(cleanBytes, "clean.zip")).resolves.toBeDefined();
  });

  it("fails a diya-gl zip missing book.toml, naming the missing file", async () => {
    // lines.jsonl alone is what detectBookSource keys a diya-gl zip on, so a
    // zip that carries it without book.toml still reaches this reader --
    // the missing-file check inside it is what has to catch this, not sniffing.
    const bytes = await zipOf({ "lines.jsonl": referenceLinesJsonl });
    await expect(readBookSource(bytes, "no-book.zip")).rejects.toThrow(/missing book\.toml/);
  });

  it("fails a JSON book at a version this module does not carry, naming the version it found", async () => {
    const document = JSON.parse(referenceJson);
    document.version = 2;
    const bytes = new TextEncoder().encode(JSON.stringify(document));

    let caught;
    try {
      await readBookSource(bytes, "future.json");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(InvalidDiyaGlJsonError);
    expect(caught.message).toContain('"version": 1');
    expect(caught.message).toContain("found 2");

    // The unmodified reference JSON still reads clean at version 1.
    await expect(readBookSource(new TextEncoder().encode(referenceJson), "current.json")).resolves.toBeDefined();
  });

  it("fails a JSON file at the wrong format name", async () => {
    const document = JSON.parse(referenceJson);
    document.format = "something-else";
    const bytes = new TextEncoder().encode(JSON.stringify(document));
    await expect(readBookSource(bytes, "wrong-format.json")).rejects.toThrow(InvalidDiyaGlJsonError);
  });

  it("fails text that does not parse as JSON at all", async () => {
    const bytes = new TextEncoder().encode("{ not json");
    await expect(readBookSource(bytes, "broken.json")).rejects.toThrow(InvalidDiyaGlJsonError);
  });
});

describe("writeBookJson: canonical key order, round trips to the same D", () => {
  it("carries the diya-gl-books envelope", () => {
    const document = JSON.parse(referenceJson);
    expect(document.format).toBe("diya-gl-books");
    expect(document.version).toBe(1);
    expect(document.product).toBe("bst");
    expect(document.book.documentInfo).toBeDefined();
    expect(Array.isArray(document.lines)).toBe(true);
  });

  it("orders a book's own top-level tables by the schema, not by the input's key order", () => {
    const reordered = { ...workbookSource.book };
    delete reordered.documentInfo;
    reordered.documentInfo = workbookSource.book.documentInfo;
    const text = writeBookJson(reordered, workbookSource.lines);
    expect(text).toBe(referenceJson);
  });

  it("orders each line's own fields by the schema, not by the input's key order", () => {
    const reorderedLines = workbookSource.lines.map((line) => Object.fromEntries(Object.entries(line).reverse()));
    const text = writeBookJson(workbookSource.book, reorderedLines);
    expect(text).toBe(referenceJson);
  });

  it("is invariant to the lines' own input order", () => {
    const reversed = [...workbookSource.lines].reverse();
    expect(writeBookJson(workbookSource.book, reversed)).toBe(referenceJson);
  });

  it("keeps a date as a plain YYYY-MM-DD string, matching the TOML form's bare date", () => {
    const document = JSON.parse(referenceJson);
    expect(document.book.documentInfo.periodCoveredStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("writes the JSON product from the book's own field", () => {
    const document = JSON.parse(writeBookJson(bookDeclaring("SelfEmployed"), workbookSource.lines));
    expect(document.product).toBe("se");
  });

  it("refuses to write a book that declares no product, naming the field and the four names", () => {
    const book = { ...workbookSource.book, entityInformation: { ...workbookSource.book.entityInformation } };
    delete book.entityInformation["diya-gl:product"];
    expect(() => writeBookJson(book, workbookSource.lines)).toThrow(/diya-gl:product/);
    expect(() => writeBookJson(book, workbookSource.lines)).toThrow(/BasicSoleTrader, TaxiDriver, SelfEmployed, Company/);
  });
});

describe("the JSON interchange's product, at all four ids", () => {
  it("reads a JSON document at each product id it accepts", async () => {
    for (const [id, schemaName] of Object.entries({ bst: "BasicSoleTrader", taxi: "TaxiDriver", se: "SelfEmployed", ltd: "Company" })) {
      const text = writeBookJson(bookDeclaring(schemaName), workbookSource.lines);
      expect(JSON.parse(text).product).toBe(id);
      const source = await readBookSource(new TextEncoder().encode(text), `${id}.json`);
      expect(source.kind).toBe("json");
      expect(source.book.entityInformation["diya-gl:product"]).toBe(schemaName);
    }
  });

  it("refuses a JSON document whose product disagrees with its book, naming both", async () => {
    const document = JSON.parse(referenceJson);
    document.product = "se";
    const bytes = new TextEncoder().encode(JSON.stringify(document));

    let caught;
    try {
      await readBookSource(bytes, "disagrees.json");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(InvalidDiyaGlJsonError);
    expect(caught.message).toContain('"se"');
    expect(caught.message).toContain('"BasicSoleTrader"');
  });

  it("names the product a diya-gl zip's book declares", async () => {
    const source = await readBookSource(referenceDiyaGlZipBytes, "book-diya-gl.zip");
    expect(source.product).toBe("bst");
  });

  it("refuses a diya-gl zip whose book declares no product, naming the field", async () => {
    const withoutProduct = referenceBookToml.replace(/^"diya-gl:product" = .*\n/m, "");
    expect(withoutProduct).not.toBe(referenceBookToml);
    const bytes = await zipOf({ "book.toml": withoutProduct, "lines.jsonl": referenceLinesJsonl });
    await expect(readBookSource(bytes, "no-product.zip")).rejects.toThrow(InvalidDiyaGlBookError);
    await expect(readBookSource(bytes, "no-product.zip")).rejects.toThrow(/diya-gl:product/);
  });

  it("refuses a JSON document at a product id no product carries", async () => {
    const document = JSON.parse(referenceJson);
    document.product = "payslip";
    const bytes = new TextEncoder().encode(JSON.stringify(document));
    await expect(readBookSource(bytes, "unknown-product.json")).rejects.toThrow(/expected "product" to be one of bst, taxi, se, ltd/);
  });
});

describe("writeDiyaGlZip: the CLI's exact bytes, deterministic", () => {
  it("carries book.toml, lines.jsonl, report.json in that order, and overtyped.json when given", async () => {
    const zip = await JSZip.loadAsync(referenceDiyaGlZipBytes);
    expect(Object.keys(zip.files)).toEqual(["book.toml", "lines.jsonl", "report.json", "overtyped.json"]);

    const bookToml = await zip.file("book.toml").async("string");
    const linesJsonl = await zip.file("lines.jsonl").async("string");
    expect(bookToml).toBe(referenceBookToml);
    expect(linesJsonl).toBe(referenceLinesJsonl);
  });

  it("omits bookchecks.json and overtyped.json when neither is given", async () => {
    const bytes = await writeDiyaGlZip({ book: workbookSource.book, lines: workbookSource.lines, report: referenceReport });
    const zip = await JSZip.loadAsync(bytes);
    expect(Object.keys(zip.files)).toEqual(["book.toml", "lines.jsonl", "report.json"]);
  });

  it("carries bookchecks.json when given", async () => {
    const bookchecks = { rules: [] };
    const bytes = await writeDiyaGlZip({ book: workbookSource.book, lines: workbookSource.lines, report: referenceReport, bookchecks });
    const zip = await JSZip.loadAsync(bytes);
    expect(Object.keys(zip.files)).toEqual(["book.toml", "lines.jsonl", "report.json", "bookchecks.json"]);
    expect(JSON.parse(await zip.file("bookchecks.json").async("string"))).toEqual(bookchecks);
  });

  it("writes byte-identical zips for the same book across two separate calls", async () => {
    const again = await writeDiyaGlZip({
      book: workbookSource.book,
      lines: workbookSource.lines,
      report: referenceReport,
      overtyped: workbookSource.overtyped,
    });
    expect(Buffer.from(again).equals(Buffer.from(referenceDiyaGlZipBytes))).toBe(true);
  });
});
