// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// trial-balance-view.test.js — the trial balance a reader picks a period for:
// the periods a book offers, the range each selection names, the lines
// behind an account's balance, and the diya-gl MCP tool that answers the
// same selection.

import { describe, it, expect } from "vitest";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadDiyaGlData, extractTaxDataFromBook } from "../lib/diya-gl-loader.js";
import { trialBalance, trialBalanceAccountLines, trialBalancePeriods, trialBalanceRange, trialBalanceReport } from "../lib/book-queries.js";
import { yearEndPostings } from "../lib/posting-rules.js";
import { TOOLS, createSession, loadIntoSession } from "../lib/mcp/diya-gl-tools.js";
import { createMethods } from "../lib/mcp/server.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EXAMPLES = ["precision-code-ltd/full", "brickwork-pro/ltd-vat"];

const toThePenny = (a, b) => Math.abs(a - b) < 0.005;

function loaded(example) {
  const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", example));
  return { book, lines, taxData: extractTaxDataFromBook(book, "ltd") };
}

describe("the periods a Company book offers a trial balance", () => {
  const { book } = loaded("precision-code-ltd/full");
  const periods = trialBalancePeriods(book);

  it("are the year, each of its twelve months, and the quarters of the three VAT staggers", () => {
    expect(periods.year.from).toBe(book.documentInfo.periodCoveredStart.toISOString().slice(0, 10));
    expect(periods.year.to).toBe(book.documentInfo.periodCoveredEnd.toISOString().slice(0, 10));
    expect(periods.months).toHaveLength(12);
    expect(periods.months[0].from).toBe(periods.year.from);
    expect(periods.months[11].to).toBe(periods.year.to);
    for (const stagger of [0, 1, 2]) {
      const quarters = periods.vatQuarters.filter((quarter) => quarter.stagger === stagger);
      expect(quarters.length).toBeGreaterThanOrEqual(4);
      for (const quarter of quarters) {
        const days = (new Date(quarter.to) - new Date(quarter.from)) / 86_400_000 + 1;
        expect(days).toBeGreaterThanOrEqual(89);
        expect(days).toBeLessThanOrEqual(92);
      }
    }
  });

  it("name a month or a quarter by its last month, and refuse one the book does not have", () => {
    const month = periods.months[2];
    expect(trialBalanceRange(book, { period: "month", month: month.id })).toMatchObject({ from: month.from, to: month.to });
    const quarter = periods.vatQuarters[0];
    expect(trialBalanceRange(book, { period: "vatQuarter", month: quarter.id })).toMatchObject({ from: quarter.from, to: quarter.to });
    expect(() => trialBalanceRange(book, { period: "month", month: "1999-01" })).toThrow("no month ending 1999-01");
    expect(() => trialBalanceRange(book, { period: "month" })).toThrow("needs the month argument");
    expect(() => trialBalanceRange(book, { period: "week" })).toThrow('Unknown trial balance period "week"');
    expect(trialBalanceRange(book, { from: "2026-01-01", to: "2026-01-31" }).period).toBe("custom");
  });
});

describe.each(EXAMPLES)("the trial balance report of %s", (example) => {
  const { book, lines, taxData } = loaded(example);
  const periods = trialBalancePeriods(book);
  const selections = [
    { period: "year" },
    { period: "month", month: periods.months[0].id },
    { period: "month", month: periods.months[5].id },
    { period: "vatQuarter", month: periods.vatQuarters[1].id },
  ];

  it("has equal debit and credit totals over the year, a month and a VAT quarter", () => {
    for (const selection of selections) {
      const { totals } = trialBalanceReport(book, lines, taxData, selection);
      expect({ selection, balances: toThePenny(totals.debit, totals.credit) }).toEqual({ selection, balances: true });
    }
    expect(trialBalanceReport(book, lines, taxData, { period: "year" }).totals.debit).toBeGreaterThan(0);
  });

  it("shows, for each account, lines whose debits less credits are the account's exact balance", () => {
    for (const selection of selections) {
      const { from, to } = trialBalanceRange(book, selection);
      const yearEnd = yearEndPostings(book, lines, taxData);
      const { accounts } = trialBalance(book, lines, { from, to, yearEndPostings: yearEnd });
      for (const row of accounts) {
        const { totals } = trialBalanceAccountLines(book, lines, row.account, { from, to, yearEndPostings: yearEnd });
        const net = totals.debit - totals.credit;
        expect({ selection, account: row.account, ties: toThePenny(net, row.debit - row.credit) }).toEqual({
          selection,
          account: row.account,
          ties: true,
        });
      }
    }
  });

  it("answers every debit and credit, in the balances and in each account's lines, to at most two places", () => {
    const twoPlaces = (value) => Math.round(value * 100) / 100 === value;
    for (const selection of selections) {
      const report = trialBalanceReport(book, lines, taxData, selection);
      const figures = [report.totals.debit, report.totals.credit, ...report.accounts.flatMap((row) => [row.debit, row.credit])];
      for (const row of report.accounts) {
        const { accountLines } = trialBalanceReport(book, lines, taxData, { ...selection, account: row.account });
        figures.push(
          accountLines.totals.debit,
          accountLines.totals.credit,
          ...accountLines.rows.flatMap((line) => [line.debit, line.credit]),
        );
      }
      expect({ selection, offenders: figures.filter((value) => !twoPlaces(value)) }).toEqual({ selection, offenders: [] });
    }
  });

  it("answers equal debit and credit totals, each the penny of the engine's exact total", () => {
    for (const selection of selections) {
      const { from, to } = trialBalanceRange(book, selection);
      const exact = trialBalance(book, lines, { from, to, yearEndPostings: yearEndPostings(book, lines, taxData) });
      const { totals } = trialBalanceReport(book, lines, taxData, selection);
      expect({ selection, equal: totals.debit === totals.credit }).toEqual({ selection, equal: true });
      expect({ selection, debit: totals.debit }).toEqual({ selection, debit: Math.round(exact.totals.debit * 100) / 100 });
    }
  });

  it("counts, in the engine, every figure exactly in hundredths of a penny, with column totals that are exactly the sums of their rows", () => {
    const exactCount = (value) => Math.round(value * 10000) / 10000 === value;
    for (const selection of selections) {
      const { from, to } = trialBalanceRange(book, selection);
      const { accounts, totals } = trialBalance(book, lines, { from, to, yearEndPostings: yearEndPostings(book, lines, taxData) });
      const sum = (side) => accounts.reduce((exact, row) => exact + Math.round(row[side] * 10000), 0) / 10000;
      const offenders = [totals.debit, totals.credit, ...accounts.flatMap((row) => [row.debit, row.credit])].filter(
        (value) => !exactCount(value),
      );
      expect({ selection, offenders }).toEqual({ selection, offenders: [] });
      expect({ selection, debit: totals.debit, credit: totals.credit }).toEqual({ selection, debit: sum("debit"), credit: sum("credit") });
      expect({ selection, equal: totals.debit === totals.credit }).toEqual({ selection, equal: true });
    }
  });

  it("carries no account lines unless an account is named", () => {
    expect(trialBalanceReport(book, lines, taxData, { period: "year" }).accountLines).toBeUndefined();
  });
});

describe("the trial balance answered to the penny", () => {
  const { book, lines, taxData } = loaded("precision-code-ltd/full");

  it("answers the June 2025 balance on the current account as 7524.80", () => {
    const report = trialBalanceReport(book, lines, taxData, { period: "month", month: "2025-06", account: "1200" });
    expect(report.accounts.find((row) => row.account === "1200")).toMatchObject({ debit: 7524.8, credit: 0 });
    expect(report.accountLines.totals).toEqual({ debit: 35200, credit: 27675.2 });
  });

  it("rounds a balance that falls between pennies half away from zero, and keeps the engine's figure exact", () => {
    const { from, to } = trialBalanceRange(book, { period: "year" });
    const exact = trialBalance(book, lines, { from, to, yearEndPostings: yearEndPostings(book, lines, taxData) });
    const halfPenny = exact.accounts.flatMap((row) =>
      ["debit", "credit"].filter((side) => Math.abs(Math.round(row[side] * 10000) % 100) === 50).map((side) => ({ row, side })),
    );
    expect(halfPenny.length).toBeGreaterThan(0);
    const answered = trialBalanceReport(book, lines, taxData, { period: "year" }).accounts;
    for (const { row, side } of halfPenny) {
      const answer = answered.find((candidate) => candidate.account === row.account)[side];
      expect({ account: row.account, side, answer }).toEqual({
        account: row.account,
        side,
        answer: Math.round(row[side] * 100 + 1e-9) / 100,
      });
      expect(answer).toBeGreaterThan(row[side]);
    }
  });
});

describe("the trial_balance tool", () => {
  const { book, lines, taxData } = loaded("precision-code-ltd/full");
  const methods = () => {
    const session = createSession();
    loadIntoSession(session, book, lines);
    return createMethods(session);
  };
  const call = async (args) => (await methods()["tools/call"]({ name: "trial_balance", arguments: args })).structuredContent;

  it("is listed with the period, month, from, to and account arguments", () => {
    expect(Object.keys(TOOLS.trial_balance.inputSchema.properties)).toEqual(
      expect.arrayContaining(["period", "month", "from", "to", "account", "book", "lines"]),
    );
  });

  it("answers the year with the same accounts and totals the report gives, and equal columns", async () => {
    const answer = await call({});
    const report = trialBalanceReport(book, lines, taxData, {});
    expect(answer.accounts).toEqual(JSON.parse(JSON.stringify(report.accounts)));
    expect(toThePenny(answer.totals.debit, answer.totals.credit)).toBe(true);
    expect(answer.periods).toBeUndefined();
  });

  it("answers a month and an account's lines", async () => {
    const month = trialBalancePeriods(book).months[4];
    const answer = await call({ period: "month", month: month.id, account: "1300" });
    expect(answer).toMatchObject({ period: "month", from: month.from, to: month.to });
    expect(answer.accountLines.account).toBe("1300");
    expect(answer.accountLines.rows.length).toBeGreaterThan(0);
    for (const row of answer.accountLines.rows) {
      expect(row.postingDate >= month.from && row.postingDate <= month.to).toBe(true);
    }
  });

  it("names the missing month when a month period has none", async () => {
    await expect(call({ period: "month" })).rejects.toThrow("needs the month argument");
  });
});
