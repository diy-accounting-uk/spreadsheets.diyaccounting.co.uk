// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// payslips-date-chain.js — recomputes the cached dates the Payslips workbook
// carries downstream of its Admin calendar.
//
// The Admin sheet's B column is a daily calendar anchored on the payroll
// year's 6 April, and the generator rewrites both the anchor and every cached
// day on it. The rest of the workbook does not read that calendar day by day.
// A month tab's first weekly block reads it once and then the blocks chain:
// each one counts days off the block above it, and the first block of a month
// counts off the last block of the month before, on the tab before. Only the
// seeds are Admin reads, so rolling the Admin reads alone leaves every counted
// cell on the template's own year -- a week ending a year before it starts, on
// the workbook a customer downloads and opens without recalculating.
//
// So the chain is evaluated rather than pattern-rolled: the cells the layout
// says carry a date are computed from their own formulas, over the calendar
// the generator has just written, and their caches replaced. A formula the
// evaluator does not recognise throws, because the alternative is keeping a
// stale cache and calling it rolled.

import { PAYROLL_WEEKS_PER_MONTH, PAYSLIP_PRINT_SHEET, PAYSLIP_PRINT_CELLS } from "./payslips-layout.js";

export const PAYSLIPS_EMPLOYEE_SHEET = "Employee";
export const PAYSLIPS_ADMIN_SHEET = "Admin";
export const PAYSLIPS_PAYMENT_SHEET = "Payment";

// The Admin daily calendar: B2 is the payroll year's first day and every row
// below it one day later, down to the last row the chain reaches.
const ADMIN_CALENDAR_FIRST_ROW = 2;
const ADMIN_CALENDAR_LAST_ROW = 381;
// I1 is the payroll year's last day, the day before the next year's B2.
const ADMIN_YEAR_END_CELL = "I1";

// The Admin sheet's own "Date code" column reads two days back off the B
// chain: the payroll year's first (E2) and its last (E366).
const ADMIN_DATE_CODE_CELLS = ["E2", "E366"];

// The Employee sheet dates its calendar column straight off the Admin chain,
// which the Admin roll already reaches. M9 and O9 are the year's two ends the
// sheet prints as a caption, O9 through Admin's I1 rather than its B column.
const EMPLOYEE_CHAIN_CELLS = ["M9", "O9"];

// The PAYE remittance schedule's rows: B the tax month end, C the day the
// payment is due, M the online filing month code the first row builds from
// the calendar's own year and the rest count up from.
const PAYMENT_FIRST_ROW = 4;
const PAYMENT_LAST_ROW = 15;
const PAYMENT_CHAIN_COLUMNS = ["B", "C", "M"];

// The printed page's "Tax Week ended" and the four copies of it further down
// the page. Each is an INDIRECT through the page's own join, so the date on
// the page a customer prints is the chain's, one step removed.
const PRINT_PERIOD_END_CELLS = [PAYSLIP_PRINT_CELLS.periodEnd, "I23", "I38", "I52", "I67"];

// The page's join to a month tab: H3 the tab name, H4 the row its block starts
// on. Both are LOOKUPs down the Admin calendar, which this evaluator does not
// compute -- the generator sets H3's cache when it renames the tabs and the
// template ships H4's, so the join is read from there. Their values are
// checked before use, because a join read from a stale cache would move every
// figure on the page rather than fail.
const PRINT_JOIN_CELLS = [PAYSLIP_PRINT_CELLS.tab, PAYSLIP_PRINT_CELLS.blockRow];

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86400000;

const serialToUtc = (serial) => new Date(EXCEL_EPOCH_UTC + Math.round(serial) * MS_PER_DAY);
const utcToSerial = (date) => Math.round((date.getTime() - EXCEL_EPOCH_UTC) / MS_PER_DAY);

/**
 * The cells this evaluator recomputes, in the order the layout lays them out.
 * The month tabs come from the workbook rather than from a name list, because
 * the tabs are renamed for a non-March year end and their place in the book is
 * what fixes the block rows.
 * @param {string[]} monthTabs - the twelve month tabs in workbook order
 * @returns {{sheet: string, ref: string}[]}
 */
export function payslipsChainedDateCells(monthTabs) {
  if (monthTabs.length !== PAYROLL_WEEKS_PER_MONTH.length) {
    throw new Error(`The Payslips workbook has ${monthTabs.length} month tabs, not ${PAYROLL_WEEKS_PER_MONTH.length}`);
  }
  const cells = [];
  monthTabs.forEach((tab, monthIndex) => {
    // One ten-row block per tax week from row 8, then the monthly block below
    // them. Each block opens its period on its second row: K the first day, M
    // the last.
    const blocks = PAYROLL_WEEKS_PER_MONTH[monthIndex] + 1;
    for (let block = 0; block < blocks; block++) {
      const row = 9 + 10 * block;
      cells.push({ sheet: tab, ref: `K${row}` }, { sheet: tab, ref: `M${row}` });
    }
  });
  for (const ref of EMPLOYEE_CHAIN_CELLS) cells.push({ sheet: PAYSLIPS_EMPLOYEE_SHEET, ref });
  for (const ref of ADMIN_DATE_CODE_CELLS) cells.push({ sheet: PAYSLIPS_ADMIN_SHEET, ref });
  for (let row = PAYMENT_FIRST_ROW; row <= PAYMENT_LAST_ROW; row++) {
    for (const column of PAYMENT_CHAIN_COLUMNS) cells.push({ sheet: PAYSLIPS_PAYMENT_SHEET, ref: `${column}${row}` });
  }
  for (const ref of PRINT_PERIOD_END_CELLS) cells.push({ sheet: PAYSLIP_PRINT_SHEET, ref });
  return cells;
}

// ── Reading a sheet's cells out of its XML ──────────────────────────────────

const CELL_PATTERN = /<c\s+r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
const FORMULA_PATTERN = /<f([^>]*?)(?:\/>|>([\s\S]*?)<\/f>)/;

function decodeXml(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// One sheet's cells, with shared formulas resolved back to the text their
// master cell declares. A shared formula's continuation cells carry no text of
// their own, so a chain running through one would otherwise look like a cell
// with no formula at all.
function readSheet(name, xml, sharedStrings) {
  const cells = new Map();
  const sharedMasters = new Map();
  for (const match of xml.matchAll(CELL_PATTERN)) {
    const [, ref, attrs, body] = match;
    const type = (attrs.match(/\st="([^"]+)"/) || [])[1] || "n";
    const valueMatch = body ? body.match(/<v>([\s\S]*?)<\/v>/) : null;
    const formulaMatch = body ? body.match(FORMULA_PATTERN) : null;
    const cell = { ref, type, raw: valueMatch ? decodeXml(valueMatch[1]) : null, formula: null, shared: null };
    if (formulaMatch) {
      const formulaAttrs = formulaMatch[1] || "";
      const text = formulaMatch[2] ? decodeXml(formulaMatch[2]) : null;
      const si = (formulaAttrs.match(/\ssi="(\d+)"/) || [])[1];
      if (si !== undefined && text) sharedMasters.set(si, { ref, text });
      cell.formula = text;
      cell.shared = si;
    }
    cells.set(ref, cell);
  }
  for (const cell of cells.values()) {
    if (cell.formula || cell.shared === null || cell.shared === undefined) continue;
    const master = sharedMasters.get(cell.shared);
    if (!master) throw new Error(`Payslips ${name}!${cell.ref} shares formula ${cell.shared}, which no cell declares`);
    cell.formula = translateFormula(master.text, master.ref, cell.ref);
  }
  return { name, cells, sharedStrings };
}

const columnToNumber = (column) => [...column].reduce((n, letter) => n * 26 + (letter.charCodeAt(0) - 64), 0);

function numberToColumn(number) {
  let column = "";
  let n = number;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    n = Math.floor((n - remainder) / 26);
  }
  return column;
}

const splitRef = (ref) => {
  const parts = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!parts) throw new Error(`${ref} is not a cell reference`);
  return { column: parts[1], row: parseInt(parts[2], 10) };
};

// A shared formula's continuation cells hold the master's formula with every
// relative reference shifted by the distance between the two cells. An
// absolute part ($A, $1) does not move.
const SHIFTABLE_REF = /(\$?)([A-Z]{1,3})(\$?)(\d+)/g;

function translateFormula(text, masterRef, targetRef) {
  const master = splitRef(masterRef);
  const target = splitRef(targetRef);
  const columnShift = columnToNumber(target.column) - columnToNumber(master.column);
  const rowShift = target.row - master.row;
  return text.replace(SHIFTABLE_REF, (whole, columnAbsolute, column, rowAbsolute, row) => {
    const newColumn = columnAbsolute ? column : numberToColumn(columnToNumber(column) + columnShift);
    const newRow = rowAbsolute ? row : String(parseInt(row, 10) + rowShift);
    return `${columnAbsolute}${newColumn}${rowAbsolute}${newRow}`;
  });
}

// ── The formula grammar the chain is written in ─────────────────────────────

const TOKEN_PATTERN =
  /\s*(?:(?<number>\d+(?:\.\d+)?)|(?<string>"(?:[^"]|"")*")|(?<sheetRef>(?:'[^']+'|[A-Za-z_][A-Za-z0-9_.]*)!\$?[A-Z]{1,3}\$?\d+)|(?<call>[A-Za-z][A-Za-z0-9.]*)\s*\(|(?<ref>\$?[A-Z]{1,3}\$?\d+)|(?<word>[A-Za-z][A-Za-z0-9.]*)|(?<symbol>[-+*/(),]))/y;

function tokenize(formula, where) {
  const tokens = [];
  TOKEN_PATTERN.lastIndex = 0;
  while (TOKEN_PATTERN.lastIndex < formula.length) {
    const start = TOKEN_PATTERN.lastIndex;
    const match = TOKEN_PATTERN.exec(formula);
    if (!match) {
      if (/^\s*$/.test(formula.slice(start))) break;
      throw new Error(`${where} reads ${formula}, which this evaluator cannot read from column ${start + 1}`);
    }
    const groups = match.groups;
    if (groups.number !== undefined) tokens.push({ kind: "number", text: groups.number });
    else if (groups.string !== undefined) tokens.push({ kind: "string", text: groups.string.slice(1, -1).replace(/""/g, '"') });
    else if (groups.sheetRef !== undefined) tokens.push({ kind: "ref", text: groups.sheetRef });
    else if (groups.call !== undefined) tokens.push({ kind: "call", text: groups.call.toUpperCase() });
    else if (groups.ref !== undefined) tokens.push({ kind: "ref", text: groups.ref });
    else if (groups.word !== undefined) tokens.push({ kind: "word", text: groups.word.toUpperCase() });
    else tokens.push({ kind: "symbol", text: groups.symbol });
  }
  return tokens;
}

// ADDRESS() hands INDIRECT() a reference rather than a value, so it evaluates
// to one. Nothing else in this grammar takes or returns a reference.
const isReference = (value) => value !== null && typeof value === "object" && "sheet" in value;

function parseFormula(tokens, where, formula) {
  let position = 0;
  const peek = () => tokens[position];
  const take = () => tokens[position++];
  const expect = (text) => {
    const token = take();
    if (!token || token.text !== text) throw new Error(`${where} reads ${formula}, which this evaluator cannot read: expected ${text}`);
  };

  function parseExpression() {
    let node = parseTerm();
    while (peek() && (peek().text === "+" || peek().text === "-")) {
      const operator = take().text;
      node = { kind: "binary", operator, left: node, right: parseTerm() };
    }
    return node;
  }

  function parseTerm() {
    let node = parseUnary();
    while (peek() && (peek().text === "*" || peek().text === "/")) {
      const operator = take().text;
      node = { kind: "binary", operator, left: node, right: parseUnary() };
    }
    return node;
  }

  function parseUnary() {
    if (peek() && peek().text === "-") {
      take();
      return { kind: "negate", operand: parseUnary() };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const token = take();
    if (!token) throw new Error(`${where} reads ${formula}, which ends before it is finished`);
    if (token.kind === "number") return { kind: "number", value: Number(token.text) };
    if (token.kind === "string") return { kind: "string", value: token.text };
    if (token.kind === "ref") return { kind: "ref", text: token.text };
    if (token.kind === "word") {
      if (token.text === "TRUE") return { kind: "boolean", value: true };
      if (token.text === "FALSE") return { kind: "boolean", value: false };
      throw new Error(`${where} reads ${formula}, whose ${token.text} this evaluator does not know`);
    }
    if (token.kind === "call") {
      const args = [];
      if (peek() && peek().text === ")") take();
      else {
        for (;;) {
          args.push(parseExpression());
          const next = take();
          if (!next) throw new Error(`${where} reads ${formula}, whose ${token.text}( never closes`);
          if (next.text === ")") break;
          if (next.text !== ",") throw new Error(`${where} reads ${formula}, which this evaluator cannot read at ${next.text}`);
        }
      }
      return { kind: "call", name: token.text, args };
    }
    if (token.text === "(") {
      const node = parseExpression();
      expect(")");
      return node;
    }
    throw new Error(`${where} reads ${formula}, which this evaluator cannot read at ${token.text}`);
  }

  const node = parseExpression();
  if (position !== tokens.length) throw new Error(`${where} reads ${formula}, which has more in it than this evaluator can read`);
  return node;
}

// ── Walking the chain ───────────────────────────────────────────────────────

/**
 * Recompute every cached date the Payslips workbook carries downstream of its
 * Admin calendar, and hand back the sheets whose XML changed.
 *
 * @param {Map<string, string>} sheetXmls - sheet name to worksheet XML, in workbook order
 * @param {number} startYear - the year the package's payroll calendar opens in
 * @param {string[]} sharedStrings - the workbook's shared string table
 * @param {(xml: string, ref: string, value: string|number) => string} writeCachedValue
 * @returns {Map<string, string>} the same sheet names, with the recomputed caches written
 */
export function rollPayslipsCachedDateChain(sheetXmls, startYear, sharedStrings, writeCachedValue) {
  const sheets = new Map();
  for (const [name, xml] of sheetXmls) sheets.set(name, readSheet(name, xml, sharedStrings));

  const monthTabs = [...sheetXmls.keys()].filter((name) => MONTH_TAB_NAMES.has(name));
  const yearStartSerial = utcToSerial(new Date(Date.UTC(startYear, 3, 6)));
  const yearEndSerial = utcToSerial(new Date(Date.UTC(startYear + 1, 3, 5)));

  const values = new Map();
  const inProgress = new Set();

  const cellValue = (sheetName, ref) => {
    const key = `${sheetName}!${ref}`;
    if (values.has(key)) return values.get(key);
    if (inProgress.has(key)) throw new Error(`Payslips ${key} is on a chain that comes back to itself`);
    inProgress.add(key);
    const value = computeCell(sheetName, ref, key);
    inProgress.delete(key);
    values.set(key, value);
    return value;
  };

  function computeCell(sheetName, ref, key) {
    // The Admin calendar is the chain's floor: the generator has just written
    // it, so it is read from the year rather than from the sheet.
    if (sheetName === PAYSLIPS_ADMIN_SHEET) {
      const parts = /^\$?B\$?(\d+)$/.exec(ref);
      if (parts) {
        const row = parseInt(parts[1], 10);
        if (row < ADMIN_CALENDAR_FIRST_ROW || row > ADMIN_CALENDAR_LAST_ROW) {
          throw new Error(`Payslips ${key} is off the Admin calendar, which runs B${ADMIN_CALENDAR_FIRST_ROW}:B${ADMIN_CALENDAR_LAST_ROW}`);
        }
        return yearStartSerial + (row - ADMIN_CALENDAR_FIRST_ROW);
      }
      if (ref.replace(/\$/g, "") === ADMIN_YEAR_END_CELL) return yearEndSerial;
    }

    const sheet = sheets.get(sheetName);
    if (!sheet) throw new Error(`Payslips ${key} names a sheet the workbook does not have`);
    const cell = sheet.cells.get(ref.replace(/\$/g, ""));
    if (!cell) throw new Error(`Payslips ${key} is not on the sheet`);

    // The page's join is a LOOKUP this evaluator does not compute. Its cache
    // is set by the pass that renames the tabs, so it is read from there --
    // checked, because a wrong join moves every figure on the printed page.
    if (sheetName === PAYSLIP_PRINT_SHEET && PRINT_JOIN_CELLS.includes(ref)) {
      return printJoinValue(ref, cell, key, monthTabs);
    }

    if (cell.formula === null) return cachedValue(cell, key);
    const tokens = tokenize(cell.formula, `Payslips ${key}`);
    return evaluate(parseFormula(tokens, `Payslips ${key}`, cell.formula), sheetName, key, cell.formula);
  }

  function cachedValue(cell, key) {
    if (cell.raw === null) throw new Error(`Payslips ${key} holds neither a formula nor a value`);
    if (cell.type === "s") {
      const text = sharedStrings[parseInt(cell.raw, 10)];
      if (text === undefined) throw new Error(`Payslips ${key} names shared string ${cell.raw}, which the workbook does not have`);
      return text;
    }
    if (cell.type === "str" || cell.type === "inlineStr") return cell.raw;
    const number = Number(cell.raw);
    if (!Number.isFinite(number)) throw new Error(`Payslips ${key} holds ${cell.raw}, which is not a number`);
    return number;
  }

  function printJoinValue(ref, cell, key, tabs) {
    const value = cachedValue(cell, key);
    if (ref === PAYSLIP_PRINT_CELLS.tab) {
      if (!tabs.includes(value)) throw new Error(`Payslips ${key} joins to ${value}, which is not a month tab`);
      return value;
    }
    if (!Number.isInteger(value) || value < 1) throw new Error(`Payslips ${key} starts the block at ${value}, which is not a row`);
    return value;
  }

  function evaluate(node, sheetName, key, formula) {
    switch (node.kind) {
      case "number":
      case "string":
      case "boolean":
        return node.value;
      case "negate":
        return -asNumber(evaluate(node.operand, sheetName, key, formula), key, formula);
      case "binary": {
        const left = asNumber(evaluate(node.left, sheetName, key, formula), key, formula);
        const right = asNumber(evaluate(node.right, sheetName, key, formula), key, formula);
        if (node.operator === "+") return left + right;
        if (node.operator === "-") return left - right;
        if (node.operator === "*") return left * right;
        if (right === 0) throw new Error(`Payslips ${key} reads ${formula}, which divides by zero`);
        return left / right;
      }
      case "ref": {
        const reference = resolveRef(node.text, sheetName);
        return cellValue(reference.sheet, reference.ref);
      }
      case "call":
        return callFunction(node, sheetName, key, formula);
      default:
        throw new Error(`Payslips ${key} reads ${formula}, which this evaluator cannot read`);
    }
  }

  function callFunction(node, sheetName, key, formula) {
    const argument = (index) => evaluate(node.args[index], sheetName, key, formula);
    const number = (index) => asNumber(argument(index), key, formula);
    const arity = (expected) => {
      if (node.args.length !== expected) {
        throw new Error(`Payslips ${key} reads ${formula}, whose ${node.name} takes ${node.args.length} arguments, not ${expected}`);
      }
    };
    switch (node.name) {
      case "DATE": {
        arity(3);
        const months = number(0) * 12 + (number(1) - 1);
        return utcToSerial(new Date(Date.UTC(Math.floor(months / 12), months % 12, number(2))));
      }
      case "YEAR":
        arity(1);
        return serialToUtc(number(0)).getUTCFullYear();
      case "MONTH":
        arity(1);
        return serialToUtc(number(0)).getUTCMonth() + 1;
      case "DAY":
        arity(1);
        return serialToUtc(number(0)).getUTCDate();
      case "WEEKDAY": {
        // Only return type 2 -- Monday 1 through Sunday 7 -- is in the chain,
        // and the other types number the week differently enough that reading
        // one as another silently moves every week end.
        arity(2);
        if (number(1) !== 2) throw new Error(`Payslips ${key} reads ${formula}, whose WEEKDAY return type this evaluator does not know`);
        return ((serialToUtc(number(0)).getUTCDay() + 6) % 7) + 1;
      }
      case "ADDRESS": {
        // ADDRESS(row, column, 1, TRUE, sheet) -- an absolute A1 reference on
        // a named sheet, which is the only form the printed page builds.
        arity(5);
        if (number(2) !== 1) throw new Error(`Payslips ${key} reads ${formula}, whose ADDRESS is not an absolute reference`);
        if (argument(3) !== true) throw new Error(`Payslips ${key} reads ${formula}, whose ADDRESS is not in A1 style`);
        const sheet = argument(4);
        if (typeof sheet !== "string") throw new Error(`Payslips ${key} reads ${formula}, whose ADDRESS names no sheet`);
        return { sheet, ref: `${numberToColumn(number(1))}${number(0)}` };
      }
      case "INDIRECT": {
        arity(1);
        const reference = argument(0);
        if (!isReference(reference)) throw new Error(`Payslips ${key} reads ${formula}, whose INDIRECT is not built from ADDRESS`);
        return cellValue(reference.sheet, reference.ref);
      }
      default:
        throw new Error(`Payslips ${key} reads ${formula}, whose ${node.name} this evaluator does not know`);
    }
  }

  function asNumber(value, key, formula) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`Payslips ${key} reads ${formula}, which works on ${JSON.stringify(value)} as though it were a number`);
    }
    return value;
  }

  function resolveRef(text, sheetName) {
    const qualified = /^(?:'([^']+)'|([A-Za-z_][A-Za-z0-9_.]*))!(\$?[A-Z]{1,3}\$?\d+)$/.exec(text);
    if (qualified) return { sheet: qualified[1] ?? qualified[2], ref: (qualified[3] || "").replace(/\$/g, "") };
    return { sheet: sheetName, ref: text.replace(/\$/g, "") };
  }

  const rolled = new Map(sheetXmls);
  for (const { sheet, ref } of payslipsChainedDateCells(monthTabs)) {
    const value = cellValue(sheet, ref);
    rolled.set(sheet, writeCachedValue(rolled.get(sheet), ref, value));
  }
  return rolled;
}

const MONTH_TAB_NAMES = new Set(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
