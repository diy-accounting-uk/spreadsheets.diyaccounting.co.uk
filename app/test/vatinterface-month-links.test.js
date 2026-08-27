// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// Catalogue-wide guard for the Vatinterface month links. Walks every
// packages/*/Vatreturns.xlsx (Ltd) and packages/*/Vat.xlsx (SE) via JSZip
// only -- no LibreOffice -- and asserts, per workbook:
//
//   1. the Vatinterface month rows (6-17) pull each figure from that row's
//      own month tab: columns D, F and M reference [n]<month>! where [n]
//      resolves via the workbook rels to Sales.xlsx, columns H and J to
//      Purchases.xlsx, and <month> follows the package's accounting year
//      (the month after the year-end month for Ltd, Apr..Mar for SE);
//   2. the sibling Sales.xlsx and Purchases.xlsx workbooks name their month
//      tabs in that same sequence, so every referenced tab exists.
//
// The month-collapse bug this guards against (every row reading the Apr
// tab) lived in generated output only -- the reconciliation scenarios never
// read a VAT figure and the roundtrip test only runs the template year-end,
// so nothing walked the shipped workbooks' month links until this test.

import { describe, it, expect, beforeAll } from "vitest";
import JSZip from "jszip";
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { buildSheetMap } from "../lib/spreadsheet-runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const PACKAGES_DIR = join(ROOT, "packages");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Vatinterface layout shared by Ltd Vatreturns.xlsx and SE Vat.xlsx: rows
// 6-17 are the twelve accounting-year months; D/F/M read Sales, H/J read
// Purchases.
const FIRST_MONTH_ROW = 6;
const SALES_COLS = ["D", "F", "M"];
const PURCHASES_COLS = ["H", "J"];

// The twelve month-tab names for an accounting year starting the month
// after yearEndMonth (1-indexed). Ltd year-end Apr 2026 -> May..Apr; the
// SE tax year (ends 5 April) runs Apr..Mar, i.e. yearEndMonth 3.
function expectedMonthTabs(yearEndMonth) {
  const tabs = [];
  for (let i = 0; i < 12; i++) {
    tabs.push(MONTHS[(yearEndMonth + i) % 12]);
  }
  return tabs;
}

// ── Discovery ────────────────────────────────────────────────────────────

function findVatWorkbooks() {
  const found = [];
  if (!existsSync(PACKAGES_DIR)) return found;
  const entries = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  for (const dirName of entries) {
    const dirPath = join(PACKAGES_DIR, dirName);
    if (existsSync(join(dirPath, "DO NOT USE - WORK IN PROGRESS.txt"))) continue;
    for (const filename of ["Vatreturns.xlsx", "Vat.xlsx"]) {
      const filePath = join(dirPath, filename);
      if (existsSync(filePath)) found.push({ dirName, dirPath, filename, filePath });
    }
  }
  return found;
}

function yearEndMonthFor(dirName, filename) {
  if (filename === "Vat.xlsx") return 3; // SE tax year always runs Apr..Mar
  const m = dirName.match(/\d{4}-(\d{2})-\d{2}/);
  if (!m) return null;
  return parseInt(m[1], 10);
}

// ── External reference resolution (same approach as the dropdown guard) ──

function relsPathFor(filePath) {
  const idx = filePath.lastIndexOf("/");
  return `${filePath.slice(0, idx)}/_rels/${filePath.slice(idx + 1)}.rels`;
}

// Maps the formula "[n]" index (1-based, in <externalReferences> order) to
// the linked workbook's relative filename (e.g. "Sales.xlsx"), resolved via
// the workbook rels and each external link's own rels.
async function buildExternalTargetMap(zip) {
  const wbXml = await zip.file("xl/workbook.xml").async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");

  const ridToFile = new Map();
  for (const [, rid, target] of relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]*)"/g)) {
    ridToFile.set(rid, `xl/${target}`);
  }

  const targetMap = new Map();
  const refsBlock = wbXml.match(/<externalReferences>([\s\S]*?)<\/externalReferences>/);
  if (!refsBlock) return targetMap;
  const refEntries = [...refsBlock[1].matchAll(/r:id="(rId\d+)"/g)];
  for (let i = 0; i < refEntries.length; i++) {
    const linkPath = ridToFile.get(refEntries[i][1]);
    if (!linkPath) continue;
    const relsFile = zip.file(relsPathFor(linkPath));
    if (!relsFile) continue;
    const linkRels = await relsFile.async("string");
    // Prefer the relative target (plain filename); a link also carries an
    // absolute-URL target from the authoring machine.
    const targets = [...linkRels.matchAll(/Target="([^"]*)"/g)].map((m) => decodeURIComponent(m[1]));
    const relative = targets.find((t) => !t.includes("/"));
    targetMap.set(i + 1, relative ?? targets[0] ?? null);
  }
  return targetMap;
}

// Month tabs of a workbook, in sheet order, filtered to month names.
async function workbookMonthTabs(filePath) {
  const zip = await JSZip.loadAsync(readFileSync(filePath));
  const wbXml = await zip.file("xl/workbook.xml").async("string");
  return [...wbXml.matchAll(/<sheet name="([^"]*)"/g)].map((m) => m[1]).filter((name) => MONTHS.includes(name));
}

// ── Load everything once ─────────────────────────────────────────────────

const workbooks = findVatWorkbooks();

describe.skipIf(workbooks.length === 0)("Vatinterface month links (all packages)", () => {
  // dirName/filename -> { viXml, targetMap, yearEndMonth }
  const loaded = new Map();

  beforeAll(async () => {
    for (const wb of workbooks) {
      const zip = await JSZip.loadAsync(readFileSync(wb.filePath));
      const sheetMap = await buildSheetMap(zip);
      const viFile = sheetMap.get("Vatinterface");
      const viXml = viFile ? await zip.file(viFile).async("string") : null;
      const targetMap = await buildExternalTargetMap(zip);
      loaded.set(wb.filePath, { viXml, targetMap, yearEndMonth: yearEndMonthFor(wb.dirName, wb.filename) });
    }
  }, 120_000);

  it("found VAT workbooks to check", () => {
    expect(workbooks.length).toBeGreaterThan(0);
  });

  it("every month row reads its own month tab from the right workbook", () => {
    const failures = [];

    for (const wb of workbooks) {
      const { viXml, targetMap, yearEndMonth } = loaded.get(wb.filePath);
      const label = `${wb.dirName}/${wb.filename}`;
      if (!viXml) {
        failures.push(`${label}: no Vatinterface sheet resolved via workbook.xml/rels`);
        continue;
      }
      if (yearEndMonth === null) {
        failures.push(`${label}: no year-end date in package directory name`);
        continue;
      }
      const expected = expectedMonthTabs(yearEndMonth);

      for (const [cols, wantTarget] of [
        [SALES_COLS, "Sales.xlsx"],
        [PURCHASES_COLS, "Purchases.xlsx"],
      ]) {
        for (const col of cols) {
          for (let i = 0; i < 12; i++) {
            const row = FIRST_MONTH_ROW + i;
            const cell = viXml.match(new RegExp(`<c r="${col}${row}"[^>]*><f>(?:IF\\()?\\[(\\d+)\\]([A-Za-z]+)!`));
            if (!cell) {
              failures.push(`${label}: ${col}${row} has no [n]Month! formula`);
              continue;
            }
            const [, extIdx, month] = cell;
            const target = targetMap.get(parseInt(extIdx, 10));
            if (target !== wantTarget) {
              failures.push(`${label}: ${col}${row} reads [${extIdx}] -> ${target}, expected ${wantTarget}`);
            }
            if (month !== expected[i]) {
              failures.push(`${label}: ${col}${row} reads tab ${month}, expected ${expected[i]}`);
            }
          }
        }
      }
    }

    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("sibling Sales and Purchases workbooks carry the same month-tab sequence", async () => {
    const failures = [];
    const checkedDirs = new Set();

    for (const wb of workbooks) {
      if (checkedDirs.has(wb.dirPath)) continue;
      checkedDirs.add(wb.dirPath);
      const { yearEndMonth } = loaded.get(wb.filePath);
      if (yearEndMonth === null) continue;
      const expected = expectedMonthTabs(yearEndMonth);

      for (const sibling of ["Sales.xlsx", "Purchases.xlsx"]) {
        const siblingPath = join(wb.dirPath, sibling);
        if (!existsSync(siblingPath)) {
          failures.push(`${wb.dirName}: ${sibling} missing alongside ${wb.filename}`);
          continue;
        }
        const tabs = await workbookMonthTabs(siblingPath);
        if (tabs.join(",") !== expected.join(",")) {
          failures.push(`${wb.dirName}: ${sibling} month tabs [${tabs.join(",")}], expected [${expected.join(",")}]`);
        }
      }
    }

    expect(failures, failures.join("\n")).toEqual([]);
  }, 120_000);
});
