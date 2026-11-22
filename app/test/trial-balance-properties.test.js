// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// trial-balance-properties.test.js — properties of the posting rules over
// every Company book the engine's writers produce: the postings of each
// daybook line, of each opening journal entry and of each year-end entry
// balance, and the trial balance's debits equal its credits for the year, for
// each month and for each VAT quarter of every stagger.

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { extractTaxDataFromBook } from "../lib/diya-gl-loader.js";
import { postingsOf, yearEndPostings } from "../lib/posting-rules.js";
import { trialBalance } from "../lib/book-queries.js";
import { buildBooksFromPlan, companyBookPlans } from "./support/book-generators.js";

const RUNS = 40;

const toThePenny = (a, b) => Math.abs(a - b) < 0.005;
const sides = (postings) => ({
  debit: postings.reduce((total, posting) => total + posting.debit, 0),
  credit: postings.reduce((total, posting) => total + posting.credit, 0),
});

const isoDay = (value) => (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);

// The first and last day of the month `offset` months after the period's first month.
function monthRange(periodStart, offset, length = 1) {
  const start = new Date(`${periodStart}T00:00:00Z`);
  const from = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1));
  const to = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset + length, 0));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

// The year, its twelve months, and the quarters of the three VAT staggers.
function ranges(book) {
  const start = isoDay(book.documentInfo.periodCoveredStart);
  const all = [{ from: start, to: isoDay(book.documentInfo.periodCoveredEnd) }];
  for (let month = 0; month < 12; month++) all.push(monthRange(start, month));
  for (let stagger = 0; stagger < 3; stagger++) {
    for (let quarter = -1; quarter < 4; quarter++) all.push(monthRange(start, stagger + quarter * 3, 3));
  }
  return all;
}

describe("the posting rules over books the engine writes", () => {
  it("give every daybook line, and every opening journal entry, postings whose debits equal their credits", async () => {
    await fc.assert(
      fc.asyncProperty(companyBookPlans, async (plan) => {
        for (const { book, lines } of await buildBooksFromPlan(plan)) {
          // A journal line is one leg of its entry; the lines sharing its document reference are the entry.
          const entries = new Map();
          for (const line of lines) {
            const key = line.sourceJournalID === "journal" ? `journal ${line.documentReference}` : `line ${line.entryNumber}`;
            entries.set(key, [...(entries.get(key) ?? []), ...postingsOf(book, line)]);
          }
          for (const [entry, postings] of entries) {
            const { debit, credit } = sides(postings);
            expect({ entry, balances: toThePenny(debit, credit) }).toEqual({ entry, balances: true });
          }
        }
      }),
      { numRuns: RUNS },
    );
  });

  it("give every year-end entry from the registers postings whose debits equal their credits", async () => {
    await fc.assert(
      fc.asyncProperty(companyBookPlans, async (plan) => {
        for (const { book, lines } of await buildBooksFromPlan(plan)) {
          for (const entry of yearEndPostings(book, lines, extractTaxDataFromBook(book, "ltd"))) {
            const { debit, credit } = sides(entry.postings);
            expect({ description: entry.description, balances: toThePenny(debit, credit) }).toEqual({
              description: entry.description,
              balances: true,
            });
          }
        }
      }),
      { numRuns: RUNS },
    );
  });

  it("sum to a trial balance whose debits equal its credits for the year, each month and each VAT quarter", async () => {
    await fc.assert(
      fc.asyncProperty(companyBookPlans, async (plan) => {
        for (const { book, lines } of await buildBooksFromPlan(plan)) {
          const yearEnd = yearEndPostings(book, lines, extractTaxDataFromBook(book, "ltd"));
          for (const range of ranges(book)) {
            const { totals } = trialBalance(book, lines, { ...range, yearEndPostings: yearEnd });
            expect({ range, balances: toThePenny(totals.debit, totals.credit) }).toEqual({ range, balances: true });
          }
        }
      }),
      { numRuns: RUNS },
    );
  });
});

describe("a plan that redates the roll forward's opening cash line", () => {
  const plans = {
    "after a supplier payment from the current account": {
      kind: "statements",
      yearEnd: "2022-03-31",
      vatRegistered: false,
      stages: [
        { actions: [{ kind: "bank", account: 94, receipt: false, code: 0, amount: 0.01, day: 0, who: "a" }], rollAfter: true },
        { actions: [{ kind: "changeDate", target: 0, day: 1 }], rollAfter: false },
      ],
    },
    "after that payment moved to another bank account": {
      kind: "statements",
      yearEnd: "2022-03-31",
      vatRegistered: false,
      stages: [
        { actions: [{ kind: "bank", account: 0, receipt: false, code: 0, amount: 0.01, day: 0, who: "A" }], rollAfter: false },
        { actions: [{ kind: "changeBankAccount", target: 0, account: 62 }], rollAfter: true },
        { actions: [{ kind: "changeDate", target: 0, day: 1 }], rollAfter: false },
      ],
    },
  };
  for (const [name, plan] of Object.entries(plans)) {
    it(`keeps the line on the first day and the trial balance balanced, ${name}`, async () => {
      const books = await buildBooksFromPlan(plan);
      const { book, lines } = books.at(-1);
      const opening = lines.find((line) => line.sourceJournalID === "bank" && line["diya-gl:bankCode"] === "BC");
      expect(opening.postingDate).toBe(isoDay(book.documentInfo.periodCoveredStart));
      const { totals } = trialBalance(book, lines, { yearEndPostings: yearEndPostings(book, lines, extractTaxDataFromBook(book, "ltd")) });
      expect(toThePenny(totals.debit, totals.credit)).toBe(true);
      expect(totals.debit).toBeGreaterThan(0);
    });
  }
});
