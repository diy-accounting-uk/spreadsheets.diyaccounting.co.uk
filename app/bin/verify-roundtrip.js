#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// verify-roundtrip.js — Score both halves of the export tuple between an
// Excel-side output directory and a JS-side one, both written by report.js.
//
//   EQ1, the report half: join the two report.json documents on key and
//   return four counts that can only fall -- equal, differing, no JS value,
//   no Excel value.
//   EQ2, the data half: join the two data/ directories as a multiset of
//   canonical lines, plus a field-by-field comparison of book.toml. The JS
//   side writes the original fixture in canonical form, so this compares the
//   export against the fixture and not against a second export.
//
// A diff -r line count moves when a report section is added, when a label is
// reworded, and when a value changes, and the three are indistinguishable.
// These counts move only when a value does.
//
// Usage:
//   node app/bin/verify-roundtrip.js --package ltd \
//     --excel target/ltd-excel --js target/ltd-js \
//     --budget app/data/roundtrip-budget.json

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { parse as parseTOML } from "smol-toml";

// ── Canonicalisation by unit ───────────────────────────────────────────────

// Excel stores binary floating point and the xls roundtrip re-serialises it,
// so both sides carry representation noise below a penny. Rounding removes
// the noise and keeps every real penny. This is canonicalisation, not
// tolerance: it applies to every money value, the filed boxes included.
const MONEY_DECIMALS = 2;
// A working precision a money value passes through before the penny round,
// finer than any real penny difference but coarse enough to absorb the
// representation noise a binary float or an xls roundtrip leaves below it.
const WORKING_DECIMALS = 6;
// A rate is stored as a fraction, and six places is finer than any rate the
// tax data declares.
const RATE_DECIMALS = 6;

/**
 * Round a decimal string half away from zero to a fixed number of places, on
 * the digits themselves rather than through a binary float, so 0.005 at two
 * places is 0.01 and never 0.00.
 * @param {string} text - a decimal string, optionally signed
 * @param {number} decimals
 * @returns {string} the value with exactly `decimals` places
 */
export function roundHalfUp(text, decimals) {
  const match = /^([-+]?)(\d*)(?:\.(\d*))?$/.exec(String(text).trim());
  if (!match) return String(text).trim();
  const sign = match[1] === "-" ? "-" : "";
  const whole = match[2] || "0";
  const fraction = match[3] || "";

  const kept = fraction.slice(0, decimals).padEnd(decimals, "0");
  const nextDigit = fraction.charCodeAt(decimals) - 48;
  let digits = BigInt(whole + kept);
  if (nextDigit >= 5) digits += 1n;

  const padded = digits.toString().padStart(decimals + 1, "0");
  const wholePart = padded.slice(0, padded.length - decimals);
  const fractionPart = decimals > 0 ? `.${padded.slice(padded.length - decimals)}` : "";
  const rounded = `${wholePart}${fractionPart}`;
  // A rounded nil is nil, never "-0.00".
  return digits === 0n ? rounded : `${sign}${rounded}`;
}

// A money string already rounded to the penny, as a whole number of pence.
// Comparing a window in pence keeps the arithmetic exact: 100.01 minus
// 100.00 is one penny, where the same subtraction in binary floating point
// lands just over the penny window it is being tested against.
function pennies(text) {
  const [whole, fraction = ""] = String(text).replace("-", "").split(".");
  const magnitude = BigInt(whole + fraction.padEnd(MONEY_DECIMALS, "0").slice(0, MONEY_DECIMALS));
  return String(text).startsWith("-") ? -magnitude : magnitude;
}

function isDecimal(text) {
  const trimmed = String(text ?? "").trim();
  return /^[-+]?\d*(\.\d*)?$/.test(trimmed) && /\d/.test(trimmed);
}

/**
 * A report value in the form its unit is compared in. An unknown or absent
 * unit canonicalises to the trimmed string, so a value with no declared unit
 * is compared exactly and declaring a unit can only ever loosen a comparison,
 * never tighten one.
 * @param {string} value
 * @param {string} [unit] - money, rate, count, date, text, identifier or verdict
 * @returns {string}
 */
export function canonicalForUnit(value, unit) {
  const text = String(value ?? "").trim();
  // A money value is rounded to a working precision first (finer than the
  // penny but coarse enough to absorb binary-float noise below it), then to
  // the penny. Rounding straight to the penny lets the noise itself decide
  // which way a value on the boundary falls, and the two engines' noise
  // differs, so the same underlying penny can round two different ways.
  if (unit === "money" && isDecimal(text)) return roundHalfUp(roundHalfUp(text, WORKING_DECIMALS), MONEY_DECIMALS);
  if (unit === "rate" && isDecimal(text)) return roundHalfUp(text, RATE_DECIMALS);
  return text;
}

// ── The tolerance policy ───────────────────────────────────────────────────

// A window left open after the money rounding above is a tolerance, and a key
// may carry one only where an Excel check reads that same value and already
// allows the same difference. Each row below names the check rather than a
// figure, and the figure is read from that check's own entry in R, so a
// comparator window can never be wider than the check standing behind it.
//
// The check() helper in all four products defaults to a one pound window.
// That exists to absorb a sheet rounding a filed box to the pound, not to
// absorb a difference between two engines, so nothing here inherits it: money
// keys compare at two decimal places exact whatever their check allows.
const NETTING_CHECK = /^Category netting: (.+) \((.+)\) net reaches .* with no residue$/;

function slugSegment(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const TOLERANCE_ROWS = [
  {
    owns: (name) => name === "Accounting profit to tax profit bridge closes to zero",
    keys: () => ["section/accounting-profit-to-tax-profit-bridge/residue"],
  },
  {
    // The flat 20/120 case: the netting table strips VAT at the book's single
    // rate while the journal carries a rate per line, and this check is the
    // one place that difference is already allowed for.
    owns: (name) => NETTING_CHECK.test(name),
    keys: (name) => {
      const match = NETTING_CHECK.exec(name);
      const row = `${slugSegment(match[1])}-${slugSegment(match[2])}`;
      return [`section/journal-category-vat-netting/${row}/net`, `section/journal-category-vat-netting/${row}/residue`];
    },
  },
  {
    owns: (name) => name === "SA103S: Net profit close to P&L Net",
    keys: () => ["section/self-assessment-sa103s/net-profit-loss"],
  },
];

/**
 * The window each key may differ by, read from the check that owns it. A key
 * whose check is absent from R carries none and is compared exactly.
 *
 * A key scored through another (a section row that reprints a cell) hands its
 * window to the key actually scored, so naming the report row is enough and
 * the comparator finds the cell standing behind it.
 *
 * @param {Array} entries - the Excel side's R entries
 * @returns {Map<string, number>}
 */
export function toleranceByKey(entries) {
  const tolerances = new Map();
  for (const entry of entries) {
    if (!entry.key.startsWith("check/") || entry.tolerance === undefined) continue;
    const name = entry.key.slice("check/".length);
    for (const row of TOLERANCE_ROWS) {
      if (!row.owns(name)) continue;
      for (const key of row.keys(name)) tolerances.set(key, Number(entry.tolerance));
    }
  }

  for (const entry of entries) {
    if (entry.source && tolerances.has(entry.key)) tolerances.set(entry.source, tolerances.get(entry.key));
  }
  return tolerances;
}

// ── EQ1: the report half ───────────────────────────────────────────────────

// Whether an entry is evidence in its own right. A value that reprints a cell
// R already carries, or that is the sum of keys R already carries, is scored
// through those: if every operand agrees so does the total, and a
// disagreement in an operand has already failed. A total whose operands are
// not all present keeps its own key.
function isScored(entry, present) {
  if (entry.source) return !present.has(entry.source);
  if (entry.derivedFrom) return !entry.derivedFrom.every((key) => present.has(key));
  return true;
}

// Whether a key is scored is settled across both documents at once. A row
// whose source one engine carries and the other does not would otherwise be
// scored on one side only, and land in the "no value" column as though the
// row itself were missing.
function scoredEntries(document, present) {
  const scored = new Map();
  for (const entry of document?.values ?? []) {
    if (isScored(entry, present)) scored.set(entry.key, entry);
  }
  return scored;
}

/**
 * Whether two entries at one key carry the same figure, under that key's
 * declared unit and whatever window the check owning it allows.
 */
export function entriesEqual(excelEntry, jsEntry, tolerance) {
  const unit = excelEntry.unit ?? jsEntry.unit;
  const excel = canonicalForUnit(excelEntry.value, unit);
  const js = canonicalForUnit(jsEntry.value, unit);
  if (excel === js) return true;
  if (tolerance === undefined || unit !== "money") return false;
  if (!isDecimal(excel) || !isDecimal(js)) return false;
  const difference = pennies(excel) - pennies(js);
  return (difference < 0n ? -difference : difference) <= pennies(roundHalfUp(String(tolerance), MONEY_DECIMALS));
}

/**
 * Score EQ1 between two R documents. Returns the four counts plus the keys
 * behind each, so a rise can be read rather than guessed at.
 * @param {Object} excelDocument - report.json from the Excel side
 * @param {Object} jsDocument - report.json from the JS side
 */
export function scoreReportDocuments(excelDocument, jsDocument) {
  const present = new Set([...(excelDocument?.values ?? []), ...(jsDocument?.values ?? [])].map((entry) => entry.key));
  const excel = scoredEntries(excelDocument, present);
  const js = scoredEntries(jsDocument, present);
  const tolerances = toleranceByKey(excelDocument?.values ?? []);

  let equal = 0;
  const differingKeys = [];
  const noJsValueKeys = [];
  const noExcelValueKeys = [];

  for (const [key, excelEntry] of excel) {
    const jsEntry = js.get(key);
    if (!jsEntry) {
      noJsValueKeys.push(key);
      continue;
    }
    if (entriesEqual(excelEntry, jsEntry, tolerances.get(key))) equal++;
    else differingKeys.push(key);
  }
  for (const key of js.keys()) {
    if (!excel.has(key)) noExcelValueKeys.push(key);
  }

  return {
    equal,
    differing: differingKeys.length,
    noJsValue: noJsValueKeys.length,
    noExcelValue: noExcelValueKeys.length,
    differingKeys: differingKeys.sort(),
    noJsValueKeys: noJsValueKeys.sort(),
    noExcelValueKeys: noExcelValueKeys.sort(),
  };
}

// The kind of key an entry is, for a breakdown of the same score: every cell
// read together, then one row per report section, then the verdicts.
function keyKind(key) {
  const kind = key.split("/")[0];
  return kind === "section" ? `section/${key.split("/")[1]}` : kind;
}

/**
 * The same score, broken down by the kind of key.
 */
export function scoreReportDocumentsByKind(excelDocument, jsDocument) {
  const subset = (document, kind) => ({
    ...document,
    values: (document?.values ?? []).filter((entry) => keyKind(entry.key) === kind),
  });
  const kinds = new Set([...(excelDocument?.values ?? []), ...(jsDocument?.values ?? [])].map((entry) => keyKind(entry.key)));
  const byKind = new Map();
  for (const kind of [...kinds].sort()) {
    byKind.set(kind, scoreReportDocuments(subset(excelDocument, kind), subset(jsDocument, kind)));
  }
  return byKind;
}

// ── The period-frame shift ─────────────────────────────────────────────────

// generate.js moves every posting date onto the package's own accounting
// period (app/products/ltd.js, cellWrites/shiftMonths): forward by the
// whole-month gap between the scenario's declared period start and the
// package's, clamping a day the shifted month lacks to that month's own last
// day. Reversing that on the export is lossy at a clamped date -- the exact
// origin day cannot be recovered -- so this comparator puts the fixture
// through the identical forward shift instead. Clamping then falls the same
// way on both sides and the comparison after it is exact.
function shiftMonths(date, monthOffset) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + monthOffset;
  const lastDayOfShiftedMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDayOfShiftedMonth)));
}

/**
 * The whole-month offset generate.js shifts every posting date by, from a
 * scenario's own declared period start month to a package's year-end month.
 * Mirrors the monthOffset arithmetic in app/products/ltd.js's cellWrites.
 * @param {number} periodStartMonth - 1-indexed month documentInfo.periodCoveredStart falls in
 * @param {number} yearEndMonth - 1-indexed month the package's own year end falls in
 * @returns {number} 0-11
 */
export function periodFrameOffset(periodStartMonth, yearEndMonth) {
  const targetStartMonth = yearEndMonth % 12;
  const sourceStartMonth = periodStartMonth - 1;
  return (targetStartMonth - sourceStartMonth + 12) % 12;
}

/**
 * A YYYY-MM-DD posting date moved forward by a period-frame offset, in the
 * same form scoreDataHalves reads lines.jsonl in.
 * @param {string} text
 * @param {number} monthOffset
 * @returns {string}
 */
export function shiftPostingDate(text, monthOffset) {
  const [year, month, day] = String(text).split("-").map(Number);
  return shiftMonths(new Date(Date.UTC(year, month - 1, day)), monthOffset).toISOString().slice(0, 10);
}

// ── EQ2: the data half ─────────────────────────────────────────────────────

function readJsonl(path) {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function countMultiset(items) {
  const counts = new Map();
  for (const item of items) counts.set(item, (counts.get(item) || 0) + 1);
  return counts;
}

function multisetOverlap(left, right) {
  const rightCounts = countMultiset(right);
  let matched = 0;
  for (const [item, count] of countMultiset(left)) {
    matched += Math.min(count, rightCounts.get(item) || 0);
  }
  return matched;
}

// Three progressively wider projections of a line, so a loss can be told
// apart from a mangling: the coarse one says the transaction survived, the
// account one says its identity did, and the whole line says every field did.
const COARSE_FIELDS = ["postingDate", "amount", "sourceJournalID"];
const ACCOUNT_FIELDS = [...COARSE_FIELDS, "accountMainID"];

function project(line, fields) {
  return fields.map((field) => (field === "amount" ? roundHalfUp(String(line[field] ?? 0), 2) : String(line[field] ?? ""))).join("|");
}

// A line on every field the encoding claims to carry. The fields the
// inventory names are left out of both sides: an entry number the export
// regenerates, or a quantity no sheet has a column for, would otherwise put
// every line in the differing column and hide the fields that do survive.
function wholeLine(line, unrepresentable) {
  return JSON.stringify(
    Object.keys(line)
      .filter((field) => !unrepresentable.has(field))
      .sort()
      .map((field) => [field, typeof line[field] === "number" ? roundHalfUp(String(line[field]), 4) : line[field]]),
  );
}

// ── The unrepresentable-field inventory ────────────────────────────────────

// An inventory entry names its reach with exactly one of "products" (every
// block of a product) or "blocks" (only the named product/block pairs, block
// being a line's own sourceJournalID). Mixing the two on one entry would let
// a product-wide and a block-scoped declaration be read as either, so it is
// rejected outright rather than guessed at.
function validateInventoryEntry(entry, index) {
  const where = `roundtrip-unrepresentable.json fields[${index}]${entry?.field ? ` ("${entry.field}")` : ""}`;
  if (typeof entry?.field !== "string" || entry.field.length === 0) throw new Error(`${where} has no field name`);
  const hasProducts = Object.prototype.hasOwnProperty.call(entry, "products");
  const hasBlocks = Object.prototype.hasOwnProperty.call(entry, "blocks");
  if (hasProducts === hasBlocks) throw new Error(`${where} must declare exactly one of "products" or "blocks", never both or neither`);
  if (hasProducts) {
    if (!Array.isArray(entry.products) || entry.products.length === 0 || !entry.products.every((p) => typeof p === "string" && p)) {
      throw new Error(`${where} has a malformed "products" list`);
    }
  } else {
    if (!Array.isArray(entry.blocks) || entry.blocks.length === 0) throw new Error(`${where} has a malformed "blocks" list`);
    for (const scope of entry.blocks) {
      if (!scope || typeof scope.product !== "string" || !scope.product || typeof scope.block !== "string" || !scope.block) {
        throw new Error(`${where} has a malformed block scope; each entry needs a "product" and a "block"`);
      }
    }
  }
}

// A scope with no declarations, for a call site that has no inventory file
// or is scoring a product the inventory names nothing for.
const EMPTY_SCOPE = { product: undefined, productWide: new Set(), byBlock: new Map() };

/**
 * The fields the checked-in inventory says the Excel encoding has nowhere to
 * put, for one product, split into the fields no block of that product can
 * carry (`productWide`) and the fields only a specific block cannot carry
 * (`byBlock`, keyed by a line's own sourceJournalID). A line's own
 * applicable set is `productWide` plus whatever `byBlock` names for that
 * line's block, so a block-scoped declaration blanks only the block it
 * names -- a block that still carries the field (e.g. sales keeping its own
 * description column) keeps being compared on it.
 * @param {string} product
 * @param {Object} [inventory] - the parsed roundtrip-unrepresentable.json
 * @returns {{ product: string, productWide: Set<string>, byBlock: Map<string, Set<string>> }}
 */
export function unrepresentableScope(product, inventory) {
  const productWide = new Set();
  const byBlock = new Map();
  const fields = inventory?.fields ?? [];
  fields.forEach((entry, index) => validateInventoryEntry(entry, index));
  for (const entry of fields) {
    if (entry.products) {
      if (entry.products.includes(product)) productWide.add(entry.field);
      continue;
    }
    for (const scope of entry.blocks) {
      if (scope.product !== product) continue;
      if (!byBlock.has(scope.block)) byBlock.set(scope.block, new Set());
      byBlock.get(scope.block).add(entry.field);
    }
  }
  return { product, productWide, byBlock };
}

// The fields a given line's own block leaves unrepresentable: the
// product-wide set plus whatever the block-scoped map names for that line's
// sourceJournalID. A line with no matching block entry gets the product-wide
// set alone, unchanged from before block scoping existed.
function unrepresentableForLine(scope, line) {
  const blockFields = scope.byBlock.get(line.sourceJournalID);
  if (!blockFields) return scope.productWide;
  return new Set([...scope.productWide, ...blockFields]);
}

// Every field name any entry in the scope declares, product-wide or
// block-scoped, for the coarse "does the export carry this field kind at
// all" axis below -- that axis does not distinguish blocks, so a field
// dropped from one block but carried by another is "no home" there and
// "dropped" nowhere.
function allDeclaredFields(scope) {
  const all = new Set(scope.productWide);
  for (const fields of scope.byBlock.values()) for (const field of fields) all.add(field);
  return all;
}

/**
 * Flatten a parsed book.toml to dotted paths, so two books can be compared
 * field by field rather than as two blobs of text.
 */
export function flattenBook(value, prefix = "") {
  const flat = new Map();
  if (value === null || value === undefined) return flat;
  if (value instanceof Date) {
    flat.set(prefix, value.toISOString().slice(0, 10));
    return flat;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      for (const [path, leaf] of flattenBook(item, `${prefix}[${index}]`)) flat.set(path, leaf);
    });
    return flat;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      for (const [path, leaf] of flattenBook(nested, prefix ? `${prefix}.${key}` : key)) flat.set(path, leaf);
    }
    return flat;
  }
  flat.set(prefix, typeof value === "number" ? roundHalfUp(String(value), 6) : String(value));
  return flat;
}

/**
 * Score EQ2 between the fixture (the JS side's data/, which is the original
 * input written in canonical form) and the export (the Excel side's data/).
 * @param {string} fixtureDir
 * @param {string} exportDir
 * @param {{ product: string, productWide: Set<string>, byBlock: Map<string, Set<string>> }} [scope] -
 *   the fields the encoding has no home for, from unrepresentableScope(). A
 *   block-scoped declaration whose block matches no line's sourceJournalID
 *   in this run is a stale or mistyped block name, not silence, so it
 *   throws rather than quietly declaring nothing.
 * @param {number} [dateShiftMonths] - the period-frame offset (periodFrameOffset)
 *   to move the fixture's own postingDate forward by before comparing, for a
 *   package whose year end put the export's dates through the same shift.
 *   0 (the default) compares postingDate as the fixture wrote it.
 */
export function scoreDataHalves(fixtureDir, exportDir, scope = EMPTY_SCOPE, dateShiftMonths = 0) {
  const rawFixtureLines = readJsonl(resolve(fixtureDir, "lines.jsonl"));
  const exportedLines = readJsonl(resolve(exportDir, "lines.jsonl"));
  const fixtureLines = dateShiftMonths
    ? rawFixtureLines.map((line) =>
        line.postingDate === undefined ? line : { ...line, postingDate: shiftPostingDate(line.postingDate, dateShiftMonths) },
      )
    : rawFixtureLines;

  const observedBlocks = new Set(
    [...fixtureLines, ...exportedLines].map((line) => line.sourceJournalID).filter((block) => block !== undefined),
  );
  for (const block of scope.byBlock.keys()) {
    if (!observedBlocks.has(block)) {
      throw new Error(
        `roundtrip-unrepresentable.json declares a block-scoped field for ${scope.product ?? "this product"}'s "${block}" block, ` +
          `but no line in this run carries sourceJournalID "${block}" -- the declaration matches nothing`,
      );
    }
  }

  const unrepresentable = allDeclaredFields(scope);
  const fixtureFields = new Set(fixtureLines.flatMap((line) => Object.keys(line)));
  const exportedFields = new Set(exportedLines.flatMap((line) => Object.keys(line)));
  const missingFields = [...fixtureFields].filter((field) => !exportedFields.has(field)).sort();
  const fieldsDropped = missingFields.filter((field) => !unrepresentable.has(field));
  const fieldsUnrepresentable = missingFields.filter((field) => unrepresentable.has(field));

  const fixtureFlat = flattenBook(parseTOML(readFileSync(resolve(fixtureDir, "book.toml"), "utf8")));
  const exportedFlat = flattenBook(parseTOML(readFileSync(resolve(exportDir, "book.toml"), "utf8")));

  const bookMissing = [];
  const bookDiffering = [];
  let bookEqual = 0;
  for (const [path, value] of fixtureFlat) {
    if (!exportedFlat.has(path)) bookMissing.push(path);
    else if (exportedFlat.get(path) === value) bookEqual++;
    else bookDiffering.push(path);
  }
  const bookExtra = [...exportedFlat.keys()].filter((path) => !fixtureFlat.has(path));

  return {
    fixtureLines: fixtureLines.length,
    exportedLines: exportedLines.length,
    linesLost: Math.max(0, fixtureLines.length - exportedLines.length),
    coarseMatches: multisetOverlap(
      fixtureLines.map((line) => project(line, COARSE_FIELDS)),
      exportedLines.map((line) => project(line, COARSE_FIELDS)),
    ),
    accountMatches: multisetOverlap(
      fixtureLines.map((line) => project(line, ACCOUNT_FIELDS)),
      exportedLines.map((line) => project(line, ACCOUNT_FIELDS)),
    ),
    wholeLineMatches: multisetOverlap(
      fixtureLines.map((line) => wholeLine(line, unrepresentableForLine(scope, line))),
      exportedLines.map((line) => wholeLine(line, unrepresentableForLine(scope, line))),
    ),
    fieldsDropped,
    fieldsDroppedCount: fieldsDropped.length,
    fieldsUnrepresentable,
    book: {
      equal: bookEqual,
      differing: bookDiffering.length,
      missing: bookMissing.length,
      extra: bookExtra.length,
      differingPaths: bookDiffering.sort(),
      missingPaths: bookMissing.sort(),
    },
  };
}

// ── Reporting ──────────────────────────────────────────────────────────────

function formatScorecard(packageName, excelDir, jsDir, score, byKind, data) {
  const excelValues = score.equal + score.differing + score.noJsValue;
  const jsValues = score.equal + score.differing + score.noExcelValue;
  const lines = [
    `=== Roundtrip scorecard: ${packageName} ===`,
    `Excel: ${excelDir}`,
    `JS:    ${jsDir}`,
    "",
    "EQ1, the report half",
    `Excel values: ${excelValues}  JS values: ${jsValues}  Equal: ${score.equal}  Differing: ${score.differing}  No JS value: ${score.noJsValue}  No Excel value: ${score.noExcelValue}`,
    "",
    "| Key kind | Equal | Differing | No JS value | No Excel value |",
    "|----------|------:|----------:|------------:|---------------:|",
  ];
  for (const [kind, kindScore] of byKind) {
    lines.push(`| ${kind} | ${kindScore.equal} | ${kindScore.differing} | ${kindScore.noJsValue} | ${kindScore.noExcelValue} |`);
  }

  if (data) {
    lines.push(
      "",
      "EQ2, the data half, against the original fixture",
      "",
      "| Fixture lines | Exported lines | Same date, amount, journal | Same, plus accountMainID | Same on every carried field | Field kinds dropped | No home in the encoding |",
      "|--------------:|---------------:|---------------------------:|-------------------------:|--------------------:|--------------------:|------------------------:|",
      `| ${data.fixtureLines} | ${data.exportedLines} | ${data.coarseMatches} | ${data.accountMatches} | ${data.wholeLineMatches} | ${data.fieldsDroppedCount} | ${data.fieldsUnrepresentable.length} |`,
      "",
      `book.toml fields: equal ${data.book.equal}, differing ${data.book.differing}, missing ${data.book.missing}, extra ${data.book.extra}`,
    );
    if (data.fieldsDropped.length > 0) lines.push(`Fields the export drops: ${data.fieldsDropped.join(", ")}`);
    if (data.fieldsUnrepresentable.length > 0) lines.push(`Fields the encoding has no home for: ${data.fieldsUnrepresentable.join(", ")}`);
  }

  return lines.join("\n");
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
  };

  const packageName = getArg("--package");
  const excelDir = getArg("--excel");
  const jsDir = getArg("--js");
  const budgetPath = getArg("--budget");
  const outPath = getArg("--out");
  const unrepresentablePath = getArg("--unrepresentable");
  const dateShiftMonths = Number(getArg("--date-shift-months") ?? 0);

  if (!packageName || !excelDir || !jsDir) {
    console.error(
      "Usage: verify-roundtrip.js --package <name> --excel <dir> --js <dir> [--budget <file>] [--out <file>] [--unrepresentable <file>] [--date-shift-months <n>]",
    );
    process.exit(1);
  }

  return { packageName, excelDir, jsDir, budgetPath, outPath, unrepresentablePath, dateShiftMonths };
}

/**
 * The budget entries a result's counts exceed, for one product's counts and
 * budget entry. Only the keys the entry actually names are gated, so a track
 * can add a tighter bound without every other track's entry needing to grow
 * one.
 * @param {Object} counts - a result's `counts`, as returned alongside `scoreReportDocuments`
 * @param {Object} entry - one product's entry from `roundtrip-budget.json`
 * @returns {Array<[string, number]>} the metric name and budget limit for each breach
 */
export function budgetBreaches(counts, entry) {
  return Object.entries(entry).filter(([metric, limit]) => (counts[metric] ?? 0) > limit);
}

function readReportDocument(dir) {
  const path = resolve(dir, "report.json");
  if (!existsSync(path)) {
    console.error(`No report.json in ${dir}. Run report.js against it first.`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

async function main() {
  const { packageName, excelDir, jsDir, budgetPath, outPath, unrepresentablePath, dateShiftMonths } = parseArgs(process.argv);

  const excelDocument = readReportDocument(excelDir);
  const jsDocument = readReportDocument(jsDir);
  const score = scoreReportDocuments(excelDocument, jsDocument);
  const byKind = scoreReportDocumentsByKind(excelDocument, jsDocument);

  const excelData = resolve(excelDir, "data");
  const fixtureData = resolve(jsDir, "data");
  const hasData = existsSync(resolve(excelData, "lines.jsonl")) && existsSync(resolve(fixtureData, "lines.jsonl"));
  const inventoryPath = unrepresentablePath || resolve(process.cwd(), "app", "data", "roundtrip-unrepresentable.json");
  const inventory = existsSync(inventoryPath) ? JSON.parse(readFileSync(inventoryPath, "utf8")) : null;
  const data = hasData
    ? scoreDataHalves(fixtureData, excelData, unrepresentableScope(packageName, inventory), dateShiftMonths)
    : null;

  console.log(formatScorecard(packageName, excelDir, jsDir, score, byKind, data));

  const result = {
    package: packageName,
    excelDir,
    jsDir,
    counts: {
      equal: score.equal,
      differing: score.differing,
      noJsValue: score.noJsValue,
      noExcelValue: score.noExcelValue,
      ...(data
        ? {
            linesLost: data.linesLost,
            fieldsDropped: data.fieldsDroppedCount,
            bookFieldsMissing: data.book.missing,
            // A fixture line the export does not bring back as at least the
            // same transaction (coarseUnmatched), or brings back as the same
            // transaction but posted to a different account (accountUnmatched).
            // With --date-shift-months set, these score in the shifted frame,
            // so a non-March year end is judged on the transactions
            // themselves rather than on counts alone.
            coarseUnmatched: Math.max(0, data.fixtureLines - data.coarseMatches),
            accountUnmatched: Math.max(0, data.coarseMatches - data.accountMatches),
          }
        : {}),
    },
    byKind: Object.fromEntries(
      [...byKind].map(([kind, kindScore]) => [
        kind,
        { equal: kindScore.equal, differing: kindScore.differing, noJsValue: kindScore.noJsValue, noExcelValue: kindScore.noExcelValue },
      ]),
    ),
    differingKeys: score.differingKeys,
    noJsValueKeys: score.noJsValueKeys,
    noExcelValueKeys: score.noExcelValueKeys,
    ...(data ? { data } : {}),
  };

  if (outPath) {
    writeFileSync(resolve(outPath), JSON.stringify(result, null, 2) + "\n");
    console.log(`\nWritten: ${outPath}`);
  } else {
    console.log(`\n${JSON.stringify(result.counts)}`);
  }

  // The budget holds one entry per product with the counts CI must not let
  // rise, e.g. { "ltd": { "differing": 222, "noJsValue": 557 } }. Only the
  // keys a budget entry actually names are gated, so a track can add a
  // tighter bound without every other track's entry needing to grow one.
  if (budgetPath) {
    if (!existsSync(budgetPath)) {
      console.error(`Budget file not found: ${budgetPath}`);
      process.exit(1);
    }
    const budget = JSON.parse(readFileSync(resolve(budgetPath), "utf8"));
    const entry = budget[packageName];
    if (!entry) {
      console.log(`\nNo budget entry for "${packageName}" in ${budgetPath}; skipping the gate.`);
    } else {
      const breaches = budgetBreaches(result.counts, entry);
      if (breaches.length > 0) {
        console.error(`\nBudget exceeded for "${packageName}":`);
        for (const [metric, limit] of breaches) {
          console.error(`  ${metric}: ${result.counts[metric]} > ${limit}`);
        }
        process.exit(1);
      }
      console.log(`\nWithin budget for "${packageName}".`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
