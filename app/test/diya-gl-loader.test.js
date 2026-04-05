// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect } from "vitest";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadDiyaGlData, diyaGlToScenario, extractTaxDataFromBook } from "../lib/diya-gl-loader.js";
import { MONTH_ORDER } from "../lib/scenario-extractor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const BST_DATA = resolve(ROOT, "examples", "precision-code-ltd", "bst");
const ADV_DATA = resolve(ROOT, "examples", "precision-code-ltd", "advanced");
const FULL_DATA = resolve(ROOT, "examples", "precision-code-ltd", "full");

describe("loadDiyaGlData", () => {
  it("loads book.toml and lines.jsonl from BST subset", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    expect(book.entityInformation.organizationIdentifier).toBe("Precision Code Trading");
    expect(lines.length).toBe(504);
  });

  it("loads full dataset", () => {
    const { book, lines } = loadDiyaGlData(FULL_DATA);
    expect(book.entityInformation.organizationIdentifier).toBe("Precision Code Ltd");
    expect(lines.length).toBe(715);
  });
});

describe("diyaGlToScenario — BST", () => {
  let scenario;

  it("converts BST data to scenario format", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    scenario = diyaGlToScenario(book, lines, "bst");
    expect(scenario.metadata.product).toBe("bst");
    expect(scenario.metadata.tax_regime).toBe("se");
  });

  it("populates sales for all 12 months", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    scenario = diyaGlToScenario(book, lines, "bst");
    const monthsWithSales = Object.keys(scenario.sales);
    expect(monthsWithSales.length).toBe(12);
  });

  it("populates purchases for all 12 months", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    scenario = diyaGlToScenario(book, lines, "bst");
    const monthsWithPurchases = Object.keys(scenario.purchases);
    expect(monthsWithPurchases.length).toBe(12);
  });

  it("computes expected total_sales matching extract-scenarios output", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    scenario = diyaGlToScenario(book, lines, "bst");
    // From extract-scenarios: BST total_sales = 409900
    expect(scenario.expected.total_sales).toBe(409900);
  });

  it("computes expected gross_profit", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    scenario = diyaGlToScenario(book, lines, "bst");
    expect(scenario.expected.gross_profit).toBeDefined();
    expect(scenario.expected.gross_profit).toBeGreaterThan(0);
  });

  it("does not include bank transactions for BST", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    scenario = diyaGlToScenario(book, lines, "bst");
    expect(scenario.bank).toBeUndefined();
  });
});

describe("diyaGlToScenario — SE", () => {
  it("computes SE total_sales as net (gross / 1.2)", () => {
    const { book, lines } = loadDiyaGlData(ADV_DATA);
    const scenario = diyaGlToScenario(book, lines, "se");
    // From extract-scenarios: SE total_sales = 339200
    expect(scenario.expected.total_sales).toBe(339200);
  });

  it("includes bank transactions for SE", () => {
    const { book, lines } = loadDiyaGlData(ADV_DATA);
    const scenario = diyaGlToScenario(book, lines, "se");
    expect(scenario.bank).toBeDefined();
    expect(Object.keys(scenario.bank).length).toBeGreaterThan(0);
  });
});

describe("diyaGlToScenario — Ltd", () => {
  it("computes Ltd total_sales including grants (4004)", () => {
    const { book, lines } = loadDiyaGlData(FULL_DATA);
    const scenario = diyaGlToScenario(book, lines, "ltd");
    // From extract-scenarios: Ltd total_sales = 341283
    expect(scenario.expected.total_sales).toBe(341283);
  });
});

describe("extractTaxDataFromBook", () => {
  it("converts book.toml tax fields to app/data format", () => {
    const { book } = loadDiyaGlData(BST_DATA);
    const taxData = extractTaxDataFromBook(book);
    expect(taxData.income_tax.personal_allowance).toBe(12570);
    expect(taxData.income_tax.basic_rate).toBe(0.2);
    expect(taxData.income_tax.higher_rate).toBe(0.4);
    expect(taxData.income_tax.basic_band_end).toBe(37700);
  });

  it("converts NI rates", () => {
    const { book } = loadDiyaGlData(BST_DATA);
    const taxData = extractTaxDataFromBook(book);
    expect(taxData.national_insurance).toBeDefined();
    expect(taxData.national_insurance.class4_lower_limit).toBeDefined();
  });
});
