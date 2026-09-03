// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// export.js's --file mode: a single .xlsx, or a .zip unzipped to find the
// workbook, alongside the existing --source-dir. Every case here runs
// export.js as a child process, the way verify-roundtrip.test.js already
// does, because the script runs main() at import time. No LibreOffice: the
// fixture's own cached cell values are read as-is, exactly as --source-dir
// already does against the same file.

import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "child_process";
import JSZip from "jszip";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, cpSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const NODE = process.execPath;
const EXPORT_BIN = resolve(ROOT, "app", "bin", "export.js");
const BST_XLSX = resolve(ROOT, "examples", "bst-latest", "GB_Accounts_Basic_Sole_Trader.xlsx");

const tempDirs = [];
function tempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop(), { recursive: true, force: true });
});

function run(args) {
  return execFileSync(NODE, args, { cwd: ROOT, encoding: "utf8" });
}

function runExpectingFailure(args) {
  try {
    run(args);
    throw new Error("expected export.js to exit non-zero");
  } catch (err) {
    if (err.status === undefined) throw err; // not the execFileSync failure we're after
    return err;
  }
}

// examples/bst-latest is read-only, and the .zip cases need a workbook to
// pack -- both come from one copy into a scratch directory this file owns.
function stagedXlsx() {
  const dir = tempDir("export-file-src-");
  const path = resolve(dir, "GB_Accounts_Basic_Sole_Trader.xlsx");
  cpSync(BST_XLSX, path);
  return path;
}

async function zipOf(xlsxPath) {
  const zip = new JSZip();
  zip.file(basename(xlsxPath), readFileSync(xlsxPath));
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const zipPath = xlsxPath.replace(/\.xlsx$/, ".zip");
  writeFileSync(zipPath, buffer);
  return zipPath;
}

// A sheet name as workbook.xml spells it. "Debtors & Creditors" is stored
// with its ampersand escaped, so a literal match on the name the code uses
// finds nothing.
const asXml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// A copy of the fixture with one workbook.xml sheet name swapped for
// another -- the shape a customer's own renamed tab takes.
async function renameSheet(xlsxPath, from, to) {
  const zip = await JSZip.loadAsync(readFileSync(xlsxPath));
  const workbookXml = await zip.file("xl/workbook.xml").async("string");
  const patched = workbookXml.replace(`name="${asXml(from)}"`, `name="${asXml(to)}"`);
  expect(patched).not.toBe(workbookXml); // the fixture actually had that sheet
  zip.file("xl/workbook.xml", patched);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const outPath = resolve(dirname(xlsxPath), `renamed-${basename(xlsxPath)}`);
  writeFileSync(outPath, buffer);
  return outPath;
}

// A copy of the fixture with one header cell's text swapped for another --
// the shape a customer's own retyped label takes.
async function retypeCell(xlsxPath, sheetName, cellRef, newText) {
  const zip = await JSZip.loadAsync(readFileSync(xlsxPath));
  const workbookXml = await zip.file("xl/workbook.xml").async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const sheetMatch = workbookXml.match(new RegExp(`<sheet name="${asXml(sheetName)}"[^>]*r:id="(rId\\d+)"`));
  expect(sheetMatch).not.toBeNull();
  const relMatch = relsXml.match(new RegExp(`Id="${sheetMatch[1]}"[^>]*Target="worksheets/([^"]+)"`));
  expect(relMatch).not.toBeNull();
  const sheetPath = `xl/worksheets/${relMatch[1]}`;
  const sheetXml = await zip.file(sheetPath).async("string");

  // The label cell is a shared string in this fixture; point that entry's
  // shared-string index at a freshly appended string instead of the
  // template's own text, so no other cell reusing the same string moves too.
  const sstXml = await zip.file("xl/sharedStrings.xml").async("string");
  const cellMatch = sheetXml.match(new RegExp(`<c r="${cellRef}"[^>]*t="s"[^>]*><v>(\\d+)</v></c>`));
  expect(cellMatch).not.toBeNull();
  const countMatch = sstXml.match(/count="(\d+)"/);
  const uniqueMatch = sstXml.match(/uniqueCount="(\d+)"/);
  const newIndex = Number(uniqueMatch[1]);
  const patchedSst = sstXml
    .replace(/<\/sst>/, `<si><t>${newText}</t></si></sst>`)
    .replace(/count="(\d+)"/, `count="${Number(countMatch[1]) + 1}"`)
    .replace(/uniqueCount="(\d+)"/, `uniqueCount="${newIndex + 1}"`);
  const patchedSheet = sheetXml.replace(cellMatch[0], `<c r="${cellRef}" s="0" t="s"><v>${newIndex}</v></c>`);

  zip.file("xl/sharedStrings.xml", patchedSst);
  zip.file(sheetPath, patchedSheet);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const outPath = resolve(dirname(xlsxPath), `retyped-${basename(xlsxPath)}`);
  writeFileSync(outPath, buffer);
  return outPath;
}

describe("export.js --file mode", () => {
  it("matches --source-dir byte-for-byte on the same package", () => {
    const sourceDirOutput = tempDir("export-file-source-out-");
    const fileOutput = tempDir("export-file-file-out-");

    run([
      "app/bin/export.js",
      "--package",
      "bst",
      "--source-dir",
      resolve(ROOT, "examples", "bst-latest"),
      "--output-dir",
      sourceDirOutput,
    ]);
    run(["app/bin/export.js", "--package", "bst", "--file", BST_XLSX, "--output-dir", fileOutput]);

    const bookFromSource = readFileSync(resolve(sourceDirOutput, "book.toml"));
    const bookFromFile = readFileSync(resolve(fileOutput, "book.toml"));
    expect(bookFromFile.equals(bookFromSource)).toBe(true);

    const linesFromSource = readFileSync(resolve(sourceDirOutput, "lines.jsonl"));
    const linesFromFile = readFileSync(resolve(fileOutput, "lines.jsonl"));
    expect(linesFromFile.equals(linesFromSource)).toBe(true);
  }, 30000);

  it("reads a .zip by unzipping it to find the workbook, with the same byte-for-byte result", async () => {
    const xlsxPath = stagedXlsx();
    const zipPath = await zipOf(xlsxPath);
    const sourceDirOutput = tempDir("export-file-source-out-");
    const zipOutput = tempDir("export-file-zip-out-");

    run([
      "app/bin/export.js",
      "--package",
      "bst",
      "--source-dir",
      resolve(ROOT, "examples", "bst-latest"),
      "--output-dir",
      sourceDirOutput,
    ]);
    run(["app/bin/export.js", "--package", "bst", "--file", zipPath, "--output-dir", zipOutput]);

    expect(readFileSync(resolve(zipOutput, "book.toml")).equals(readFileSync(resolve(sourceDirOutput, "book.toml")))).toBe(true);
    expect(readFileSync(resolve(zipOutput, "lines.jsonl")).equals(readFileSync(resolve(sourceDirOutput, "lines.jsonl")))).toBe(true);
  }, 30000);

  it("writes beside the input when --output-dir is omitted", () => {
    const xlsxPath = stagedXlsx();
    run(["app/bin/export.js", "--package", "bst", "--file", xlsxPath]);

    const besideInput = dirname(xlsxPath);
    expect(existsSync(resolve(besideInput, "book.toml"))).toBe(true);
    expect(existsSync(resolve(besideInput, "lines.jsonl"))).toBe(true);
    expect(existsSync(resolve(besideInput, "report.json"))).toBe(true);
  }, 30000);

  it("emits report.json computed by the JS engine from the extracted data", () => {
    const outputDir = tempDir("export-file-report-out-");
    run(["app/bin/export.js", "--package", "bst", "--file", BST_XLSX, "--output-dir", outputDir]);

    const document = JSON.parse(readFileSync(resolve(outputDir, "report.json"), "utf8"));
    expect(document.package).toBe("bst");
    expect(document.engine).toBe("js");
    expect(Array.isArray(document.values)).toBe(true);
    expect(document.values.length).toBeGreaterThan(0);
    // At least one compliance check ran against the book the same run
    // extracted, so the report is more than a bare cell dump.
    expect(document.values.some((entry) => entry.key.startsWith("check/"))).toBe(true);

    // R is a pure function of D: the book.toml this run wrote is a valid
    // diya-gl book, and calculateFromDiyaGl() needs nothing report.js's
    // --data mode wouldn't already have from the same directory.
    const book = parseTOML(readFileSync(resolve(outputDir, "book.toml"), "utf8"));
    expect(book.documentInfo.periodCoveredStart).toBeDefined();
  }, 30000);

  it("rejects a package a customer renamed a required sheet on, naming the sheet", async () => {
    const xlsxPath = stagedXlsx();
    const renamed = await renameSheet(xlsxPath, "SalesApr", "SalesAprRenamed");

    const err = runExpectingFailure(["app/bin/export.js", "--package", "bst", "--file", renamed]);

    expect(err.status).toBe(1);
    expect(err.stderr).toContain('sheet "SalesApr" not found');
    expect(err.stderr).toContain("does not match the current Basic Sole Trader template");
    // A named anchor error, not a stack trace: no frame line, no "Error:"
    // preamble node's default uncaught-error printing would add.
    expect(err.stderr).not.toMatch(/at\s+\S+\s+\(.*:\d+:\d+\)/);
    expect(err.stderr).not.toContain("Error:");

    expect(existsSync(resolve(dirname(xlsxPath), "book.toml"))).toBe(false);
  }, 30000);

  it("rejects a package a customer retyped a header label on, naming the sheet and cell", async () => {
    const xlsxPath = stagedXlsx();
    const retyped = await retypeCell(xlsxPath, "Business Details", "C3", "Full name");

    const err = runExpectingFailure(["app/bin/export.js", "--package", "bst", "--file", retyped]);

    expect(err.status).toBe(1);
    expect(err.stderr).toContain('sheet "Business Details" cell C3');
    expect(err.stderr).toContain('expected header "Your name"');
    expect(err.stderr).toContain('found "Full name"');
  }, 30000);

  // The Debtors & Creditors sheet is where the book's opening trade debtors
  // and creditors are read from, and PurchasesStock and Fixed Assets feed the
  // stock table and the asset register. All three were opened by name with
  // nothing checking they were there, so a file short of one exported a book
  // quietly missing that table.
  it.each([
    ["Debtors & Creditors", "B3", "Owed start year", "Beginning balance"],
    ["PurchasesStock", "B4", "Opening Stock", "Stock brought forward"],
    ["Fixed Assets", "E2", "Original Cost", "Purchase price"],
  ])(
    "rejects a package a customer retyped %s!%s on",
    async (sheet, cell, label, replacement) => {
      const retyped = await retypeCell(stagedXlsx(), sheet, cell, replacement);

      const err = runExpectingFailure(["app/bin/export.js", "--package", "bst", "--file", retyped]);

      expect(err.status).toBe(1);
      expect(err.stderr).toContain(`sheet "${sheet}" cell ${cell}`);
      expect(err.stderr).toContain(`expected header "${label}"`);
      expect(err.stderr).toContain(`found ${JSON.stringify(replacement)}`);
    },
    30000,
  );

  it("rejects a package the Debtors & Creditors sheet was renamed on, naming the sheet", async () => {
    const renamed = await renameSheet(stagedXlsx(), "Debtors & Creditors", "Aged debt");

    const err = runExpectingFailure(["app/bin/export.js", "--package", "bst", "--file", renamed]);

    expect(err.status).toBe(1);
    expect(err.stderr).toContain('sheet "Debtors & Creditors" not found');
  }, 30000);

  it("rejects --file for a package other than bst", () => {
    const err = runExpectingFailure(["app/bin/export.js", "--package", "taxi", "--file", BST_XLSX]);
    expect(err.status).toBe(1);
    expect(err.stderr).toContain("--file mode supports --package bst only");
  });

  it("rejects --source-dir and --file given together", () => {
    const err = runExpectingFailure([
      "app/bin/export.js",
      "--package",
      "bst",
      "--source-dir",
      resolve(ROOT, "examples", "bst-latest"),
      "--file",
      BST_XLSX,
    ]);
    expect(err.status).toBe(1);
    expect(err.stderr).toContain("mutually exclusive");
  });

  it("rejects a file that is neither .xlsx nor .zip", () => {
    const dir = tempDir("export-file-bad-ext-");
    const badFile = resolve(dir, "not-a-workbook.txt");
    writeFileSync(badFile, "hello");
    expect(() => run(["app/bin/export.js", "--package", "bst", "--file", badFile])).toThrow();
  });
});

describe("package.json export-bst alias", () => {
  it("is --package bst --file, so npm run export-bst -- my-file.xlsx appends the file path", () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
    expect(pkg.scripts["export-bst"]).toBe("node app/bin/export.js --package bst --file");
  });
});
