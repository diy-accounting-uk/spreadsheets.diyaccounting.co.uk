// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { loadDiyaGlData, diyaGlToScenario, extractTaxDataFromBook } from "../lib/diya-gl-loader.js";
import { MONTH_ORDER } from "../lib/scenario-extractor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const BST_DATA = resolve(ROOT, "examples", "precision-code-ltd", "bst");
const ADV_DATA = resolve(ROOT, "examples", "precision-code-ltd", "advanced");
const FULL_DATA = resolve(ROOT, "examples", "precision-code-ltd", "full");
const BRICKWORK_LTD_NONVAT = resolve(ROOT, "examples", "brickwork-pro", "ltd-nonvat");

describe("loadDiyaGlData", () => {
  it("loads book.toml and lines.jsonl from BST subset", () => {
    const { book, lines } = loadDiyaGlData(BST_DATA);
    expect(book.entityInformation.organizationIdentifier).toBe("Precision Code Trading");
    expect(lines.length).toBe(528);
  });

  it("loads full dataset", () => {
    const { book, lines } = loadDiyaGlData(FULL_DATA);
    expect(book.entityInformation.organizationIdentifier).toBe("Precision Code Ltd");
    expect(lines.length).toBe(722);
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

// The v2 book tables (fixedAssets, hpAgreements, dividends, members, charges,
// stock, debtors, creditors) and diya-gl:vatRegistered, checked against the
// same scenario the extractor writes for the same master data. Parsing both
// sides through smol-toml means a bare TOML date comes back as the same kind
// of Date object on both sides, so the comparison holds the field, not its
// text representation.
describe("diyaGlToScenario — v2 tables match the extractor's own fixtures", () => {
  const fixturesDir = resolve(ROOT, "app", "test", "fixtures");
  const fullFixture = parseTOML(readFileSync(resolve(fixturesDir, "ltd-scenario-full.toml"), "utf-8"));
  const brickFixture = parseTOML(readFileSync(resolve(fixturesDir, "ltd-brickwork-pro-nonvat.toml"), "utf-8"));

  function ltdScenarioFor(dataDir) {
    const { book, lines } = loadDiyaGlData(dataDir);
    return diyaGlToScenario(book, lines, "ltd");
  }

  const fullScenario = ltdScenarioFor(FULL_DATA);
  const brickScenario = ltdScenarioFor(BRICKWORK_LTD_NONVAT);

  it("declares vat_registered from the book's own diya-gl:vatRegistered flag", () => {
    expect(fullScenario.metadata.vat_registered).toBe(fullFixture.metadata.vat_registered);
    expect(fullFixture.metadata.vat_registered).toBe(true);
    expect(brickScenario.metadata.vat_registered).toBe(brickFixture.metadata.vat_registered);
    expect(brickFixture.metadata.vat_registered).toBe(false);
  });

  it.each([
    ["stock", "full"],
    ["opening_debtors", "full"],
    ["closing_debtors", "full"],
    ["opening_creditors", "full"],
    ["closing_creditors", "full"],
    ["opening_fixed_assets", "full"],
    ["hp_agreements", "full"],
    ["charges", "full"],
    ["dividend", "full"],
    ["stock", "brickwork"],
    ["opening_debtors", "brickwork"],
    ["closing_debtors", "brickwork"],
    ["opening_creditors", "brickwork"],
    ["closing_creditors", "brickwork"],
    ["opening_fixed_assets", "brickwork"],
  ])("%s (%s) equals the extractor-written fixture", (table, which) => {
    const scenario = which === "full" ? fullScenario : brickScenario;
    const fixture = which === "full" ? fullFixture : brickFixture;
    expect(scenario[table]).toEqual(fixture[table]);
  });

  it("opening_fixed_assets excludes an asset a purchase line already claims", () => {
    // BrickWork's van is bought within the year (a "fa"-coded purchase line
    // carries its diya-gl:assetID), so it reaches the Schedule through that
    // purchase, not through the opening register, and the fixture agrees:
    // BrickWork Ltd carries no opening_fixed_assets at all.
    expect(brickScenario.opening_fixed_assets).toBeUndefined();
    expect(brickFixture.opening_fixed_assets).toBeUndefined();
  });

  it("members equals the fixture, name and shares always, acquisition date where the fixture keeps it", () => {
    expect(fullScenario.members).toEqual(fullFixture.members);
    expect(brickScenario.members).toEqual(brickFixture.members);
  });

  it("hp_agreements and charges are absent from BrickWork Ltd, which declares neither table", () => {
    expect(brickScenario.hp_agreements).toBeUndefined();
    expect(brickFixture.hp_agreements).toBeUndefined();
    expect(brickScenario.charges).toBeUndefined();
    expect(brickFixture.charges).toBeUndefined();
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
