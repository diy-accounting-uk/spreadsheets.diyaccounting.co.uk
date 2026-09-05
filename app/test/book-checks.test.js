// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// book-checks.test.js — the book checks and warnings over the three
// example books, plus a controlled fixture that proves every one of the
// eight rules breakable by exactly one crafted change.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { loadDiyaGlData } from "../lib/diya-gl-loader.js";
import { runBookChecks, bookChecksJson, previewHelper, applyHelper } from "../lib/book-checks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const DATA_DIR = resolve(REPO_ROOT, "app", "data");

const TAX_DATA = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));

function resultFor(results, id) {
  return results.find((r) => r.id === id);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const CHECK_IDS = ["book-dates-in-period", "book-accounts-in-chart", "book-amounts-whole-pence"];
const WARNING_IDS = ["book-vat-threshold", "book-duplicate-entries", "book-empty-detail", "book-negative-amount", "book-empty-month"];
const ALL_IDS = CHECK_IDS.concat(WARNING_IDS);

// ============================== the three example books ==============================
// Real fixtures, discovered from their own data rather than assumed clean.

describe("the three example books", () => {
  it("Precision Code Trading: the three checks pass, and turnover has passed the VAT threshold", () => {
    const { book, lines } = loadDiyaGlData(resolve(REPO_ROOT, "examples", "precision-code-ltd", "bst"));
    const { results, summary } = runBookChecks({ book, lines, taxData: TAX_DATA });

    for (const id of CHECK_IDS) expect(resultFor(results, id).result, id).toBe("pass");

    const vat = resultFor(results, "book-vat-threshold");
    expect(vat.result).toBe("warn");
    expect(vat.actual).toBeCloseTo(409900, 2);

    for (const id of ["book-duplicate-entries", "book-empty-detail", "book-negative-amount", "book-empty-month"]) {
      expect(resultFor(results, id).result, id).toBe("pass");
    }
    expect(summary).toEqual({ pass: 7, warn: 1, fail: 0 });
  });

  it("SP Sixty Driving: every entry sits inside the declared period, and every check and warning pass", () => {
    const { book, lines } = loadDiyaGlData(resolve(REPO_ROOT, "examples", "sp-sixty-driving", "bst"));
    const { results, summary } = runBookChecks({ book, lines, taxData: TAX_DATA });

    const datesCheck = resultFor(results, "book-dates-in-period");
    expect(datesCheck.result).toBe("pass");
    expect(datesCheck.actual).toBe(0);
    expect(datesCheck.offenders).toHaveLength(0);

    expect(resultFor(results, "book-accounts-in-chart").result).toBe("pass");
    expect(resultFor(results, "book-amounts-whole-pence").result).toBe("pass");
    for (const id of WARNING_IDS) expect(resultFor(results, id).result, id).toBe("pass");

    expect(summary).toEqual({ pass: 8, warn: 0, fail: 0 });
  });

  it("Kestrel Executive Cars: every entry sits inside the declared period", () => {
    const { book, lines } = loadDiyaGlData(resolve(REPO_ROOT, "examples", "kestrel-executive-cars", "taxi"));
    const { results } = runBookChecks({ book, lines, taxData: TAX_DATA });

    expect(resultFor(results, "book-dates-in-period").result).toBe("pass");
  });

  it("BrickWork Pro (non-VAT): every check and every warning pass", () => {
    const { book, lines } = loadDiyaGlData(resolve(REPO_ROOT, "examples", "brickwork-pro", "bst-nonvat"));
    const { results, summary } = runBookChecks({ book, lines, taxData: TAX_DATA });

    for (const id of ALL_IDS) expect(resultFor(results, id).result, id).toBe("pass");
    expect(summary).toEqual({ pass: 8, warn: 0, fail: 0 });
  });
});

// ============================== a controlled, breakable fixture ==============================
// A small synthetic book, one line per month across the year so every
// warning and every check starts clean, then one crafted change per rule.

const BASE_BOOK = {
  documentInfo: { periodCoveredStart: "2025-04-01", periodCoveredEnd: "2026-03-31" },
  accounts: {
    sales: { 4000: { accountMainDescription: "Sales" } },
    purchases: { 5000: { accountMainDescription: "Stock" }, 5501: { accountMainDescription: "General admin" } },
  },
};

const BASE_LINES = [
  {
    entryNumber: "BASE-01",
    sourceJournalID: "sales",
    postingDate: "2025-04-05",
    accountMainID: "4000",
    amount: 1000.0,
    detailComment: "Acme Ltd invoice 1",
  },
  {
    entryNumber: "BASE-02",
    sourceJournalID: "purchases",
    postingDate: "2025-05-05",
    accountMainID: "5000",
    amount: 100.0,
    detailComment: "Supplier A",
  },
  {
    entryNumber: "BASE-03",
    sourceJournalID: "purchases",
    postingDate: "2025-06-05",
    accountMainID: "5501",
    amount: 20.0,
    detailComment: "Office costs June",
  },
  {
    entryNumber: "BASE-04",
    sourceJournalID: "purchases",
    postingDate: "2025-07-05",
    accountMainID: "5000",
    amount: 150.0,
    detailComment: "Supplier B",
  },
  {
    entryNumber: "BASE-05",
    sourceJournalID: "purchases",
    postingDate: "2025-08-05",
    accountMainID: "5501",
    amount: 25.0,
    detailComment: "Office costs Aug",
  },
  {
    entryNumber: "BASE-06",
    sourceJournalID: "purchases",
    postingDate: "2025-09-05",
    accountMainID: "5000",
    amount: 175.0,
    detailComment: "Supplier C",
  },
  {
    entryNumber: "BASE-07",
    sourceJournalID: "sales",
    postingDate: "2025-10-05",
    accountMainID: "4000",
    amount: 2000.0,
    detailComment: "Acme Ltd invoice 2",
  },
  {
    entryNumber: "BASE-08",
    sourceJournalID: "purchases",
    postingDate: "2025-11-05",
    accountMainID: "5501",
    amount: 30.0,
    detailComment: "Office costs Nov",
  },
  {
    entryNumber: "BASE-09",
    sourceJournalID: "purchases",
    postingDate: "2025-12-05",
    accountMainID: "5000",
    amount: 200.0,
    detailComment: "Supplier D",
  },
  {
    entryNumber: "BASE-10",
    sourceJournalID: "purchases",
    postingDate: "2026-01-05",
    accountMainID: "5501",
    amount: 35.0,
    detailComment: "Office costs Jan",
  },
  {
    entryNumber: "BASE-11",
    sourceJournalID: "purchases",
    postingDate: "2026-02-05",
    accountMainID: "5000",
    amount: 225.0,
    detailComment: "Supplier E",
  },
  {
    entryNumber: "BASE-12",
    sourceJournalID: "purchases",
    postingDate: "2026-03-05",
    accountMainID: "5501",
    amount: 40.0,
    detailComment: "Office costs Mar",
  },
];

// A threshold well above the fixture's £3,000 turnover, so the baseline
// starts clean on the VAT warning too.
const BASE_TAX_DATA = { vat: { registration_threshold: 90000 } };

function baseline() {
  return { book: clone(BASE_BOOK), lines: clone(BASE_LINES), taxData: clone(BASE_TAX_DATA) };
}

describe("the controlled fixture starts clean", () => {
  it("passes all eight rules", () => {
    const { book, lines, taxData } = baseline();
    const { results, summary } = runBookChecks({ book, lines, taxData });
    for (const id of ALL_IDS) expect(resultFor(results, id).result, id).toBe("pass");
    expect(summary).toEqual({ pass: 8, warn: 0, fail: 0 });
  });
});

// Runs the baseline and a mutated variant, and asserts that only `targetId`
// changed result -- every other rule keeps the same result it had on the
// clean baseline.
function assertOnlyThisRuleFlips(mutated, targetId, expectedResult) {
  const before = runBookChecks(baseline()).results;
  const after = runBookChecks(mutated).results;

  expect(resultFor(after, targetId).result).toBe(expectedResult);
  for (const id of ALL_IDS) {
    if (id === targetId) continue;
    expect(resultFor(after, id).result, id).toBe(resultFor(before, id).result);
  }
}

describe("each rule is breakable by one crafted change, and only that rule flips", () => {
  it("book-dates-in-period: a purchase dated after the period end", () => {
    const fixture = baseline();
    fixture.lines.push({
      entryNumber: "BREAK-DATE",
      sourceJournalID: "purchases",
      postingDate: "2026-04-15",
      accountMainID: "5000",
      amount: 60.0,
      detailComment: "Late invoice",
    });
    assertOnlyThisRuleFlips(fixture, "book-dates-in-period", "fail");
  });

  it("book-accounts-in-chart: a purchase posted to an account the chart never declares", () => {
    const fixture = baseline();
    fixture.lines.push({
      entryNumber: "BREAK-ACCOUNT",
      sourceJournalID: "purchases",
      postingDate: "2025-05-20",
      accountMainID: "9999",
      amount: 15.0,
      detailComment: "Unposted item",
    });
    assertOnlyThisRuleFlips(fixture, "book-accounts-in-chart", "fail");
  });

  it("book-amounts-whole-pence: a purchase amount finer than a penny", () => {
    const fixture = baseline();
    fixture.lines.push({
      entryNumber: "BREAK-PENCE",
      sourceJournalID: "purchases",
      postingDate: "2025-05-21",
      accountMainID: "5000",
      amount: 12.345,
      detailComment: "Sub-penny item",
    });
    assertOnlyThisRuleFlips(fixture, "book-amounts-whole-pence", "fail");
  });

  it("book-vat-threshold: a registration threshold below the fixture's own turnover", () => {
    const fixture = baseline();
    fixture.taxData.vat.registration_threshold = 2500;
    assertOnlyThisRuleFlips(fixture, "book-vat-threshold", "warn");
  });

  it("book-duplicate-entries: a second line matching an existing one's journal, date, amount and detail", () => {
    const fixture = baseline();
    fixture.lines.push({
      entryNumber: "BREAK-DUPLICATE",
      sourceJournalID: "purchases",
      postingDate: "2025-05-05",
      accountMainID: "5000",
      amount: 100.0,
      detailComment: "Supplier A",
    });
    assertOnlyThisRuleFlips(fixture, "book-duplicate-entries", "warn");
  });

  it("book-empty-detail: a purchase with a blank detail", () => {
    const fixture = baseline();
    fixture.lines.push({
      entryNumber: "BREAK-DETAIL",
      sourceJournalID: "purchases",
      postingDate: "2025-05-22",
      accountMainID: "5000",
      amount: 45.0,
      detailComment: "   ",
    });
    assertOnlyThisRuleFlips(fixture, "book-empty-detail", "warn");
  });

  it("book-negative-amount: a purchase with an amount below zero", () => {
    const fixture = baseline();
    fixture.lines.push({
      entryNumber: "BREAK-NEGATIVE",
      sourceJournalID: "purchases",
      postingDate: "2025-05-23",
      accountMainID: "5000",
      amount: -75.0,
      detailComment: "Refund from supplier",
    });
    assertOnlyThisRuleFlips(fixture, "book-negative-amount", "warn");
  });

  it("book-empty-month: moving the only entry in a month elsewhere leaves that month empty", () => {
    const fixture = baseline();
    const july = fixture.lines.find((l) => l.entryNumber === "BASE-04");
    july.postingDate = "2025-04-20";
    assertOnlyThisRuleFlips(fixture, "book-empty-month", "warn");

    const { results } = runBookChecks(fixture);
    const emptyMonth = resultFor(results, "book-empty-month");
    expect(emptyMonth.actual).toBe(1);
    expect(emptyMonth.offenders).toEqual([{ month: "2025-07" }]);
  });
});

// ============================== helpers ==============================

describe("the fix-it helpers", () => {
  it("book-dates-in-period: preview text matches the page's own wording, and applying it moves the entry inside the period", () => {
    const fixture = baseline();
    fixture.lines.push({
      entryNumber: "BREAK-DATE",
      sourceJournalID: "purchases",
      postingDate: "2026-04-15",
      accountMainID: "5000",
      amount: 60.0,
      detailComment: "Late invoice",
    });

    const preview = previewHelper(fixture, "book-dates-in-period");
    expect(preview.title).toBe("Move these entries into the period");
    expect(preview.summary).toBe("This will change 1 line. Nothing else in the book moves.");
    expect(preview.changes).toEqual([{ entryNumber: "BREAK-DATE", was: "2026-04-15", becomes: "2026-03-31", amount: 60.0, what: "date" }]);

    const applied = applyHelper(fixture, "book-dates-in-period");
    const fixedLine = applied.find((l) => l.entryNumber === "BREAK-DATE");
    expect(fixedLine.postingDate).toBe("2026-03-31");
    expect(
      resultFor(runBookChecks({ book: fixture.book, lines: applied, taxData: fixture.taxData }).results, "book-dates-in-period").result,
    ).toBe("pass");
  });

  it("book-accounts-in-chart: preview text matches the page's own wording, and applying it reposts the entry", () => {
    const fixture = baseline();
    fixture.lines.push({
      entryNumber: "BREAK-ACCOUNT",
      sourceJournalID: "purchases",
      postingDate: "2025-05-20",
      accountMainID: "9999",
      amount: 15.0,
      detailComment: "Unposted item",
    });

    const preview = previewHelper(fixture, "book-accounts-in-chart");
    expect(preview.title).toBe("Repost these entries to the chart");
    expect(preview.summary).toBe("This will change 1 line. Nothing else in the book moves.");
    expect(preview.changes).toEqual([
      { entryNumber: "BREAK-ACCOUNT", was: "9999", becomes: "5000 — Stock", amount: 15.0, what: "account" },
    ]);

    const applied = applyHelper(fixture, "book-accounts-in-chart");
    const fixedLine = applied.find((l) => l.entryNumber === "BREAK-ACCOUNT");
    expect(fixedLine.accountMainID).toBe("5000");
  });

  it("book-amounts-whole-pence: preview text matches the page's own wording, and applying it rounds the amount", () => {
    const fixture = baseline();
    fixture.lines.push({
      entryNumber: "BREAK-PENCE",
      sourceJournalID: "purchases",
      postingDate: "2025-05-21",
      accountMainID: "5000",
      amount: 12.345,
      detailComment: "Sub-penny item",
    });

    const preview = previewHelper(fixture, "book-amounts-whole-pence");
    expect(preview.title).toBe("Round these amounts to the penny");
    expect(preview.summary).toBe("This will change 1 line. Nothing else in the book moves.");
    expect(preview.changes).toEqual([{ entryNumber: "BREAK-PENCE", was: "12.345", becomes: "12.35", amount: 12.345, what: "amount" }]);

    const applied = applyHelper(fixture, "book-amounts-whole-pence");
    const fixedLine = applied.find((l) => l.entryNumber === "BREAK-PENCE");
    expect(fixedLine.amount).toBe(12.35);
  });

  it("returns null for a passing check and throws for an unknown check id", () => {
    const fixture = baseline();
    expect(previewHelper(fixture, "book-dates-in-period")).toBeNull();
    expect(() => applyHelper(fixture, "book-dates-in-period")).toThrow("Nothing left for this helper to fix.");
    expect(() => applyHelper(fixture, "not-a-real-check")).toThrow('No helper called "not-a-real-check"');
  });
});

// ============================== the reposting account follows the book's product ==============================

describe("the reposting account follows the book's product", () => {
  it("a Taxi book reposts to 6200", () => {
    const { book, lines } = loadDiyaGlData(resolve(REPO_ROOT, "examples", "basic-taxi-driver", "taxi"));
    const offender = lines.find((l) => l.sourceJournalID === "purchases");
    offender.accountMainID = "9999";

    const preview = previewHelper({ book, lines }, "book-accounts-in-chart");
    expect(preview.changes).toHaveLength(1);
    expect(preview.changes[0].becomes).toBe("6200 — " + book.accounts.purchases["6200"].accountMainDescription);

    const applied = applyHelper({ book, lines }, "book-accounts-in-chart");
    const fixedLine = applied.find((l) => l.entryNumber === offender.entryNumber);
    expect(fixedLine.accountMainID).toBe("6200");
  });

  it("a Taxi book whose chart drops 6200 falls to its first account", () => {
    const { book, lines } = loadDiyaGlData(resolve(REPO_ROOT, "examples", "basic-taxi-driver", "taxi"));
    const offender = lines.find((l) => l.sourceJournalID === "purchases");
    offender.accountMainID = "9999";
    delete book.accounts.purchases["6200"];

    const preview = previewHelper({ book, lines }, "book-accounts-in-chart");
    expect(preview.changes[0].becomes.startsWith("5100")).toBe(true);
  });

  it("a BST book still prefers 5002", () => {
    const { book, lines } = loadDiyaGlData(resolve(REPO_ROOT, "examples", "precision-code-ltd", "bst"));
    const offender = lines.find((l) => l.sourceJournalID === "purchases");
    offender.accountMainID = "9999";

    const preview = previewHelper({ book, lines }, "book-accounts-in-chart");
    expect(preview.changes[0].becomes.startsWith("5002")).toBe(true);
  });
});

// ============================== bookChecksJson ==============================

describe("bookChecksJson", () => {
  it("is byte-stable across two calls, sorted by id, 2-space indent, newline-terminated", () => {
    const { book, lines, taxData } = baseline();
    const { results } = runBookChecks({ book, lines, taxData });

    const first = bookChecksJson(results);
    const second = bookChecksJson(clone(results));

    expect(first).toBe(second);
    expect(first.endsWith("\n")).toBe(true);
    expect(first.startsWith('[\n  {\n    "id":')).toBe(true);

    const ids = JSON.parse(first).map((r) => r.id);
    const sortedIds = [...ids].sort();
    expect(ids).toEqual(sortedIds);
  });

  it("is byte-stable whatever order the offenders behind it arrived in", () => {
    const fixtureA = baseline();
    fixtureA.lines.push(
      {
        entryNumber: "BREAK-A",
        sourceJournalID: "purchases",
        postingDate: "2026-04-15",
        accountMainID: "5000",
        amount: 60.0,
        detailComment: "Late invoice",
      },
      {
        entryNumber: "BREAK-B",
        sourceJournalID: "purchases",
        postingDate: "2026-05-15",
        accountMainID: "5000",
        amount: 61.0,
        detailComment: "Later invoice",
      },
    );

    const fixtureB = baseline();
    fixtureB.lines.push(
      {
        entryNumber: "BREAK-B",
        sourceJournalID: "purchases",
        postingDate: "2026-05-15",
        accountMainID: "5000",
        amount: 61.0,
        detailComment: "Later invoice",
      },
      {
        entryNumber: "BREAK-A",
        sourceJournalID: "purchases",
        postingDate: "2026-04-15",
        accountMainID: "5000",
        amount: 60.0,
        detailComment: "Late invoice",
      },
    );
    // Shuffle the whole array too, not just the appended lines.
    fixtureB.lines.reverse();

    const jsonA = bookChecksJson(runBookChecks(fixtureA).results);
    const jsonB = bookChecksJson(runBookChecks(fixtureB).results);

    expect(jsonA).toBe(jsonB);
  });
});
