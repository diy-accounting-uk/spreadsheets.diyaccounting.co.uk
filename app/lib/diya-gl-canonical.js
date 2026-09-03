// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl-canonical.js — The one form D (a diya-gl book.toml and lines.jsonl
// pair) is written in for comparison. Two independently produced books agree
// exactly on this text when their underlying facts agree, so a re-ordered
// array, a re-ordered field, or a floating point rounding difference never
// registers as a data difference. Field order, and which fields are money or
// a rate, come from the published v2 schemas, so this module and the schemas
// cannot drift apart.
//
// This is a comparison form, not the schema-conformant file the extractor or
// the exporter serve: money is written to exactly two decimal places (a rate
// to four) even where that means a trailing zero a plain number would drop.
// A JSON number token or a TOML float can both carry that text -- neither
// format has to become a string to hold it -- so canonicalLinesJsonl's
// output still parses back as the numeric type the schema declares.
//
// The two schemas load lazily, not at import, so this module can sit in the
// browser bundle: a caller with no file system (the books page) hands them
// in with useSchemas() or loadSchemasFrom() before the first write; the Node
// fallback reads them off disk on first use, exactly as diya-gl-schema.js
// does for validation.

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { BOOK_SCHEMA_RESOURCE, LINES_SCHEMA_RESOURCE, nodeResourceLoader } from "./app-resources.js";

let schemas = null;

/**
 * Supply the two v2 schemas rather than have them read from disk. A caller
 * with no file system (the books page) fetches them and calls this before
 * its first canonical write.
 * @param {Object} bookSchema - parsed diya-gl-book-v2.schema.json
 * @param {Object} linesSchema - parsed diya-gl-lines-v2.schema.json
 */
export function useSchemas(bookSchema, linesSchema) {
  schemas = { book: bookSchema, lines: linesSchema };
}

/**
 * Load and parse the two schemas through a resource loader, for a caller
 * that has one but would rather not read the files itself.
 * @param {{readText: (path: string) => Promise<string>}} [resources]
 */
export async function loadSchemasFrom(resources = nodeResourceLoader()) {
  const [book, lines] = await Promise.all([
    resources.readText(BOOK_SCHEMA_RESOURCE).then(JSON.parse),
    resources.readText(LINES_SCHEMA_RESOURCE).then(JSON.parse),
  ]);
  useSchemas(book, lines);
}

// Every canonical writer below reads field order and type off the schemas,
// so the Node fallback reads them synchronously on first use -- every caller
// in the pipeline treats canonicalLinesJsonl/canonicalBookToml as
// synchronous. A bundle whose caller forgot useSchemas()/loadSchemasFrom()
// reaches this only when it actually writes something, and fails loudly
// rather than writing nothing.
function compiled() {
  if (schemas) return schemas;
  try {
    const schemaDir = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "web",
      "spreadsheets.diyaccounting.co.uk",
      "public",
      "schema",
    );
    const read = (fileName) => JSON.parse(readFileSync(resolve(schemaDir, fileName), "utf8"));
    schemas = { book: read("diya-gl-book-v2.schema.json"), lines: read("diya-gl-lines-v2.schema.json") };
  } catch (cause) {
    throw new Error(
      "the diya-gl schemas could not be read; a caller with no file system has to call useSchemas() or loadSchemasFrom() first",
      {
        cause,
      },
    );
  }
  return schemas;
}

function resolveRef(rootSchema, node) {
  if (!node || !node.$ref) return node;
  const path = node.$ref.replace(/^#\//, "").split("/");
  let target = rootSchema;
  for (const segment of path) target = target[segment];
  return target;
}

// A field is a rate when the schema bounds it to the 0-1 fraction a
// percentage is stored as; every other number in these two schemas is money,
// at penny precision. Nothing here is a non-money, non-rate decimal.
function isRate(propSchema) {
  return propSchema?.type === "number" && propSchema.minimum === 0 && propSchema.maximum === 1;
}

function formatNumber(value, propSchema) {
  if (propSchema?.type === "integer") return String(value);
  return Number(value).toFixed(isRate(propSchema) ? 4 : 2);
}

// A date field is whichever the schema declares "format": "date", whether
// the value in hand is a TOML parser's Date instance or the plain ISO string
// a JSON round trip hands back -- neither carries a time component the
// canonical form should keep.
function isDateField(propSchema) {
  return propSchema?.format === "date";
}

function formatDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

// ============================================================================
// canonicalLinesJsonl
// ============================================================================

// The tuple a line sorts on: the year-end reports read a book by posting
// date, so that leads; the rest breaks a tie deterministically without
// carrying any meaning of its own.
const LINE_SORT_KEYS = ["postingDate", "sourceJournalID", "accountMainID", "entryNumber", "lineNumber", "documentReference", "amount"];

/**
 * The tuple order every canonical writer sorts diya-gl lines by, exported so
 * a caller building its own ordered form (writeBookJson) sorts the same way
 * rather than re-deriving the tuple.
 * @param {Object} a
 * @param {Object} b
 * @returns {number}
 */
export function compareLines(a, b) {
  for (const key of LINE_SORT_KEYS) {
    const left = a[key];
    const right = b[key];
    if (left === right) continue;
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    if (left < right) return -1;
    if (left > right) return 1;
  }
  return 0;
}

function jsonScalar(value, propSchema) {
  if (typeof value === "number") return formatNumber(value, propSchema);
  if (typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

// A line's fields in schema order, each rendered as a raw JSON token: a
// quoted, escaped string for text, or an unquoted numeral for a number
// (money and rates carry their canonical decimal places in the token
// itself, which JSON.stringify's own number formatting would not preserve).
function canonicalLineText(line, lineFieldOrder, linesSchema) {
  const parts = [];
  for (const field of lineFieldOrder) {
    if (!(field in line) || line[field] === undefined) continue;
    parts.push(`${JSON.stringify(field)}:${jsonScalar(line[field], linesSchema.properties[field])}`);
  }
  return `{${parts.join(",")}}`;
}

/**
 * Render a set of diya-gl lines in canonical form: sorted, one field order,
 * money and rates at a fixed decimal precision. Two multisets of lines that
 * agree on every fact produce byte-identical text.
 * @param {Array} lines - parsed lines.jsonl entries
 * @returns {string} the canonical lines.jsonl text, newline-terminated
 */
export function canonicalLinesJsonl(lines) {
  const { lines: linesSchema } = compiled();
  const lineFieldOrder = Object.keys(linesSchema.properties);
  const sorted = [...lines].sort(compareLines);
  return sorted.map((line) => canonicalLineText(line, lineFieldOrder, linesSchema)).join("\n") + "\n";
}

/**
 * One line's own fields reordered to the schema's declared order, values
 * untouched -- the shape writeBookJson (books-interchange.js) serialises a
 * line as. Any field the schema does not declare is kept, after the
 * declared ones, so an unrecognised key is lost to validation rather than
 * to this reordering.
 * @param {Object} line
 * @returns {Object}
 */
export function orderedLine(line) {
  const { lines: linesSchema } = compiled();
  const ordered = {};
  for (const field of Object.keys(linesSchema.properties)) {
    if (field in line && line[field] !== undefined) ordered[field] = line[field];
  }
  for (const field of Object.keys(line)) {
    if (!(field in ordered)) ordered[field] = line[field];
  }
  return ordered;
}

// ============================================================================
// canonicalBookToml
// ============================================================================

// The one property name that identifies an entry on each array-of-tables
// register. An array whose item schema declares none of these (directors,
// dividends, charges: none has an id an diya-gl line can name) keeps its
// original order, because there is nothing else to sort it by that would
// not be arbitrary.
const ARRAY_ID_FIELDS = ["employeeID", "assetID", "agreementID", "memberID"];

function idFieldOf(itemSchema) {
  const props = itemSchema?.properties || {};
  return ARRAY_ID_FIELDS.find((field) => field in props);
}

function sortById(items, itemSchema) {
  const idField = idFieldOf(itemSchema);
  if (!idField) return items;
  return [...items].sort((a, b) => String(a[idField]).localeCompare(String(b[idField])));
}

function tomlString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function tomlScalar(value, propSchema) {
  if (isDateField(propSchema) || value instanceof Date) return formatDate(value);
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") return formatNumber(value, propSchema);
  return tomlString(value);
}

// Every diya-gl: extension key holds a colon, which a bare TOML key cannot.
const BARE_TOML_KEY = /^[A-Za-z0-9_-]+$/;

function tomlKey(key) {
  return BARE_TOML_KEY.test(key) ? key : tomlString(key);
}

// The chart of accounts nests one level deeper than every other book table:
// section, then account code, then the accountDefinition fields. Nothing
// else in book.toml has this shape, so it is rendered on its own rather than
// forcing the generic table walker below to grow a third case for it.
function renderAccounts(bookSchema, accounts, lines) {
  const sectionSchema = bookSchema.properties.accounts.properties;
  for (const section of Object.keys(sectionSchema)) {
    if (!accounts[section]) continue;
    const accountDefSchema = resolveRef(bookSchema, sectionSchema[section].patternProperties["^[0-9]{4}$"]);
    for (const code of Object.keys(accounts[section]).sort()) {
      lines.push(`[accounts.${section}."${code}"]`);
      const account = accounts[section][code];
      for (const key of Object.keys(accountDefSchema.properties)) {
        if (account[key] === undefined) continue;
        lines.push(`${tomlKey(key)} = ${tomlScalar(account[key], accountDefSchema.properties[key])}`);
      }
      lines.push("");
    }
  }
}

// A plain object table (documentInfo, entityInformation, stock, tax's own
// sub-sections, openingBalances' assetClassAmounts): every property in
// schema order, scalars as `key = value`, a nested object recursed as
// `[header.key]`, and a patternProperties dict (only openingBalances.
// bankAccounts is one) as a table of bare account-code keys.
function renderObjectTable(bookSchema, header, value, objectSchema, lines) {
  const props = objectSchema?.properties || {};
  const scalarKeys = [];
  const nestedKeys = [];
  for (const key of Object.keys(props)) {
    if (value[key] === undefined) continue;
    const propSchema = resolveRef(bookSchema, props[key]);
    if (propSchema.type === "object") nestedKeys.push(key);
    else scalarKeys.push(key);
  }
  if (scalarKeys.length > 0) {
    lines.push(`[${header}]`);
    for (const key of scalarKeys) lines.push(`${tomlKey(key)} = ${tomlScalar(value[key], resolveRef(bookSchema, props[key]))}`);
    lines.push("");
  }
  for (const key of nestedKeys) {
    const propSchema = resolveRef(bookSchema, props[key]);
    if (propSchema.patternProperties) {
      lines.push(`[${header}.${key}]`);
      for (const code of Object.keys(value[key]).sort()) lines.push(`"${code}" = ${tomlScalar(value[key][code], null)}`);
      lines.push("");
    } else {
      renderObjectTable(bookSchema, `${header}.${key}`, value[key], propSchema, lines);
    }
  }
}

function renderArrayOfTables(key, items, itemSchema, lines) {
  for (const item of sortById(items, itemSchema)) {
    lines.push(`[[${key}]]`);
    for (const field of Object.keys(itemSchema.properties)) {
      if (item[field] === undefined) continue;
      lines.push(`${tomlKey(field)} = ${tomlScalar(item[field], itemSchema.properties[field])}`);
    }
    lines.push("");
  }
}

/**
 * Render a parsed book.toml in canonical form: tables and their keys in
 * schema order, every array-of-tables sorted by its id field, money and
 * rates at a fixed decimal precision, dates as YYYY-MM-DD. Two books that
 * agree on every fact produce byte-identical text.
 * @param {Object} book - parsed book.toml (dates as TOML Date instances or
 *   ISO strings -- either reads the same, since date fields are told apart
 *   by the schema's own "format": "date", not by the JS type in hand)
 * @returns {string} the canonical book.toml text
 */
export function canonicalBookToml(book) {
  const { book: bookSchema } = compiled();
  const lines = [];
  for (const key of Object.keys(bookSchema.properties)) {
    if (book[key] === undefined) continue;
    if (key === "accounts") {
      renderAccounts(bookSchema, book[key], lines);
      continue;
    }
    const propSchema = resolveRef(bookSchema, bookSchema.properties[key]);
    if (propSchema.type === "array") {
      renderArrayOfTables(key, book[key], resolveRef(bookSchema, propSchema.items), lines);
    } else {
      renderObjectTable(bookSchema, key, book[key], propSchema, lines);
    }
  }
  return lines.join("\n");
}

/**
 * The book's top-level tables reordered to the schema's declared order,
 * values untouched -- the shape writeBookJson (books-interchange.js)
 * serialises a book as. Any table the schema does not declare is kept,
 * after the declared ones.
 * @param {Object} book - parsed book.toml
 * @returns {Object}
 */
export function orderedBookTopLevel(book) {
  const { book: bookSchema } = compiled();
  const ordered = {};
  for (const key of Object.keys(bookSchema.properties)) {
    if (book[key] !== undefined) ordered[key] = book[key];
  }
  for (const key of Object.keys(book)) {
    if (!(key in ordered)) ordered[key] = book[key];
  }
  return ordered;
}
