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
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
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
} from "../lib/books-interchange.js";
import { canonicalBookToml, canonicalLinesJsonl } from "../lib/diya-gl-canonical.js";
import { buildFileReportDocument } from "../bin/export.js";
import * as bst from "../products/bst.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const BST_XLSX_PATH = resolve(ROOT, "examples", "bst-latest", "GB_Accounts_Basic_Sole_Trader.xlsx");
const BST_XLSX_BYTES = readFileSync(BST_XLSX_PATH);

async function zipOf(entries) {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(entries)) zip.file(name, content);
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
    expect(source.workbookBytes).toBeInstanceOf(Uint8Array);
  });

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
