// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

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
    // The land & buildings opening asset's two OB- journal lines (the asset
    // and its offsetting retained earnings entry) add to the 723 lines the
    // rest of the book carries, one more again for the cash top-up's
    // counter leg on the current account, and ten more for the VAT-straddling
    // entries the periods either side of the year are returned on.
    expect(lines.length).toBe(735);
  });
});

// The master states ten lines carrying diya-gl:vatPeriodEnd -- sales and
// purchases in the VAT periods either side of the accounting year. They reach
// Vat.xlsx's out-of-year entry sheets and no journal at all, so the subset
// books keep them and the loader hands them to the scenario's own straddling
// tables while every year figure is built from the rest.
describe("diyaGlToScenario — the VAT periods either side of the year", () => {
  it("splits the straddling lines out of the advanced book into the scenario's own tables", () => {
    const { book, lines } = loadDiyaGlData(ADV_DATA);
    const scenario = diyaGlToScenario(book, lines, "se");
    expect(scenario.vat_straddling_sales.map((entry) => entry.period)).toEqual(["02Y1", "03Y1", "04Y2", "05Y2", "06Y2"]);
    expect(scenario.vat_straddling_purchases.map((entry) => entry.period)).toEqual(["02Y1", "03Y1", "04Y2", "05Y2", "06Y2"]);
    expect(scenario.vat_straddling_sales.map((entry) => entry.amount)).toEqual([4800, 2400, 3600, 1800, 1200]);
  });

  it("keeps them off the year's own journals", () => {
    const { book, lines } = loadDiyaGlData(ADV_DATA);
    const scenario = diyaGlToScenario(book, lines, "se");
    const invoiced = Object.values(scenario.sales)
      .flat()
      .map((tx) => tx.invoice);
    for (const entry of scenario.vat_straddling_sales) expect(invoiced).not.toContain(entry.invoice);
  });

  it("leaves a book with no straddling line carrying no straddling table", () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "brickwork-pro", "se-vat"));
    const scenario = diyaGlToScenario(book, lines, "se");
    expect(scenario.vat_straddling_sales).toBeUndefined();
    expect(scenario.vat_straddling_purchases).toBeUndefined();
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

  it("maps the book's diya-gl:vatNumber onto business.vat_number, matching the extractor's own fixture", () => {
    expect(fullScenario.business.vat_number).toBe(fullFixture.business.vat_number);
    expect(fullFixture.business.vat_number).toBe("123456789");
  });

  it("leaves business.vat_number unset for a book that declares no VAT number", () => {
    expect(brickScenario.business.vat_number).toBeUndefined();
    expect(brickFixture.business.vat_number).toBeUndefined();
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

  it("dividend.declared sums every voucher a book declares, dated the first one's own board meeting", () => {
    const { book, lines } = loadDiyaGlData(FULL_DATA);
    expect(book.dividends).toHaveLength(1);
    book.dividends = [
      { boardMeetingDate: book.dividends[0].boardMeetingDate, amount: book.dividends[0].amount },
      { boardMeetingDate: new Date("2026-06-30"), amount: 4000 },
    ];
    const scenario = diyaGlToScenario(book, lines, "ltd");
    expect(scenario.dividend).toEqual({
      board_meeting: fullFixture.dividend.board_meeting,
      declared: fullFixture.dividend.declared + 4000,
    });
  });
});

describe("extractTaxDataFromBook", () => {
  it("converts book.toml tax fields to app/data format (SE shape)", () => {
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

  it("emits SE capital_allowances shape with single writing_down_allowance key", () => {
    const { book } = loadDiyaGlData(BST_DATA);
    const taxData = extractTaxDataFromBook(book, "se");
    expect(taxData.capital_allowances.writing_down_allowance).toBeDefined();
    expect(taxData.capital_allowances.writing_down_allowance_main).toBeUndefined();
    expect(taxData.capital_allowances.writing_down_allowance_special).toBeUndefined();
    expect(taxData.capital_allowances.full_expensing_rate).toBeUndefined();
  });

  it("emits Ltd capital_allowances shape with main/special WDA and full_expensing_rate", () => {
    const { book } = loadDiyaGlData(FULL_DATA);
    const taxData = extractTaxDataFromBook(book, "ltd");
    expect(taxData.capital_allowances.writing_down_allowance_main).toBe(0.18);
    expect(taxData.capital_allowances.writing_down_allowance_special).toBe(0.06);
    expect(taxData.capital_allowances.full_expensing_rate).toBe(0);
    expect(taxData.capital_allowances.writing_down_allowance).toBeUndefined();
  });

  it("defaults full_expensing_rate to 0 when extracting from book.toml", () => {
    const { book } = loadDiyaGlData(FULL_DATA);
    const taxData = extractTaxDataFromBook(book, "ltd");
    expect(taxData.capital_allowances.full_expensing_rate).toBe(0);
  });

  // Depreciation rates are not a field book.toml carries, so every product
  // reads them off the app/data/<year>.toml file its own period falls in --
  // the same file --years names -- rather than leaving them out (as bst, se
  // and taxi did) or hardcoding standard rates (as the old ltd branch did).
  it("derives a depreciation table for bst, se and taxi from the book's own period", () => {
    const { book } = loadDiyaGlData(BST_DATA); // periodCoveredEnd 2026-03-31 -> se-2025-2026
    for (const product of [undefined, "bst", "taxi", "se"]) {
      const taxData = extractTaxDataFromBook(book, product);
      expect(taxData.depreciation, `product ${product}`).toEqual({
        land_and_property: 0,
        plant_and_machinery: 0.1,
        fixtures_and_fittings: 0.2,
        computer_equipment: 0.33,
        motor_vehicles: 0.25,
      });
    }
  });

  it("still derives a depreciation table for ltd, from the ltd tax-year file rather than a hardcoded copy", () => {
    const { book } = loadDiyaGlData(FULL_DATA); // periodCoveredEnd 2026-03-31 -> ltd-2025
    const taxData = extractTaxDataFromBook(book, "ltd");
    expect(taxData.depreciation).toEqual({
      land_and_property: 0,
      plant_and_machinery: 0.1,
      fixtures_and_fittings: 0.2,
      computer_equipment: 0.33,
      motor_vehicles: 0.25,
    });
  });

  it("throws rather than deriving a depreciation table for a book with no accounting period", () => {
    const { book } = loadDiyaGlData(BST_DATA);
    const noPeriod = { ...book, documentInfo: { ...book.documentInfo, periodCoveredEnd: undefined } };
    expect(() => extractTaxDataFromBook(noPeriod, "se")).toThrow(/periodCoveredEnd/);
  });

  it("throws rather than deriving a depreciation table for a period no tax-year file covers", () => {
    const { book } = loadDiyaGlData(BST_DATA);
    const outOfRange = { ...book, documentInfo: { ...book.documentInfo, periodCoveredEnd: new Date("1999-03-31") } };
    expect(() => extractTaxDataFromBook(outOfRange, "se")).toThrow(/no tax-year file covers/);
  });
});
