// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// se-anchors.test.js -- the Self Employed anchor table and input-cell
// predicate (app/lib/anchors/se.js), proved against the shipped package and
// against the writer's own output: the table passes a real package, names
// every file a customer's own upload could drop, names every header a
// customer's own upload could retype, and the predicate recognises every
// cell app/products/se.js's cellWrites() actually fills.

import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "child_process";
import { readFileSync, mkdtempSync, rmSync, readdirSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { buildSheetMap } from "../lib/spreadsheet-runner.js";
import { workbookSetFromDirectory, workbookSetFromZipBytes } from "../lib/workbook-set.js";
import { validateAnchors, AnchorError } from "../lib/anchors/run.js";
import { SE_ANCHORS, isSeInputCell, seTemplatePaths } from "../lib/anchors/se.js";
import { overtypedCells } from "../lib/overtype-sidecar.js";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { cellWrites } from "../products/se.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const SE_PACKAGE_DIR = resolve(ROOT, "examples", "se-latest");
const SE_FILES = Object.keys(SE_ANCHORS);

const baseBytes = Object.fromEntries(SE_FILES.map((file) => [file, readFileSync(resolve(SE_PACKAGE_DIR, file))]));

function zipOf(entries) {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(entries)) zip.file(name, content);
  return zip.generateAsync({ type: "uint8array" });
}

// A copy of one package file with a header cell's text swapped for another,
// the shape a customer's own retyped label takes.
async function retypedFile(originalBytes, sheet, cellRef, newText) {
  const zip = await JSZip.loadAsync(originalBytes);
  const sheetMap = await buildSheetMap(zip);
  const sheetPath = sheetMap.get(sheet);
  expect(sheetPath, `sheet "${sheet}" not found in the fixture`).toBeTruthy();
  const sheetXml = await zip.file(sheetPath).async("string");
  const sstXml = await zip.file("xl/sharedStrings.xml").async("string");
  const cellMatch = sheetXml.match(new RegExp(`<c r="${cellRef}"[^>]*t="s"[^>]*><v>(\\d+)</v></c>`));
  expect(cellMatch, `${sheet}!${cellRef} is not a shared-string cell in the fixture`).not.toBeNull();
  const uniqueMatch = sstXml.match(/uniqueCount="(\d+)"/);
  const countMatch = sstXml.match(/count="(\d+)"/);
  const newIndex = Number(uniqueMatch[1]);
  const patchedSst = sstXml
    .replace(/<\/sst>/, `<si><t>${newText}</t></si></sst>`)
    .replace(/count="(\d+)"/, `count="${Number(countMatch[1]) + 1}"`)
    .replace(/uniqueCount="(\d+)"/, `uniqueCount="${newIndex + 1}"`);
  const patchedSheet = sheetXml.replace(cellMatch[0], `<c r="${cellRef}" t="s"><v>${newIndex}</v></c>`);
  zip.file(sheetPath, patchedSheet);
  zip.file("xl/sharedStrings.xml", patchedSst);
  return zip.generateAsync({ type: "uint8array" });
}

// A copy of one package file with a cell's formula dropped, leaving the
// cached value in place -- the shape a customer's own typed-over cell takes.
async function withFormulaStripped(originalBytes, sheet, cellRef) {
  const zip = await JSZip.loadAsync(originalBytes);
  const sheetMap = await buildSheetMap(zip);
  const sheetPath = sheetMap.get(sheet);
  expect(sheetPath, `sheet "${sheet}" not found in the fixture`).toBeTruthy();
  const xml = await zip.file(sheetPath).async("string");
  const element = xml.match(new RegExp(`<c r="${cellRef}"[^>]*(?:/>|>[\\s\\S]*?</c>)`))?.[0];
  expect(element, `${sheet}!${cellRef} has no <c> element in the fixture`).toBeTruthy();
  const stripped = element.replace(/<f[^>]*(?:\/>|>[\s\S]*?<\/f>)/, "");
  expect(stripped, `no <f> to strip from ${sheet}!${cellRef}`).not.toBe(element);
  zip.file(sheetPath, xml.replace(element, stripped));
  return zip.generateAsync({ type: "uint8array" });
}

// The shipped package, one file replaced with a patched copy.
async function setWithFileReplaced(file, patchedBytes) {
  const entries = { ...baseBytes, [file]: patchedBytes };
  return workbookSetFromZipBytes(await zipOf(entries));
}

describe("SE_ANCHORS against the shipped package", () => {
  it("the table passes on the shipped package", async () => {
    const set = await workbookSetFromDirectory(SE_PACKAGE_DIR);
    await expect(validateAnchors(set, SE_ANCHORS, "Self Employed")).resolves.toBeUndefined();
  });

  it.each(SE_FILES)("a set missing %s is refused naming the file", async (missing) => {
    const entries = Object.fromEntries(SE_FILES.filter((file) => file !== missing).map((file) => [file, baseBytes[file]]));
    const set = await workbookSetFromZipBytes(await zipOf(entries));

    let caught;
    try {
      await validateAnchors(set, SE_ANCHORS, "Self Employed");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AnchorError);
    expect(caught.findings).toEqual([{ file: null, sheet: null, cell: null, message: `file "${missing}" not found in the package` }]);
  });

  const allHeaders = SE_FILES.flatMap((file) => SE_ANCHORS[file].headers.map((header) => ({ file, ...header })));
  it.each(allHeaders)("$file sheet $sheet cell $cell retyped is refused naming file, sheet and cell", async ({ file, sheet, cell }) => {
    const patched = await retypedFile(baseBytes[file], sheet, cell, "x");
    const set = await setWithFileReplaced(file, patched);

    let caught;
    try {
      await validateAnchors(set, SE_ANCHORS, "Self Employed");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AnchorError);
    expect(caught.findings.length).toBe(1);
    expect(caught.findings[0]).toMatchObject({ file, sheet, cell });
  });
});

describe("isSeInputCell against the writer's own output", () => {
  it("every cell the writer fills is an input cell", () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "precision-code-ltd", "advanced"));
    const scenario = diyaGlToScenario(book, lines, "se");
    const writes = cellWrites(scenario, 2025);

    let total = 0;
    for (const [file, sheets] of Object.entries(writes)) {
      for (const [sheet, cells] of Object.entries(sheets)) {
        for (const cellRef of Object.keys(cells)) {
          total++;
          expect(isSeInputCell(file, sheet, cellRef), `${file}!${sheet}!${cellRef}`).toBe(true);
        }
      }
    }
    expect(total).toBeGreaterThan(0);
  });

  it("a computed cell the writer never touches is not an input cell", () => {
    expect(isSeInputCell("Financialaccounts.xlsx", "Profit & Loss Account", "B9")).toBe(false);
  });
});

describe("a generated SE package carries no overtyped cell", () => {
  const tempDirs = [];
  afterEach(() => {
    while (tempDirs.length > 0) rmSync(tempDirs.pop(), { recursive: true, force: true });
  });

  it("reports nothing for a package the generator just produced, and names one cell typed over", async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "se-anchors-generate-"));
    tempDirs.push(outputDir);
    execFileSync(
      process.execPath,
      ["app/bin/generate.js", "--package", "se", "--years", "se-2025-2026", "--skip-guide", "--output-dir", outputDir],
      { cwd: ROOT, stdio: "pipe" },
    );
    const [pkgDirName] = readdirSync(outputDir);
    const pkgDir = resolve(outputDir, pkgDirName);

    const seOptions = { isInputCell: isSeInputCell, templates: await seTemplatePaths() };

    const cleanSet = await workbookSetFromDirectory(pkgDir);
    expect(await overtypedCells(cleanSet, seOptions)).toEqual({});

    const hubBytes = readFileSync(resolve(pkgDir, "Financialaccounts.xlsx"));
    const patchedHub = await withFormulaStripped(hubBytes, "Profit & Loss Account", "B9");
    const packageBytes = readdirSync(pkgDir).map((name) => [
      name,
      name === "Financialaccounts.xlsx" ? patchedHub : readFileSync(resolve(pkgDir, name)),
    ]);
    const patchedSet = await workbookSetFromZipBytes(await zipOf(Object.fromEntries(packageBytes)));

    const overtyped = await overtypedCells(patchedSet, seOptions);
    expect(Object.keys(overtyped)).toEqual(["Financialaccounts.xlsx!Profit & Loss Account!B9"]);
    expect(overtyped["Financialaccounts.xlsx!Profit & Loss Account!B9"].kind).toBe("literal");
  }, 60000);
});
