// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// scoreDataHalves puts the fixture's dates through the same period-frame
// shift the writers move a package's own postings by (app/lib/period-shift.js,
// periodShiftMonths/shiftMonths), derived from the two book.tomls rather than
// a --date-shift-months flag: without it, a package generated for any year
// end but the fixture's own scores every line as lost, because the export's
// dates sit in a different calendar period than the unshifted fixture's.
//
// No LibreOffice: cellWrites and applyCellWrites both write literal cell
// values straight into the xlsx XML, so a package built this way carries the
// same postings a recalculated one would without needing LibreOffice to read
// them back.

import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";

import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { applyCellWrites } from "../lib/spreadsheet-runner.js";
import { readBookSource } from "../lib/books-interchange.js";
import { canonicalBookToml, canonicalLinesJsonl } from "../lib/diya-gl-canonical.js";
import { PRODUCTS } from "../lib/products.js";
import { scoreDataHalves, unrepresentableScope } from "../bin/verify-roundtrip.js";
import * as bst from "../products/bst.js";
import * as se from "../products/se.js";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(APP_DIR, "..");
const NODE = process.execPath;

function run(args) {
  return execFileSync(NODE, args, { cwd: ROOT, encoding: "utf8" });
}

function inventory() {
  return JSON.parse(readFileSync(resolve(ROOT, "app", "data", "roundtrip-unrepresentable.json"), "utf8"));
}

// The fixture side, in the canonical form scoreDataHalves reads: the JS
// engine's own reading of the master data, at its own unshifted dates.
// generate-bst.yml, generate-se.yml and generate-ltd.yml all build this same
// side with report.js --data.
function buildFixture(scratchDir, product, data, years) {
  const outputDir = resolve(scratchDir, `${product}-fixture`);
  run(["app/bin/report.js", "--package", product, "--data", data, "--years", years, "--output-dir", outputDir]);
  return resolve(outputDir, "data");
}

// A single-file package's export side, built through the writer directly
// (cellWrites) rather than product-workbook.js's saveWorkbook: saveWorkbook
// is the interactive save path and, for a single-file product, passes no
// target year at all, because the book it saves is already in its own
// period. reconcile.js -- the pipeline generate-bst.yml and generate-se.yml
// actually score -- calls cellWrites with a real target year for every
// product, single-file or not, which is what this mirrors.
async function buildSingleFileExport(scratchDir, product, data, templateFile, productMod, targetStartYear) {
  const { book, lines } = loadDiyaGlData(resolve(ROOT, data));
  const scenario = diyaGlToScenario(book, lines, product);
  const writes = productMod.cellWrites(scenario, targetStartYear);
  const templateBuffer = readFileSync(resolve(APP_DIR, "templates", product, templateFile));
  const buffer = await applyCellWrites(templateBuffer, writes);
  const { book: exportedBook, lines: exportedLines } = await readBookSource(buffer, templateFile, { products: PRODUCTS });

  const outputDir = resolve(scratchDir, `${product}-export`);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, "book.toml"), canonicalBookToml(exportedBook));
  writeFileSync(resolve(outputDir, "lines.jsonl"), canonicalLinesJsonl(exportedLines));
  return outputDir;
}

// A multi-file package's export side, the same way but once per file the
// writer names, written to a scratch package directory export.js's own
// --source-dir extraction then reads -- the extraction multi-file products
// need spans every workbook in the set, which is what --source-dir already
// does without requiring a second, hand-rolled copy of it here.
async function buildMultiFileExport(scratchDir, product, data, productMod, targetStartYear) {
  const { book, lines } = loadDiyaGlData(resolve(ROOT, data));
  const scenario = diyaGlToScenario(book, lines, product);
  const writes = productMod.cellWrites(scenario, targetStartYear);

  const packageDir = resolve(scratchDir, `${product}-package`);
  mkdirSync(packageDir, { recursive: true });
  for (const file of Object.keys(writes)) {
    const templateBuffer = readFileSync(resolve(APP_DIR, "templates", product, file));
    const buffer = await applyCellWrites(templateBuffer, writes[file]);
    writeFileSync(resolve(packageDir, file), buffer);
  }

  const outputDir = resolve(scratchDir, `${product}-export`);
  run(["app/bin/export.js", "--package", product, "--source-dir", packageDir, "--output-dir", outputDir]);
  return outputDir;
}

describe("scoreDataHalves against a package built for a year end the fixture does not cover", () => {
  it("BST: matches every line of a package two years past the fixture's own period", async () => {
    const scratchDir = mkdtempSync(join(tmpdir(), "verify-roundtrip-frame-bst-"));
    try {
      const data = "examples/precision-code-ltd/bst";
      const fixtureDir = buildFixture(scratchDir, "bst", data, "se-2025-2026");

      const { book: fixtureBook } = loadDiyaGlData(resolve(ROOT, data));
      const sourceStartYear = new Date(fixtureBook.documentInfo.periodCoveredStart).getUTCFullYear();
      const exportDir = await buildSingleFileExport(scratchDir, "bst", data, "bst-excel.xlsx", bst, sourceStartYear + 2);

      const score = scoreDataHalves(fixtureDir, exportDir, unrepresentableScope("bst", inventory()));
      expect(score.exportedLines).toBe(score.fixtureLines);
      expect(score.groupedFixtureLines - score.coarseMatches).toBe(0);
      expect(score.coarseMatches - score.accountMatches).toBe(0);
      expect(score.wholeLineMatches).toBe(score.fixtureLines);
    } finally {
      rmSync(scratchDir, { recursive: true, force: true });
    }
  }, 60000);

  it("SE: matches every line of a package two years past the fixture's own period", async () => {
    const scratchDir = mkdtempSync(join(tmpdir(), "verify-roundtrip-frame-se-"));
    try {
      const data = "examples/precision-code-ltd/advanced";
      const fixtureDir = buildFixture(scratchDir, "se", data, "se-2025-2026");

      const { book: fixtureBook } = loadDiyaGlData(resolve(ROOT, data));
      const sourceStartYear = new Date(fixtureBook.documentInfo.periodCoveredStart).getUTCFullYear();
      const exportDir = await buildMultiFileExport(scratchDir, "se", data, se, sourceStartYear + 2);

      const score = scoreDataHalves(fixtureDir, exportDir, unrepresentableScope("se", inventory()));
      expect(score.exportedLines).toBe(score.fixtureLines);
      expect(score.groupedFixtureLines - score.coarseMatches).toBe(0);
      expect(score.coarseMatches - score.accountMatches).toBe(0);
      // 11 of the 697 fixture lines carry a field the inventory does not yet
      // excuse (a structural gap unrelated to the date shift: the same 686
      // holds at zero shift too) -- held steady here rather than papered over.
      expect(score.wholeLineMatches).toBe(686);
    } finally {
      rmSync(scratchDir, { recursive: true, force: true });
    }
  }, 60000);

  // examples/ltd-latest is the committed October package generate-ltd.yml's
  // own pipeline produced; its period (November to October) already sits a
  // whole year and seven months from examples/precision-code-ltd/full's own
  // March period, exercising the year-counting gap directly rather than
  // rebuilding a Company package by hand.
  it("Ltd: matches every line of the committed October package against the March fixture", () => {
    const scratchDir = mkdtempSync(join(tmpdir(), "verify-roundtrip-frame-ltd-"));
    try {
      const fixtureDir = buildFixture(scratchDir, "ltd", "examples/precision-code-ltd/full", "ltd-2025");
      const exportDir = resolve(scratchDir, "ltd-export");
      run(["app/bin/export.js", "--package", "ltd", "--source-dir", "examples/ltd-latest", "--output-dir", exportDir]);

      const score = scoreDataHalves(fixtureDir, exportDir, unrepresentableScope("ltd", inventory()));
      expect(score.groupedFixtureLines - score.coarseMatches).toBe(0);
      expect(score.coarseMatches - score.accountMatches).toBe(0);
    } finally {
      rmSync(scratchDir, { recursive: true, force: true });
    }
  }, 60000);
});
