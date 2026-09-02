// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl-loader-chart.test.js — a book's own declared chart of accounts
// (book.toml's [accounts.purchases] tables) decides which purchase code map
// diyaGlToScenario() and calculateBstResults() apply, not the "bst" product
// name alone. sp-sixty-driving/bst keeps the Taxi Driver masters' account
// numbering (5900 is "Legal and professional" there, not BST's fixed
// assets; 7000 is a fixed asset account the generic BST map has no entry
// for at all), so resolveBstPurchaseCodeMap() must resolve it to
// TAXI_BST_PURCHASE_CODE_MAP instead. This file anchors both symptoms the
// wrong map produced -- 5900 misrouting into capital allowances, 7000's
// line dropping out of every total -- to the fixture's own lines, and
// proves the fix breakable by corrupting a scratch copy of the book's
// declared chart back into something the generic map already covers.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { loadDiyaGlData, diyaGlToScenario, resolveBstPurchaseCodeMap } from "../lib/diya-gl-loader.js";
import { calculateBstResults } from "../lib/calculators/bst.js";
import { BST_PURCHASE_CODE_MAP, TAXI_BST_PURCHASE_CODE_MAP } from "../lib/scenario-extractor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(__dirname, "..");
const taxData = parseTOML(readFileSync(resolve(APP_DIR, "data", "se-2025-2026.toml"), "utf8"));
const DIR = resolve(ROOT, "examples", "sp-sixty-driving", "bst");

function runFixture(book, lines) {
  const scenario = diyaGlToScenario(book, lines, "bst");
  const merged = { ...scenario, ...scenario.expected };
  const results = calculateBstResults(book, lines, taxData, merged);
  return { scenario, results };
}

function purchaseLinesFor(lines, accountMainID) {
  return lines.filter((l) => l.sourceJournalID === "purchases" && l.accountMainID === accountMainID);
}

describe("diya-gl-loader: resolveBstPurchaseCodeMap reads the book's own declared chart", () => {
  it("resolves sp-sixty's chart to the Taxi-numbered map, not the generic BST one", () => {
    const { book } = loadDiyaGlData(DIR);
    const map = resolveBstPurchaseCodeMap(book);
    expect(map).toBe(TAXI_BST_PURCHASE_CODE_MAP);
  });

  it("still resolves a BST-numbered chart to the generic map (generator-shaped fixtures are unaffected)", () => {
    const { book } = loadDiyaGlData(resolve(ROOT, "examples", "precision-code-ltd", "bst"));
    const map = resolveBstPurchaseCodeMap(book);
    expect(map).toBe(BST_PURCHASE_CODE_MAP);
  });

  it("account 5900 (Legal and professional in sp-sixty's own chart) lands on its true category", () => {
    const { book, lines } = loadDiyaGlData(DIR);
    const account5900Total = purchaseLinesFor(lines, "5900").reduce((sum, l) => sum + l.amount, 0);
    expect(account5900Total).toBe(750);

    const { scenario, results } = runFixture(book, lines);

    // Legal & professional, not capitalised as a fixed asset.
    expect(results["Profit & Loss Acc"].C18).toBe(750);
    expect((scenario.fixed_asset_additions || []).map((a) => a.cost)).not.toContain(400);
    expect((scenario.fixed_asset_additions || []).map((a) => a.cost)).not.toContain(350);
  });

  it("account 7000's fixed asset line is no longer dropped: it capitalises and feeds capital allowances", () => {
    const { book, lines } = loadDiyaGlData(DIR);
    const account7000Lines = purchaseLinesFor(lines, "7000");
    expect(account7000Lines).toHaveLength(1);
    expect(account7000Lines[0].amount).toBe(200);

    const { scenario, results } = runFixture(book, lines);

    expect(scenario.fixed_asset_additions.map((a) => a.cost)).toContain(200);
    expect(scenario.expected.fixed_asset_cost).toBe(200);
    expect(results["Fixed Assets"].E1).toBe(200);
    expect(results.PurchasesMar.X1).toBe(200);
  });

  // Prove the fix breakable: a chart trimmed of every account the generic
  // BST map lacks (6000, 6100, 6200, 7000) is indistinguishable from a
  // native BST chart to the coverage check, so it wrongly falls back to
  // BST_PURCHASE_CODE_MAP -- misrouting 5900 into fixed assets and dropping
  // 7000, exactly the defect the fix corrects. Corrupting the chart's own
  // 5900 entry alone cannot move this: the map is keyed by account number,
  // not by which accounts a chart happens to declare, so only removing the
  // chart's own coverage evidence changes which candidate map is chosen.
  it("is breakable: a chart edited to hide its non-BST accounts fools the coverage check and misroutes 5900 again", () => {
    const { book, lines } = loadDiyaGlData(DIR);
    const corruptedPurchases = { ...book.accounts.purchases };
    for (const account of ["6000", "6100", "6200", "7000"]) delete corruptedPurchases[account];
    const corruptedBook = { ...book, accounts: { ...book.accounts, purchases: corruptedPurchases } };

    const map = resolveBstPurchaseCodeMap(corruptedBook);
    expect(map).toBe(BST_PURCHASE_CODE_MAP);
    expect(map["5900"]).toBe("f");
    expect(map["7000"]).toBeUndefined();

    const { scenario, results } = runFixture(corruptedBook, lines);

    expect(results["Profit & Loss Acc"].C18).not.toBe(750); // 5900 no longer lands as Legal
    expect(scenario.expected.fixed_asset_cost).not.toBe(200); // 7000 drops out again
  });
});
