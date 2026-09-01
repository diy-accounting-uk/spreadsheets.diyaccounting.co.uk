// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl-edit-recalc.test.js — the edit-recalc harness: parse a BST
// fixture's own lines.jsonl, apply one named edit from diya-gl-edits.js in
// memory, run calculateFromDiyaGl and checkCompliance again, and assert the
// movement in the resulting report -- both the raw cell map
// calculateFromDiyaGl returns and R, the canonical document
// buildReportDocument builds from it (the same shape report.js writes to
// report.json). Recalculation never rewrites lines: D stays input-only, so
// an edit's effect is read entirely off R.
//
// Every edit is anchored to a real line or a real account the fixture
// already carries -- never a synthetic category the fixture has no data
// for -- so a check that could never fail (comparing a derived figure to
// itself) never stands in for one that can.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { addSaleLine, addPurchaseLine, changeLineAmount } from "../lib/diya-gl-edits.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import { buildReportDocument } from "../lib/report-serializer.js";
import { canonicalLinesJsonl } from "../lib/diya-gl-canonical.js";
import * as bst from "../products/bst.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(__dirname, "..");

const taxData = parseTOML(readFileSync(resolve(APP_DIR, "data", "se-2025-2026.toml"), "utf8"));

// One run of the same D -> R loop report.js's diya-gl mode performs: the
// scenario diyaGlToScenario derives from the lines is both the calculator's
// fourth argument and checkCompliance's "expected", so an edit's checks are
// re-derived from the edited lines themselves rather than a stale figure.
function runReport(book, lines) {
  const scenario = diyaGlToScenario(book, lines, "bst");
  const merged = { ...scenario, ...scenario.expected };
  const results = calculateFromDiyaGl(book, lines, "bst", taxData, merged);
  const checks = bst.checkCompliance({ ...results }, merged, taxData, calculateExpectedTax);
  const document = buildReportDocument({ packageName: "bst", engine: "js", results, productMod: bst, scenario: merged, checks });
  return { results, checks, document };
}

function valueAt(document, key) {
  const entry = document.values.find((v) => v.key === key);
  if (!entry) throw new Error(`R carries no value for ${key}`);
  return Number(entry.value);
}

// Every check the product declares must still pass after an edit: the
// checks are recomputed from the same edited lines the calculator saw, so a
// disagreement here is the calculator and the scenario builder drifting
// apart, not a stale fixture expectation.
function expectAllChecksPass(checks) {
  const failing = checks.filter((c) => !c.pass);
  expect(failing, JSON.stringify(failing, null, 2)).toEqual([]);
}

// Each fixture names a real line to change and a real account to post a new
// line against, picked from the fixture's own lines.jsonl (see the file's
// own account chart under [accounts.purchases]/[accounts.sales] in
// book.toml). The category codes are BST_PURCHASE_CODE_MAP's own -- see
// app/lib/scenario-extractor.js -- so "categoryCell" is the P&L cell that
// code's total lands on.
const FIXTURES = [
  {
    name: "bst-scenario-basic",
    dir: resolve(ROOT, "examples", "precision-code-ltd", "bst"),
    // Advertising (account 5500, BST code "a") lands on Profit & Loss Acc!C17.
    addPurchase: {
      line: {
        entryNumber: "TEST-ADD-PURCHASE-1",
        sourceJournalID: "purchases",
        postingDate: "2025-08-15",
        accountMainID: "5500",
        amount: 200,
        documentType: "invoice",
        detailComment: "Test synthetic advertising spend",
        taxCode: "S",
        taxRate: 0.2,
      },
      amount: 200,
      categoryCell: "C17",
    },
    // A second sales account (4001) the fixture already carries (e.g. TXN-0016).
    addSale: {
      line: {
        entryNumber: "TEST-ADD-SALE-1",
        sourceJournalID: "sales",
        postingDate: "2025-09-10",
        accountMainID: "4001",
        amount: 815,
        documentType: "invoice",
        documentReference: "INV-TEST-1",
        detailComment: "Test synthetic sale",
        lineItemComment: "Synthetic sale for the edit-recalc harness",
        taxCode: "S",
        taxRate: 0.2,
      },
      amount: 815,
      monthCell: "I4", // September
    },
    // TXN-0016: Beta Systems, account 4001, 1200 on 2025-04-01 (April).
    changeSaleLine: { entryNumber: "TXN-0016", newAmount: 1450, delta: 250, monthCell: "D4" },
    // TXN-0164: BuildTech Solutions, account 5001 (direct costs, "d"), 5000 on 2025-06-15.
    changePurchaseLine: { entryNumber: "TXN-0164", newAmount: 5450, delta: 450, categoryCell: "C7" },
  },
  {
    name: "bst-brickwork-pro-nonvat",
    dir: resolve(ROOT, "examples", "brickwork-pro", "bst-nonvat"),
    // Employee costs (account 5101, BST code "e") lands on Profit & Loss Acc!C11.
    addPurchase: {
      line: {
        entryNumber: "TEST-ADD-PURCHASE-1",
        sourceJournalID: "purchases",
        postingDate: "2025-10-05",
        accountMainID: "5101",
        amount: 175,
        documentType: "invoice",
        detailComment: "Test synthetic employee cost",
        taxCode: "NA",
        taxRate: 0,
      },
      amount: 175,
      categoryCell: "C11",
    },
    addSale: {
      line: {
        entryNumber: "TEST-ADD-SALE-1",
        sourceJournalID: "sales",
        postingDate: "2025-11-20",
        accountMainID: "4000",
        amount: 2200,
        documentType: "invoice",
        documentReference: "INV-TEST-1",
        detailComment: "Test synthetic bricklaying job",
        lineItemComment: "Synthetic sale for the edit-recalc harness",
        taxCode: "NA",
        taxRate: 0,
        paymentMethod: "bank-transfer",
      },
      amount: 2200,
      monthCell: "K4", // November
    },
    // TXN-0014: Acme Developments, account 4000, 4550 on 2025-04-10 (April).
    changeSaleLine: { entryNumber: "TXN-0014", newAmount: 4850, delta: 300, monthCell: "D4" },
    // TXN-0028: JB Plastering, account 5001 (direct costs, "d"), 6000 on 2025-05-15.
    changePurchaseLine: { entryNumber: "TXN-0028", newAmount: 6450, delta: 450, categoryCell: "C7" },
  },
  {
    // The no-ledger, mileage route: this book's own chart of accounts
    // numbers its purchase codes the way the Taxi Driver masters do (5100 is
    // Fuel, not BST's Directors wages), so BST_PURCHASE_CODE_MAP -- keyed by
    // account number, not by the book's own accountMainDescription --
    // diya-gl-loader.js's resolveBstPurchaseCodeMap() reads this book's own
    // declared chart under [accounts.purchases] and resolves it to
    // TAXI_BST_PURCHASE_CODE_MAP (the Taxi Driver masters' numbering, read
    // onto BST's codes), not the generic BST_PURCHASE_CODE_MAP. Every edit
    // below is anchored to a code letter verified against
    // calculateFromDiyaGl's own output under that resolved map, not to the
    // account's plain-English description.
    name: "bst-sp-sixty",
    dir: resolve(ROOT, "examples", "sp-sixty-driving", "bst"),
    // Account 5400 ("Road tax and insurance" in this book's own chart) reads
    // under TAXI_BST_PURCHASE_CODE_MAP as code "o", landing on C21 (Other
    // Expenses) -- not on Repairs & Maintenance, which BST_PURCHASE_CODE_MAP
    // (built for a BST-numbered chart) would have read it as.
    addPurchase: {
      line: {
        entryNumber: "TEST-ADD-PURCHASE-1",
        sourceJournalID: "purchases",
        postingDate: "2025-08-20",
        accountMainID: "5400",
        amount: 95,
        documentType: "invoice",
        detailComment: "Test synthetic road tax renewal",
        taxCode: "OS",
        taxRate: 0,
      },
      amount: 95,
      categoryCell: "C21",
    },
    addSale: {
      line: {
        entryNumber: "TEST-ADD-SALE-1",
        sourceJournalID: "sales",
        postingDate: "2025-09-12",
        accountMainID: "4000",
        amount: 340,
        documentType: "receipt",
        detailComment: "Daily fares",
        lineItemComment: "Synthetic fares for the edit-recalc harness",
        taxCode: "OS",
        taxRate: 0,
        paymentMethod: "online-payment",
      },
      amount: 340,
      monthCell: "I4", // September
    },
    // TXN-0001: the year's first fare-day banking, account 4000, 174 on
    // 2025-04-07 (April). It also carries the day's business miles, which
    // BST's mileage claim never reads off a sales line (see
    // scenario-extractor.js buildGrouped: a sale only carries "mileage" for
    // Taxi's carriesMileage="all"; BST's "claims" mode reads purchases
    // only), so changing its amount moves no motoring figure.
    changeSaleLine: { entryNumber: "TXN-0001", newAmount: 214, delta: 40, monthCell: "D4" },
    // TXN-0182: DVLA, account 5400 (code "o"), 180 on 2025-04-06.
    changePurchaseLine: { entryNumber: "TXN-0182", newAmount: 235, delta: 55, categoryCell: "C21" },
  },
];

for (const fixture of FIXTURES) {
  describe(`diya-gl edit-recalc: ${fixture.name}`, () => {
    const { book, lines } = loadDiyaGlData(fixture.dir);
    const base = runReport(book, lines);

    it("baseline: every compliance check already passes", () => {
      expectAllChecksPass(base.checks);
    });

    it("adds a purchase of X: profit falls by X, turnover is unchanged", () => {
      const edited = addPurchaseLine(book, lines, { line: fixture.addPurchase.line });
      const after = runReport(book, edited);

      expect(valueAt(after.document, "cell/Profit & Loss Acc!C4")).toBe(valueAt(base.document, "cell/Profit & Loss Acc!C4"));
      expect(after.results["Profit & Loss Acc"][fixture.addPurchase.categoryCell] - base.results["Profit & Loss Acc"][fixture.addPurchase.categoryCell]).toBe(
        fixture.addPurchase.amount,
      );
      expect(valueAt(after.document, "cell/Profit & Loss Acc!C24") - valueAt(base.document, "cell/Profit & Loss Acc!C24")).toBe(
        -fixture.addPurchase.amount,
      );
      expectAllChecksPass(after.checks);
    });

    it("adds a sale of Y: profit and turnover both rise by Y", () => {
      const edited = addSaleLine(book, lines, { line: fixture.addSale.line });
      const after = runReport(book, edited);

      expect(valueAt(after.document, "cell/Profit & Loss Acc!C4") - valueAt(base.document, "cell/Profit & Loss Acc!C4")).toBe(
        fixture.addSale.amount,
      );
      expect(after.results["Profit & Loss Acc"][fixture.addSale.monthCell] - base.results["Profit & Loss Acc"][fixture.addSale.monthCell]).toBe(
        fixture.addSale.amount,
      );
      expect(valueAt(after.document, "cell/Profit & Loss Acc!C24") - valueAt(base.document, "cell/Profit & Loss Acc!C24")).toBe(
        fixture.addSale.amount,
      );
      expectAllChecksPass(after.checks);
    });

    it("changes a sales line's amount: its month, turnover and net profit move by the difference, checks stay green", () => {
      const edited = changeLineAmount(book, lines, {
        entryNumber: fixture.changeSaleLine.entryNumber,
        newAmount: fixture.changeSaleLine.newAmount,
      });
      const after = runReport(book, edited);
      const { delta, monthCell } = fixture.changeSaleLine;

      expect(after.results["Profit & Loss Acc"][monthCell] - base.results["Profit & Loss Acc"][monthCell]).toBe(delta);
      expect(valueAt(after.document, "cell/Profit & Loss Acc!C4") - valueAt(base.document, "cell/Profit & Loss Acc!C4")).toBe(delta);
      expect(valueAt(after.document, "cell/Profit & Loss Acc!C24") - valueAt(base.document, "cell/Profit & Loss Acc!C24")).toBe(delta);
      expectAllChecksPass(after.checks);
    });

    it("changes a purchase line's amount: its category and net profit move by the difference, checks stay green", () => {
      const edited = changeLineAmount(book, lines, {
        entryNumber: fixture.changePurchaseLine.entryNumber,
        newAmount: fixture.changePurchaseLine.newAmount,
      });
      const after = runReport(book, edited);
      const { delta, categoryCell } = fixture.changePurchaseLine;

      expect(after.results["Profit & Loss Acc"][categoryCell] - base.results["Profit & Loss Acc"][categoryCell]).toBe(delta);
      // Turnover carries no purchase-side movement at all.
      expect(valueAt(after.document, "cell/Profit & Loss Acc!C4")).toBe(valueAt(base.document, "cell/Profit & Loss Acc!C4"));
      expect(valueAt(after.document, "cell/Profit & Loss Acc!C24") - valueAt(base.document, "cell/Profit & Loss Acc!C24")).toBe(-delta);
      expectAllChecksPass(after.checks);
    });

    it("identity: parse then serialize with no edit is byte-identical, and an unchanged book recalculates to an unchanged report", () => {
      // The "edit" is a fresh copy of every line, applying no change at all --
      // recalculation never rewrites D, so nothing here should move.
      const identityLines = lines.map((line) => ({ ...line }));

      expect(canonicalLinesJsonl(identityLines)).toBe(canonicalLinesJsonl(lines));

      const after = runReport(book, identityLines);
      expect(after.results).toEqual(base.results);
      expect(after.document).toEqual(base.document);
    });
  });
}
