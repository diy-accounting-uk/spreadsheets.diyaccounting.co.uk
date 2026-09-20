// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// The chart a new Limited Company book starts from on the DIYA-GL page
// (web/.../diya-gl/products/ltd.js), proved against the code map the engine
// posts purchases through. The manifest is a classic script that assigns one
// global, so it is imported for its side effect and read back off globalThis.

import { describe, it, expect } from "vitest";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { LTD_PURCHASE_CODE_MAP, LTD_SALES_CODE_MAP } from "../lib/scenario-extractor.js";
import { PURCHASE_ANALYSIS_COLUMNS } from "../lib/calculators/ltd.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const MANIFEST_FILE = resolve(ROOT, "web", "diya-gl.co.uk", "public", "products", "ltd.js");

await import(MANIFEST_FILE);
const manifest = globalThis.DiyaGlProducts.ltd;

const book = manifest.newBook.build(
  { businessName: "Fresh Books Ltd", yearEnd: "2026-03-31", vatRegistered: true },
  { period: { start: "2025-04-01", end: "2026-03-31" } },
);

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
