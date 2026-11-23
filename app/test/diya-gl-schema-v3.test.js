// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-schema-v3.test.js — The engine reads the v3 schemas beside v2. A
// book is validated and written by the schema version its own
// diya-gl:formatVersion selects: "diya-gl/3" reads as v3, and every other
// marker, or none, reads as v2. A v2 example loads and saves as it did; a v3
// book carrying every field v3 adds validates, survives the canonical writer
// byte for byte, and loads through the diya-gl zip reader; the v2 schema an
// older engine holds refuses it.

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";
import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, dirname, join, relative } from "path";
import { fileURLToPath } from "url";
import { validateBook, validateLines } from "../lib/diya-gl-schema.js";
import { canonicalBookToml, canonicalLinesJsonl } from "../lib/diya-gl-canonical.js";
import { SCHEMA_RESOURCES, SCHEMA_VERSIONS, resourcePathWithinRoot, schemaVersionOf } from "../lib/app-resources.js";
import { parseDiyaGlData } from "../lib/diya-gl-loader.js";
import { readBookSource, writeBookJson } from "../lib/diya-gl-interchange.js";
import { PROVENANCE_DATA } from "../lib/provenance-data.js";
import { accountClasses } from "../lib/account-classes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const EXAMPLES_DIR = resolve(ROOT, "examples");
const SCHEMA_DIR = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public", "schema");
const FULL_DIR = join(EXAMPLES_DIR, "precision-code-ltd", "full");

function findBookDirs(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...findBookDirs(path));
    else if (entry === "book.toml") found.push(dir);
  }
  return found.sort();
}

function readLines(text) {
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

// The comment lines extract-scenarios.js writes above the canonical text.
function withoutCommentHeader(text) {
  const lines = text.split("\n");
  let first = 0;
  while (first < lines.length && lines[first].startsWith("#")) first += 1;
  return lines.slice(first).join("\n");
}

function readSchema(version, kind) {
  return JSON.parse(readFileSync(join(SCHEMA_DIR, resourcePathWithinRoot(SCHEMA_RESOURCES[version][kind])), "utf8"));
}

// The Precision Code Ltd full book restated as v3: its marker, each account's
// class and FRS 102 concept from the account class table, a Welsh label on
// one account, a VAT filing with its nine boxes, a bank statement balance,
// and on the lines an entry type, the GL posting status word and one
// reversing line.
function v3Book() {
  const book = parseTOML(readFileSync(join(FULL_DIR, "book.toml"), "utf8"));
  const lines = readLines(readFileSync(join(FULL_DIR, "lines.jsonl"), "utf8"));
  const classes = accountClasses("ltd");
  const accounts = {};
  for (const [section, entries] of Object.entries(book.accounts)) {
    accounts[section] = {};
    for (const [code, account] of Object.entries(entries)) {
      const entry = classes.get(code);
      accounts[section][code] = {
        ...account,
        "diya-gl:accountClass": entry.accountClass,
        ...(entry.frs102 ? { "diya-gl:summaryConcept": entry.frs102.concept } : {}),
      };
    }
  }
  const firstSales = Object.keys(accounts.sales)[0];
  accounts.sales[firstSales] = { ...accounts.sales[firstSales], "diya-gl:labels": { cy: "Gwerthiant" } };
  const firstBank = Object.keys(accounts.bank)[0];
  const v3 = {
    ...book,
    "documentInfo": { ...book.documentInfo, "diya-gl:formatVersion": "diya-gl/3" },
    accounts,
    "diya-gl:filings": [
      {
        kind: "vat",
        periodStart: "2025-04-01",
        periodEnd: "2025-06-30",
        filedDate: "2025-08-01",
        reference: "123456789012",
        figures: { box1: 2400, box2: 0, box3: 2400, box4: 310.5, box5: 2089.5, box6: 12000, box7: 1552.5, box8: 0, box9: 0 },
      },
    ],
    "diya-gl:statementBalances": { [firstBank]: [{ date: "2025-04-30", balance: 15234.12 }] },
  };
  const v3Lines = lines.map((line) => ({ ...line, entryType: "standard", postingStatus: "posted" }));
  v3Lines.push({
    ...v3Lines[0],
    "entryNumber": `${v3Lines[0].entryNumber}-R`,
    "entryType": "adjusting",
    "debitCreditCode": v3Lines[0].debitCreditCode === "D" ? "C" : "D",
    "diya-gl:reversesEntry": v3Lines[0].entryNumber,
  });
  return { book: v3, lines: v3Lines };
}

describe("the schema version a book reads against", () => {
  it.each([
    ["diya-gl/3", "v3"],
    ["diya-gl/2", "v2"],
    ["diya-gl/1", "v2"],
    ["diya-gl-books/1", "v2"],
    [undefined, "v2"],
  ])("a book marked %s reads against %s", (marker, version) => {
    const documentInfo = marker === undefined ? {} : { "diya-gl:formatVersion": marker };
    expect(schemaVersionOf({ documentInfo })).toBe(version);
  });

  it("a book with no documentInfo reads against v2", () => {
    expect(schemaVersionOf({})).toBe("v2");
    expect(schemaVersionOf(undefined)).toBe("v2");
  });

  it.each(SCHEMA_VERSIONS)("the %s schema pair carries its own $id", (version) => {
    expect(readSchema(version, "book").$id).toBe(`https://spreadsheets.diyaccounting.co.uk/schema/diya-gl-book-${version}.schema.json`);
    expect(readSchema(version, "lines").$id).toBe(`https://spreadsheets.diyaccounting.co.uk/schema/diya-gl-lines-${version}.schema.json`);
  });
});

const bookDirs = findBookDirs(EXAMPLES_DIR);

describe("each v2 example loads and saves as v2", () => {
  it.each(bookDirs.map((dir) => [relative(ROOT, dir), dir]))("%s", async (_name, dir) => {
    const bookText = readFileSync(join(dir, "book.toml"), "utf8");
    const linesText = readFileSync(join(dir, "lines.jsonl"), "utf8");
    const parsed = parseDiyaGlData(bookText, linesText);
    expect(schemaVersionOf(parsed.book)).toBe("v2");

    const zip = new JSZip();
    zip.file("book.toml", bookText);
    zip.file("lines.jsonl", linesText);
    const loaded = await readBookSource(await zip.generateAsync({ type: "uint8array" }), "example.zip");
    expect(loaded.book, "the reader leaves the book as parsed").toEqual(parsed.book);
    expect(loaded.lines, "the reader leaves the lines as parsed").toEqual(parsed.lines);

    const savedBook = canonicalBookToml(loaded.book);
    const savedLines = canonicalLinesJsonl(loaded.lines, loaded.book);
    // The master books at each example's root are kept by hand; the subsets
    // under them are written by the canonical writer, so they save back as
    // the very text they were read from.
    if (relative(EXAMPLES_DIR, dir).includes("/")) {
      expect(savedBook, "book.toml saves as the canonical text it was read from").toBe(withoutCommentHeader(bookText));
      expect(savedLines, "lines.jsonl saves as the canonical text it was read from").toBe(linesText);
    }
    const resaved = parseTOML(savedBook);
    expect(validateBook(resaved).errors).toEqual([]);
    expect(validateLines(readLines(savedLines), resaved).errors).toEqual([]);
  });
});

describe("a v3 book", () => {
  const { book, lines } = v3Book();

  it("validates against v3", () => {
    expect(validateBook(book).errors).toEqual([]);
    expect(validateLines(lines, book).errors).toEqual([]);
  });

  it("round-trips through the canonical writer byte for byte", () => {
    const bookText = canonicalBookToml(book);
    const linesText = canonicalLinesJsonl(lines, book);
    const reparsedBook = parseTOML(bookText);
    const reparsed = readLines(linesText);

    expect(canonicalBookToml(reparsedBook)).toBe(bookText);
    expect(canonicalLinesJsonl(reparsed, reparsedBook)).toBe(linesText);
    expect(validateBook(reparsedBook).errors).toEqual([]);
    expect(validateLines(reparsed, reparsedBook).errors).toEqual([]);
  });

  it("keeps every field v3 adds through the canonical writer", () => {
    const reparsedBook = parseTOML(canonicalBookToml(book));
    const reparsed = readLines(canonicalLinesJsonl(lines, book));
    const firstSales = Object.keys(book.accounts.sales)[0];
    const firstBank = Object.keys(book.accounts.bank)[0];

    expect(reparsedBook.documentInfo["diya-gl:formatVersion"]).toBe("diya-gl/3");
    expect(reparsedBook.accounts.sales[firstSales]["diya-gl:labels"]).toEqual({ cy: "Gwerthiant" });
    expect(reparsedBook.accounts.sales[firstSales]["diya-gl:accountClass"]).toBe("income");
    expect(reparsedBook.accounts.sales[firstSales]["diya-gl:summaryConcept"]).toBe(
      book.accounts.sales[firstSales]["diya-gl:summaryConcept"],
    );
    const [filing] = reparsedBook["diya-gl:filings"];
    expect(filing).toMatchObject({ kind: "vat", reference: "123456789012" });
    expect(filing.figures).toEqual(book["diya-gl:filings"][0].figures);
    const [statement] = reparsedBook["diya-gl:statementBalances"][firstBank];
    expect(statement.balance).toBe(15234.12);
    const reversing = reparsed.find((line) => line["diya-gl:reversesEntry"] !== undefined);
    expect(reversing).toMatchObject({ "entryType": "adjusting", "diya-gl:reversesEntry": lines[0].entryNumber });
    expect(reparsed.every((line) => line.postingStatus === "posted")).toBe(true);
  });

  it("loads through the diya-gl zip reader as v3", async () => {
    const zip = new JSZip();
    zip.file("book.toml", canonicalBookToml(book));
    zip.file("lines.jsonl", canonicalLinesJsonl(lines, book));
    const loaded = await readBookSource(await zip.generateAsync({ type: "uint8array" }), "v3.zip");
    expect(loaded.kind).toBe("diya-gl-zip");
    expect(schemaVersionOf(loaded.book)).toBe("v3");
    expect(loaded.book["diya-gl:filings"]).toHaveLength(1);
  });

  it("is refused by the v2 schema an older engine holds", () => {
    const asV2 = { ...book, documentInfo: { ...book.documentInfo, "diya-gl:formatVersion": "diya-gl/2" } };
    const bookErrors = validateBook(asV2).errors;
    expect(bookErrors).toContain("book/ must NOT have additional properties");
    expect(bookErrors.some((error) => error.startsWith("book/accounts/sales/"))).toBe(true);
    const lineErrors = validateLines(lines, asV2).errors;
    expect(lineErrors.some((error) => error.includes("must NOT have additional properties"))).toBe(true);
  });

  it("refuses v2's posting status words", () => {
    for (const status of ["draft", "voided"]) {
      const errors = validateLines([{ ...lines[0], postingStatus: status }], book).errors;
      expect(errors).toEqual([`line 1 (${lines[0].entryNumber}): /postingStatus must be equal to one of the allowed values`]);
    }
  });

  it("a v2 book still takes v2's posting status words", () => {
    const v2Book = parseTOML(readFileSync(join(FULL_DIR, "book.toml"), "utf8"));
    const v2Line = readLines(readFileSync(join(FULL_DIR, "lines.jsonl"), "utf8"))[0];
    expect(validateLines([{ ...v2Line, postingStatus: "draft" }], v2Book).errors).toEqual([]);
    expect(validateLines([{ ...v2Line, postingStatus: "proposed" }], v2Book).errors).toHaveLength(1);
  });

  // Each field v3 adds is checked: one corrupted value flips exactly the
  // error that names it, and nothing else.
  it.each([
    ["an account class v3 does not know", (b) => setFirstSales(b, "diya-gl:accountClass", "revenue"), "/accounts/sales/"],
    [
      "a summary concept that is not a concept local name",
      (b) => setFirstSales(b, "diya-gl:summaryConcept", "turnover revenue"),
      "/accounts/sales/",
    ],
    ["a label in a language v3 does not carry", (b) => setFirstSales(b, "diya-gl:labels", { fr: "Ventes" }), "/accounts/sales/"],
    ["a filing of a kind v3 does not know", (b) => setFiling(b, { kind: "paye" }), "/diya-gl:filings/0/kind"],
    ["a filing with no filed date", (b) => setFiling(b, { filedDate: undefined }), "/diya-gl:filings/0"],
    ["a filed figure that is not a number", (b) => setFiling(b, { figures: { box1: "2400" } }), "/diya-gl:filings/0/figures/box1"],
    [
      "a statement balance on a key that is not an account code",
      (b) => ({ ...b, "diya-gl:statementBalances": { BANK: [] } }),
      "/diya-gl:statementBalances",
    ],
    ["a statement balance with no balance", (b) => setStatement(b, { date: "2025-04-30" }), "/diya-gl:statementBalances/"],
  ])("flags %s", (_what, corrupt, errorPath) => {
    const corrupted = corrupt(structuredClone(book));
    const errors = validateBook(corrupted).errors;
    expect(errors.length).toBeGreaterThan(0);
    expect(
      errors.every((error) => error.startsWith(`book${errorPath}`)),
      errors.join("\n"),
    ).toBe(true);
  });

  it.each([
    ["an entry type v3 does not know", { entryType: "closing" }, "/entryType"],
    ["a reversed entry that is not text", { "diya-gl:reversesEntry": 7 }, "/diya-gl:reversesEntry"],
  ])("flags a line with %s", (_what, change, errorPath) => {
    const errors = validateLines([{ ...lines[0], ...change }], book).errors;
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(`): ${errorPath} `);
  });
});

// The JSON writer orders each line by the schema of the book it writes, the
// book as stamped. Every stamp says diya-gl/2 today, so this writes under a
// diya-gl/3 stamp to tell the v3 order (entryType straight after
// sourceJournalID) from the v2 order (an undeclared field kept at the end).
describe("the JSON writer orders lines by the book it writes", () => {
  it("writes a diya-gl/3 book's lines in the v3 field order", () => {
    const { book: v3, lines } = v3Book();
    // A diya-gl/3 book states the nominal value of every member's shares.
    const book = { ...v3, members: v3.members.map((member) => ({ ...member, nominalValue: 1 })) };
    const formatVersion = PROVENANCE_DATA.formatVersion;
    PROVENANCE_DATA.formatVersion = "diya-gl/3";
    let written;
    try {
      written = JSON.parse(writeBookJson(book, lines));
    } finally {
      PROVENANCE_DATA.formatVersion = formatVersion;
    }
    expect(written.book.documentInfo["diya-gl:formatVersion"]).toBe("diya-gl/3");
    const keys = Object.keys(written.lines[0]);
    expect(keys.indexOf("entryType")).toBe(keys.indexOf("sourceJournalID") + 1);
  });
});

function setFirstSales(book, field, value) {
  const code = Object.keys(book.accounts.sales)[0];
  book.accounts.sales[code][field] = value;
  return book;
}

function setFiling(book, change) {
  const filing = { ...book["diya-gl:filings"][0], ...change };
  for (const key of Object.keys(filing)) if (filing[key] === undefined) delete filing[key];
  book["diya-gl:filings"] = [filing];
  return book;
}

function setStatement(book, entry) {
  const code = Object.keys(book["diya-gl:statementBalances"])[0];
  book["diya-gl:statementBalances"][code] = [entry];
  return book;
}
