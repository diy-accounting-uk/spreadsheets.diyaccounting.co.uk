// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl-edits.js — Named, in-memory edits over a diya-gl book's own
// lines.jsonl. Each operation takes (book, lines, params) and returns a new
// lines array; nothing here reads or writes a file, so the MCP server and a
// browser page can call the same functions a Node CLI does.
//
// Recalculation never rewrites D: an edit's whole effect is read off R by
// running calculateFromDiyaGl (and checkCompliance) again on the returned
// lines, the same D-to-R loop report.js's diya-gl mode performs. There is no
// undo to design here -- the caller keeps whichever lines array it wants to
// go back to.
//
// A diya-gl line already carries its own bank movement (a sale or purchase
// line is the transaction as banked or invoiced, not one leg of a
// double-entry pair the way a full ledger journal would post it), so adding
// one line needs no separate counter-leg entry.

/**
 * Append a sales line. Refuses a line posted to any other journal, so a
 * caller cannot silently add a purchase under this name.
 * @param {Object} book - parsed book.toml (unused; kept for a uniform edit
 *   signature across all three operations, and for edits that need it later)
 * @param {Array} lines - the book's current lines.jsonl entries
 * @param {{line: Object}} params - the sales line to add
 * @returns {Array} a new lines array with the line appended
 */
export function addSaleLine(book, lines, params) {
  const { line } = params;
  if (line.sourceJournalID !== "sales") {
    throw new Error(`addSaleLine expects a line with sourceJournalID "sales", got "${line.sourceJournalID}"`);
  }
  return [...lines, line];
}

/**
 * Append a purchases line. Refuses a line posted to any other journal, so a
 * caller cannot silently add a sale under this name.
 * @param {Object} book - parsed book.toml (unused; see addSaleLine)
 * @param {Array} lines - the book's current lines.jsonl entries
 * @param {{line: Object}} params - the purchase line to add
 * @returns {Array} a new lines array with the line appended
 */
export function addPurchaseLine(book, lines, params) {
  const { line } = params;
  if (line.sourceJournalID !== "purchases") {
    throw new Error(`addPurchaseLine expects a line with sourceJournalID "purchases", got "${line.sourceJournalID}"`);
  }
  return [...lines, line];
}

/**
 * Change one existing line's amount, identified by its entryNumber. Every
 * other field on the line is carried over unchanged.
 * @param {Object} book - parsed book.toml (unused; see addSaleLine)
 * @param {Array} lines - the book's current lines.jsonl entries
 * @param {{entryNumber: string, newAmount: number}} params
 * @returns {Array} a new lines array with the named line's amount changed
 */
export function changeLineAmount(book, lines, params) {
  const { entryNumber, newAmount } = params;
  let found = false;
  const changed = lines.map((line) => {
    if (line.entryNumber !== entryNumber) return line;
    found = true;
    return { ...line, amount: newAmount };
  });
  if (!found) throw new Error(`No line carries entryNumber ${entryNumber}`);
  return changed;
}

/**
 * Remove one existing line, identified by its entryNumber.
 * @param {Object} book - parsed book.toml (unused; see addSaleLine)
 * @param {Array} lines - the book's current lines.jsonl entries
 * @param {{entryNumber: string}} params
 * @returns {Array} a new lines array with the named line removed
 */
export function removeLine(book, lines, params) {
  const { entryNumber } = params;
  let found = false;
  const filtered = lines.filter((line) => {
    if (line.entryNumber !== entryNumber) return true;
    found = true;
    return false;
  });
  if (!found) throw new Error(`No line carries entryNumber ${entryNumber}`);
  return filtered;
}
