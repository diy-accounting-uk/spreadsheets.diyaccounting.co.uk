// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// Catalogue-wide guard for missing formulas: walks every packages/*/*.xlsx via
// JSZip only -- no LibreOffice -- and flags a cell that looks like it should
// carry a shared formula (because sibling cells in the same si group do) but
// has none. This is the "unit test" tier: a dead row anywhere in the
// catalogue, caught in a JSZip scan rather than a LibreOffice recalculation.
//
// Detection and calibration
// --------------------------
// An xlsx shared formula (<f t="shared" ref="A1:A20" si="N">FORMULA</f> on the
// master cell, <f t="shared" si="N"/> on followers) declares its ref= as the
// *bounding box* of every cell that shares si=N -- not a promise that every
// cell inside the box carries a formula. Two patterns confirmed against this
// catalogue's real templates make a naive "every cell in the box must have a
// formula" check produce false positives on every workbook:
//
//   1. Section-header/label rows sit inside a shared range's bounding box
//      with every column blank (e.g. Fixedassets.xlsx Schedule!B49 carries a
//      category label; the numeric columns either side of it, G49..Z49, are
//      all deliberately blank across every shared si group active on that
//      row -- the whole row opts out, not just this one cell).
//   2. A row that IS a live data row can still be blank in one column of a
//      shared range while carrying a formula elsewhere, when that column
//      sources from an external file the row's account doesn't use (e.g.
//      Financialaccounts.xlsx TrialBalance rows pull from different bank/
//      sales/purchase/payroll workbooks per account; a payroll-only line
//      legitimately has no H/I/J/K formula while its own rollup column does).
//   3. A shared range's bounding box can include a genuine spacer column with
//      a different cell style (e.g. Purchases.xlsx row 1's P1:AK1 monthly
//      totals share si=0, but AJ1 inside that box is a styled spacer column,
//      style 79 against the group's style 6, with no formula by design).
//
// The calibrated rule: flag cell X in shared group N's box only when
//   - X has no <f> at all (a cell with its own independent formula, shared or
//     not, is never a gap -- pattern 2 does not apply to X itself), and
//   - X's row carries at least one OTHER shared-formula member somewhere
//     (proof the row is a live, templated row and not a header/spacer row --
//     rules out pattern 1), and
//   - X's style matches a style used by an actual member of group N (proof X
//     is styled as a data cell in this group, not a spacer -- rules out
//     pattern 3).
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

// ── Cell ref / range arithmetic ─────────────────────────────────────────

function colToNum(col) {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function numToCol(n) {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function parseCellRef(ref) {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  return { col: m[1], row: parseInt(m[2], 10) };
}

// Enumerates every cell ref in a rectangular range (single cell or "A1:B5").
function rangeCells(ref) {
  const [a, b] = ref.split(":");
  if (!b) return [a];
  const pa = parseCellRef(a);
  const pb = parseCellRef(b);
  const c1 = colToNum(pa.col);
  const c2 = colToNum(pb.col);
  const r1 = pa.row;
  const r2 = pb.row;
  const out = [];
  for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
      out.push(`${numToCol(c)}${r}`);
    }
  }
  return out;
}

// ── Sheet XML parsing ────────────────────────────────────────────────────

// Parses every <c> element in a worksheet's XML into a
// Map<cellRef, { hasF, fSi, fRef, style }>:
//   hasF  -- true if the cell has any <f> element at all (shared or not)
//   fSi   -- the si= of a t="shared" formula, if present
//   fRef  -- the ref= on a shared formula's master cell, if present
//   style -- the cell's s= (style index), or null
function parseCells(xml) {
  const cells = new Map();
  const cellRe = /<c r="([A-Z]+\d+)"([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g;
  let m;
  while ((m = cellRe.exec(xml))) {
    const [, ref, attrStr, , inner] = m;
    let hasF = false;
    let fSi = null;
    let fRef = null;
    if (inner) {
      const fm = inner.match(/<f([^>]*)(?:\/>|>([\s\S]*?)<\/f>)/);
      if (fm) {
        hasF = true;
        const attrs = fm[1];
        const siMatch = attrs.match(/si="(\d+)"/);
        if (siMatch) fSi = siMatch[1];
        const refMatch = attrs.match(/ref="([^"]*)"/);
        if (refMatch) fRef = refMatch[1];
      }
    }
    const sMatch = attrStr.match(/\ss="(\d+)"/);
    cells.set(ref, { hasF, fSi, fRef, style: sMatch ? sMatch[1] : null });
  }
  return cells;
}

// Implements the calibrated rule documented at the top of this file. Returns
// an array of human-readable gap descriptions (empty when the sheet is clean).
function findFormulaGaps(cells, sheetLabel) {
  const gaps = [];
  const masters = new Map(); // si -> master's ref=
  const membersBySi = new Map(); // si -> Set(cellRef) actually carrying that si
  const stylesBySi = new Map(); // si -> Set(style) used by its members
  const rowsWithAnySharedMembership = new Set();

  for (const [ref, c] of cells) {
    if (c.fRef && c.fSi != null) masters.set(c.fSi, c.fRef);
    if (c.hasF && c.fSi != null) {
      if (!membersBySi.has(c.fSi)) membersBySi.set(c.fSi, new Set());
      membersBySi.get(c.fSi).add(ref);
      if (!stylesBySi.has(c.fSi)) stylesBySi.set(c.fSi, new Set());
      stylesBySi.get(c.fSi).add(c.style);
      rowsWithAnySharedMembership.add(parseCellRef(ref).row);
    }
  }

  for (const [si, ref] of masters) {
    const members = membersBySi.get(si) || new Set();
    const styles = stylesBySi.get(si) || new Set();
    for (const expected of rangeCells(ref)) {
      if (members.has(expected)) continue;
      const c = cells.get(expected);
      if (!c || c.hasF) continue; // absent, or carries its own independent formula
      if (!styles.has(c.style)) continue; // styled unlike every member: a spacer/label cell
      const { row } = parseCellRef(expected);
      if (!rowsWithAnySharedMembership.has(row)) continue; // header/spacer row, not a data row
      gaps.push(
        `${sheetLabel}!${expected}: row ${row} carries other shared formulas and this cell's style matches si=${si}'s members (ref=${ref}), but it has no <f>`,
      );
    }
  }
  return gaps;
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

// ── Breakability proof ───────────────────────────────────────────────────
// The guard must actually fail when a formula is missing. Takes a real,
// known-good sheet from the catalogue, deletes one shared-formula follower's
// <f> element (keeping its cached <v> and style, exactly what a corrupted
// generation step would do), and asserts findFormulaGaps flags it. Entirely
// in-memory -- no file on disk is modified.
describe("Formula presence guard breakability", () => {
  it("flags a shared-formula cell whose <f> element is deleted", async () => {
    const salesWorkbook = workbooks.find((wb) => wb.filename === "Sales.xlsx");
    expect(salesWorkbook, "no Sales.xlsx found in the catalogue to break a copy of").toBeDefined();

    const buffer = readFileSync(salesWorkbook.filePath);
    const zip = await JSZip.loadAsync(buffer);
    const sheetMap = await buildSheetMap(zip);
    const aprFile = sheetMap.get("Apr");
    expect(aprFile, `${salesWorkbook.filePath}: no "Apr" sheet resolved via workbook.xml/rels`).toBeDefined();

    const xml = await zip.file(aprFile).async("string");
    const before = findFormulaGaps(parseCells(xml), "Sales.xlsx Apr");
    expect(before, "sanity: the unmodified sheet must be clean before breaking it").toEqual([]);

    // H7 is a shared-formula follower (si group ref H7:H64) confirmed present
    // in the template; strip its <f t="shared" si="12"/> element but keep the
    // cached <v> and style, exactly as a dropped-formula regression would.
    const cellMatch = xml.match(/<c r="H7"[^>]*>(?:<f[^>]*(?:\/>|>[\s\S]*?<\/f>))?(<v[^>]*>[\s\S]*?<\/v>)?<\/c>/);
    expect(cellMatch, "Sales.xlsx Apr!H7: expected cell not found to break").not.toBeNull();
    const openTag = cellMatch[0].match(/^<c r="H7"[^>]*>/)[0];
    const brokenXml = xml.replace(cellMatch[0], `${openTag}${cellMatch[1] || ""}</c>`);
    expect(brokenXml, "the corrupted XML must actually differ from the original").not.toEqual(xml);

    const after = findFormulaGaps(parseCells(brokenXml), "Sales.xlsx Apr");
    expect(after.some((g) => g.includes("!H7:")), `expected a gap reported for H7, got:\n${after.join("\n")}`).toBe(true);
  });
});
