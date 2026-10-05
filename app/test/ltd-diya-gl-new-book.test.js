// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// The chart a new Limited Company book starts from (app/lib/diya-gl-new-book.js,
// which the DIYA-GL page's New book form and the MCP server's new_book tool
// both build from), proved against the code map the engine posts purchases
// through.

import { describe, it, expect } from "vitest";
import { LTD_PURCHASE_CODE_MAP, LTD_SALES_CODE_MAP } from "../lib/scenario-extractor.js";
import { PURCHASE_ANALYSIS_COLUMNS } from "../lib/calculators/ltd.js";
import { buildNewBook } from "../lib/diya-gl-new-book.js";

const book = buildNewBook({ product: "ltd", businessName: "Fresh Books Ltd", yearEnd: "2026-03-31", vatRegistered: true });

describe("a new Company book's standard chart", () => {
  it("posts every purchase account through a code letter the engine analyses", () => {
    for (const code of Object.keys(book.accounts.purchases)) {
      const letter = LTD_PURCHASE_CODE_MAP[code];
      expect(letter, `purchases account ${code} has no code letter`).toBeDefined();
      expect(PURCHASE_ANALYSIS_COLUMNS[letter], `code ${letter} has no Purchases column`).toBeDefined();
    }
    for (const code of Object.keys(book.accounts.sales)) {
      expect(LTD_SALES_CODE_MAP[code], `sales account ${code} has no code letter`).toBeDefined();
    }
  });

  it("carries business entertainment on its own column, so a fresh book can post the line the computation adds back", () => {
    const entertainment = book.accounts.purchases["5502"];
    expect(entertainment).toEqual({ "accountMainDescription": "Business entertainment", "diya-gl:column": "AJ" });
    expect(PURCHASE_ANALYSIS_COLUMNS[LTD_PURCHASE_CODE_MAP[5502]]).toBe(entertainment["diya-gl:column"]);
  });

  it("names a column only where the column is the one the code letter analyses into", () => {
    for (const [code, account] of Object.entries(book.accounts.purchases)) {
      if (account["diya-gl:column"] === undefined) continue;
      expect(account["diya-gl:column"], `purchases account ${code}`).toBe(PURCHASE_ANALYSIS_COLUMNS[LTD_PURCHASE_CODE_MAP[code]]);
    }
  });
});
