// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-edits-opening-lines.test.js — the named edits keep the opening
// lines a roll forward writes where the engine reads them: an opening
// balance stays on the first day of the year, an opening journal line keeps
// its OB- reference, and one leg of the opening journal does not change or go
// alone. Ordinary lines still move.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { loadDiyaGlData, diyaGlToScenario, extractTaxDataFromBook } from "../lib/diya-gl-loader.js";
import { rollForward } from "../lib/diya-gl-roll-forward.js";
import { calculateLtdTrialBalance } from "../lib/calculators/ltd.js";
import { changeLineAmount, changeLinePostingDate, removeLine, setLineReference } from "../lib/diya-gl-edits.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const prior = loadDiyaGlData(resolve(ROOT, "examples", "brickwork-pro"));
const rateData = parseTOML(readFileSync(resolve(ROOT, "app", "data", "ltd-2026.toml"), "utf8"));
const { book, lines } = rollForward(prior.book, prior.lines, rateData);
const before = structuredClone(lines);

const OPENING_BANK = lines.find((line) => line.sourceJournalID === "bank" && line["diya-gl:bankCode"] === "BC");
const OPENING_JOURNAL = lines.find((line) => line.sourceJournalID === "journal" && line.documentReference.startsWith("OB-"));
const SECOND_DAY = "2026-04-02";

function auditCheck(bookLines) {
  const { trialBalance } = calculateLtdTrialBalance(
    book,
    bookLines,
    extractTaxDataFromBook(book, "ltd"),
    diyaGlToScenario(book, bookLines, "ltd"),
  );
  return Math.round(trialBalance.EJ91 * 100);
}

describe("edits on the opening lines a roll forward writes", () => {
  it("finds the roll forward's opening bank line and opening journal on the first day of the year", () => {
    expect(OPENING_BANK.postingDate).toBe("2026-04-01");
    expect(OPENING_JOURNAL.postingDate).toBe("2026-04-01");
    expect(auditCheck(lines)).toBe(0);
  });

  it("refuses to move the opening bank line off the first day, naming the line", () => {
    expect(() => changeLinePostingDate(book, lines, { entryNumber: OPENING_BANK.entryNumber, newPostingDate: SECOND_DAY })).toThrow(
      `changeLinePostingDate refuses ${OPENING_BANK.entryNumber}: it is an opening bank balance line, and an opening balance stays on the first day of the year`,
    );
  });

  it("refuses to move an opening journal line off the first day, naming the line", () => {
    expect(() => changeLinePostingDate(book, lines, { entryNumber: OPENING_JOURNAL.entryNumber, newPostingDate: SECOND_DAY })).toThrow(
      `changeLinePostingDate refuses ${OPENING_JOURNAL.entryNumber}: it is an opening journal line, and an opening balance stays on the first day of the year`,
    );
  });

  it("refuses to change the amount of, remove, or re-reference one opening journal line", () => {
    const entryNumber = OPENING_JOURNAL.entryNumber;
    expect(() => changeLineAmount(book, lines, { entryNumber, newAmount: OPENING_JOURNAL.amount + 1 })).toThrow(
      `changeLineAmount refuses ${entryNumber}: it is an opening journal line, and one leg of the opening balances cannot change alone`,
    );
    expect(() => removeLine(book, lines, { entryNumber })).toThrow(
      `removeLine refuses ${entryNumber}: it is an opening journal line, and one leg of the opening balances cannot go alone`,
    );
    expect(() => setLineReference(book, lines, { entryNumber, documentReference: "JNL-9" })).toThrow(
      `setLineReference refuses ${entryNumber}: it is an opening journal line, and its OB- reference is what makes it part of the opening balances`,
    );
  });

  it("leaves the book the engine wrote unchanged when it refuses", () => {
    for (const attempt of [
      () => changeLinePostingDate(book, lines, { entryNumber: OPENING_BANK.entryNumber, newPostingDate: SECOND_DAY }),
      () => removeLine(book, lines, { entryNumber: OPENING_JOURNAL.entryNumber }),
    ]) {
      expect(attempt).toThrow();
    }
    expect(lines).toEqual(before);
    expect(auditCheck(lines)).toBe(0);
  });

  it("still moves an ordinary bank line and still changes the opening bank line's amount", () => {
    const ordinary = prior.lines.find((line) => line.sourceJournalID === "bank" && line["diya-gl:bankCode"] === "CR");
    const moved = changeLinePostingDate(prior.book, prior.lines, { entryNumber: ordinary.entryNumber, newPostingDate: "2025-06-02" });
    expect(moved.find((line) => line.entryNumber === ordinary.entryNumber).postingDate).toBe("2025-06-02");
    const changed = changeLineAmount(book, lines, { entryNumber: OPENING_BANK.entryNumber, newAmount: OPENING_BANK.amount + 1 });
    expect(changed.find((line) => line.entryNumber === OPENING_BANK.entryNumber).amount).toBe(OPENING_BANK.amount + 1);
    expect(auditCheck(changed)).toBe(0);
  });

  it("refuses to give one in-year journal line an OB- reference", () => {
    const inYear = { ...OPENING_JOURNAL, entryNumber: "JNL-LINE-1", documentReference: "JNL-001", postingDate: "2026-09-30" };
    expect(() => setLineReference(book, [...lines, inYear], { entryNumber: "JNL-LINE-1", documentReference: "OB-002" })).toThrow(
      "setLineReference refuses JNL-LINE-1: an OB- reference would make one leg of an in-year journal an opening balance",
    );
  });
});
