// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl-schema.test.js — Holds the published book and lines schemas to
// what the example books actually carry. Every book.toml and lines.jsonl
// under examples/ is validated against them, so a field or a code letter
// added to a fixture without being added to the schema fails here rather
// than being discovered by whoever downloads the schema and tries to
// validate their own book.

import { describe, it, expect } from "vitest";
import { parse as parseTOML } from "smol-toml";
import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, dirname, join, relative } from "path";
import { fileURLToPath } from "url";
import { validateBook, validateLines } from "../lib/diya-gl-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const EXAMPLES_DIR = resolve(ROOT, "examples");
const SCHEMA_DIR = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public", "schema");

function findBookDirs(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...findBookDirs(path));
    else if (entry === "book.toml") found.push(dir);
  }
  return found.sort();
}

function readBook(dir) {
  return parseTOML(readFileSync(join(dir, "book.toml"), "utf8"));
}

function readLines(dir) {
  return readFileSync(join(dir, "lines.jsonl"), "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

const bookDirs = findBookDirs(EXAMPLES_DIR);

describe("diya-gl schema", () => {
  it("finds the example books to validate", () => {
    expect(bookDirs.length).toBeGreaterThan(0);
    expect(bookDirs.map((dir) => relative(ROOT, dir))).toContain("examples/precision-code-ltd/full");
  });

  it.each(bookDirs.map((dir) => [relative(ROOT, dir), dir]))("validates %s", (_name, dir) => {
    const book = readBook(dir);
    const lines = readLines(dir);
    const bookResult = validateBook(book);
    const linesResult = validateLines(lines, book);
    expect([...bookResult.errors, ...linesResult.errors]).toEqual([]);
  });
});

describe("diya-gl schema, proved breakable", () => {
  const fullDir = join(EXAMPLES_DIR, "precision-code-ltd", "full");
  const book = readBook(fullDir);
  const lines = readLines(fullDir);

  it("rejects an extension field the schema does not declare", () => {
    const line = { ...lines[0], "diya-gl:notAField": "x" };
    const result = validateLines([line], book);
    expect(result.valid).toBe(false);
  });

  it("rejects a bank code outside the analysis columns", () => {
    const banked = lines.find((l) => l["diya-gl:bankCode"]);
    expect(validateLines([{ ...banked, "diya-gl:bankCode": "ZZ" }], book).valid).toBe(false);
    expect(validateLines([banked], book).valid).toBe(true);
  });

  it("declares every bank code the bank workbooks analyse", () => {
    const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, "diya-gl-lines-v2.schema.json"), "utf8"));
    const declared = new Set(schema.properties["diya-gl:bankCode"].enum);
    for (const code of ["BB", "BS", "BC", "BD", "DR", "CR", "K", "LDR", "LCR", "RV", "RC", "RT", "RP", "W", "B", "J", "DV", "DL", "X"]) {
      expect(declared, code).toContain(code);
    }
  });

  it("declares every field the example books carry", () => {
    const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, "diya-gl-lines-v2.schema.json"), "utf8"));
    const declared = new Set(Object.keys(schema.properties));
    const used = new Set();
    for (const dir of bookDirs) for (const line of readLines(dir)) for (const key of Object.keys(line)) used.add(key);
    expect([...used].filter((key) => !declared.has(key))).toEqual([]);
  });

  it("requires debitCreditCode on a journal line", () => {
    const journalLine = lines.find((l) => l.sourceJournalID === "journal");
    expect(journalLine.debitCreditCode).toBeDefined();
    const { debitCreditCode, ...withoutSign } = journalLine;
    expect(validateLines([withoutSign], book).valid).toBe(false);
  });

  it("rejects a line posting to an account the book does not declare", () => {
    const line = { ...lines[0], accountMainID: "9999" };
    const result = validateLines([line], book);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('accountMainID "9999" is not declared');
  });

  it("rejects a hire purchase line naming an agreement the book does not declare", () => {
    const hpLine = lines.find((l) => l["diya-gl:hpAgreement"]);
    expect(hpLine).toBeDefined();
    const bookWithHp = {
      ...book,
      hpAgreements: [
        {
          agreementID: hpLine["diya-gl:hpAgreement"],
          amountFinanced: 13000,
          adminCharges: 200,
          totalInterest: 1800,
          termMonths: 20,
          startDate: "2025-06-01",
        },
      ],
    };
    expect(validateLines([hpLine], bookWithHp).valid).toBe(true);
    const result = validateLines([{ ...hpLine, "diya-gl:hpAgreement": "HP-NOT-DECLARED" }], bookWithHp);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("does not match any hpAgreements[].agreementID");
  });

  it("rejects an asset purchase naming a fixed asset the book does not declare", () => {
    const line = { ...lines[0], "diya-gl:assetID": "ASSET-NOT-DECLARED" };
    const bookWithAssets = { ...book, fixedAssets: [{ assetID: "ASSET-0001", class: "computerTechnology", cost: 1000 }] };
    expect(validateLines([line], bookWithAssets).valid).toBe(false);
    const matching = { ...line, "diya-gl:assetID": "ASSET-0001" };
    expect(validateLines([matching], bookWithAssets).valid).toBe(true);
  });

  it("rejects a dividend payment naming a member the book does not declare", () => {
    const line = { ...lines[0], "diya-gl:memberID": "MEMBER-NOT-DECLARED" };
    const bookWithMembers = { ...book, members: [{ memberID: "MEM-0001", name: "Carol Smith", shares: 60 }] };
    expect(validateLines([line], bookWithMembers).valid).toBe(false);
    const matching = { ...line, "diya-gl:memberID": "MEM-0001" };
    expect(validateLines([matching], bookWithMembers).valid).toBe(true);
  });

  it("rejects a book carrying a table the schema does not declare", () => {
    const withStrayTable = { ...book, notATable: { anything: 1 } };
    expect(validateBook(withStrayTable).valid).toBe(false);
    expect(validateBook(book).valid).toBe(true);
  });
});
