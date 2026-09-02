// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl-schema.js — The one validator for diya-gl book.toml and lines.jsonl
// data. Compiles the published v2 JSON Schemas (draft 2020-12) with ajv, and
// adds the two rules JSON Schema itself cannot state: that every line's
// accountMainID names a declared account, and that every
// diya-gl:hpAgreement, diya-gl:assetID and diya-gl:memberID names an entry
// on the matching book.toml register.

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { BOOK_SCHEMA_RESOURCE, LINES_SCHEMA_RESOURCE, nodeResourceLoader } from "./app-resources.js";

// The two published schemas compile once, on the first validation rather than
// on import. A caller that cannot read files — the books page — hands them in
// with useSchemas() before validating anything; in Node they come off disk.
let validators = null;

function compileSchemas(bookSchema, linesSchema) {
  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);
  return { book: ajv.compile(bookSchema), lines: ajv.compile(linesSchema) };
}

/**
 * Supply the two v2 schemas rather than have them read from disk. The books
 * page fetches them and calls this before its first validation.
 * @param {Object} bookSchema - parsed diya-gl-book-v2.schema.json
 * @param {Object} linesSchema - parsed diya-gl-lines-v2.schema.json
 */
export function useSchemas(bookSchema, linesSchema) {
  validators = compileSchemas(bookSchema, linesSchema);
}

/**
 * Load and compile the two schemas through a resource loader, for a caller
 * that has one but would rather not parse the JSON itself.
 * @param {{readText: (path: string) => Promise<string>}} [resources]
 */
export async function loadSchemasFrom(resources = nodeResourceLoader()) {
  const [book, lines] = await Promise.all([
    resources.readText(BOOK_SCHEMA_RESOURCE).then(JSON.parse),
    resources.readText(LINES_SCHEMA_RESOURCE).then(JSON.parse),
  ]);
  useSchemas(book, lines);
}

// Validation is synchronous, and every caller in the pipeline relies on that,
// so the Node fallback reads the two files synchronously. A bundle with no
// file system reaches this only when the page forgot to call useSchemas(), and
// then it fails loudly rather than validating nothing.
function compiled() {
  if (validators) return validators;
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
  validators = compileSchemas(read("diya-gl-book-v2.schema.json"), read("diya-gl-lines-v2.schema.json"));
  return validators;
}

function formatAjvError(prefix, error) {
  return `${prefix}${error.instancePath || "/"} ${error.message}`;
}

// TOML dates parse to JS Date instances (smol-toml, and every other TOML
// parser this book format has used), never to strings. The schema declares
// them as ISO 8601 strings, matching lines.jsonl and the schema's own JSON
// Schema "date" format, so a book fresh off the parser is walked once to
// turn every Date into the string the schema expects before it is checked.
function withIsoDates(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(withIsoDates);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, v] of Object.entries(value)) out[key] = withIsoDates(v);
    return out;
  }
  return value;
}

/**
 * Validate a parsed book.toml against the published diya-gl-book-v2 schema.
 * @param {Object} book - parsed book.toml (TOML dates as JS Date instances, as every TOML parser returns them)
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateBook(book) {
  const validateBookSchema = compiled().book;
  const valid = validateBookSchema(withIsoDates(book));
  const errors = valid ? [] : validateBookSchema.errors.map((e) => formatAjvError("book", e));
  return { valid, errors };
}

// Every section of the chart of accounts a line's accountMainID can name.
const ACCOUNT_SECTIONS = ["sales", "purchases", "bank", "capital", "assets", "liabilities"];

function declaredAccountCodes(book) {
  const codes = new Set();
  for (const section of ACCOUNT_SECTIONS) {
    for (const code of Object.keys(book?.accounts?.[section] || {})) codes.add(code);
  }
  return codes;
}

function declaredIDs(entries, idField) {
  return new Set((entries || []).map((entry) => entry[idField]).filter((id) => id !== undefined));
}

/**
 * Validate a book's lines.jsonl entries against the published
 * diya-gl-lines-v2 schema, then against the book: every accountMainID has
 * to name a declared account, and every diya-gl:hpAgreement /
 * diya-gl:assetID / diya-gl:memberID has to name an entry on the book's own
 * hpAgreements / fixedAssets / members register. A register the book does
 * not declare is not checked, because a product subset with no such
 * register carries no lines that could name one either.
 * @param {Array} lines - parsed lines.jsonl entries
 * @param {Object} book - parsed book.toml, for the referential checks
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateLines(lines, book) {
  const validateLineSchema = compiled().lines;
  const errors = [];

  const accountCodes = declaredAccountCodes(book);
  const hpAgreementIDs = book?.hpAgreements ? declaredIDs(book.hpAgreements, "agreementID") : null;
  const assetIDs = book?.fixedAssets ? declaredIDs(book.fixedAssets, "assetID") : null;
  const memberIDs = book?.members ? declaredIDs(book.members, "memberID") : null;

  lines.forEach((line, index) => {
    const label = `line ${index + 1} (${line.entryNumber || "no entryNumber"})`;
    if (!validateLineSchema(line)) {
      for (const e of validateLineSchema.errors) errors.push(formatAjvError(`${label}: `, e));
    }
    if (line.accountMainID !== undefined && !accountCodes.has(line.accountMainID)) {
      errors.push(`${label}: accountMainID "${line.accountMainID}" is not declared in book.toml accounts`);
    }
    if (hpAgreementIDs && line["diya-gl:hpAgreement"] !== undefined && !hpAgreementIDs.has(line["diya-gl:hpAgreement"])) {
      errors.push(
        `${label}: diya-gl:hpAgreement "${line["diya-gl:hpAgreement"]}" does not match any hpAgreements[].agreementID in book.toml`,
      );
    }
    if (assetIDs && line["diya-gl:assetID"] !== undefined && !assetIDs.has(line["diya-gl:assetID"])) {
      errors.push(`${label}: diya-gl:assetID "${line["diya-gl:assetID"]}" does not match any fixedAssets[].assetID in book.toml`);
    }
    if (memberIDs && line["diya-gl:memberID"] !== undefined && !memberIDs.has(line["diya-gl:memberID"])) {
      errors.push(`${label}: diya-gl:memberID "${line["diya-gl:memberID"]}" does not match any members[].memberID in book.toml`);
    }
  });

  return { valid: errors.length === 0, errors };
}
