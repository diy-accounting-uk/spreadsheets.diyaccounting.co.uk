// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-properties.test.js — properties of every Company book the engine's
// writers produce: the book and its lines pass the published schemas, and the
// journal lines of each document reference balance to the penny.

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { validateBook, validateLines } from "../lib/diya-gl-schema.js";
import { ENGINE_WRITERS, buildBooksFromPlan, companyBookPlans } from "./support/book-generators.js";

const RUNS = 40;

// Journal lines grouped by documentReference, each group's debits less credits in whole pence.
function journalImbalances(lines) {
  const totals = new Map();
  for (const line of lines.filter((entry) => entry.sourceJournalID === "journal")) {
    const pence = Math.round(line.amount * 100) * (line.debitCreditCode === "D" ? 1 : -1);
    totals.set(line.documentReference, (totals.get(line.documentReference) ?? 0) + pence);
  }
  return [...totals].filter(([, pence]) => pence !== 0);
}

const booksBalance = (books) => books.every(({ lines }) => journalImbalances(lines).length === 0);

describe("books the engine writes", () => {
  it("pass validateBook and validateLines", async () => {
    await fc.assert(
      fc.asyncProperty(companyBookPlans, async (plan) => {
        for (const { book, lines } of await buildBooksFromPlan(plan)) {
          expect(validateBook(book).errors).toEqual([]);
          expect(validateLines(lines, book).errors).toEqual([]);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it("hold journal entries that balance to the penny for each document reference", async () => {
    await fc.assert(
      fc.asyncProperty(companyBookPlans, async (plan) => {
        for (const { lines } of await buildBooksFromPlan(plan)) {
          expect(journalImbalances(lines)).toEqual([]);
        }
      }),
      { numRuns: RUNS },
    );
  });
});

describe("the balance property", () => {
  // A roll forward that drops the first opening journal line it writes.
  const unbalancedWriters = {
    ...ENGINE_WRITERS,
    rollForward(book, lines, rateData) {
      const rolled = ENGINE_WRITERS.rollForward(book, lines, rateData);
      const dropped = rolled.lines.findIndex((line) => line.sourceJournalID === "journal");
      return { ...rolled, lines: rolled.lines.filter((_, position) => position !== dropped) };
    },
  };

  it("fails with a shrunk counter-example when a writer leaves a journal entry unbalanced", async () => {
    const outcome = await fc.check(
      fc.asyncProperty(companyBookPlans, async (plan) => booksBalance(await buildBooksFromPlan(plan, unbalancedWriters))),
      { numRuns: 200, seed: 20260101 },
    );
    expect(outcome.failed).toBe(true);
    const [plan] = outcome.counterexample;
    expect(plan.kind).toBe("statements");
    expect(plan.stages.some((stage) => stage.rollAfter)).toBe(true);
    expect(plan.stages.flatMap((stage) => stage.actions).length).toBeLessThanOrEqual(1);
    expect(outcome.numShrinks).toBeGreaterThan(0);
    console.log(`shrunk counter-example after ${outcome.numShrinks} shrinks: ${JSON.stringify(plan)}`);
  });
});
