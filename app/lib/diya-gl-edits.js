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

// YYYY-MM-DD, and a real calendar date under it -- "2025-02-30" matches the
// regex but is not a date, so it is walked back through Date.UTC and checked
// for round-tripping to the same year/month/day.
function isValidIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// Every section of the chart of accounts a line's accountMainID can name --
// mirrors diya-gl-schema.js's own declaredAccountCodes(), the referential
// check validateLines() already runs over every line's accountMainID.
const ACCOUNT_SECTIONS = ["sales", "purchases", "bank", "capital", "assets", "liabilities"];

function declaredAccountCodes(book) {
  const codes = new Set();
  for (const section of ACCOUNT_SECTIONS) {
    for (const code of Object.keys(book?.accounts?.[section] || {})) codes.add(code);
  }
  return codes;
}

/**
 * Change one existing line's posting date, identified by its entryNumber.
 * Every other field on the line, including its position in the array, is
 * carried over unchanged -- unlike removing and re-adding the line, which
 * moves it to the end, this keeps the in-memory order the page renders from.
 * @param {Object} book - parsed book.toml, for the chart-honouring precedent's
 *   own shape (unused here; a date carries no chart membership to check)
 * @param {Array} lines - the book's current lines.jsonl entries
 * @param {{entryNumber: string, newPostingDate: string}} params
 * @returns {Array} a new lines array with the named line's posting date changed
 */
export function changeLinePostingDate(book, lines, params) {
  const { entryNumber, newPostingDate } = params;
  if (!isValidIsoDate(newPostingDate)) {
    throw new Error(`changeLinePostingDate expects a valid ISO 8601 date (YYYY-MM-DD), got "${newPostingDate}"`);
  }
  let found = false;
  const changed = lines.map((line) => {
    if (line.entryNumber !== entryNumber) return line;
    found = true;
    return { ...line, postingDate: newPostingDate };
  });
  if (!found) throw new Error(`No line carries entryNumber ${entryNumber}`);
  return changed;
}

/**
 * Change one existing line's account, identified by its entryNumber. The new
 * account has to be one the book's own chart declares (book.toml's
 * [accounts.*] tables -- see resolveBstPurchaseCodeMap in diya-gl-loader.js
 * for the same chart-honouring precedent), or the line would silently reach
 * no column on any sheet. Every other field, including the line's position
 * in the array, is carried over unchanged.
 * @param {Object} book - parsed book.toml, for its declared chart of accounts
 * @param {Array} lines - the book's current lines.jsonl entries
 * @param {{entryNumber: string, newAccountMainID: string}} params
 * @returns {Array} a new lines array with the named line's account changed
 */
export function changeLineAccount(book, lines, params) {
  const { entryNumber, newAccountMainID } = params;
  if (!declaredAccountCodes(book).has(newAccountMainID)) {
    throw new Error(`changeLineAccount expects an account declared in the book's own chart, got "${newAccountMainID}"`);
  }
  let found = false;
  const changed = lines.map((line) => {
    if (line.entryNumber !== entryNumber) return line;
    found = true;
    return { ...line, accountMainID: newAccountMainID };
  });
  if (!found) throw new Error(`No line carries entryNumber ${entryNumber}`);
  return changed;
}

/**
 * Move one existing bank entry to another of the book's own bank accounts,
 * identified by its entryNumber. A bank line names its account twice -- as
 * the line's own account and as the bank account the workbook is keyed by --
 * and both move together, or the entry would reach one workbook and be
 * totalled under another. The new account has to be one the book's chart
 * declares under [accounts.bank], and the named line has to be on the bank
 * journal. Every other field, including the line's position in the array,
 * is carried over unchanged.
 * @param {Object} book - parsed book.toml, for its declared bank accounts
 * @param {Array} lines - the book's current lines.jsonl entries
 * @param {{entryNumber: string, newBankAccountID: string}} params
 * @returns {Array} a new lines array with the named line's bank account changed
 */
export function changeLineBankAccount(book, lines, params) {
  const { entryNumber, newBankAccountID } = params;
  if (!Object.keys(book?.accounts?.bank || {}).includes(newBankAccountID)) {
    throw new Error(`changeLineBankAccount expects a bank account declared in the book's own chart, got "${newBankAccountID}"`);
  }
  let found = false;
  const changed = lines.map((line) => {
    if (line.entryNumber !== entryNumber) return line;
    if (line.sourceJournalID !== "bank") {
      throw new Error(`changeLineBankAccount expects a line on the bank journal, got "${line.sourceJournalID}"`);
    }
    found = true;
    return { ...line, "accountMainID": newBankAccountID, "diya-gl:bankAccountID": newBankAccountID };
  });
  if (!found) throw new Error(`No line carries entryNumber ${entryNumber}`);
  return changed;
}
