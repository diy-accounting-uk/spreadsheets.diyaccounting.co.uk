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
import { trialBalancePeriods, trialBalanceRange, trialBalanceReport } from "../lib/book-queries.js";
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

  it("shows, for each account, lines whose debits less credits are the account's balance", () => {
    for (const selection of selections) {
      const { accounts } = trialBalanceReport(book, lines, taxData, selection);
      for (const row of accounts) {
        const { accountLines } = trialBalanceReport(book, lines, taxData, { ...selection, account: row.account });
        const net = accountLines.totals.debit - accountLines.totals.credit;
        expect({ selection, account: row.account, ties: toThePenny(net, row.debit - row.credit) }).toEqual({
          selection,
          account: row.account,
          ties: true,
        });
      }
    }
  });

  it("carries no account lines unless an account is named", () => {
    expect(trialBalanceReport(book, lines, taxData, { period: "year" }).accountLines).toBeUndefined();
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
