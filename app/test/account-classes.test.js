// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// account-classes.test.js — every account a product's chart declares has a
// class, a normal side and the chart table it is declared in; the outbound
// account-to-concept map and the inbound iXBRL table agree for every account
// both name, apart from the placements the map states as the workbook's; a
// book built from an iXBRL file and read back through the map gives the
// file's own balance sheet lines; and the chart of accounts carries the
// class and the concept.

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { ACCOUNT_CLASSES, FRS_105_LINES, accountClasses, accountClassesOfBook } from "../lib/account-classes.js";
import { MAPPING_TABLE } from "../lib/ixbrl-accounts.js";
import { NEW_BOOK_CHARTS } from "../lib/diya-gl-new-book.js";
import { TAXI_BST_PURCHASE_CODE_MAP } from "../lib/scenario-extractor.js";
import { loadDiyaGlData, extractTaxDataFromBook } from "../lib/diya-gl-loader.js";
import { readBookSource } from "../lib/diya-gl-interchange.js";
import { chartOfAccounts, trialBalance } from "../lib/book-queries.js";
import { yearEndPostings } from "../lib/posting-rules.js";
import { buildFileReportDocument } from "../bin/export.js";
import { productModule } from "../lib/products.js";
import { buildBooksFromPlan, companyBookPlans } from "./support/book-generators.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const IXBRL_FIXTURES = resolve(ROOT, "app", "test", "fixtures", "ixbrl");

const PRODUCT_OF_SCHEMA_NAME = { Company: "ltd", SelfEmployed: "se", BasicSoleTrader: "bst", TaxiDriver: "taxi" };

// Every book.toml under examples/, with the product it declares.
function exampleBooks() {
  const found = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name === "book.toml") found.push(dirname(path));
    }
  };
  walk(resolve(ROOT, "examples"));
  return found.map((dir) => {
    const { book, lines } = loadDiyaGlData(dir);
    return { name: dir.slice(ROOT.length + 1), book, lines, product: PRODUCT_OF_SCHEMA_NAME[book.entityInformation["diya-gl:product"]] };
  });
}

const EXAMPLES = exampleBooks();

// Each declared account of each chart: the new-book charts and every example book's own chart.
const DECLARED = [
  ...Object.entries(NEW_BOOK_CHARTS).map(([product, accounts]) => ({ source: `new ${product} book`, product, book: { accounts } })),
  ...EXAMPLES.map(({ name, product, book }) => ({ source: name, product, book })),
].flatMap(({ source, product, book }) =>
  Object.entries(book.accounts).flatMap(([table, accounts]) =>
    Object.keys(accounts).map((account) => ({ source, product, book, table, account })),
  ),
);

describe("account classes", () => {
  it("reads at least one chart of each product", () => {
    expect(new Set(DECLARED.map(({ product }) => product))).toEqual(new Set(["ltd", "se", "bst", "taxi"]));
    expect(DECLARED.length).toBeGreaterThan(300);
  });

  it("gives every account any product's chart declares a class, a side and the table it is declared in", () => {
    fc.assert(
      fc.property(fc.constantFrom(...DECLARED), ({ source, product, book, table, account }) => {
        const entry = accountClassesOfBook(book, product).get(account);
        expect(entry, `${source}: ${table}.${account}`).toBeDefined();
        expect(ACCOUNT_CLASSES).toContain(entry.accountClass);
        expect(["D", "C"]).toContain(entry.normalSide);
        expect(entry.chartTable, `${source}: ${table}.${account}`).toBe(table);
      }),
      { numRuns: DECLARED.length * 2 },
    );
  });

  it("gives every Company account an FRS 102 concept and an FRS 105 line, except the long-term debtors the published sheet leaves out", () => {
    const unplaced = [...accountClasses("ltd").values()].filter((entry) => entry.frs102 === null || entry.frs105 === null);
    expect(unplaced.map((entry) => entry.account)).toEqual(["1400"]);
    for (const entry of accountClasses("ltd").values()) {
      if (entry.frs105) expect(FRS_105_LINES[entry.frs105.line]).toMatchObject({ concept: entry.frs105.concept });
    }
  });

  it("reads a class off what the account does, not the table or the leading digit", () => {
    const company = accountClasses("ltd");
    expect(company.get("3200")).toMatchObject({ accountClass: "liability", chartTable: "capital" });
    expect(company.get("4005")).toMatchObject({ accountClass: "expense", normalSide: "D", chartTable: "sales" });
    expect(company.get("5900")).toMatchObject({ accountClass: "asset", chartTable: "purchases" });
    expect(company.get("0010-depreciation")).toMatchObject({ accountClass: "asset", normalSide: "C", chartTable: null });
    expect(company.get("dividends-declared")).toMatchObject({ accountClass: "equity", normalSide: "D" });
    expect(accountClasses("bst").get("5900").accountClass).toBe("asset");
    const onTheTaxiChart = accountClasses("bst", { purchaseCodeMap: TAXI_BST_PURCHASE_CODE_MAP });
    expect(onTheTaxiChart.get("5900").accountClass).toBe("expense");
    expect(onTheTaxiChart.get("7000").accountClass).toBe("asset");
    expect(accountClasses("taxi").get("5900").accountClass).toBe("expense");
  });

  it("names concepts, dimensions and members the FRC suite defines", () => {
    const defined = new Set(JSON.parse(readFileSync(resolve(ROOT, "app", "data", "frc-taxonomy", "2021.json"), "utf8")).concepts);
    const named = new Set();
    for (const entry of accountClasses("ltd").values()) {
      for (const placed of [entry.frs102, entry.frs105]) {
        if (!placed) continue;
        for (const name of [placed.concept, placed.dimension, placed.member]) if (name) named.add(name);
      }
    }
    expect(named.size).toBeGreaterThan(25);
    expect([...named].filter((name) => !defined.has(name))).toEqual([]);
  });
});

describe("every Company book the engine writes", () => {
  it("has a class and a placement for every account its chart declares and its trial balance reaches", async () => {
    const company = accountClasses("ltd");
    await fc.assert(
      fc.asyncProperty(companyBookPlans, async (plan) => {
        for (const { book, lines } of await buildBooksFromPlan(plan)) {
          const declared = Object.values(book.accounts).flatMap((accounts) => Object.keys(accounts));
          const reached = trialBalance(book, lines, {
            yearEndPostings: yearEndPostings(book, lines, extractTaxDataFromBook(book, "ltd")),
          }).accounts.map((row) => row.account);
          for (const account of [...declared, ...reached]) {
            const entry = company.get(account);
            expect(entry, `account ${account}`).toBeDefined();
            expect(entry.frs105 === null).toBe(account === "1400");
          }
        }
      }),
      { numRuns: 25 },
    );
  });
});

// The accounts an inbound row posts to: one account, a range of fixed asset
// accounts, or none ("-" and the depreciation rate are not accounts).
function inboundAccounts(row) {
  if (/^\d{4}$/.test(row.account)) return [row.account];
  const range = row.account.match(/^(\d{4})-(\d{4})$/);
  if (!range) return [];
  return ["0000", "0010", "0020", "0030", "0040"].filter((account) => account >= range[1] && account <= range[2]);
}

const sameConcept = (row, placed) =>
  placed && row.concept === placed.concept && (row.member === undefined || row.member === "*" || row.member === placed.member);

// The accounts both tables name whose outbound FRS 102 concept and FRS 105
// line the inbound table maps to some other account.
function disagreements(classes) {
  const rowsOfAccount = new Map();
  for (const row of MAPPING_TABLE) {
    for (const account of inboundAccounts(row)) rowsOfAccount.set(account, [...(rowsOfAccount.get(account) ?? []), row]);
  }
  const differ = [];
  for (const [account, rows] of rowsOfAccount) {
    const entry = classes.get(account);
    if (!entry) continue;
    if (!rows.some((row) => sameConcept(row, entry.frs102) || sameConcept(row, entry.frs105))) differ.push(account);
  }
  return differ.sort();
}

describe("the outbound map against the inbound iXBRL table", () => {
  const company = accountClasses("ltd");

  it("agrees for every account both name, apart from the placements stated as the workbook's", () => {
    const stated = [...company.values()].filter((entry) => entry.asFound).map((entry) => entry.account);
    expect(stated.sort()).toEqual(["4003", "4006", "5001", "5803"]);
    expect(disagreements(company)).toEqual(stated);
    const named = new Set(MAPPING_TABLE.flatMap(inboundAccounts));
    expect([...named].filter((account) => company.has(account)).length).toBeGreaterThan(15);
  });

  it("states loan interest 5803 within administrative expenses, where the published profit and loss shows it", () => {
    expect(company.get("5803")).toMatchObject({
      accountClass: "expense",
      frs102: { concept: "AdministrativeExpenses" },
      frs105: { line: "otherCharges" },
    });
    expect(company.get("5803").asFound).toMatch(/legal and professional/);
  });

  it("finds the one account whose concept is moved off the inbound table's", () => {
    const moved = new Map(company);
    moved.set("1300", { ...company.get("1300"), frs102: { concept: "TotalInventories" } });
    expect(disagreements(moved)).toEqual(["1300", "4003", "4006", "5001", "5803"]);
  });
});

// The FRS 105 balance sheet lines a file states, and the side each sits on.
const BALANCE_SHEET_LINES = {
  fixedAssets: "D",
  currentAssets: "D",
  creditorsWithinOneYear: "C",
  creditorsAfterOneYear: "C",
  calledUpShareCapital: "C",
};

// A year's closing trial balance, year-end postings included, summed by the FRS 105 line each account feeds.
function linesFromTrialBalance(book, lines) {
  const company = accountClasses("ltd");
  const { accounts } = trialBalance(book, lines, { yearEndPostings: yearEndPostings(book, lines, extractTaxDataFromBook(book, "ltd")) });
  const totals = {};
  for (const row of accounts) {
    const line = company.get(row.account).frs105?.line;
    if (!BALANCE_SHEET_LINES[line]) continue;
    const balance = row.debit - row.credit;
    totals[line] = (totals[line] ?? 0) + (BALANCE_SHEET_LINES[line] === "D" ? balance : -balance);
  }
  return totals;
}

// Files whose books the engine closes on the file's own net assets: the
// summary book names no difference in either year's net assets.
const ROUND_TRIP_FILES = [
  "builder-micro.xhtml",
  "builder-micro-dormant.xhtml",
  "builder-small-consistent.xhtml",
  "builder-small-bank-lines.xhtml",
  "builder-small-filleted.xhtml",
  "adp-micro.xhtml",
  "adp-small-format2.xhtml",
  "diya-2025-accounts.xhtml",
];

describe("a book built from an iXBRL file, read back through the map", () => {
  for (const file of ROUND_TRIP_FILES) {
    it(`gives ${file}'s own balance sheet lines for both years`, async () => {
      const source = await readBookSource(readFileSync(resolve(IXBRL_FIXTURES, file)), file);
      expect(source.differences.filter((difference) => /net assets/.test(difference))).toEqual([]);
      const years = [
        [source.book, source.lines, source.accounts.balanceSheet.currentYear],
        [source.comparative.book, source.comparative.lines, source.accounts.balanceSheet.priorYear],
      ];
      let compared = 0;
      for (const [book, lines, stated] of years) {
        const read = linesFromTrialBalance(book, lines);
        for (const line of Object.keys(BALANCE_SHEET_LINES)) {
          if (stated[line] === undefined) continue;
          expect(Math.abs((read[line] ?? 0) - stated[line]), `${line}: ${read[line]} against ${stated[line]}`).toBeLessThanOrEqual(1);
          compared++;
        }
      }
      expect(compared).toBeGreaterThan(1);
    });
  }
});

describe("the chart of accounts", () => {
  const reportOf = (book, lines, product) => buildFileReportDocument(book, lines, product, productModule(product), { attribute: true });

  it("gives each Company account its class, side, FRS 102 concept and FRS 105 line", () => {
    const { book, lines } = EXAMPLES.find(({ name }) => name === "examples/precision-code-ltd");
    const chart = chartOfAccounts(book, lines, reportOf(book, lines, "ltd"), "ltd");
    const rent = chart.find((account) => account.id === "5200");
    expect(rent).toMatchObject({
      accountClass: "expense",
      normalSide: "D",
      frs102: { concept: "AdministrativeExpenses" },
      frs105: { line: "otherCharges", concept: "OtherOperatingExpensesFormat2" },
    });
    expect(chart.find((account) => account.id === "2600")).toMatchObject({
      accountClass: "liability",
      frs102: { concept: "Creditors", dimension: "MaturitiesOrExpirationPeriodsDimension", member: "AfterOneYear" },
    });
    expect(chart.find((account) => account.id === "5803").asFound).toBeDefined();
    expect(chart.every((account) => ACCOUNT_CLASSES.includes(account.accountClass))).toBe(true);
  });

  it("gives a sole trader's accounts a class and no concept", () => {
    const { book, lines } = EXAMPLES.find(({ name }) => name === "examples/sp-sixty-driving/bst");
    const chart = chartOfAccounts(book, lines, reportOf(book, lines, "bst"), "bst");
    expect(chart.find((account) => account.id === "7000")).toMatchObject({ accountClass: "asset" });
    expect(chart.find((account) => account.id === "5900")).toMatchObject({ accountClass: "expense" });
    expect(chart.some((account) => "frs102" in account || "frs105" in account)).toBe(false);
  });
});
