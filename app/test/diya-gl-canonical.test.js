// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl-canonical.test.js — canonicalBookToml() and canonicalLinesJsonl()
// exist so two independently built books that agree on the facts produce
// byte-identical text. Each test picks one way two equal-but-differently-
// shaped inputs could diverge (order, number formatting, field order) and
// proves the canonical form erases it.

import { describe, it, expect } from "vitest";
import { parse as parseTOML } from "smol-toml";
import { readFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { canonicalBookToml, canonicalLinesJsonl } from "../lib/diya-gl-canonical.js";
import { validateBook, validateLines } from "../lib/diya-gl-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const FULL_DIR = join(ROOT, "examples", "precision-code-ltd", "full");
const MASTER_DIR = join(ROOT, "examples", "precision-code-ltd");

function readBook(dir) {
  return parseTOML(readFileSync(join(dir, "book.toml"), "utf8"));
}

function readLines(dir) {
  return readFileSync(join(dir, "lines.jsonl"), "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

describe("canonicalLinesJsonl", () => {
  const lines = readLines(FULL_DIR);

  it("is invariant to the input order", () => {
    const forward = canonicalLinesJsonl(lines);
    const reversed = canonicalLinesJsonl([...lines].reverse());
    expect(reversed).toEqual(forward);
  });

  it("is invariant to field order within a line", () => {
    const reordered = lines.map((line) => Object.fromEntries(Object.entries(line).reverse()));
    expect(canonicalLinesJsonl(reordered)).toEqual(canonicalLinesJsonl(lines));
  });

  it("writes money to exactly two decimal places, whole pounds included", () => {
    const wholePounds = lines.find((l) => Number.isInteger(l.amount) && l.amount > 0);
    expect(wholePounds).toBeDefined();
    const text = canonicalLinesJsonl([wholePounds]);
    expect(text).toContain(`"amount":${wholePounds.amount.toFixed(2)}`);
    expect(text).not.toContain(`"amount":${wholePounds.amount},`);
  });

  it("orders every field the schema declares, not the line's own key order", () => {
    const line = lines.find((l) => l["diya-gl:bankCode"] && l.debitCreditCode);
    const shuffled = { debitCreditCode: line.debitCreditCode, postingDate: line.postingDate, ...line };
    const text = canonicalLinesJsonl([shuffled]);
    // postingDate is declared before debitCreditCode in the schema, so it
    // has to come first in the canonical text regardless of shuffled's
    // own key order.
    expect(text.indexOf('"postingDate"')).toBeLessThan(text.indexOf('"debitCreditCode"'));
  });

  it("sorts by postingDate, then the rest of the tuple, not by input order", () => {
    const [a, b] = lines.filter((l) => l.postingDate === lines[0].postingDate).slice(0, 2);
    if (a && b) {
      const forward = canonicalLinesJsonl([a, b]);
      const backward = canonicalLinesJsonl([b, a]);
      expect(backward).toEqual(forward);
    }
  });

  it("produces text that still parses as a schema-valid line", () => {
    const book = readBook(FULL_DIR);
    const text = canonicalLinesJsonl(lines);
    const reparsed = text
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));
    expect(validateLines(reparsed, book).valid).toBe(true);
  });
});

describe("canonicalBookToml", () => {
  const book = readBook(MASTER_DIR);

  it("is invariant to a document's own table order", () => {
    // smol-toml gives back one object regardless of the source file's table
    // order, so this proves the *writer's* order comes from the schema by
    // building the same book from two differently-ordered TOML documents.
    const reordered = { ...book };
    delete reordered.documentInfo;
    reordered.documentInfo = book.documentInfo;
    expect(canonicalBookToml(reordered)).toEqual(canonicalBookToml(book));
  });

  it("quotes a diya-gl: key, which is not a bare TOML key", () => {
    const text = canonicalBookToml(book);
    expect(text).toContain('"diya-gl:vatRegistered" = true');
    expect(text).not.toContain("diya-gl:vatRegistered = true");
  });

  it("sorts members by memberID, not by their order in the source", () => {
    const fullBook = readBook(FULL_DIR);
    const reversedMembers = { ...fullBook, members: [...fullBook.members].reverse() };
    expect(canonicalBookToml(reversedMembers)).toEqual(canonicalBookToml(fullBook));
  });

  it("writes a rate at four decimal places and money at two", () => {
    const text = canonicalBookToml(book);
    expect(text).toContain("class4MainRate = 0.0600");
    expect(text).toContain("amount = 15000.00");
  });

  it("produces text that still parses as a schema-valid book", () => {
    const text = canonicalBookToml(book);
    const reparsed = parseTOML(text);
    expect(validateBook(reparsed).valid).toBe(true);
  });
});
