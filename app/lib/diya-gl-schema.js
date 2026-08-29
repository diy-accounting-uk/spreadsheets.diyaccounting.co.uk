// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl-schema.js — The one validator for diya-gl book.toml and lines.jsonl
// data. Compiles the published JSON Schemas (v1 and v2, draft 2020-12) with
// ajv, and adds the two rules JSON Schema itself cannot state: that every
// accountMainID names an account the book declares, and that every
// diya-gl:hpAgreement, diya-gl:assetID and diya-gl:memberID names an entry
// on the matching book.toml register.

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = resolve(__dirname, "..", "..", "web", "spreadsheets.diyaccounting.co.uk", "public", "schema");

function loadSchema(fileName) {
  return JSON.parse(readFileSync(resolve(SCHEMA_DIR, fileName), "utf8"));
}

const bookSchemas = { v1: loadSchema("diya-gl-book-v1.schema.json"), v2: loadSchema("diya-gl-book-v2.schema.json") };
const linesSchemas = { v1: loadSchema("diya-gl-lines-v1.schema.json"), v2: loadSchema("diya-gl-lines-v2.schema.json") };

function makeAjv() {
  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);
  return ajv;
}

const ajv = makeAjv();
const compiledBook = { v1: ajv.compile(bookSchemas.v1), v2: ajv.compile(bookSchemas.v2) };
const compiledLine = { v1: ajv.compile(linesSchemas.v1), v2: ajv.compile(linesSchemas.v2) };

function assertVersion(version) {
  if (version !== "v1" && version !== "v2") throw new Error(`Unknown diya-gl schema version: "${version}". Use "v1" or "v2".`);
}

/**
 * The schema version a book declares. Absent means the book predates the
 * version field, which is what v1 books are: v1's additionalProperties
 * forbids the key, so no v1 book can carry it.
 */
export function bookSchemaVersion(book) {
  return book?.documentInfo?.["diya-gl:schemaVersion"] || "v1";
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
 * Validate a parsed book.toml against the published JSON Schema.
 * @param {Object} book - parsed book.toml (TOML dates as JS Date instances, as every TOML parser returns them)
 * @param {{version?: "v1"|"v2"}} [options] - defaults to the book's own diya-gl:schemaVersion, or v1 if absent
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateBook(book, { version = bookSchemaVersion(book) } = {}) {
  assertVersion(version);
  const validate = compiledBook[version];
  const valid = validate(withIsoDates(book));
  const errors = valid ? [] : validate.errors.map((e) => formatAjvError("book", e));
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
 * Validate a book's lines.jsonl entries against the published JSON Schema,
 * then against the book: every accountMainID has to name a declared
 * account, and every diya-gl:hpAgreement / diya-gl:assetID / diya-gl:memberID
 * has to name an entry on the book's own hpAgreements / fixedAssets /
 * members register. A register the book does not declare is not checked,
 * because a v1 book or a product subset with no such register carries no
 * lines that could name one either.
 * @param {Array} lines - parsed lines.jsonl entries
 * @param {Object} book - parsed book.toml, for the referential checks
 * @param {{version?: "v1"|"v2"}} [options] - defaults to the book's own diya-gl:schemaVersion, or v1 if absent
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateLines(lines, book, { version = bookSchemaVersion(book) } = {}) {
  assertVersion(version);
  const validate = compiledLine[version];
  const errors = [];

  const accountCodes = declaredAccountCodes(book);
  const hpAgreementIDs = book?.hpAgreements ? declaredIDs(book.hpAgreements, "agreementID") : null;
  const assetIDs = book?.fixedAssets ? declaredIDs(book.fixedAssets, "assetID") : null;
  const memberIDs = book?.members ? declaredIDs(book.members, "memberID") : null;

  lines.forEach((line, index) => {
    const label = `line ${index + 1} (${line.entryNumber || "no entryNumber"})`;
    if (!validate(line)) {
      for (const e of validate.errors) errors.push(formatAjvError(`${label}: `, e));
    }
    if (line.accountMainID !== undefined && !accountCodes.has(line.accountMainID)) {
      errors.push(`${label}: accountMainID "${line.accountMainID}" is not declared in book.toml accounts`);
    }
    if (hpAgreementIDs && line["diya-gl:hpAgreement"] !== undefined && !hpAgreementIDs.has(line["diya-gl:hpAgreement"])) {
      errors.push(`${label}: diya-gl:hpAgreement "${line["diya-gl:hpAgreement"]}" does not match any hpAgreements[].agreementID in book.toml`);
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
