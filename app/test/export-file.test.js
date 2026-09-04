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
import { runBookChecks, bookChecksJson } from "../lib/book-checks.js";
import { loadTaxDataForBook } from "../lib/product-workbook.js";

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
    expect(existsSync(resolve(besideInput, "bookchecks.json"))).toBe(true);
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

  it("emits bookchecks.json byte-identical to the module's own text for the same book", async () => {
    const outputDir = tempDir("export-file-bookchecks-out-");
    run(["app/bin/export.js", "--package", "bst", "--file", BST_XLSX, "--output-dir", outputDir]);

    const written = readFileSync(resolve(outputDir, "bookchecks.json"), "utf8");

    const book = parseTOML(readFileSync(resolve(outputDir, "book.toml"), "utf8"));
    const lines = readFileSync(resolve(outputDir, "lines.jsonl"), "utf8")
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
    const taxData = await loadTaxDataForBook(book);
    const { results } = runBookChecks({ book, lines, taxData });

    expect(written).toBe(bookChecksJson(results));
  }, 30000);

  // Breakability: a purchase dated one day after the period end is added
  // through the diya-gl JSON round trip (the same seam the interchange
  // tests below use), and only book-dates-in-period is expected to flip --
  // the other seven rules read a book export.js's own extraction already
  // leaves clean. The added date sits in the month right after the period
  // end with no gap behind it, so it moves no other book carried in the
  // book unaffected -- a date far in the past would open a stretch of empty
  // months of its own and flip that rule too.
  it("carries a fail for book-dates-in-period, and nothing else, when one line is dated outside the period", async () => {
    const cleanOutput = tempDir("export-file-break-clean-out-");
    run(["app/bin/export.js", "--package", "bst", "--file", BST_XLSX, "--output-dir", cleanOutput]);
    const cleanBookChecks = JSON.parse(readFileSync(resolve(cleanOutput, "bookchecks.json"), "utf8"));

    const book = parseTOML(readFileSync(resolve(cleanOutput, "book.toml"), "utf8"));
    const lines = readFileSync(resolve(cleanOutput, "lines.jsonl"), "utf8")
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
    const dayAfterPeriodEnd = new Date(book.documentInfo.periodCoveredEnd);
    dayAfterPeriodEnd.setUTCDate(dayAfterPeriodEnd.getUTCDate() + 1);
    const outOfPeriodLine = {
      ...lines[0],
      entryNumber: "BREAK-OUT-OF-PERIOD",
      postingDate: dayAfterPeriodEnd.toISOString().slice(0, 10),
    };

    const { writeBookJson } = await import("../lib/books-interchange.js");
    const brokenDir = tempDir("export-file-break-src-");
    const brokenPath = resolve(brokenDir, "broken-diya-gl.json");
    writeFileSync(brokenPath, writeBookJson(book, [...lines, outOfPeriodLine]));

    const brokenOutput = tempDir("export-file-break-out-");
    run(["app/bin/export.js", "--package", "bst", "--file", brokenPath, "--output-dir", brokenOutput]);
    const brokenBookChecks = JSON.parse(readFileSync(resolve(brokenOutput, "bookchecks.json"), "utf8"));

    const byId = (checks) => Object.fromEntries(checks.map((c) => [c.id, c.result]));
    const cleanResults = byId(cleanBookChecks);
    const brokenResults = byId(brokenBookChecks);

    expect(brokenResults["book-dates-in-period"]).toBe("fail");
    expect(cleanResults["book-dates-in-period"]).not.toBe("fail");
    for (const id of Object.keys(cleanResults)) {
      if (id === "book-dates-in-period") continue;
      expect(brokenResults[id], id).toBe(cleanResults[id]);
    }
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

// The interchange formats: a diya-gl zip, a diya-gl JSON file, and that JSON
// zipped, each fed back through --file. Round-tripping any of the three
// reproduces the same book.toml/lines.jsonl/report.json the original
// workbook wrote -- overtyped.json is the one file the workbook alone
// carries, since only it has an as-read layer to compare against.
describe("export.js --file mode: the diya-gl interchange formats", () => {
  it("reads its own diya-gl zip output back to the same book.toml, lines.jsonl and report.json", async () => {
    const firstOutput = tempDir("export-file-interchange-first-");
    run(["app/bin/export.js", "--package", "bst", "--file", BST_XLSX, "--output-dir", firstOutput]);

    const zip = new JSZip();
    for (const name of ["book.toml", "lines.jsonl", "report.json", "overtyped.json"]) {
      zip.file(name, readFileSync(resolve(firstOutput, name)));
    }
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const zipDir = tempDir("export-file-interchange-zip-");
    const zipPath = resolve(zipDir, "book-diya-gl.zip");
    writeFileSync(zipPath, buffer);

    const secondOutput = tempDir("export-file-interchange-second-");
    run(["app/bin/export.js", "--package", "bst", "--file", zipPath, "--output-dir", secondOutput]);

    for (const name of ["book.toml", "lines.jsonl", "report.json", "bookchecks.json"]) {
      expect(readFileSync(resolve(secondOutput, name)).equals(readFileSync(resolve(firstOutput, name))), name).toBe(true);
    }
    // Nothing to read overtyped values off any more -- a diya-gl zip in
    // carries D only, so there is no workbook to compare against.
    expect(existsSync(resolve(secondOutput, "overtyped.json"))).toBe(false);
  }, 30000);

  it("reads a diya-gl JSON file back to the same book.toml, lines.jsonl and report.json", async () => {
    const firstOutput = tempDir("export-file-json-first-");
    run(["app/bin/export.js", "--package", "bst", "--file", BST_XLSX, "--output-dir", firstOutput]);

    const book = parseTOML(readFileSync(resolve(firstOutput, "book.toml"), "utf8"));
    const lines = readFileSync(resolve(firstOutput, "lines.jsonl"), "utf8")
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
    const { writeBookJson } = await import("../lib/books-interchange.js");
    const jsonDir = tempDir("export-file-json-src-");
    const jsonPath = resolve(jsonDir, "book-diya-gl.json");
    writeFileSync(jsonPath, writeBookJson(book, lines));

    const secondOutput = tempDir("export-file-json-second-");
    run(["app/bin/export.js", "--package", "bst", "--file", jsonPath, "--output-dir", secondOutput]);

    for (const name of ["book.toml", "lines.jsonl", "report.json", "bookchecks.json"]) {
      expect(readFileSync(resolve(secondOutput, name)).equals(readFileSync(resolve(firstOutput, name))), name).toBe(true);
    }
  }, 30000);

  it("reads that same JSON file zipped, to the same book.toml and lines.jsonl", async () => {
    const firstOutput = tempDir("export-file-jsonzip-first-");
    run(["app/bin/export.js", "--package", "bst", "--file", BST_XLSX, "--output-dir", firstOutput]);

    const book = parseTOML(readFileSync(resolve(firstOutput, "book.toml"), "utf8"));
    const lines = readFileSync(resolve(firstOutput, "lines.jsonl"), "utf8")
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
    const { writeBookJson } = await import("../lib/books-interchange.js");

    const zip = new JSZip();
    zip.file("book-diya-gl.json", writeBookJson(book, lines));
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const zipDir = tempDir("export-file-jsonzip-src-");
    const zipPath = resolve(zipDir, "book-diya-gl.json.zip");
    writeFileSync(zipPath, buffer);

    const secondOutput = tempDir("export-file-jsonzip-second-");
    run(["app/bin/export.js", "--package", "bst", "--file", zipPath, "--output-dir", secondOutput]);

    expect(readFileSync(resolve(secondOutput, "book.toml")).equals(readFileSync(resolve(firstOutput, "book.toml")))).toBe(true);
    expect(readFileSync(resolve(secondOutput, "lines.jsonl")).equals(readFileSync(resolve(firstOutput, "lines.jsonl")))).toBe(true);
    expect(readFileSync(resolve(secondOutput, "bookchecks.json")).equals(readFileSync(resolve(firstOutput, "bookchecks.json")))).toBe(true);
  }, 30000);

  it("reads a package zip renamed .xlsx by content, not by its extension", async () => {
    const sourceDirOutput = tempDir("export-file-renamed-source-out-");
    run([
      "app/bin/export.js",
      "--package",
      "bst",
      "--source-dir",
      resolve(ROOT, "examples", "bst-latest"),
      "--output-dir",
      sourceDirOutput,
    ]);

    const zip = new JSZip();
    zip.file("GB_Accounts_Basic_Sole_Trader.xlsx", readFileSync(BST_XLSX));
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const dir = tempDir("export-file-renamed-src-");
    const renamedPath = resolve(dir, "looks-like-a-workbook.xlsx");
    writeFileSync(renamedPath, buffer);

    const output = tempDir("export-file-renamed-out-");
    run(["app/bin/export.js", "--package", "bst", "--file", renamedPath, "--output-dir", output]);

    expect(readFileSync(resolve(output, "book.toml")).equals(readFileSync(resolve(sourceDirOutput, "book.toml")))).toBe(true);
    expect(readFileSync(resolve(output, "lines.jsonl")).equals(readFileSync(resolve(sourceDirOutput, "lines.jsonl")))).toBe(true);
  }, 30000);

  it("refuses the legacy .xls format, naming it", () => {
    const dir = tempDir("export-file-xls-");
    const xlsPath = resolve(dir, "old-accounts.xls");
    writeFileSync(xlsPath, Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]));

    const err = runExpectingFailure(["app/bin/export.js", "--package", "bst", "--file", xlsPath]);
    expect(err.status).toBe(1);
    expect(err.stderr).toContain("older .xls format");
  });

  it("refuses a file that sniffs as none of the six kinds, naming what it accepts", () => {
    const dir = tempDir("export-file-unknown-");
    const badFile = resolve(dir, "not-a-book.dat");
    writeFileSync(badFile, "not any of the accepted formats");

    const err = runExpectingFailure(["app/bin/export.js", "--package", "bst", "--file", badFile]);
    expect(err.status).toBe(1);
    expect(err.stderr).toContain("not one of the kinds diya-gl reads");
  });

  it("refuses a diya-gl JSON at an unsupported version, naming the version found", async () => {
    const firstOutput = tempDir("export-file-badversion-first-");
    run(["app/bin/export.js", "--package", "bst", "--file", BST_XLSX, "--output-dir", firstOutput]);

    const book = parseTOML(readFileSync(resolve(firstOutput, "book.toml"), "utf8"));
    const lines = readFileSync(resolve(firstOutput, "lines.jsonl"), "utf8")
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
    const { writeBookJson } = await import("../lib/books-interchange.js");
    const document = JSON.parse(writeBookJson(book, lines));
    document.version = 2;

    const dir = tempDir("export-file-badversion-src-");
    const badPath = resolve(dir, "future.json");
    writeFileSync(badPath, JSON.stringify(document));

    const err = runExpectingFailure(["app/bin/export.js", "--package", "bst", "--file", badPath]);
    expect(err.status).toBe(1);
    expect(err.stderr).toContain('"version": 1');
    expect(err.stderr).toContain("found 2");
  });
});

describe("package.json export-bst alias", () => {
  it("is --package bst --file, so npm run export-bst -- my-file.xlsx appends the file path", () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
    expect(pkg.scripts["export-bst"]).toBe("node app/bin/export.js --package bst --file");
  });
});
