// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// template-formula-map.js — what formulas a workbook's sheets carry, read
// straight out of the sheet XML with JSZip and no LibreOffice.
//
// Two readers share this. app/test/formula-presence-guard.test.js walks the
// whole catalogue looking for a cell that should carry a shared formula and
// does not, which is a generation bug in one of our own workbooks. The
// overtype sidecar (app/lib/overtype-sidecar.js) compares a customer's
// uploaded workbook against the template it was downloaded from, which is a
// record of what that customer typed over. Both start from the same parse,
// so the two can never disagree about what a cell holds.
//
// Shared formulas
// ---------------
// An xlsx shared formula (<f t="shared" ref="A1:A20" si="N">FORMULA</f> on
// the master cell, <f t="shared" si="N"/> on followers) declares its ref= as
// the *bounding box* of every cell that shares si=N -- not a promise that
// every cell inside the box carries a formula. Two patterns confirmed
// against this catalogue's real templates make a naive "every cell in the
// box must have a formula" check produce false positives on every workbook:
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
// sheet) this rule reports zero gaps.

import { buildSheetMap } from "./spreadsheet-runner.js";

// ── Cell ref / range arithmetic ─────────────────────────────────────────

export function colToNum(col) {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export function numToCol(n) {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function parseCellRef(ref) {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  return { col: m[1], row: parseInt(m[2], 10) };
}

// Enumerates every cell ref in a rectangular range (single cell or "A1:B5").
export function rangeCells(ref) {
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

// Cells in a sheet, ordered by column then row, the way an Excel range reads.
export function sortCellRefs(refs) {
  return [...refs].sort((a, b) => {
    const pa = parseCellRef(a);
    const pb = parseCellRef(b);
    return pa.row - pb.row || colToNum(pa.col) - colToNum(pb.col);
  });
}

// ── Sheet XML parsing ────────────────────────────────────────────────────

/**
 * Every <c> element in a worksheet's XML.
 *
 * @param {string} xml
 * @returns {Map<string, {hasF: boolean, formula: string|null, fSi: string|null, fRef: string|null, style: string|null, hasValue: boolean}>}
 *   hasF     -- true if the cell has any <f> element at all (shared or not)
 *   formula  -- the <f> element's own text, "" for a shared follower that
 *               carries none of its own, null where the cell has no <f>
 *   fSi      -- the si= of a t="shared" formula, if present
 *   fRef     -- the ref= on a shared formula's master cell, if present
 *   style    -- the cell's s= (style index), or null
 *   hasValue -- true if the cell carries a cached <v> or an inline <is>
 */
export function parseCells(xml) {
  const cells = new Map();
  const cellRe = /<c r="([A-Z]+\d+)"([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g;
  let m;
  while ((m = cellRe.exec(xml))) {
    const [, ref, attrStr, , inner] = m;
    let hasF = false;
    let formula = null;
    let fSi = null;
    let fRef = null;
    let hasValue = false;
    if (inner) {
      const fm = inner.match(/<f([^>]*)(?:\/>|>([\s\S]*?)<\/f>)/);
      if (fm) {
        hasF = true;
        formula = fm[2] ?? "";
        const attrs = fm[1];
        const siMatch = attrs.match(/si="(\d+)"/);
        if (siMatch) fSi = siMatch[1];
        const refMatch = attrs.match(/ref="([^"]*)"/);
        if (refMatch) fRef = refMatch[1];
      }
      hasValue = /<v[\s>]/.test(inner) || /<is[\s>]/.test(inner);
    }
    const sMatch = attrStr.match(/\ss="(\d+)"/);
    cells.set(ref, { hasF, formula, fSi, fRef, style: sMatch ? sMatch[1] : null, hasValue });
  }
  return cells;
}

/**
 * The formula every formula-carrying cell in a sheet holds, with a shared
 * follower's blank <f> resolved to its group master's text. A follower's
 * formula is the master's with every relative reference shifted, which the
 * file never spells out; naming the master alongside the text is what keeps
 * the answer honest rather than pretending the follower's own formula was
 * read.
 *
 * @param {Map} cells - the result of parseCells()
 * @returns {Map<string, {formula: string, sharedMaster: string|null}>}
 */
export function formulaCells(cells) {
  const mastersBySi = new Map();
  for (const [ref, c] of cells) {
    if (c.hasF && c.fSi != null && c.fRef) mastersBySi.set(c.fSi, { ref, formula: c.formula });
  }

  const out = new Map();
  for (const [ref, c] of cells) {
    if (!c.hasF) continue;
    if (c.formula) {
      out.set(ref, { formula: c.formula, sharedMaster: null });
      continue;
    }
    const master = c.fSi != null ? mastersBySi.get(c.fSi) : undefined;
    if (master) out.set(ref, { formula: master.formula, sharedMaster: master.ref });
    else out.set(ref, { formula: "", sharedMaster: null });
  }
  return out;
}

/**
 * Every sheet of a workbook and the formulas it carries, in the workbook's
 * own sheet order.
 *
 * @param {Object} zip - a JSZip of an xlsx
 * @returns {Promise<Map<string, Map<string, {formula: string, sharedMaster: string|null}>>>}
 */
export async function workbookFormulaMap(zip) {
  const sheetMap = await buildSheetMap(zip);
  const bySheet = new Map();
  for (const [sheetName, sheetPath] of sheetMap) {
    const xml = await zip.file(sheetPath).async("string");
    bySheet.set(sheetName, formulaCells(parseCells(xml)));
  }
  return bySheet;
}

/**
 * The calibrated missing-shared-formula rule documented at the top of this
 * file. Returns human-readable gap descriptions, empty when the sheet is
 * clean.
 *
 * @param {Map} cells - the result of parseCells()
 * @param {string} sheetLabel - how to name the sheet in a finding
 * @returns {string[]}
 */
export function findFormulaGaps(cells, sheetLabel) {
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
