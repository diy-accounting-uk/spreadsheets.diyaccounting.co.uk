// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl-edits-ltd.js — The named edits only a Company book carries: a
// payroll line's own figures, and the three registers book.toml holds rather
// than lines.jsonl (the board's dividend, the members and the charges).
// Everything the four products share lives in diya-gl-edits.js.
//
// Two shapes, both taking (book, lines, params) so a caller can dispatch
// either from one map. A line edit returns a new lines array and leaves the
// book alone; a book edit returns a new book and leaves the lines array
// alone. Neither mutates its input, and a line keeps its position in the
// array -- the page renders in that order, so rewriting in place rather
// than removing and re-adding is what keeps the rows still.

import { validateBook, validateLines } from "./diya-gl-schema.js";

const PAYROLL_FIGURE_FIELDS = {
  grossPay: "diya-gl:grossPay",
  incomeTax: "diya-gl:incomeTax",
  employeeNI: "diya-gl:employeeNI",
  employerNI: "diya-gl:employerNI",
};

function refuseInvalidBook(edit, book) {
  const { valid, errors } = validateBook(book);
  if (!valid) throw new Error(`${edit} would leave the book invalid: ${errors.join("; ")}`);
}

/**
 * Change one payroll line's figures, identified by its entryNumber. Every
 * named figure replaces the line's own; the ones left out keep what the line
 * already carries. Net pay is never taken from the caller -- it is gross less
 * income tax less employee NI, recomputed from whichever four figures the
 * line ends up with -- and the line's amount is its gross, which is how the
 * fixtures' own payroll lines read.
 *
 * Naming an employeeID moves the line to that employee: the id has to name
 * one of book.employees, and the line's detailComment becomes their name,
 * because the Payslips sheets key a row by the name rather than the id.
 * @param {Object} book - parsed book.toml, for its employees register
 * @param {Array} lines - the book's current lines.jsonl entries
 * @param {{entryNumber: string, grossPay?: number, incomeTax?: number, employeeNI?: number, employerNI?: number, employeeID?: string}} params
 * @returns {Array} a new lines array with the named line's payroll figures changed
 */
export function changePayrollLine(book, lines, params) {
  const { entryNumber, employeeID } = params;
  const line = lines.find((entry) => entry.entryNumber === entryNumber);
  if (!line) throw new Error(`No line carries entryNumber ${entryNumber}`);
  if (line.sourceJournalID !== "payroll") {
    throw new Error(`changePayrollLine expects a line with sourceJournalID "payroll", got "${line.sourceJournalID}"`);
  }

  const changed = { ...line };
  for (const [name, field] of Object.entries(PAYROLL_FIGURE_FIELDS)) {
    if (params[name] === undefined) continue;
    if (typeof params[name] !== "number" || !Number.isFinite(params[name])) {
      throw new Error(`changePayrollLine expects ${name} to be a number, got "${params[name]}"`);
    }
    if (params[name] < 0) throw new Error(`changePayrollLine expects ${name} to be nil or above, got ${params[name]}`);
    changed[field] = params[name];
  }

  if (employeeID !== undefined) {
    const employee = (book.employees || []).find((entry) => entry.employeeID === employeeID);
    if (!employee) throw new Error(`changePayrollLine expects an employee the book declares, got "${employeeID}"`);
    changed["diya-gl:employeeID"] = employeeID;
    changed.detailComment = employee.name;
  }

  const grossPay = changed["diya-gl:grossPay"];
  changed["diya-gl:netPay"] = grossPay - changed["diya-gl:incomeTax"] - changed["diya-gl:employeeNI"];
  changed.amount = grossPay;

  const { valid, errors } = validateLines([changed], book);
  if (!valid) throw new Error(`changePayrollLine would leave line ${entryNumber} invalid: ${errors.join("; ")}`);

  return lines.map((entry) => (entry.entryNumber === entryNumber ? changed : entry));
}

/**
 * Set the dividend the board declared. The register holds one declaration,
 * which the minute, the trial balance and the published profit and loss
 * account all read; an amount of nil takes it off the book, for a company
 * that declared none.
 * @param {Object} book - parsed book.toml
 * @param {Array} lines - the book's current lines.jsonl entries (unchanged)
 * @param {{boardMeetingDate: string, amount: number}} params
 * @returns {Object} a new book carrying the declaration
 */
export function setDividend(book, lines, params) {
  const { boardMeetingDate, amount } = params;
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new Error(`setDividend expects an amount as a number, got "${amount}"`);
  }
  if (amount < 0) throw new Error(`setDividend expects an amount of nil or above, got ${amount}`);

  const changed = { ...book };
  if (amount === 0) {
    delete changed.dividends;
  } else {
    changed.dividends = [{ boardMeetingDate, amount }];
  }
  refuseInvalidBook("setDividend", changed);
  return changed;
}

/**
 * Replace the register of members. A member a line names by
 * diya-gl:memberID has to stay on the register, so the lines are checked
 * against the new book as well as the book itself.
 * @param {Object} book - parsed book.toml
 * @param {Array} lines - the book's current lines.jsonl entries (unchanged)
 * @param {{members: Array<{memberID: string, name: string, shares: number, acquiredDate?: string}>}} params
 * @returns {Object} a new book carrying the register
 */
export function setMembers(book, lines, params) {
  const { members } = params;
  if (!Array.isArray(members)) throw new Error(`setMembers expects members as an array, got "${members}"`);

  const changed = { ...book, members };
  refuseInvalidBook("setMembers", changed);
  const { valid, errors } = validateLines(lines, changed);
  if (!valid) throw new Error(`setMembers would leave the lines invalid: ${errors.join("; ")}`);
  return changed;
}

/**
 * Replace the register of charges and debentures.
 * @param {Object} book - parsed book.toml
 * @param {Array} lines - the book's current lines.jsonl entries (unchanged)
 * @param {{charges: Array<{chargeDate?: string, description?: string, valuation: number, holder?: string, terms?: string, boardMeetingDate?: string}>}} params
 * @returns {Object} a new book carrying the register
 */
export function setCharges(book, lines, params) {
  const { charges } = params;
  if (!Array.isArray(charges)) throw new Error(`setCharges expects charges as an array, got "${charges}"`);

  const changed = { ...book, charges };
  refuseInvalidBook("setCharges", changed);
  return changed;
}

export const LTD_LINE_EDITS = { changePayrollLine };
export const LTD_BOOK_EDITS = { setDividend, setMembers, setCharges };
