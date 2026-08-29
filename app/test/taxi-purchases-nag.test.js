// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// taxi-purchases-nag.test.js — Proves the PurchasesMar!T2 "vehicle changes"
// nag references the additions total (Fixed Assets!D62), not the empty
// Fixed Assets!D74 the template shipped with. The empty cell reads as 0 in
// a numeric comparison, so the old formula (T1 > D74) fired on every
// package that coded anything to "f", whether or not the asset was ever
// registered on the Fixed Assets schedule.
//
// Requires: LibreOffice installed (brew install --cask libreoffice) for the
// dynamic no-nag proof; the formula-text assertion runs without it.

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";
import { runSpreadsheet, hasLibreOffice, buildSheetMap, readCellValue, loadSharedStrings } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { cellWrites as taxiCellWrites, standardReads as taxiReads } from "../products/taxi.js";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const TAXI_DIR = resolve(APP_DIR, "templates", "taxi");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

const NO_NAG_TEXT = "Motor Vehicles: make, model, date reg. and reg. Mark";
const NAG_TEXT = "ENTER VEHICLE CHANGES        on Fixed Asset schedule";

function corruptCachedValue(xml, cellRef, value) {
  const cellPattern = new RegExp(`<c\\s+r="${cellRef}"[^>]*>[\\s\\S]*?</c>`);
  const match = xml.match(cellPattern);
  if (!match) throw new Error(`Cell ${cellRef} not found in XML`);
  const replaced = match[0].replace(/<v>[^<]*<\/v>/, `<v>${value}</v>`);
  if (replaced === match[0]) throw new Error(`Cell ${cellRef} has no <v> to corrupt`);
  return xml.replace(match[0], replaced);
}

it("PurchasesMar!T2 compares the vehicle purchases total against the additions total, not the empty cell it shipped with", async () => {
  const templateBuffer = readFileSync(resolve(TAXI_DIR, "taxi-excel.xlsx"));
  const zip = await JSZip.loadAsync(templateBuffer);
  const sheetMap = await buildSheetMap(zip);
  const xml = await zip.file(sheetMap.get("PurchasesMar")).async("string");

  const cellPattern = /<c\s+r="T2"[^>]*>[\s\S]*?<\/c>/;
  const match = xml.match(cellPattern);
  expect(match, "PurchasesMar!T2 not found").toBeTruthy();

  expect(match[0]).toContain("'Fixed Assets'!$D$62");
  expect(match[0]).not.toContain("'Fixed Assets'!$D$74");
});

describeCalc("Taxi PurchasesMar vehicle-changes nag does not fire on a registered addition", () => {
  let scenario;
  let populatedPath;

  beforeAll(async () => {
    const templateBuffer = readFileSync(resolve(TAXI_DIR, "taxi-excel.xlsx"));
    const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(TAXI_DIR, "meta.toml"), "utf8"));
    const xlsxBuffer = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);

    scenario = loadScenario(resolve(FIXTURES_DIR, "taxi-scenario-basic.toml"));
    const writes = taxiCellWrites(scenario);
    const reads = taxiReads();
    reads.PurchasesMar = [...reads.PurchasesMar, "T2"];
    reads["Fixed Assets"] = [...reads["Fixed Assets"], "D62"];

    const tmpDir = mkdtempSync(join(tmpdir(), "taxi-nag-"));
    populatedPath = join(tmpDir, "populated.xlsx");
    await runSpreadsheet(xlsxBuffer, writes, reads, { saveRecalculatedTo: populatedPath });
  }, 60000);

  async function readCells() {
    const zip = await JSZip.loadAsync(readFileSync(populatedPath));
    const sheetMap = await buildSheetMap(zip);
    const sharedStrings = await loadSharedStrings(zip);
    const purchasesXml = await zip.file(sheetMap.get("PurchasesMar")).async("string");
    const fixedAssetsXml = await zip.file(sheetMap.get("Fixed Assets")).async("string");
    return {
      T1: readCellValue(purchasesXml, "T1", sharedStrings),
      T2: readCellValue(purchasesXml, "T2", sharedStrings),
      D47: readCellValue(fixedAssetsXml, "D47", sharedStrings),
      D62: readCellValue(fixedAssetsXml, "D62", sharedStrings),
    };
  }

  it("the fixture's f-coded purchase reaches both the journal and the Fixed Assets schedule", async () => {
    const cells = await readCells();
    expect(cells.T1).toBeGreaterThan(0);
    expect(cells.D47).toBeGreaterThan(0);
    expect(cells.D62).toBeGreaterThan(0);
  });

  it("shows the plain caption, not the nag, once the vehicle purchase is registered on the schedule", async () => {
    const cells = await readCells();
    expect(cells.T2).toBe(NO_NAG_TEXT);
    expect(cells.T2).not.toContain("ENTER VEHICLE CHANGES");
  });

  it("would have failed the no-nag assertion had the nag actually fired", async () => {
    // Proves the assertion above is a genuine content check, not one a nag
    // string would also satisfy: corrupt T2's cached value to the nag text
    // and confirm the same assertion now fails.
    const zip = await JSZip.loadAsync(readFileSync(populatedPath));
    const sheetMap = await buildSheetMap(zip);
    const sharedStrings = await loadSharedStrings(zip);
    let xml = await zip.file(sheetMap.get("PurchasesMar")).async("string");
    xml = corruptCachedValue(xml, "T2", NAG_TEXT);
    const corrupted = readCellValue(xml, "T2", sharedStrings);

    expect(corrupted).not.toBe(NO_NAG_TEXT);
  });
});
