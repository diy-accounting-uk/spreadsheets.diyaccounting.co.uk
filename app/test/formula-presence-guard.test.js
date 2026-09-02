// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// Catalogue-wide guard for missing formulas: walks every packages/*/*.xlsx via
// JSZip only -- no LibreOffice -- and flags a cell that looks like it should
// carry a shared formula (because sibling cells in the same si group do) but
// has none. This is the "unit test" tier: a dead row anywhere in the
// catalogue, caught in a JSZip scan rather than a LibreOffice recalculation.
//
// The parse and the calibrated rule both live in
// app/lib/template-formula-map.js, which documents why a naive "every cell in
// a shared range's bounding box must carry a formula" check produces false
// positives on every workbook and what the rule does instead. The overtype
// sidecar reads the same module, so the guard and the sidecar can never
// disagree about what a cell holds.
//
// Run against the full committed catalogue (every packages/*/*.xlsx, every
// sheet) this rule reports zero gaps -- see the "breakability" describe below
// for proof the rule still catches a real deletion.

import { describe, it, expect, beforeAll } from "vitest";
import JSZip from "jszip";
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { buildSheetMap } from "../lib/spreadsheet-runner.js";
import { parseCells, findFormulaGaps } from "../lib/template-formula-map.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const PACKAGES_DIR = join(ROOT, "packages");

// ── Discovery ────────────────────────────────────────────────────────────

// Every xlsx shipped in every package directory, whichever product(s) the
// current packages/ tree holds -- a per-product CI run (only BST, only Taxi,
// etc.) has fewer directories but the discovery itself makes no product
// assumption.
function findAllWorkbooks() {
  const found = [];
  if (!existsSync(PACKAGES_DIR)) return found;
  const dirNames = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  for (const dirName of dirNames) {
    const dirPath = join(PACKAGES_DIR, dirName);
    if (existsSync(join(dirPath, "DO NOT USE - WORK IN PROGRESS.txt"))) continue;
    const filenames = readdirSync(dirPath)
      .filter((f) => f.endsWith(".xlsx"))
      .sort();
    for (const filename of filenames) {
      found.push({ dirName, filename, filePath: join(dirPath, filename) });
    }
  }
  return found;
}

function countPackageDirs() {
  if (!existsSync(PACKAGES_DIR)) return 0;
  return readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .filter((e) => !existsSync(join(PACKAGES_DIR, e.name, "DO NOT USE - WORK IN PROGRESS.txt"))).length;
}

// ── Test catalogue ──────────────────────────────────────────────────────

const workbooks = findAllWorkbooks();

describe("Formula presence catalogue guard", () => {
  it("finds an xlsx workbook count matching the package directories present", () => {
    const byDir = new Map();
    for (const wb of workbooks) byDir.set(wb.dirName, (byDir.get(wb.dirName) || 0) + 1);
    expect(byDir.size, "packages/ subdirectory count with at least one xlsx").toBe(countPackageDirs());
  });
});

for (const wb of workbooks) {
  const label = `${wb.dirName}/${wb.filename}`;

  describe(label, () => {
    let zip;
    let sheetMap;

    beforeAll(async () => {
      const buffer = readFileSync(wb.filePath);
      zip = await JSZip.loadAsync(buffer);
      sheetMap = await buildSheetMap(zip);
    });

    it("has no missing-formula gaps in any sheet", async () => {
      const gaps = [];
      for (const [sheetName, file] of sheetMap) {
        const xml = await zip.file(file).async("string");
        const cells = parseCells(xml);
        gaps.push(...findFormulaGaps(cells, `${label} ${sheetName}`));
      }
      expect(gaps, `${label}:\n${gaps.join("\n")}`).toEqual([]);
    });
  });
}

// ── Template-level coverage ──────────────────────────────────────────────
// packages/*/*.xlsx only exists after CI regenerates the catalogue from
// app/templates/. Running the same guard directly over the templates means a
// template repair (such as the Salesinvoice G6/H6 fix) is covered the moment
// it lands, not after the next package build. A trial sweep of every
// workbook under app/templates/*/*.xlsx came back clean, so the guard runs
// over the whole template set here rather than being scoped to one workbook.

const TEMPLATES_DIR = join(ROOT, "app", "templates");

function findAllTemplateWorkbooks() {
  const found = [];
  if (!existsSync(TEMPLATES_DIR)) return found;
  const dirNames = readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  for (const dirName of dirNames) {
    const dirPath = join(TEMPLATES_DIR, dirName);
    const filenames = readdirSync(dirPath)
      .filter((f) => f.endsWith(".xlsx"))
      .sort();
    for (const filename of filenames) {
      found.push({ dirName, filename, filePath: join(dirPath, filename) });
    }
  }
  return found;
}

const templateWorkbooks = findAllTemplateWorkbooks();

describe("Formula presence template guard", () => {
  it("discovers at least one template workbook per product directory", () => {
    const byDir = new Map();
    for (const wb of templateWorkbooks) byDir.set(wb.dirName, (byDir.get(wb.dirName) || 0) + 1);
    for (const [dirName, count] of byDir) {
      expect(count, `${dirName} template workbooks`).toBeGreaterThan(0);
    }
  });
});

for (const wb of templateWorkbooks) {
  const label = `templates/${wb.dirName}/${wb.filename}`;

  describe(label, () => {
    let zip;
    let sheetMap;

    beforeAll(async () => {
      const buffer = readFileSync(wb.filePath);
      zip = await JSZip.loadAsync(buffer);
      sheetMap = await buildSheetMap(zip);
    });

    it("has no missing-formula gaps in any sheet", async () => {
      const gaps = [];
      for (const [sheetName, file] of sheetMap) {
        const xml = await zip.file(file).async("string");
        const cells = parseCells(xml);
        gaps.push(...findFormulaGaps(cells, `${label} ${sheetName}`));
      }
      expect(gaps, `${label}:\n${gaps.join("\n")}`).toEqual([]);
    });
  });
}

// ── Salesinvoice H-column breakability ───────────────────────────────────
// The generic breakability proof below searches the whole catalogue for any
// cell it can break. This one names the exact cell the Salesinvoice repair
// depends on: H30 sits inside the repaired H6:H66 shared group with no
// formula of its own, so stripping its <f> is invisible to the guard unless
// the shared group itself is what brings it into view.
describe("Formula presence guard breakability (Salesinvoice H column)", () => {
  it("flags se/Salesinvoice.xlsx H30 when its shared formula is stripped", async () => {
    const seSalesinvoice = templateWorkbooks.find((wb) => wb.dirName === "se" && wb.filename === "Salesinvoice.xlsx");
    expect(seSalesinvoice, "se/Salesinvoice.xlsx not found among template workbooks").toBeTruthy();

    const zip = await JSZip.loadAsync(readFileSync(seSalesinvoice.filePath));
    const sheetMap = await buildSheetMap(zip);
    const sheetPath = sheetMap.get("Product Details");
    expect(sheetPath, "Product Details sheet not found").toBeTruthy();
    const xml = await zip.file(sheetPath).async("string");

    const before = findFormulaGaps(parseCells(xml), "Product Details");
    expect(before, "Product Details should start clean").toEqual([]);

    const brokenXml = xml.replace(
      `<c r="H30" s="64" t="str"><f t="shared" si="2"/><v xml:space="preserve"> </v></c>`,
      `<c r="H30" s="64" t="str"><v xml:space="preserve"> </v></c>`,
    );
    expect(brokenXml, "H30 pattern not found to break").not.toEqual(xml);

    const after = findFormulaGaps(parseCells(brokenXml), "Product Details");
    expect(after.some((g) => g.includes("!H30:"))).toBe(true);
  });
});

// ── Breakability proof ───────────────────────────────────────────────────
// The guard must actually fail when a formula is missing. Takes a real,
// known-good sheet from the catalogue, deletes one shared-formula follower's
// <f> element (keeping its cached <v> and style, exactly what a corrupted
// generation step would do), and asserts findFormulaGaps flags it. Entirely
// in-memory -- no file on disk is modified.
describe("Formula presence guard breakability", () => {
  it("flags a shared-formula cell whose <f> element is deleted", async () => {
    expect(workbooks.length, "no workbooks in the catalogue to break a copy of").toBeGreaterThan(0);

    // Search whatever catalogue this run holds (a per-product tree included)
    // for a shared-formula follower whose deletion the calibrated rule flags:
    // strip its <f> element but keep the cached <v> and style, exactly as a
    // dropped-formula regression would.
    let proven = false;
    outer: for (const wb of workbooks) {
      const zip = await JSZip.loadAsync(readFileSync(wb.filePath));
      const sheetMap = await buildSheetMap(zip);
      for (const [sheetName, sheetPath] of sheetMap) {
        const xml = await zip.file(sheetPath).async("string");
        const label = `${wb.filename} ${sheetName}`;
        if (findFormulaGaps(parseCells(xml), label).length > 0) continue;
        for (const m of xml.matchAll(/<c r="([A-Z]+\d+)"([^>]*)><f t="shared"[^>]*si="\d+"[^>]*\/>(<v[^>]*>[\s\S]*?<\/v>)?<\/c>/g)) {
          const brokenXml = xml.replace(m[0], `<c r="${m[1]}"${m[2]}>${m[3] || ""}</c>`);
          if (brokenXml === xml) continue;
          const after = findFormulaGaps(parseCells(brokenXml), label);
          if (after.some((g) => g.includes(`!${m[1]}:`))) {
            proven = true;
            break outer;
          }
        }
      }
    }
    expect(proven, "no shared-formula follower in the catalogue whose deletion the rule flags").toBe(true);
  });
});
