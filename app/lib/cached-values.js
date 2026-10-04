// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// cached-values.js — every formula cell's cached <v> brought into line with
// the cells it reads, by evaluating the workbook's own formulas in JavaScript.
//
// An xlsx keeps the last result of each formula beside the formula. Excel
// recalculates on open because every workbook here carries fullCalcOnLoad,
// but LibreOffice and Collabora show the cached result as it stands. A
// workbook written from a template therefore opens with the template's year
// on every heading unless the cached results move with the cells the writer
// changed. Given the workbook before and after a write, this module finds the
// cells the write changed, follows every formula that reads them, directly
// or through other formulas, evaluates those formulas over the workbook's
// current cells and writes each result into its <v> where it differs. No
// other byte moves, so a workbook nothing was written into comes back as the
// same bytes.
//
// Cross-file references read the external link caches as they stand: those
// are filled by the generator and by link-caches.js, never here. A cell the
// cache leaves out reads as blank, which is how Excel saves an empty one.
//
// A formula this evaluator cannot compute (a function it does not implement,
// TODAY(), a circular reference) keeps its cached value, and so does every
// formula that reads such a cell, because a result computed from a stale
// input would be a guess. The report names each one and why.

import JSZip from "jszip";
import { buildSheetMap, loadSharedStrings } from "./xlsx-parts.js";

const MAX_ROW = 1048576;
const MAX_COL = 16384;
// Deep enough for any chain a row-ordered pass meets in one go; a deeper one
// is evaluated from its far end first rather than overflowing the stack.
const MAX_DEPTH = 300;

// ── Values ───────────────────────────────────────────────────────────────

class ErrorValue {
  constructor(code) {
    this.code = code;
  }
}

const ERRORS = {
  div0: new ErrorValue("#DIV/0!"),
  value: new ErrorValue("#VALUE!"),
  ref: new ErrorValue("#REF!"),
  na: new ErrorValue("#N/A"),
  num: new ErrorValue("#NUM!"),
  name: new ErrorValue("#NAME?"),
  null: new ErrorValue("#NULL!"),
};

function errorValue(code) {
  return Object.values(ERRORS).find((e) => e.code === code) || new ErrorValue(code);
}

const isError = (v) => v instanceof ErrorValue;

// A reference evaluated but not yet read: a cell or a rectangle on one sheet.
class Ref {
  constructor(sheet, r1, c1, r2, c2) {
    this.sheet = sheet;
    this.r1 = r1;
    this.c1 = c1;
    this.r2 = r2;
    this.c2 = c2;
  }
  get single() {
    return this.r1 === this.r2 && this.c1 === this.c2;
  }
}

// Thrown when a cell cannot be evaluated; carries why.
class Unevaluable extends Error {
  constructor(reason, { tainted = false } = {}) {
    super(reason);
    this.reason = reason;
    this.tainted = tainted;
  }
}

// Thrown when a reference chain runs deeper than MAX_DEPTH; the named cell is
// evaluated on its own first and the cell that asked for it is retried.
class Deferred extends Error {
  constructor(cell) {
    super("deferred");
    this.cell = cell;
  }
}

// ── Cell references ──────────────────────────────────────────────────────

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

// A cell's position as one number; a column never reaches COL_SPAN.
const COL_SPAN = 32768;
const key = (row, col) => row * COL_SPAN + col;

// ── Dates (the 1900 date system, with its 29 February 1900) ─────────────

const DAY_MS = 86400000;
const EPOCH_MS = Date.UTC(1899, 11, 30);

function serialToDate(serial) {
  const whole = Math.floor(serial);
  if (whole < 0) throw new Unevaluable("negative date serial");
  if (whole === 60) return { year: 1900, month: 2, day: 29 };
  if (whole === 0) return { year: 1900, month: 1, day: 0 };
  const shifted = whole < 60 ? whole + 1 : whole;
  const d = new Date(EPOCH_MS + shifted * DAY_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function dateToSerial(year, month, day) {
  const ms = Date.UTC(year, month - 1, day);
  let serial = Math.round((ms - EPOCH_MS) / DAY_MS);
  if (serial <= 60) serial -= 1;
  return serial;
}

// ── Coercions ────────────────────────────────────────────────────────────

const NUMBER_TEXT = /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/;

function toNumber(v) {
  if (v === null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (isError(v)) return v;
  if (typeof v === "string") {
    if (NUMBER_TEXT.test(v)) return Number(v);
    if (/^\s*[+-]?[\d.]+%\s*$/.test(v)) return Number(v.trim().slice(0, -1)) / 100;
    return ERRORS.value;
  }
  throw new Unevaluable("value of unknown kind");
}

function numberToText(n) {
  if (Object.is(n, -0)) return "0";
  const rounded = Number(n.toPrecision(15));
  const text = String(rounded);
  if (/e/i.test(text)) throw new Unevaluable("number too large or small to format as text");
  return text;
}

function toText(v) {
  if (v === null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return numberToText(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (isError(v)) return v;
  throw new Unevaluable("value of unknown kind");
}

function toBoolean(v) {
  if (v === null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (isError(v)) return v;
  if (typeof v === "string") {
    const upper = v.toUpperCase();
    if (upper === "TRUE") return true;
    if (upper === "FALSE") return false;
    return ERRORS.value;
  }
  throw new Unevaluable("value of unknown kind");
}

// Excel compares numbers to fifteen significant digits.
function sameNumber(a, b) {
  return a === b || Number(a.toPrecision(15)) === Number(b.toPrecision(15));
}

// -1, 0 or 1, ordering numbers before text before booleans, text without case.
function compareValues(a, b) {
  if (a === null && b === null) return 0;
  if (a === null) a = typeof b === "string" ? "" : typeof b === "boolean" ? false : 0;
  if (b === null) b = typeof a === "string" ? "" : typeof a === "boolean" ? false : 0;
  const rank = (v) => (typeof v === "number" ? 0 : typeof v === "string" ? 1 : 2);
  if (rank(a) !== rank(b)) return rank(a) < rank(b) ? -1 : 1;
  if (typeof a === "number") return sameNumber(a, b) ? 0 : a < b ? -1 : 1;
  if (typeof a === "string") {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x === y ? 0 : x < y ? -1 : 1;
  }
  return a === b ? 0 : a ? 1 : -1;
}

// ── Tokenizer ────────────────────────────────────────────────────────────

const CELL = "\\$?[A-Z]{1,3}\\$?\\d{1,7}";
const COLUMN = "\\$?[A-Z]{1,3}";
const ROW = "\\$?\\d{1,7}";
const AREA = `(?:${CELL}(?::${CELL})?|${COLUMN}:${COLUMN}|${ROW}:${ROW})`;
const SHEET_PREFIX = "(?:'(?:[^']|'')+'|\\[\\d+\\][^!'\\s(),]+|[A-Za-z_\\\\][A-Za-z0-9_.]*)!";
const REF_TOKEN = new RegExp(`^(${SHEET_PREFIX})?(${AREA})(?![A-Za-z0-9_(])`);
const ERROR_TOKEN = /^#(?:NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A)/;
const NUMBER_TOKEN = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
const NAME_TOKEN = /^[A-Za-z_\\][A-Za-z0-9_.]*/;

function tokenize(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === " " || ch === "\n" || ch === "\r" || ch === "\t") {
      i++;
      continue;
    }
    const rest = text.slice(i);
    if (ch === '"') {
      let j = i + 1;
      let s = "";
      while (j < text.length) {
        if (text[j] === '"') {
          if (text[j + 1] === '"') {
            s += '"';
            j += 2;
            continue;
          }
          break;
        }
        s += text[j++];
      }
      if (j >= text.length) throw new Unevaluable("unterminated string in formula");
      tokens.push({ type: "string", value: s });
      i = j + 1;
      continue;
    }
    const ref = rest.match(REF_TOKEN);
    if (ref) {
      tokens.push({ type: "ref", prefix: ref[1] ? ref[1].slice(0, -1) : null, area: ref[2], end: i + ref[0].length });
      i += ref[0].length;
      continue;
    }
    const err = rest.match(ERROR_TOKEN);
    if (err) {
      tokens.push({ type: "error", value: err[0] });
      i += err[0].length;
      continue;
    }
    const num = rest.match(NUMBER_TOKEN);
    if (num) {
      tokens.push({ type: "number", value: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const name = rest.match(NAME_TOKEN);
    if (name) {
      const after = text.slice(i + name[0].length).match(/^\s*\(/);
      if (after) {
        tokens.push({ type: "func", value: name[0].toUpperCase() });
        i += name[0].length + after[0].length;
      } else {
        tokens.push({ type: "name", value: name[0] });
        i += name[0].length;
      }
      continue;
    }
    const two = text.slice(i, i + 2);
    if (two === "<>" || two === "<=" || two === ">=") {
      tokens.push({ type: "op", value: two });
      i += 2;
      continue;
    }
    if ("+-*/^&=<>%(),:".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }
    throw new Unevaluable(`unrecognised character ${JSON.stringify(ch)} in formula`);
  }
  return tokens;
}

// ── Parser: tokens to an AST whose references keep their $ flags ────────

function parseAreaPart(part) {
  const m = part.match(/^(\$?)([A-Z]{1,3})?(\$?)(\d{1,7})?$/);
  return {
    col: m[2] ? { v: colToNum(m[2]), abs: m[1] === "$" } : null,
    row: m[4] ? { v: Number(m[4]), abs: m[3] === "$" || (!m[2] && m[1] === "$") } : null,
  };
}

function parseArea(area) {
  const [a, b] = area.split(":");
  const first = parseAreaPart(a);
  const last = b ? parseAreaPart(b) : first;
  // A whole column (A:A) or a whole row (1:1) spans the sheet the other way.
  const r1 = first.row || { v: 1, abs: true };
  const r2 = last.row || { v: MAX_ROW, abs: true };
  const c1 = first.col || { v: 1, abs: true };
  const c2 = last.col || { v: MAX_COL, abs: true };
  return { r1, c1, r2, c2 };
}

/**
 * A formula as it reads from a cell `rows` rows down and `cols` columns
 * across: every reference without a $ moves by that much, the way a shared
 * formula's followers read their master's text.
 *
 * @param {string} text - the formula, without its leading "="
 * @param {number} rows
 * @param {number} cols
 * @returns {string}
 */
export function shiftFormula(text, rows, cols) {
  let out = "";
  let copied = 0;
  for (const token of tokenize(text)) {
    if (token.type !== "ref") continue;
    const start = token.end - token.area.length;
    const shifted = token.area
      .split(":")
      .map((part) => {
        const { col, row } = parseAreaPart(part);
        const colText = col ? `${col.abs ? "$" : ""}${numToCol(col.abs ? col.v : col.v + cols)}` : "";
        const rowText = row ? `${row.abs ? "$" : ""}${row.abs ? row.v : row.v + rows}` : "";
        if ((col && !col.abs && col.v + cols < 1) || (row && !row.abs && row.v + rows < 1)) {
          throw new Error(`${text} moved by ${rows} rows and ${cols} columns reads off the sheet`);
        }
        return colText + rowText;
      })
      .join(":");
    out += text.slice(copied, start) + shifted;
    copied = token.end;
  }
  return out + text.slice(copied);
}

function parseFormula(text) {
  const tokens = tokenize(text);
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v) => tokens[pos] && tokens[pos].type === "op" && tokens[pos].value === v;
  const expectOp = (v) => {
    if (!isOp(v)) throw new Unevaluable(`formula expected "${v}"`);
    pos++;
  };

  function comparison() {
    let left = concat();
    while (peek() && peek().type === "op" && ["=", "<>", "<", ">", "<=", ">="].includes(peek().value)) {
      const op = tokens[pos++].value;
      left = { kind: "binary", op, left, right: concat() };
    }
    return left;
  }
  function concat() {
    let left = additive();
    while (isOp("&")) {
      pos++;
      left = { kind: "binary", op: "&", left, right: additive() };
    }
    return left;
  }
  function additive() {
    let left = multiplicative();
    while (isOp("+") || isOp("-")) {
      const op = tokens[pos++].value;
      left = { kind: "binary", op, left, right: multiplicative() };
    }
    return left;
  }
  function multiplicative() {
    let left = power();
    while (isOp("*") || isOp("/")) {
      const op = tokens[pos++].value;
      left = { kind: "binary", op, left, right: power() };
    }
    return left;
  }
  function power() {
    let left = unary();
    while (isOp("^")) {
      pos++;
      left = { kind: "binary", op: "^", left, right: unary() };
    }
    return left;
  }
  function unary() {
    if (isOp("-")) {
      pos++;
      return { kind: "negate", operand: unary() };
    }
    if (isOp("+")) {
      pos++;
      return unary();
    }
    let node = primary();
    while (isOp("%")) {
      pos++;
      node = { kind: "percent", operand: node };
    }
    return node;
  }
  function primary() {
    const token = tokens[pos++];
    if (!token) throw new Unevaluable("formula ends early");
    switch (token.type) {
      case "number":
        return { kind: "value", value: token.value };
      case "string":
        return { kind: "value", value: token.value };
      case "error":
        return { kind: "value", value: errorValue(token.value) };
      case "ref":
        return { kind: "ref", prefix: token.prefix, ...parseArea(token.area) };
      case "name": {
        const upper = token.value.toUpperCase();
        if (upper === "TRUE") return { kind: "value", value: true };
        if (upper === "FALSE") return { kind: "value", value: false };
        return { kind: "name", name: token.value };
      }
      case "func": {
        const args = [];
        if (isOp(")")) {
          pos++;
          return { kind: "call", name: token.value, args };
        }
        for (;;) {
          if (isOp(",") || isOp(")")) args.push({ kind: "missing" });
          else args.push(comparison());
          if (isOp(",")) {
            pos++;
            continue;
          }
          expectOp(")");
          break;
        }
        return { kind: "call", name: token.value, args };
      }
      case "op":
        if (token.value === "(") {
          const inner = comparison();
          expectOp(")");
          return inner;
        }
        throw new Unevaluable(`formula has an unexpected "${token.value}"`);
      default:
        throw new Unevaluable("formula has an unexpected token");
    }
  }

  const ast = comparison();
  if (pos !== tokens.length) throw new Unevaluable("formula has trailing tokens");
  return ast;
}

// ── Reading the workbook ─────────────────────────────────────────────────

const CELL_PATTERN = /<c r="([A-Z]+)(\d+)"([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g;
const FORMULA_PATTERN = /<f([^>]*?)(?:\/>|>([\s\S]*?)<\/f>)/;
const EXTERNAL_CELL_PATTERN = /<cell r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/cell>)/g;

function decodeEntities(text) {
  return text.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (whole, name) => {
    if (name[0] === "#") return String.fromCodePoint(name[1] === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[name];
  });
}

function escapeText(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cachedValue(type, inner, sharedStrings) {
  if (type === "inlineStr") {
    const is = inner.match(/<is>([\s\S]*?)<\/is>/);
    if (!is) return null;
    return [...is[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => decodeEntities(t[1])).join("");
  }
  const v = inner.match(/<v(?:\s[^>]*)?>([^<]*)<\/v>/);
  if (!v) return null;
  const raw = v[1];
  switch (type) {
    case "s": {
      const s = sharedStrings[Number(raw)];
      if (s === undefined) throw new Error(`shared string ${raw} is out of range`);
      return s;
    }
    case "str":
      return decodeEntities(raw);
    case "b":
      return raw === "1" || raw === "true";
    case "e":
      return errorValue(raw);
    case "d":
      return { unsupported: "ISO date cell" };
    default:
      return raw === "" ? null : Number(raw);
  }
}

// One <c> of a sheet: where it sits in the XML and, read only when asked,
// the value it caches.
class Cell {
  constructor(row, col, ref, start, end, attrs, inner, sharedStrings) {
    this.row = row;
    this.col = col;
    this.ref = ref;
    this.start = start;
    this.end = end;
    this.attrs = attrs;
    this.inner = inner;
    this.sharedStrings = sharedStrings;
    this.formula = null;
    this.value = undefined;
  }
  get type() {
    const at = this.attrs.indexOf(' t="');
    return at < 0 ? null : this.attrs.slice(at + 4, this.attrs.indexOf('"', at + 4));
  }
  get cached() {
    if (this.value === undefined) this.value = this.inner ? cachedValue(this.type, this.inner, this.sharedStrings) : null;
    return this.value;
  }
  get hasCachedValue() {
    return /<v[\s>]/.test(this.inner);
  }
}

// A sheet of one workbook: its name and part, and the cells its XML holds,
// which two workbooks with the same sheet XML share.
class Sheet {
  constructor(name, path, content) {
    this.name = name;
    this.path = path;
    this.content = content;
  }
  get xml() {
    return this.content.xml;
  }
  get cells() {
    return this.content.cells;
  }
  // The rows that hold a cell, per column, ascending.
  columnRows(col) {
    const { content } = this;
    if (!content.columns) {
      content.columns = new Map();
      for (const cell of content.cells.values()) {
        if (!content.columns.has(cell.col)) content.columns.set(cell.col, []);
        content.columns.get(cell.col).push(cell.row);
      }
      for (const rows of content.columns.values()) rows.sort((a, b) => a - b);
    }
    return content.columns.get(col) || [];
  }
}

function parseSheet(xml, sharedStrings) {
  const content = { xml, cells: new Map(), columns: null };
  const masters = new Map();
  const followers = [];
  for (const m of xml.matchAll(CELL_PATTERN)) {
    const [whole, colText, rowText, attrs, , inner = ""] = m;
    const row = Number(rowText);
    const col = colToNum(colText);
    const cell = new Cell(row, col, colText + rowText, m.index, m.index + whole.length, attrs, inner, sharedStrings);
    if (inner.includes("<f")) {
      const f = inner.match(FORMULA_PATTERN);
      if (f) {
        const fAttrs = f[1];
        const fType = fAttrs.match(/\st="([^"]*)"/)?.[1] || null;
        const si = fAttrs.match(/\ssi="(\d+)"/)?.[1];
        cell.formula = { text: f[2] ? decodeEntities(f[2]) : "", anchorRow: row, anchorCol: col, fType };
        if (fType === "shared" && si !== undefined) {
          if (f[2]) masters.set(si, cell.formula);
          else followers.push({ cell, si });
        }
      }
    }
    content.cells.set(key(row, col), cell);
  }
  for (const { cell, si } of followers) {
    const master = masters.get(si);
    if (master) cell.formula = { text: master.text, anchorRow: master.anchorRow, anchorCol: master.anchorCol, fType: "shared" };
    else cell.formula.missingMaster = si;
  }
  return content;
}

// Sheets already parsed, by their XML: a workbook passed through several
// writes in a row is parsed again only where a write changed a sheet. The
// oldest entries go once the cells held pass the limit.
const PARSED_CELL_LIMIT = 500000;
const parsedSheets = new Map();
let parsedCells = 0;

function sameStrings(a, b) {
  return a === b || (a.length === b.length && a.every((text, index) => text === b[index]));
}

function readSheet(name, path, xml, sharedStrings) {
  const hit = parsedSheets.get(xml);
  if (hit && sameStrings(hit.sharedStrings, sharedStrings)) {
    parsedSheets.delete(xml);
    parsedSheets.set(xml, hit);
    return new Sheet(name, path, hit.content);
  }
  const content = parseSheet(xml, sharedStrings);
  if (hit) parsedCells -= hit.content.cells.size;
  parsedSheets.set(xml, { sharedStrings, content });
  parsedCells += content.cells.size;
  while (parsedCells > PARSED_CELL_LIMIT && parsedSheets.size > 1) {
    const [oldest, entry] = parsedSheets.entries().next().value;
    parsedSheets.delete(oldest);
    parsedCells -= entry.content.cells.size;
  }
  return new Sheet(name, path, content);
}

// The [N] book of an external reference: the sheets its link part caches,
// by name and by position.
function readExternalBook(path, xml) {
  const names = [...xml.matchAll(/<sheetName val="([^"]*)"/g)].map((m) => decodeEntities(m[1]));
  const sheets = new Map();
  const byIndex = names.map((sheetName, index) => {
    const sheet = new Sheet(sheetName, null, { xml: null, cells: new Map(), columns: null });
    sheet.external = true;
    sheets.set(sheetName.toLowerCase(), sheet);
    const block = xml.match(new RegExp(`<sheetData sheetId="${index}"(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</sheetData>)`));
    if (block && block[1]) {
      for (const c of block[1].matchAll(EXTERNAL_CELL_PATTERN)) {
        const row = Number(c[2]);
        const col = colToNum(c[1]);
        const type = c[3].match(/\st="([^"]*)"/)?.[1] || null;
        sheet.cells.set(key(row, col), { row, col, ref: c[1] + c[2], raw: c[0], cached: c[4] ? cachedValue(type, c[4], []) : null });
      }
    }
    return sheet;
  });
  return { path, xml, sheets, byIndex };
}

// One workbook's parts, each read out of the zip and parsed at most once
// however often it is asked for.
class WorkbookParts {
  constructor(zip) {
    this.zip = zip;
    this.texts = new Map();
    this.parsed = new Map();
    this.sharedStrings = null;
    this.sheetMap = null;
  }

  async text(path) {
    if (!this.texts.has(path)) {
      const file = this.zip.file(path);
      this.texts.set(path, file ? await file.async("string") : null);
    }
    return this.texts.get(path);
  }

  async sheetPaths() {
    if (!this.sheetMap) this.sheetMap = await buildSheetMap(this.zip);
    return this.sheetMap;
  }

  async sheet(name, path) {
    if (!this.parsed.has(path)) {
      if (!this.sharedStrings) this.sharedStrings = await loadSharedStrings(this.zip);
      const xml = await this.text(path);
      this.parsed.set(path, xml === null ? null : readSheet(name, path, xml, this.sharedStrings));
    }
    return this.parsed.get(path);
  }

  // Whether a part holds the same bytes here as in another copy. A part
  // neither copy has rewritten since it was loaded still carries the CRC and
  // size the zip recorded for it, which settles the question unread.
  async sameAs(other, path) {
    const mine = this.zip.file(path)?._data;
    const theirs = other.zip.file(path)?._data;
    if (mine && theirs && typeof mine.crc32 === "number" && typeof theirs.crc32 === "number") {
      if (mine.crc32 === theirs.crc32 && mine.uncompressedSize === theirs.uncompressedSize) return true;
    }
    return (await this.text(path)) === (await other.text(path));
  }
}

async function readWorkbook(parts) {
  const { zip } = parts;
  const sheets = new Map();
  const ordered = [];
  for (const [name, path] of await parts.sheetPaths()) {
    const sheet = await parts.sheet(name, path);
    if (!sheet) continue;
    sheets.set(name.toLowerCase(), sheet);
    ordered.push(sheet);
  }

  const wbXml = await zip.file("xl/workbook.xml").async("string");
  if (/<workbookPr[^>]*\sdate1904="(1|true)"/.test(wbXml)) throw new Unevaluable("workbook uses the 1904 date system");

  const relsXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const targets = new Map([...relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  const externalBooks = new Map();
  const references = wbXml.match(/<externalReferences>([\s\S]*?)<\/externalReferences>/);
  if (references) {
    let index = 0;
    for (const [, rid] of references[1].matchAll(/<externalReference[^>]*r:id="(rId\d+)"/g)) {
      index += 1;
      const target = targets.get(rid);
      const path = target && `xl/${target.replace(/^\.?\//, "")}`;
      const xml = path ? await parts.text(path) : null;
      if (xml !== null) externalBooks.set(index, readExternalBook(path, xml));
    }
  }

  const names = new Map();
  for (const m of wbXml.matchAll(/<definedName ([^>]*)>([^<]*)<\/definedName>/g)) {
    if (/localSheetId=/.test(m[1])) continue;
    const name = m[1].match(/name="([^"]*)"/)?.[1];
    if (name) names.set(name.toUpperCase(), decodeEntities(m[2]));
  }

  return { sheets, ordered, externalBooks, names };
}

// ── Which formulas a change reaches ──────────────────────────────────────

// A range at most this many columns wide is indexed under each column it
// covers; a wider one is checked against every changed cell.
const BUCKET_WIDTH_LIMIT = 64;

function referencesIn(ast, out = []) {
  switch (ast.kind) {
    case "ref":
      out.push(ast);
      break;
    case "negate":
    case "percent":
      referencesIn(ast.operand, out);
      break;
    case "binary":
      referencesIn(ast.left, out);
      referencesIn(ast.right, out);
      break;
    case "call":
      for (const arg of ast.args) referencesIn(arg, out);
      break;
    default:
      break;
  }
  return out;
}

// A formula whose inputs cannot be read off its text: a reference built at
// run time, a defined name, or a formula that does not parse.
function readsUnknownCells(ast) {
  switch (ast.kind) {
    case "unparsable":
    case "name":
      return true;
    case "negate":
    case "percent":
      return readsUnknownCells(ast.operand);
    case "binary":
      return readsUnknownCells(ast.left) || readsUnknownCells(ast.right);
    case "call":
      return ast.name === "INDIRECT" || ast.args.some(readsUnknownCells);
    default:
      return false;
  }
}

class Dependents {
  constructor() {
    this.single = new Map();
    this.columns = new Map();
    this.wide = new Map();
    this.unknown = [];
  }

  add(ref, dependent) {
    const { sheet } = ref;
    if (ref.single) {
      if (!this.single.has(sheet)) this.single.set(sheet, new Map());
      const bySheet = this.single.get(sheet);
      const k = key(ref.r1, ref.c1);
      if (!bySheet.has(k)) bySheet.set(k, []);
      bySheet.get(k).push(dependent);
    } else if (ref.c2 - ref.c1 < BUCKET_WIDTH_LIMIT) {
      if (!this.columns.has(sheet)) this.columns.set(sheet, new Map());
      const bySheet = this.columns.get(sheet);
      for (let c = ref.c1; c <= ref.c2; c++) {
        if (!bySheet.has(c)) bySheet.set(c, []);
        bySheet.get(c).push({ r1: ref.r1, r2: ref.r2, dependent });
      }
    } else {
      if (!this.wide.has(sheet)) this.wide.set(sheet, []);
      this.wide.get(sheet).push({ ref, dependent });
    }
  }

  *of(sheet, row, col) {
    const single = this.single.get(sheet)?.get(key(row, col));
    if (single) yield* single;
    const column = this.columns.get(sheet)?.get(col);
    if (column) for (const { r1, r2, dependent } of column) if (row >= r1 && row <= r2) yield dependent;
    const wide = this.wide.get(sheet);
    if (wide) for (const { ref, dependent } of wide) if (row >= ref.r1 && row <= ref.r2 && col >= ref.c1 && col <= ref.c2) yield dependent;
  }
}

function dependentsOf(evaluator) {
  const dependents = new Dependents();
  for (const sheet of evaluator.book.ordered) {
    for (const cell of sheet.cells.values()) {
      const { formula } = cell;
      if (!formula) continue;
      const dependent = { sheet, cell };
      if (formula.missingMaster !== undefined || formula.fType === "dataTable") {
        dependents.unknown.push(dependent);
        continue;
      }
      const ast = evaluator.ast(formula.text);
      if (ast.refs === undefined) {
        ast.refs = referencesIn(ast);
        ast.readsUnknownCells = readsUnknownCells(ast);
      }
      if (ast.readsUnknownCells) dependents.unknown.push(dependent);
      const ctx = { sheet, row: cell.row, col: cell.col, anchorRow: formula.anchorRow, anchorCol: formula.anchorCol };
      for (const node of ast.refs) {
        let ref;
        try {
          ref = evaluator.refFromNode(node, ctx);
        } catch (err) {
          if (!(err instanceof Unevaluable)) throw err;
          dependents.unknown.push(dependent);
          continue;
        }
        if (ref instanceof Ref) dependents.add(ref, dependent);
      }
    }
  }
  return dependents;
}

// Every formula cell a change reaches, the changed formulas included. A
// formula that reads cells its text does not name is reached by any change.
function reachedBy(seeds, dependents) {
  const reached = new Set();
  const queue = [];
  const reach = ({ sheet, cell }) => {
    if (reached.has(cell)) return;
    reached.add(cell);
    queue.push({ sheet, row: cell.row, col: cell.col });
  };
  for (const seed of seeds) {
    if (seed.cell && seed.cell.formula) reach(seed);
    else queue.push(seed);
  }
  let unknownReached = false;
  for (;;) {
    while (queue.length) {
      const { sheet, row, col } = queue.pop();
      for (const dependent of dependents.of(sheet, row, col)) reach(dependent);
    }
    if (unknownReached || reached.size === 0) break;
    unknownReached = true;
    for (const dependent of dependents.unknown) reach(dependent);
  }
  return reached;
}

// A cell's XML with each sheet its formula names replaced by where that
// sheet lives, so a formula rewritten only because a sheet it reads was
// renamed compares equal to the formula it was.
function isNameChar(code) {
  return (
    (code >= 48 && code <= 57) || // 0-9
    (code >= 65 && code <= 90) || // A-Z
    (code >= 97 && code <= 122) || // a-z
    code === 95 || // _
    code === 46 || // .
    code === 91 || // [
    code === 93 || // ]
    code === 92 // \
  );
}

// Walks back from each "!" to the sheet name before it, quoted or not; a
// scan for "!" stays fast over a sheet of several hundred kilobytes.
function cellIdentity(xml, sheetPaths, externalSheets) {
  const identityOf = (prefix) => {
    let name = decodeEntities(prefix);
    if (name.startsWith("'")) name = name.slice(1, -1).replace(/''/g, "'");
    const external = name.match(/^\[(\d+)\](.*)$/);
    if (external) {
      const position = externalSheets.get(Number(external[1]))?.indexOf(external[2].toLowerCase());
      return position === undefined || position < 0 ? null : `\u0001[${external[1]}]#${position}!`;
    }
    const path = sheetPaths.get(name.toLowerCase());
    return path ? `\u0001${path}!` : null;
  };
  let out = "";
  let copied = 0;
  for (let bang = xml.indexOf("!"); bang >= 0; bang = xml.indexOf("!", bang + 1)) {
    let start = bang;
    if (xml.charCodeAt(bang - 1) === 39) {
      let j = bang - 2;
      while (j >= 0) {
        if (xml.charCodeAt(j) === 39) {
          if (xml.charCodeAt(j - 1) === 39) {
            j -= 2;
            continue;
          }
          break;
        }
        if (xml.charCodeAt(j) === 60 || xml.charCodeAt(j) === 62) {
          j = -1;
          break;
        }
        j--;
      }
      if (j >= 0) start = j;
    } else {
      while (start > 0 && isNameChar(xml.charCodeAt(start - 1))) start--;
    }
    if (start === bang || start < copied) continue;
    const identity = identityOf(xml.slice(start, bang));
    if (!identity) continue;
    out += xml.slice(copied, start) + identity;
    copied = bang + 1;
  }
  return copied === 0 ? xml : out + xml.slice(copied);
}

// Whether a cell's XML, or a whole sheet's, says the same before and after:
// equal, or different only in the names of the sheets its formulas read.
function sameCell(was, now, renames) {
  if (was === now) return true;
  if (!renames) return false;
  return cellIdentity(was, renames.before, renames.externalBefore) === cellIdentity(now, renames.after, renames.externalAfter);
}

// Each external link of a workbook by its [N]: the part that caches it and
// the sheet names it lists, lower-cased.
async function externalLinkParts(parts) {
  const links = new Map();
  const wbXml = await parts.text("xl/workbook.xml");
  const relsXml = await parts.text("xl/_rels/workbook.xml.rels");
  const targets = new Map([...relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  const references = wbXml.match(/<externalReferences>([\s\S]*?)<\/externalReferences>/);
  if (!references) return links;
  let index = 0;
  for (const [, rid] of references[1].matchAll(/<externalReference[^>]*r:id="(rId\d+)"/g)) {
    index += 1;
    const target = targets.get(rid);
    const path = target && `xl/${target.replace(/^\.?\//, "")}`;
    const xml = path ? await parts.text(path) : null;
    if (xml === null) continue;
    links.set(index, { path, names: [...xml.matchAll(/<sheetName val="([^"]*)"/g)].map((m) => decodeEntities(m[1]).toLowerCase()) });
  }
  return links;
}

const ROW_PATTERN = /<row r="(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g;

// Each row of a sheet's XML by number: the cells it holds, as text.
function rowsOf(xml) {
  const rows = new Map();
  for (const m of xml.matchAll(ROW_PATTERN)) rows.set(Number(m[1]), m[2] ?? "");
  return rows;
}

// The cells whose XML differs from the same part of an earlier copy of the
// workbook, the external link caches included, by part and position.
async function changedCells(before, after) {
  const seeds = [];

  const pathsBefore = new Map([...(await before.sheetPaths())].map(([name, path]) => [name.toLowerCase(), path]));
  const pathsAfter = new Map([...(await after.sheetPaths())].map(([name, path]) => [name.toLowerCase(), path]));
  const linksBefore = await externalLinkParts(before);
  const linksAfter = await externalLinkParts(after);
  const namesOf = (links) => new Map([...links].map(([index, link]) => [index, link.names]));
  const renamed =
    pathsBefore.size !== pathsAfter.size ||
    [...pathsAfter].some(([name, path]) => pathsBefore.get(name) !== path) ||
    JSON.stringify([...namesOf(linksBefore)]) !== JSON.stringify([...namesOf(linksAfter)]);
  const renames = renamed
    ? { before: pathsBefore, after: pathsAfter, externalBefore: namesOf(linksBefore), externalAfter: namesOf(linksAfter) }
    : null;

  for (const path of (await after.sheetPaths()).values()) {
    if (await after.sameAs(before, path)) continue;
    const xml = await after.text(path);
    if (xml === null) continue;
    const earlierXml = (await before.text(path)) ?? "";
    if (renames && sameCell(earlierXml, xml, renames)) continue;
    const earlierRows = rowsOf(earlierXml);
    for (const [row, body] of rowsOf(xml)) {
      const was = earlierRows.get(row);
      earlierRows.delete(row);
      if (was === body || (was !== undefined && sameCell(was, body, renames))) continue;
      const earlierCells = new Map();
      for (const m of (was ?? "").matchAll(CELL_PATTERN)) earlierCells.set(m[1], m[0]);
      for (const m of body.matchAll(CELL_PATTERN)) {
        const wasCell = earlierCells.get(m[1]);
        earlierCells.delete(m[1]);
        if (wasCell === undefined || !sameCell(wasCell, m[0], renames)) seeds.push({ path, row, col: colToNum(m[1]) });
      }
      for (const col of earlierCells.keys()) seeds.push({ path, row, col: colToNum(col) });
    }
    for (const [row, body] of earlierRows) {
      for (const m of body.matchAll(CELL_PATTERN)) seeds.push({ path, row, col: colToNum(m[1]) });
    }
  }

  for (const [index, link] of linksAfter) {
    if (await after.sameAs(before, link.path)) continue;
    const now = readExternalBook(link.path, await after.text(link.path));
    const then = readExternalBook(link.path, (await before.text(link.path)) ?? "");
    now.byIndex.forEach((sheet, sheetIndex) => {
      const was = then.byIndex[sheetIndex];
      const keys = new Set([...sheet.cells.keys(), ...(was ? was.cells.keys() : [])]);
      for (const k of keys) {
        const a = sheet.cells.get(k);
        const b = was && was.cells.get(k);
        if (!a || !b || a.raw !== b.raw) seeds.push({ link: index, sheetIndex, row: Math.floor(k / COL_SPAN), col: k % COL_SPAN });
      }
    });
  }
  return seeds;
}

// The seeds as cells of the workbook just read.
function seedsIn(book, seeds) {
  const byPath = new Map(book.ordered.map((sheet) => [sheet.path, sheet]));
  const out = [];
  for (const seed of seeds) {
    const sheet = seed.path ? byPath.get(seed.path) : book.externalBooks.get(seed.link)?.byIndex[seed.sheetIndex];
    if (!sheet) continue;
    out.push({ sheet, row: seed.row, col: seed.col, cell: sheet.cells.get(key(seed.row, seed.col)) });
  }
  return out;
}

// ── Evaluation ───────────────────────────────────────────────────────────

class Evaluator {
  constructor(book) {
    this.book = book;
    this.asts = new Map();
    this.state = new Map(); // cell -> { value } | { unevaluable, tainted } | "pending"
    // The formulas to evaluate; every other formula reads as its cached value.
    this.stale = null;
  }

  ast(text) {
    let ast = this.asts.get(text);
    if (!ast) {
      try {
        ast = parseFormula(text);
      } catch (err) {
        if (!(err instanceof Unevaluable)) throw err;
        ast = { kind: "unparsable", reason: err.reason };
      }
      this.asts.set(text, ast);
    }
    return ast;
  }

  sheetFor(prefix, ctx) {
    if (!prefix) return ctx.sheet;
    let text = prefix;
    if (text.startsWith("'")) text = text.slice(1, -1).replace(/''/g, "'");
    const external = text.match(/^\[(\d+)\](.*)$/);
    if (external) {
      const book = this.book.externalBooks.get(Number(external[1]));
      if (!book) throw new Unevaluable(`external book [${external[1]}] has no link part`);
      const sheet = book.sheets.get(external[2].toLowerCase());
      if (!sheet) throw new Unevaluable(`external book [${external[1]}] caches no sheet ${external[2]}`);
      return sheet;
    }
    const sheet = this.book.sheets.get(text.toLowerCase());
    if (!sheet) return null;
    return sheet;
  }

  refFromNode(node, ctx) {
    const sheet = this.sheetFor(node.prefix, ctx);
    if (!sheet) return ERRORS.ref;
    const at = (part, current) => (part.abs ? part.v : part.v + current);
    const dRow = ctx.row - ctx.anchorRow;
    const dCol = ctx.col - ctx.anchorCol;
    const r1 = at(node.r1, dRow);
    const r2 = at(node.r2, dRow);
    const c1 = at(node.c1, dCol);
    const c2 = at(node.c2, dCol);
    if (Math.min(r1, r2) < 1 || Math.min(c1, c2) < 1 || Math.max(r1, r2) > MAX_ROW || Math.max(c1, c2) > MAX_COL) return ERRORS.ref;
    return new Ref(sheet, Math.min(r1, r2), Math.min(c1, c2), Math.max(r1, r2), Math.max(c1, c2));
  }

  // The reference a text names, as INDIRECT and a defined name read it.
  refFromText(text, ctx) {
    const tokens = (() => {
      try {
        return tokenize(text);
      } catch {
        return null;
      }
    })();
    if (!tokens || tokens.length !== 1 || tokens[0].type !== "ref") return ERRORS.ref;
    const area = parseArea(tokens[0].area);
    for (const part of Object.values(area)) part.abs = true;
    return this.refFromNode({ prefix: tokens[0].prefix, ...area }, ctx);
  }

  // One cell's current value: its cached value, or for a formula its result.
  cellValue(sheet, row, col, depth) {
    const cell = sheet.cells.get(key(row, col));
    if (!cell) return null;
    if (sheet.external || !cell.formula || (this.stale && !this.stale.has(cell))) {
      if (cell.cached && cell.cached.unsupported) throw new Unevaluable(cell.cached.unsupported, { tainted: true });
      return cell.cached;
    }
    const state = this.evaluateCell(sheet, cell, depth + 1);
    if (state.unevaluable) throw new Unevaluable(`reads ${sheet.name}!${cell.ref}`, { tainted: true });
    return state.value;
  }

  evaluateCell(sheet, cell, depth) {
    const known = this.state.get(cell);
    if (known === "pending") throw new Unevaluable("circular reference");
    if (known) return known;
    if (depth > MAX_DEPTH) throw new Deferred({ sheet, cell });

    this.state.set(cell, "pending");
    let state;
    try {
      state = { value: this.formulaResult(sheet, cell, depth) };
    } catch (err) {
      if (!(err instanceof Unevaluable)) {
        this.state.delete(cell);
        throw err;
      }
      state = { unevaluable: err.reason, tainted: err.tainted };
    }
    this.state.set(cell, state);
    return state;
  }

  formulaResult(sheet, cell, depth) {
    const { formula } = cell;
    if (formula.missingMaster !== undefined) throw new Unevaluable(`shared formula ${formula.missingMaster} has no master`);
    if (formula.fType === "dataTable") throw new Unevaluable("data table");
    const ast = this.ast(formula.text);
    if (ast.kind === "unparsable") throw new Unevaluable(ast.reason);
    const ctx = { sheet, row: cell.row, col: cell.col, anchorRow: formula.anchorRow, anchorCol: formula.anchorCol, depth };
    let result = this.evaluate(ast, ctx);
    if (result instanceof Ref) result = this.scalar(result, ctx);
    return result === null ? 0 : result;
  }

  // A reference read where one value is wanted: its cell, or the cell of a
  // range in the formula's own row or column.
  scalar(value, ctx) {
    if (!(value instanceof Ref)) return value;
    if (value.single) return this.cellValue(value.sheet, value.r1, value.c1, ctx.depth);
    if (value.c1 === value.c2 && ctx.row >= value.r1 && ctx.row <= value.r2)
      return this.cellValue(value.sheet, ctx.row, value.c1, ctx.depth);
    if (value.r1 === value.r2 && ctx.col >= value.c1 && ctx.col <= value.c2)
      return this.cellValue(value.sheet, value.r1, ctx.col, ctx.depth);
    return ERRORS.value;
  }

  // Every non-blank cell of a range, row by row.
  *cellsOf(ref, ctx) {
    const { sheet } = ref;
    const area = (ref.r2 - ref.r1 + 1) * (ref.c2 - ref.c1 + 1);
    if (area <= sheet.cells.size) {
      for (let r = ref.r1; r <= ref.r2; r++) {
        for (let c = ref.c1; c <= ref.c2; c++) {
          if (sheet.cells.has(key(r, c))) yield { row: r, col: c, value: this.cellValue(sheet, r, c, ctx.depth) };
        }
      }
      return;
    }
    const found = [];
    for (const cell of sheet.cells.values()) {
      if (cell.row >= ref.r1 && cell.row <= ref.r2 && cell.col >= ref.c1 && cell.col <= ref.c2) found.push(cell);
    }
    found.sort((a, b) => a.row - b.row || a.col - b.col);
    for (const cell of found) yield { row: cell.row, col: cell.col, value: this.cellValue(sheet, cell.row, cell.col, ctx.depth) };
  }

  // The non-blank cells of a one-row or one-column range, with their offset.
  vector(ref, ctx) {
    if (ref.c1 !== ref.c2 && ref.r1 !== ref.r2) throw new Unevaluable("LOOKUP over a two-dimensional range");
    const out = [];
    if (ref.c1 === ref.c2) {
      for (const row of ref.sheet.columnRows(ref.c1)) {
        if (row < ref.r1 || row > ref.r2) continue;
        const value = this.cellValue(ref.sheet, row, ref.c1, ctx.depth);
        if (value !== null) out.push({ offset: row - ref.r1, value });
      }
    } else {
      for (const { col, value } of this.cellsOf(ref, ctx)) if (value !== null) out.push({ offset: col - ref.c1, value });
    }
    return out;
  }

  evaluate(node, ctx) {
    switch (node.kind) {
      case "value":
        return node.value;
      case "missing":
        return null;
      case "ref":
        return this.refFromNode(node, ctx);
      case "name": {
        const target = this.book.names.get(node.name.toUpperCase());
        if (!target) throw new Unevaluable(`name ${node.name}`);
        return this.refFromText(target, ctx);
      }
      case "negate": {
        const v = toNumber(this.scalar(this.evaluate(node.operand, ctx), ctx));
        return isError(v) ? v : -v;
      }
      case "percent": {
        const v = toNumber(this.scalar(this.evaluate(node.operand, ctx), ctx));
        return isError(v) ? v : v / 100;
      }
      case "binary":
        return this.binary(node, ctx);
      case "call":
        return this.call(node, ctx);
      default:
        throw new Unevaluable(`node ${node.kind}`);
    }
  }

  binary(node, ctx) {
    const a = this.scalar(this.evaluate(node.left, ctx), ctx);
    const b = this.scalar(this.evaluate(node.right, ctx), ctx);
    if (isError(a)) return a;
    if (isError(b)) return b;
    if (node.op === "&") {
      const x = toText(a);
      const y = toText(b);
      return x + y;
    }
    if (["=", "<>", "<", ">", "<=", ">="].includes(node.op)) {
      const c = compareValues(a, b);
      return { "=": c === 0, "<>": c !== 0, "<": c < 0, ">": c > 0, "<=": c <= 0, ">=": c >= 0 }[node.op];
    }
    const x = toNumber(a);
    const y = toNumber(b);
    if (isError(x)) return x;
    if (isError(y)) return y;
    switch (node.op) {
      case "+":
        return x + y;
      case "-":
        return x - y;
      case "*":
        return x * y;
      case "/":
        return y === 0 ? ERRORS.div0 : x / y;
      case "^": {
        const r = Math.pow(x, y);
        return Number.isFinite(r) ? r : ERRORS.num;
      }
      default:
        throw new Unevaluable(`operator ${node.op}`);
    }
  }

  // Numbers an aggregate takes: from a range, numbers only; typed directly,
  // anything that reads as a number.
  numbersOf(args, ctx) {
    const out = [];
    for (const arg of args) {
      const v = this.evaluate(arg, ctx);
      if (v instanceof Ref) {
        for (const { value } of this.cellsOf(v, ctx)) {
          if (isError(value)) return value;
          if (typeof value === "number") out.push(value);
        }
      } else if (isError(v)) {
        return v;
      } else if (v !== null) {
        const n = toNumber(v);
        if (isError(n)) return n;
        out.push(n);
      }
    }
    return out;
  }

  argNumber(node, ctx) {
    return toNumber(this.scalar(this.evaluate(node, ctx), ctx));
  }

  call(node, ctx) {
    const { name, args } = node;
    const fn = FUNCTIONS[name];
    if (!fn) throw new Unevaluable(`function ${name}`);
    return fn.call(this, args, ctx);
  }
}

function roundHalfAwayFromZero(n, digits) {
  const sign = n < 0 ? -1 : 1;
  const shifted = Number(`${Number(Math.abs(n).toPrecision(15))}e${digits}`);
  return sign * Number(`${Math.round(shifted)}e${-digits}`) || 0;
}

function roundTowards(n, digits, away) {
  const sign = n < 0 ? -1 : 1;
  const shifted = Number(Number(`${Math.abs(n)}e${digits}`).toPrecision(15));
  const whole = away ? Math.ceil(shifted) : Math.floor(shifted);
  return sign * Number(`${whole}e${-digits}`) || 0;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// TEXT(value, format) for the number and date formats the templates use.
function formatText(value, format) {
  if (typeof value === "string") {
    const n = toNumber(value);
    if (isError(n)) return value;
    value = n;
  }
  if (value === null) value = 0;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof format === "number") format = numberToText(format);
  if (/^[0#,.]+$/.test(format)) {
    const decimals = (format.split(".")[1] || "").length;
    const minWhole = (format.split(".")[0].match(/0/g) || []).length;
    const grouped = format.includes(",");
    const fixed = roundHalfAwayFromZero(Math.abs(value), decimals).toFixed(decimals);
    let [whole, frac] = fixed.split(".");
    if (whole === "0" && minWhole === 0) whole = "";
    whole = whole.padStart(minWhole, "0");
    if (grouped) whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const sign = value < 0 && Number(fixed) !== 0 ? "-" : "";
    return sign + whole + (frac ? `.${frac}` : "");
  }
  const tokens = format.match(/yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|[^ymd]+/gi);
  if (!tokens || tokens.join("") !== format) throw new Unevaluable(`TEXT format ${JSON.stringify(format)}`);
  if (tokens.some((t) => /^[^ymd]+$/i.test(t) && /[a-z0-9#@\\"*_;\[\]]/i.test(t))) {
    throw new Unevaluable(`TEXT format ${JSON.stringify(format)}`);
  }
  const date = serialToDate(value);
  const dow = (((Math.floor(value) - 1) % 7) + 7) % 7;
  return tokens
    .map((t) => {
      switch (t.toLowerCase()) {
        case "yyyy":
          return String(date.year);
        case "yy":
          return String(date.year % 100).padStart(2, "0");
        case "mmmm":
          return MONTHS[date.month - 1];
        case "mmm":
          return MONTHS[date.month - 1].slice(0, 3);
        case "mm":
          return String(date.month).padStart(2, "0");
        case "m":
          return String(date.month);
        case "dddd":
          return WEEKDAYS[dow];
        case "ddd":
          return WEEKDAYS[dow].slice(0, 3);
        case "dd":
          return String(date.day).padStart(2, "0");
        case "d":
          return String(date.day);
        default:
          return t;
      }
    })
    .join("");
}

// A SUMIF criterion as a test over one cell's value.
function criterion(spec) {
  if (typeof spec !== "string") return (v) => v !== null && compareValues(v, spec) === 0;
  const m = spec.match(/^(<>|<=|>=|=|<|>)?(.*)$/s);
  const op = m[1] || "=";
  const operandText = m[2];
  const operand = NUMBER_TEXT.test(operandText) ? Number(operandText) : operandText;
  if (/[*?~]/.test(operandText)) throw new Unevaluable("SUMIF wildcard criterion");
  return (v) => {
    if (op === "=" && operand === "") return v === null || v === "";
    if (op === "<>" && operand === "") return !(v === null || v === "");
    if (v === null) return op === "<>";
    if (typeof operand === "number" && typeof v !== "number") return op === "<>";
    if (typeof operand === "string" && typeof v !== "string") return op === "<>";
    const c = compareValues(v, operand);
    return { "=": c === 0, "<>": c !== 0, "<": c < 0, ">": c > 0, "<=": c <= 0, ">=": c >= 0 }[op];
  };
}

const FUNCTIONS = {
  IF(args, ctx) {
    const test = toBoolean(this.scalar(this.evaluate(args[0], ctx), ctx));
    if (isError(test)) return test;
    if (test) return args.length > 1 ? (this.evaluate(args[1], ctx) ?? 0) : true;
    return args.length > 2 ? (this.evaluate(args[2], ctx) ?? 0) : false;
  },
  AND(args, ctx) {
    let result = true;
    for (const arg of args) {
      const v = this.evaluate(arg, ctx);
      const values = v instanceof Ref ? [...this.cellsOf(v, ctx)].map((c) => c.value).filter((x) => typeof x !== "string") : [v];
      for (const x of values) {
        if (x === null) continue;
        const b = toBoolean(x);
        if (isError(b)) return b;
        result = result && b;
      }
    }
    return result;
  },
  OR(args, ctx) {
    let result = false;
    for (const arg of args) {
      const v = this.evaluate(arg, ctx);
      const values = v instanceof Ref ? [...this.cellsOf(v, ctx)].map((c) => c.value).filter((x) => typeof x !== "string") : [v];
      for (const x of values) {
        if (x === null) continue;
        const b = toBoolean(x);
        if (isError(b)) return b;
        result = result || b;
      }
    }
    return result;
  },
  SUM(args, ctx) {
    const numbers = this.numbersOf(args, ctx);
    if (isError(numbers)) return numbers;
    return numbers.reduce((a, b) => a + b, 0);
  },
  MIN(args, ctx) {
    const numbers = this.numbersOf(args, ctx);
    if (isError(numbers)) return numbers;
    return numbers.length ? Math.min(...numbers) : 0;
  },
  MAX(args, ctx) {
    const numbers = this.numbersOf(args, ctx);
    if (isError(numbers)) return numbers;
    return numbers.length ? Math.max(...numbers) : 0;
  },
  COUNT(args, ctx) {
    let count = 0;
    for (const arg of args) {
      const v = this.evaluate(arg, ctx);
      if (v instanceof Ref) {
        for (const { value } of this.cellsOf(v, ctx)) if (typeof value === "number") count++;
      } else if (typeof v === "number" || typeof v === "boolean" || (typeof v === "string" && NUMBER_TEXT.test(v))) {
        count++;
      }
    }
    return count;
  },
  ROUND(args, ctx) {
    const n = this.argNumber(args[0], ctx);
    const d = this.argNumber(args[1], ctx);
    if (isError(n)) return n;
    if (isError(d)) return d;
    return roundHalfAwayFromZero(n, Math.trunc(d));
  },
  ROUNDUP(args, ctx) {
    const n = this.argNumber(args[0], ctx);
    const d = this.argNumber(args[1], ctx);
    if (isError(n)) return n;
    if (isError(d)) return d;
    return roundTowards(n, Math.trunc(d), true);
  },
  ROUNDDOWN(args, ctx) {
    const n = this.argNumber(args[0], ctx);
    const d = this.argNumber(args[1], ctx);
    if (isError(n)) return n;
    if (isError(d)) return d;
    return roundTowards(n, Math.trunc(d), false);
  },
  N(args, ctx) {
    const v = this.scalar(this.evaluate(args[0], ctx), ctx);
    if (isError(v)) return v;
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v ? 1 : 0;
    return 0;
  },
  ISERROR(args, ctx) {
    return isError(this.scalar(this.evaluate(args[0], ctx), ctx));
  },
  TEXT(args, ctx) {
    const v = this.scalar(this.evaluate(args[0], ctx), ctx);
    const f = this.scalar(this.evaluate(args[1], ctx), ctx);
    if (isError(v)) return v;
    if (isError(f)) return f;
    return formatText(v, f === null ? "" : f);
  },
  YEAR(args, ctx) {
    const n = this.argNumber(args[0], ctx);
    return isError(n) ? n : serialToDate(n).year;
  },
  MONTH(args, ctx) {
    const n = this.argNumber(args[0], ctx);
    return isError(n) ? n : serialToDate(n).month;
  },
  DAY(args, ctx) {
    const n = this.argNumber(args[0], ctx);
    return isError(n) ? n : serialToDate(n).day;
  },
  DATE(args, ctx) {
    const [y, m, d] = args.map((a) => this.argNumber(a, ctx));
    for (const v of [y, m, d]) if (isError(v)) return v;
    let year = Math.trunc(y);
    if (year < 1900) year += 1900;
    const serial = dateToSerial(year, Math.trunc(m), Math.trunc(d));
    return serial < 0 ? ERRORS.num : serial;
  },
  EDATE(args, ctx) {
    const start = this.argNumber(args[0], ctx);
    const months = this.argNumber(args[1], ctx);
    if (isError(start)) return start;
    if (isError(months)) return months;
    const { year, month, day } = serialToDate(start);
    const target = year * 12 + (month - 1) + Math.trunc(months);
    const ty = Math.floor(target / 12);
    const tm = (target % 12) + 1;
    const last = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
    return dateToSerial(ty, tm, Math.min(day, last));
  },
  WEEKDAY(args, ctx) {
    const n = this.argNumber(args[0], ctx);
    const type = args.length > 1 ? this.argNumber(args[1], ctx) : 1;
    if (isError(n)) return n;
    if (isError(type)) return type;
    const sunday0 = (((Math.floor(n) - 1) % 7) + 7) % 7;
    if (type === 1) return sunday0 + 1;
    if (type === 2) return ((sunday0 + 6) % 7) + 1;
    if (type === 3) return (sunday0 + 6) % 7;
    throw new Unevaluable(`WEEKDAY type ${type}`);
  },
  TODAY() {
    throw new Unevaluable("function TODAY");
  },
  HYPERLINK(args, ctx) {
    const target = this.scalar(this.evaluate(args[0], ctx), ctx);
    if (args.length < 2) return target;
    const label = this.scalar(this.evaluate(args[1], ctx), ctx);
    return label === null ? 0 : label;
  },
  LOOKUP(args, ctx) {
    const wanted = this.scalar(this.evaluate(args[0], ctx), ctx);
    if (isError(wanted)) return wanted;
    const lookupRef = this.evaluate(args[1], ctx);
    if (isError(lookupRef)) return lookupRef;
    if (!(lookupRef instanceof Ref)) throw new Unevaluable("LOOKUP over an array");
    const resultRef = args.length > 2 ? this.evaluate(args[2], ctx) : lookupRef;
    if (isError(resultRef)) return resultRef;
    if (!(resultRef instanceof Ref)) throw new Unevaluable("LOOKUP into an array");
    if (wanted === null) return ERRORS.na;

    // A binary search over the cells holding the sought value's own kind,
    // which on ascending data finds the last one not above it.
    const kind = typeof wanted;
    const candidates = this.vector(lookupRef, ctx).filter(({ value }) => typeof value === kind);
    let lo = 0;
    let hi = candidates.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (compareValues(candidates[mid].value, wanted) <= 0) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (found < 0) return ERRORS.na;
    const { offset } = candidates[found];
    if (resultRef.c1 === resultRef.c2) return this.cellValue(resultRef.sheet, resultRef.r1 + offset, resultRef.c1, ctx.depth) ?? 0;
    if (resultRef.r1 === resultRef.r2) return this.cellValue(resultRef.sheet, resultRef.r1, resultRef.c1 + offset, ctx.depth) ?? 0;
    throw new Unevaluable("LOOKUP into a two-dimensional range");
  },
  SUMIF(args, ctx) {
    const range = this.evaluate(args[0], ctx);
    if (!(range instanceof Ref)) throw new Unevaluable("SUMIF over an array");
    const spec = this.scalar(this.evaluate(args[1], ctx), ctx);
    if (isError(spec)) return spec;
    const sumRef = args.length > 2 ? this.evaluate(args[2], ctx) : range;
    if (!(sumRef instanceof Ref)) throw new Unevaluable("SUMIF into an array");
    const test = criterion(spec);
    let total = 0;
    for (let r = range.r1; r <= range.r2; r++) {
      for (let c = range.c1; c <= range.c2; c++) {
        if (!test(this.cellValue(range.sheet, r, c, ctx.depth))) continue;
        const v = this.cellValue(sumRef.sheet, sumRef.r1 + (r - range.r1), sumRef.c1 + (c - range.c1), ctx.depth);
        if (isError(v)) return v;
        if (typeof v === "number") total += v;
      }
    }
    return total;
  },
  ADDRESS(args, ctx) {
    const row = this.argNumber(args[0], ctx);
    const col = this.argNumber(args[1], ctx);
    const absNum = args.length > 2 && args[2].kind !== "missing" ? this.argNumber(args[2], ctx) : 1;
    const a1 = args.length > 3 && args[3].kind !== "missing" ? toBoolean(this.scalar(this.evaluate(args[3], ctx), ctx)) : true;
    const sheetName = args.length > 4 ? this.scalar(this.evaluate(args[4], ctx), ctx) : null;
    for (const v of [row, col, absNum, a1, sheetName]) if (isError(v)) return v;
    if (a1 !== true) throw new Unevaluable("ADDRESS in R1C1 style");
    if (row < 1 || col < 1) return ERRORS.value;
    const colText = numToCol(Math.trunc(col));
    const rowText = String(Math.trunc(row));
    const address = {
      1: `$${colText}$${rowText}`,
      2: `${colText}$${rowText}`,
      3: `$${colText}${rowText}`,
      4: `${colText}${rowText}`,
    }[absNum];
    if (!address) return ERRORS.value;
    if (sheetName === null || sheetName === "") return address;
    const text = toText(sheetName);
    const quoted = /^[A-Za-z_][A-Za-z0-9_.]*$/.test(text) && !/^[A-Za-z]{1,3}\d+$/.test(text) ? text : `'${text.replace(/'/g, "''")}'`;
    return `${quoted}!${address}`;
  },
  INDIRECT(args, ctx) {
    const text = this.scalar(this.evaluate(args[0], ctx), ctx);
    if (isError(text)) return text;
    if (args.length > 1) {
      const a1 = toBoolean(this.scalar(this.evaluate(args[1], ctx), ctx));
      if (a1 !== true) throw new Unevaluable("INDIRECT in R1C1 style");
    }
    if (typeof text !== "string") return ERRORS.ref;
    return this.refFromText(text, ctx);
  },
};

// ── Writing results back ─────────────────────────────────────────────────

function sameValue(cached, computed) {
  if (cached === null || computed === null) return cached === computed;
  if (typeof cached === "number" && typeof computed === "number") {
    return Math.abs(cached - computed) <= 1e-12 * Math.max(1, Math.abs(cached), Math.abs(computed));
  }
  if (isError(cached) || isError(computed)) return isError(cached) && isError(computed) && cached.code === computed.code;
  return cached === computed;
}

function numberXml(n) {
  if (Object.is(n, -0)) return "0";
  return String(n);
}

function rewrittenCell(cell, sheetXml, value) {
  const whole = sheetXml.slice(cell.start, cell.end);
  const open = whole.match(/^<c\b[^>]*?>/)[0];
  const attrs = open.slice(2, -1).replace(/\st="[^"]*"/, "");
  let type = null;
  let v;
  if (typeof value === "number") {
    v = `<v>${numberXml(value)}</v>`;
  } else if (typeof value === "string") {
    type = "str";
    v = /^\s|\s$/.test(value) ? `<v xml:space="preserve">${escapeText(value)}</v>` : `<v>${escapeText(value)}</v>`;
  } else if (typeof value === "boolean") {
    type = "b";
    v = `<v>${value ? 1 : 0}</v>`;
  } else {
    type = "e";
    v = `<v>${escapeText(value.code)}</v>`;
  }
  const inner = cell.inner.replace(/<v(?:\s[^>]*)?>[^<]*<\/v>|<v\/>/, v);
  return `<c${attrs}${type ? ` t="${type}"` : ""}>${inner}</c>`;
}

/**
 * Brings the cached values of an open workbook into line. With `before`, an
 * earlier copy of the same workbook, only the formulas the changes since
 * then reach are evaluated; without it, every formula is. Only sheets with a
 * changed cell are rewritten in the zip.
 *
 * @param {Object} zip - a JSZip of an xlsx
 * @param {Object|null} before - a JSZip of the workbook before the changes
 * @returns {Promise<{changed: Array<{sheet: string, cell: string, from: *, to: *}>, unevaluated: Array<{sheet: string, cell: string, reason: string, tainted: boolean}>, evaluated: number}>}
 */
export async function refreshZipCachedValues(zip, before = null) {
  const parts = new WorkbookParts(zip);
  const seeds = before ? await changedCells(new WorkbookParts(before), parts) : null;
  if (seeds && !seeds.length) return { changed: [], unevaluated: [], evaluated: 0 };
  let book;
  try {
    book = await readWorkbook(parts);
  } catch (err) {
    if (err instanceof Unevaluable)
      return { changed: [], unevaluated: [{ sheet: "", cell: "", reason: err.reason, tainted: false }], evaluated: 0 };
    throw err;
  }
  const evaluator = new Evaluator(book);
  if (seeds) evaluator.stale = reachedBy(seedsIn(book, seeds), dependentsOf(evaluator));

  const toEvaluate = [];
  for (const sheet of book.ordered) {
    const cells = [];
    for (const cell of sheet.cells.values()) if (cell.formula && (!evaluator.stale || evaluator.stale.has(cell))) cells.push(cell);
    cells.sort((a, b) => a.row - b.row || a.col - b.col);
    toEvaluate.push({ sheet, cells });
  }

  let evaluated = 0;
  for (const { sheet, cells } of toEvaluate) {
    for (const cell of cells) {
      evaluated++;
      const pending = [{ sheet, cell }];
      while (pending.length) {
        if (pending.length > 100000) throw new Error(`${sheet.name}!${cell.ref} reads a chain of cells too long to evaluate`);
        const next = pending[pending.length - 1];
        try {
          evaluator.evaluateCell(next.sheet, next.cell, 0);
          pending.pop();
        } catch (err) {
          if (!(err instanceof Deferred)) throw err;
          pending.push(err.cell);
        }
      }
    }
  }

  const changed = [];
  const unevaluated = [];
  for (const { sheet, cells } of toEvaluate) {
    const edits = [];
    for (const cell of cells) {
      const state = evaluator.state.get(cell);
      if (state.unevaluable) {
        unevaluated.push({ sheet: sheet.name, cell: cell.ref, reason: state.unevaluable, tainted: state.tainted });
        continue;
      }
      if (!cell.hasCachedValue) continue;
      if (cell.cached && cell.cached.unsupported) continue;
      if (sameValue(cell.cached, state.value)) continue;
      changed.push({ sheet: sheet.name, cell: cell.ref, from: cell.cached, to: isError(state.value) ? state.value.code : state.value });
      edits.push({ cell, text: rewrittenCell(cell, sheet.xml, state.value) });
    }
    if (!edits.length) continue;
    edits.sort((a, b) => a.cell.start - b.cell.start);
    let xml = "";
    let at = 0;
    for (const { cell, text } of edits) {
      xml += sheet.xml.slice(at, cell.start) + text;
      at = cell.end;
    }
    xml += sheet.xml.slice(at);
    zip.file(sheet.path, xml, { date: zip.file(sheet.path).date });
  }
  return { changed, unevaluated, evaluated };
}

const DOS_EPOCH = new Date("1980-01-01T00:00:00Z");

/**
 * The same over a workbook's bytes, against the bytes it was made from, with
 * the report. The bytes come back untouched when no cached value moved.
 *
 * @param {Uint8Array|null} beforeBytes - the workbook before the changes; null evaluates every formula
 * @param {Uint8Array} bytes - the workbook after them
 * @param {{compressionLevel?: number}} [options]
 */
export async function analyseCachedValues(beforeBytes, bytes, { compressionLevel = 6 } = {}) {
  const zip = await JSZip.loadAsync(bytes);
  const before = beforeBytes ? await JSZip.loadAsync(beforeBytes) : null;
  const report = await refreshZipCachedValues(zip, before);
  if (!report.changed.length) return { bytes, ...report };
  for (const entry of Object.values(zip.files)) if (entry.dir) entry.date = DOS_EPOCH;
  const refreshed = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: compressionLevel },
  });
  return { bytes: refreshed, ...report };
}

/**
 * A workbook's bytes with the cached value of every formula its changes
 * since `beforeBytes` reach brought into line.
 *
 * @param {Uint8Array} beforeBytes
 * @param {Uint8Array} bytes
 * @param {{compressionLevel?: number}} [options]
 * @returns {Promise<Uint8Array>}
 */
export async function refreshCachedValues(beforeBytes, bytes, options) {
  return (await analyseCachedValues(beforeBytes, bytes, options)).bytes;
}
