// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// ixbrl-summary-book.test.js — the Company books an iXBRL file stands for:
// readBookSource on the files, the totals each year's book reproduces
// through the engine, the lines a reader traces back to the facts, and the
// postings the Company calculator has to take for that (bank interest as a K
// receipt, an asset's own depreciation rate).

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { detectBookSource, readBookSource, UnknownBookSourceError } from "../lib/diya-gl-interchange.js";
import { diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { loadTaxDataForBook } from "../lib/product-workbook.js";
import { validateBook, validateLines } from "../lib/diya-gl-schema.js";
import { IxbrlError } from "../lib/ixbrl-reader.js";
import { context, ixbrlDocument, money, words, xbrlInstance } from "./helpers/ixbrl-document.js";

const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures", "ixbrl");
const fixture = (name) => readFileSync(resolve(FIXTURES, name));

// The engine's published statements for one book.
async function resultsOf(book, lines) {
  const taxData = await loadTaxDataForBook(book);
  return calculateFromDiyaGl(book, lines, "ltd", taxData, diyaGlToScenario(book, lines, "ltd"));
}

// The figures a file's totals are compared on, from the published statements.
const totals = (results) => ({
  turnover: results["PubP&L"].F9,
  profitBeforeTax: results["PubP&L"].F49,
  fixedAssets: results.PubBalSht.F6,
  currentAssets: results.PubBalSht.E13,
  creditorsWithinOneYear: results.PubBalSht.E20,
  creditorsAfterOneYear: results.PubBalSht.E30,
  netAssets: results.PubBalSht.F33,
  capitalAndReserves: results.PubBalSht.F39,
});

const closeTo = (actual, expected) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);

function expectTotals(actual, expected) {
  for (const [name, value] of Object.entries(expected)) {
    expect(Math.abs(actual[name] - value), `${name}: ${actual[name]} against ${value}`).toBeLessThanOrEqual(1);
  }
}

describe("readBookSource on DIY Accounting Limited's 2025 accounts", () => {
  it("sniffs the file as iXBRL whatever it is called, and reads it as a Company book", async () => {
    const bytes = fixture("diya-2025-accounts.xhtml");
    expect(await detectBookSource(bytes, "accounts.pdf")).toBe("ixbrl");
    const source = await readBookSource(bytes, "accounts.pdf");
    expect(source.kind).toBe("ixbrl");
    expect(source.product).toBe("ltd");
    expect(source.book.entityInformation["diya-gl:product"]).toBe("Company");
    expect(source.book.entityInformation["diya-gl:companyNumber"]).toBe("06846849");
    expect(source.book.entityInformation.organizationIdentifier).toBe("DIY ACCOUNTING LIMITED");
    expect(source.book.documentInfo).toMatchObject({ periodCoveredStart: "2024-04-01", periodCoveredEnd: "2025-03-31" });
    expect(source.comparative.book.documentInfo).toMatchObject({ periodCoveredStart: "2023-04-01", periodCoveredEnd: "2024-03-31" });
  });

  it("returns books that pass the published schemas", async () => {
    const source = await readBookSource(fixture("diya-2025-accounts.xhtml"), "x");
    for (const [book, lines] of [
      [source.book, source.lines],
      [source.comparative.book, source.comparative.lines],
    ]) {
      expect(validateBook(book).valid).toBe(true);
      expect(validateLines(lines, book).valid).toBe(true);
    }
  });

  it("gives the file's year the totals the document shows", async () => {
    const source = await readBookSource(fixture("diya-2025-accounts.xhtml"), "x");
    const results = await resultsOf(source.book, source.lines);
    // Turnover 7,639 and other operating income 22; expenses 2,482; net assets 134.
    expectTotals(totals(results), {
      turnover: 7661,
      profitBeforeTax: 5179,
      fixedAssets: 0,
      currentAssets: 3353,
      creditorsWithinOneYear: 3219,
      creditorsAfterOneYear: 0,
      netAssets: 134,
      capitalAndReserves: 134,
    });
  });

  it("gives the year before the totals its comparatives show", async () => {
    const source = await readBookSource(fixture("diya-2025-accounts.xhtml"), "x");
    const results = await resultsOf(source.comparative.book, source.comparative.lines);
    // Turnover 8,908 and other operating income 36; expenses 3,014; net assets 102.
    expectTotals(totals(results), {
      turnover: 8944,
      profitBeforeTax: 5930,
      fixedAssets: 0,
      currentAssets: 3409,
      creditorsWithinOneYear: 3307,
      creditorsAfterOneYear: 0,
      netAssets: 102,
      capitalAndReserves: 102,
    });
  });

  it("balances the trial balance at the start and the end of each year", async () => {
    const source = await readBookSource(fixture("diya-2025-accounts.xhtml"), "x");
    for (const [book, lines] of [
      [source.book, source.lines],
      [source.comparative.book, source.comparative.lines],
    ]) {
      const results = await resultsOf(book, lines);
      closeTo(results.TrialBalance.D91, 0);
      closeTo(results.TrialBalance.EJ91, 0);
    }
  });

  it("agrees with the file on the tax, so names no difference", async () => {
    const source = await readBookSource(fixture("diya-2025-accounts.xhtml"), "x");
    expect(source.differences).toEqual([]);
    const results = await resultsOf(source.book, source.lines);
    // The file's tax is 984; the engine works 19% of 5,179.
    closeTo(results["PubP&L"].F50, 984);
  });

  it("states the opening balance sheet as the prior-year balance sheet of the file", async () => {
    const { book, lines } = await readBookSource(fixture("diya-2025-accounts.xhtml"), "x");
    const opening = lines.filter((line) => line.documentReference === "OB-001");
    expect(opening.map((line) => [line.accountMainID, line.debitCreditCode, line.amount])).toEqual([
      ["1200", "D", 3409],
      ["2100", "C", 3307],
      ["3100", "C", 102],
    ]);
    expect(book.openingBalances).toEqual({ bankAccounts: { 1200: 3409 }, tradeCreditors: 3307, retainedEarnings: 102 });
  });

  it("works the year before's opening balance sheet back from its closing one", async () => {
    const { comparative } = await readBookSource(fixture("diya-2025-accounts.xhtml"), "x");
    const opening = comparative.lines.filter((line) => line.documentReference === "OB-001");
    // 3100 and 1200 each less the year's profit: the reserves start below nil and the account overdrawn.
    expect(opening.find((line) => line.accountMainID === "3100")).toMatchObject({ debitCreditCode: "D" });
    expect(opening.find((line) => line.accountMainID === "1200")).toMatchObject({ debitCreditCode: "C" });
    expect(comparative.book.documentInfo.entriesComment).toMatch(/worked back from the file's prior-year balance sheet/);
  });

  it("writes one line for each tagged line, each traced to its fact by its document reference", async () => {
    const { lines, comparative } = await readBookSource(fixture("diya-2025-accounts.xhtml"), "x");
    const posted = (year) =>
      year
        .filter((line) => line.documentReference.startsWith("IXBRL-"))
        .map((line) => [line.documentReference, line.sourceJournalID, line.accountMainID, line.amount]);
    expect(posted(lines)).toEqual([
      ["IXBRL-TurnoverRevenue", "sales", "4000", 7639],
      ["IXBRL-OtherOperatingIncomeFormat2", "sales", "4003", 22],
      ["IXBRL-OtherOperatingExpensesFormat2", "purchases", "5501", 2482],
      ["IXBRL-Debtors", "bank", "1200", 7661],
      ["IXBRL-Creditors", "bank", "1200", 2570],
      ["IXBRL-CorporationTaxPayable", "bank", "1200", 984.01],
      ["IXBRL-Equity", "bank", "1200", 4162.99],
    ]);
    expect(posted(comparative.lines).slice(0, 3)).toEqual([
      ["IXBRL-TurnoverRevenue", "sales", "4000", 8908],
      ["IXBRL-OtherOperatingIncomeFormat2", "sales", "4003", 36],
      ["IXBRL-OtherOperatingExpensesFormat2", "purchases", "5501", 3014],
    ]);
  });

  it("does not post the file's tax charge, which diya-gl works", async () => {
    const { lines } = await readBookSource(fixture("diya-2025-accounts.xhtml"), "x");
    expect(lines.some((line) => line.documentReference === "IXBRL-TaxTaxCreditOnProfitOrLossOnOrdinaryActivities")).toBe(false);
  });

  it("says the book is a summary from an iXBRL file", async () => {
    const { book } = await readBookSource(fixture("diya-2025-accounts.xhtml"), "x");
    expect(book.documentInfo.entriesComment).toMatch(/^Summary of the figures in an iXBRL accounts file/);
  });

  it("returns the accounts and the facts it did not map", async () => {
    const source = await readBookSource(fixture("diya-2025-accounts.xhtml"), "x");
    expect(source.accounts.regime).toBe("micro");
    expect(source.accounts.company.number).toBe("06846849");
    expect(source.unmapped.map((fact) => fact.concept)).toEqual([
      "GeneralDescriptionAnyOff-balanceSheetArrangementsIncludingNaturePurposeFinancialImpactOnEntity",
    ]);
  });

  it("passes what the page expects of the file to the checks and refuses a mismatch", async () => {
    const bytes = fixture("diya-2025-accounts.xhtml");
    await expect(readBookSource(bytes, "x", { expect: { companyNumber: "01234567" } })).rejects.toThrow(IxbrlError);
    const source = await readBookSource(bytes, "x", { expect: { companyNumber: "06846849", regime: "micro", periodEnd: "2025-03-31" } });
    expect(source.accounts.period.end).toBe("2025-03-31");
  });
});

describe("the builders' small company accounts, read back", () => {
  it("reproduces each year's totals, to the pound", async () => {
    const source = await readBookSource(fixture("builder-small-consistent.xhtml"), "x");
    expectTotals(totals(await resultsOf(source.book, source.lines)), {
      turnover: 50000,
      profitBeforeTax: 5100,
      fixedAssets: 10000,
      currentAssets: 13600,
      creditorsWithinOneYear: 2469,
      creditorsAfterOneYear: 2000,
      netAssets: 19131,
      capitalAndReserves: 19131,
    });
    expectTotals(totals(await resultsOf(source.comparative.book, source.comparative.lines)), {
      turnover: 40000,
      profitBeforeTax: 3000,
      fixedAssets: 9500,
      currentAssets: 9500,
      creditorsWithinOneYear: 2500,
      creditorsAfterOneYear: 1500,
      netAssets: 15000,
      capitalAndReserves: 15000,
    });
  });

  it("names the Corporation Tax the book works against the file's, and keeps the file's figure for the accounts", async () => {
    const source = await readBookSource(fixture("builder-small-consistent.xhtml"), "x");
    // Full expensing of the 1,000 addition lowers the engine's charge on 5,100 to 874; the file states 969.
    expect(source.differences).toEqual([
      "Current year: the book works 874 Corporation Tax; the file states 969. The accounts filed keep the file's figure.",
    ]);
    expect(source.accounts.profitAndLoss.currentYear.tax).toBe(969);
  });

  it("posts bank interest as a receipt coded K, net of the tax deducted, which the engine grosses back to the file's figure", async () => {
    const source = await readBookSource(fixture("builder-small-consistent.xhtml"), "x");
    const interest = source.lines.filter((line) => line.sourceJournalID === "bank" && line["diya-gl:bankCode"] === "K");
    expect(interest).toHaveLength(1);
    expect(interest[0]).toMatchObject({
      debitCreditCode: "D",
      accountMainID: "1200",
      amount: 81,
      documentReference: "IXBRL-OtherInterestReceivableSimilarIncomeFinanceIncome",
    });
    const results = await resultsOf(source.book, source.lines);
    closeTo(results["PubP&L"].F49 - results["PubP&L"].F46, 100);
  });

  it("registers an asset for each class of the fixed asset note, with the rate that gives the tagged charge", async () => {
    const source = await readBookSource(fixture("builder-small-consistent.xhtml"), "x");
    expect(source.book.fixedAssets).toEqual([
      {
        assetID: "FA-IXBRL-landBuildings",
        class: "landBuildings",
        description: "Land and buildings",
        cost: 6000,
        accumulatedDepreciation: 0,
        depreciationRate: 0,
      },
      {
        assetID: "FA-IXBRL-computerEquipment",
        class: "computerTechnology",
        description: "Computer equipment",
        cost: 5000,
        accumulatedDepreciation: 1500,
        depreciationRate: 0.08,
      },
    ]);
    // The addition of 1,000 is bought in the year and takes the plant rate (10%), so the computers held take the other 400.
    const addition = source.lines.find((line) => line.documentReference === "IXBRL-PropertyPlantEquipmentAdditions");
    expect(addition).toMatchObject({ sourceJournalID: "purchases", accountMainID: "5900", amount: 1000 });
    const notes = (await resultsOf(source.book, source.lines)).PubNotes;
    expect(notes.G15).toBeCloseTo(500, 2);
    expect(notes.E15).toBeCloseTo(400, 2);
    expect(notes.C15).toBeCloseTo(100, 2);
  });

  it("reads the register's own depreciationRate in the Company calculator, and the class rate where it states none", async () => {
    const source = await readBookSource(fixture("builder-small-consistent.xhtml"), "x");
    const withOwnRate = await resultsOf(source.book, source.lines);
    const withoutRate = structuredClone(source.book);
    for (const asset of withoutRate.fixedAssets) delete asset.depreciationRate;
    const classRate = await resultsOf(withoutRate, source.lines);
    // Computer equipment's class rate is 33% of 5,000 cost: 1,650 on the assets held, plus 100 on the addition.
    expect(withOwnRate.PubNotes.G15).toBeCloseTo(500, 2);
    expect(classRate.PubNotes.E15).toBeCloseTo(1650, 2);
    expect(classRate.PubNotes.G15).toBeCloseTo(1750, 2);
  });

  it("balances the trial balance", async () => {
    const source = await readBookSource(fixture("builder-small-consistent.xhtml"), "x");
    const results = await resultsOf(source.book, source.lines);
    closeTo(results.TrialBalance.D91, 0);
    closeTo(results.TrialBalance.EJ91, 0);
  });

  it("names the difference when the file's own year does not follow from its profit", async () => {
    const source = await readBookSource(fixture("builder-small.xhtml"), "x");
    // 14,900 of reserves a year earlier and a profit after tax of 4,100 do not make the 19,900 the file states.
    expect(source.differences.join(" ")).toMatch(/the book's profit and loss account is 19126 and the file's 19900/);
    expect(source.differences.join(" ")).toMatch(/the book works 874 Corporation Tax; the file states 1000/);
  });
});

describe("the builders' other accounts, read back", () => {
  it("states a filleted file's year from the movement in its net assets, with the tax the engine works put back", async () => {
    const source = await readBookSource(fixture("builder-small-filleted.xhtml"), "x");
    expect(source.accounts.filleted).toBe(true);
    expectTotals(totals(await resultsOf(source.book, source.lines)), {
      fixedAssets: 10000,
      currentAssets: 15000,
      creditorsWithinOneYear: 3000,
      creditorsAfterOneYear: 2000,
      netAssets: 20000,
      capitalAndReserves: 20000,
    });
    const profit = source.lines.find((line) => line.documentReference === "IXBRL-NetAssetsLiabilities");
    expect(profit).toMatchObject({ sourceJournalID: "sales", accountMainID: "4000" });
    expect(source.book.documentInfo.entriesComment).toMatch(/^Summary of the figures in an iXBRL accounts file/);
  });

  it("reads a micro-entity file with no profit and loss account", async () => {
    const source = await readBookSource(fixture("builder-micro.xhtml"), "x");
    expectTotals(totals(await resultsOf(source.book, source.lines)), {
      fixedAssets: 1000,
      currentAssets: 5000,
      creditorsWithinOneYear: 2000,
      netAssets: 4000,
      capitalAndReserves: 4000,
    });
    expectTotals(totals(await resultsOf(source.comparative.book, source.comparative.lines)), {
      fixedAssets: 900,
      currentAssets: 3500,
      creditorsWithinOneYear: 1500,
      netAssets: 2900,
    });
  });

  it("reads the dormant accounts as a book with no postings beyond the opening balance sheet", async () => {
    const source = await readBookSource(fixture("builder-micro-dormant.xhtml"), "x");
    expect(source.lines.every((line) => line.documentReference === "OB-001" || line.documentReference.startsWith("IXBRL-"))).toBe(true);
    expectTotals(totals(await resultsOf(source.book, source.lines)), { currentAssets: 100, netAssets: 100, capitalAndReserves: 100 });
    expect(source.differences).toEqual([]);
  });
});

describe("another vendor's files", () => {
  it.each([
    ["adp-micro.xhtml", { currentAssets: 6005, creditorsWithinOneYear: 5791, netAssets: 214 }],
    ["adp-dormant.xhtml", { currentAssets: 100, netAssets: 100 }],
    ["adp-small-filleted.xhtml", { currentAssets: 100, netAssets: 100 }],
  ])("reproduces the totals of %s", async (name, expected) => {
    const source = await readBookSource(fixture(name), "x");
    expect(source.differences).toEqual([]);
    expectTotals(totals(await resultsOf(source.book, source.lines)), expected);
  });

  it("reads a small company's file with a note, and names the tax the file leaves out", async () => {
    const source = await readBookSource(fixture("adp-small-full.xhtml"), "x");
    const results = await resultsOf(source.book, source.lines);
    expectTotals(totals(results), { turnover: 46099, profitBeforeTax: 9064, fixedAssets: 14568, creditorsAfterOneYear: 0 });
    // The file states no Corporation Tax on 9,064 of profit. The engine works 19% of it, which the book cannot pay out of
    // reserves that only grew by the profit, so its net assets are the file's less that tax.
    expect(Math.round(results["PubP&L"].F50)).toBe(1425);
    expect(source.differences).toEqual([
      "Current year: the book's profit and loss account is 85643.01 and the file's 87068.",
      "Current year: the book's net assets are 85643.01 and the file's 87069.",
    ]);
  });
});

describe("a Format 2 small company file", () => {
  it("reproduces each year's profit before tax and net assets", async () => {
    const source = await readBookSource(fixture("adp-small-format2.xhtml"), "x");
    expectTotals(totals(await resultsOf(source.book, source.lines)), {
      turnover: 32400,
      profitBeforeTax: 8968,
      fixedAssets: 900,
      currentAssets: 4200,
      netAssets: 5100,
    });
    expectTotals(totals(await resultsOf(source.comparative.book, source.comparative.lines)), {
      turnover: 29800,
      profitBeforeTax: 7962,
      fixedAssets: 750,
      currentAssets: 850,
      netAssets: 1600,
    });
  });

  it("posts each tagged line to the account the mapping names", async () => {
    const source = await readBookSource(fixture("adp-small-format2.xhtml"), "x");
    const posted = Object.fromEntries(
      source.lines
        .filter((line) => line.documentReference.startsWith("IXBRL-"))
        .map((line) => [line.documentReference, line.accountMainID]),
    );
    expect(posted).toMatchObject({
      "IXBRL-TurnoverRevenue": "4000",
      "IXBRL-RawMaterialsConsumablesUsed": "5000",
      "IXBRL-StaffCostsEmployeeBenefitsExpense": "5101",
    });
  });

  const nature = (extra) =>
    new TextEncoder().encode(
      ixbrlDocument({
        contexts: [
          context("CY", { start: "2024-04-01", end: "2025-03-31" }),
          context("PY", { start: "2023-04-01", end: "2024-03-31" }),
          context("CY_END", { instant: "2025-03-31" }),
          context("PY_END", { instant: "2024-03-31" }),
        ].join(""),
        hidden: "",
        body: [
          words("uk-bus:StartDateForPeriodCoveredByReport", "CY_END", "2024-04-01"),
          words("uk-bus:EndDateForPeriodCoveredByReport", "CY_END", "2025-03-31"),
          money("core:FixedAssets", "CY_END", "100"),
          money("core:FixedAssets", "PY_END", "100"),
          money("core:Equity", "CY_END", "150"),
          money("core:Equity", "PY_END", "120"),
          money("core:TurnoverRevenue", "CY", "1,000"),
          money("core:TurnoverRevenue", "PY", "900"),
          ...extra,
        ].join(""),
      }),
    );

  it("names the difference when the file's change in stocks is not the movement of its stock", async () => {
    const source = await readBookSource(
      nature([
        money("core:TotalInventories", "CY_END", "50"),
        money("core:TotalInventories", "PY_END", "20"),
        money("core:IncreaseDecreaseInStocksInventoriesFinishedGoodsWorkInProgress", "CY", "10"),
        money("core:RawMaterialsConsumablesUsed", "CY", "300"),
      ]),
      "x",
    ).catch((error) => error);
    expect(source.differences ?? [source.message]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("the file states a change in stocks of 10 and its balance sheets a stock movement of 30"),
      ]),
    );
  });
});

describe("fixed asset disposals", () => {
  const PPE = "core:PropertyPlantEquipmentClassesDimension";
  const EQUITY = "core:EquityClassesDimension";
  const contexts =
    [
      context("CY", { start: "2024-04-01", end: "2025-03-31" }),
      context("PY", { start: "2023-04-01", end: "2024-03-31" }),
      context("CY_END", { instant: "2025-03-31" }),
      context("PY_END", { instant: "2024-03-31" }),
      context("PLANT_PY_END", { instant: "2024-03-31", members: [[PPE, "core:PlantMachinery"]] }),
      context("PLANT_CY", { start: "2024-04-01", end: "2025-03-31", members: [[PPE, "core:PlantMachinery"]] }),
      context("SHARE_PY_END", { instant: "2024-03-31", members: [[EQUITY, "core:ShareCapital"]] }),
      context("SHARE_CY_END", { instant: "2025-03-31", members: [[EQUITY, "core:ShareCapital"]] }),
      context("RETAINED_PY_END", { instant: "2024-03-31", members: [[EQUITY, "core:RetainedEarningsAccumulatedLosses"]] }),
      context("RETAINED_CY_END", { instant: "2025-03-31", members: [[EQUITY, "core:RetainedEarningsAccumulatedLosses"]] }),
    ].join("") + "";

  // A small company that sells all its plant (10,000 cost, 4,000 depreciation) in the year and says the
  // gain on the sale (a loss when negative) is netted into its administrative expenses.
  async function sourceWithGain(gain) {
    const administrativeExpenses = 5000 - gain;
    const profitBeforeTax = 12000 - administrativeExpenses;
    const cash = 4000 + 20000 - 13000 + (6000 + gain);
    const at = (name, context, value, attributes) => money(`core:${name}`, context, String(value), attributes);
    const sign = (value) => (value < 0 ? 'sign="-"' : "");
    const body = [
      words("uk-bus:StartDateForPeriodCoveredByReport", "CY_END", "2024-04-01"),
      words("uk-bus:EndDateForPeriodCoveredByReport", "CY_END", "2025-03-31"),
      at("PropertyPlantEquipmentGrossCost", "PLANT_PY_END", 10000),
      at("AccumulatedDepreciationImpairmentPropertyPlantEquipment", "PLANT_PY_END", 4000),
      at("DisposalsPropertyPlantEquipment", "PLANT_CY", 10000),
      at("DisposalsDecreaseInDepreciationImpairmentPropertyPlantEquipment", "PLANT_CY", 4000),
      at("FixedAssets", "PY_END", 6000),
      at("FixedAssets", "CY_END", 0),
      at("CashBankOnHand", "PY_END", 4000),
      at("CashBankOnHand", "CY_END", cash),
      at("CurrentAssets", "PY_END", 4000),
      at("CurrentAssets", "CY_END", cash),
      at("TradeCreditorsTradePayables", "PY_END", 1000),
      at("TradeCreditorsTradePayables", "CY_END", 1000),
      at("NetCurrentAssetsLiabilities", "PY_END", 3000),
      at("NetCurrentAssetsLiabilities", "CY_END", cash - 1000),
      at("TotalAssetsLessCurrentLiabilities", "PY_END", 9000),
      at("TotalAssetsLessCurrentLiabilities", "CY_END", cash - 1000),
      at("NetAssetsLiabilities", "PY_END", 9000),
      at("NetAssetsLiabilities", "CY_END", cash - 1000),
      at("Equity", "SHARE_PY_END", 100),
      at("Equity", "SHARE_CY_END", 100),
      at("Equity", "RETAINED_PY_END", 8900),
      at("Equity", "RETAINED_CY_END", 8900 + profitBeforeTax),
      at("Equity", "PY_END", 9000),
      at("Equity", "CY_END", cash - 1000),
      at("TurnoverRevenue", "PY", 10000),
      at("TurnoverRevenue", "CY", 20000),
      at("CostSales", "PY", 4000),
      at("CostSales", "CY", 8000),
      at("GrossProfitLoss", "PY", 6000),
      at("GrossProfitLoss", "CY", 12000),
      at("AdministrativeExpenses", "PY", 2000),
      at("AdministrativeExpenses", "CY", administrativeExpenses),
      at("OperatingProfitLoss", "PY", 4000),
      at("OperatingProfitLoss", "CY", profitBeforeTax),
      at("ProfitLossOnOrdinaryActivitiesBeforeTax", "PY", 4000),
      at("ProfitLossOnOrdinaryActivitiesBeforeTax", "CY", profitBeforeTax),
      at("TaxTaxCreditOnProfitOrLossOnOrdinaryActivities", "PY", 0),
      at("TaxTaxCreditOnProfitOrLossOnOrdinaryActivities", "CY", 0),
      at("ProfitLoss", "PY", 4000),
      at("ProfitLoss", "CY", profitBeforeTax),
      at("GainLossOnDisposalsPropertyPlantEquipment", "CY", Math.abs(gain), sign(gain)),
    ].join("");
    const bytes = ixbrlDocument({ contexts, body });
    return { source: await readBookSource(new TextEncoder().encode(bytes), "x"), profitBeforeTax };
  }

  const saleLines = (source) => source.lines.filter((line) => line.documentReference === "IXBRL-DisposalsPropertyPlantEquipment");
  const expenseLine = (source) => source.lines.find((line) => line.documentReference === "IXBRL-AdministrativeExpenses");

  it("posts a disposal with a gain as a sale at the net book value plus the gain, and takes the gain out of the expenses", async () => {
    const { source, profitBeforeTax } = await sourceWithGain(500);
    expect(saleLines(source)).toHaveLength(1);
    expect(saleLines(source)[0]).toMatchObject({ sourceJournalID: "sales", accountMainID: "4006", amount: 6500 });
    expect(expenseLine(source)).toMatchObject({ sourceJournalID: "purchases", accountMainID: "5501", amount: 5000 });
    expect(source.book.fixedAssets).toEqual([
      expect.objectContaining({
        class: "plantMachinery",
        cost: 10000,
        accumulatedDepreciation: 4000,
        depreciationRate: 0,
        taxWrittenDownValue: 6000,
      }),
    ]);
    const results = await resultsOf(source.book, source.lines);
    closeTo(results.PubBalSht.F6, 0);
    closeTo(results["PubP&L"].F49, profitBeforeTax);
    expect(source.differences.filter((text) => /dispos|fall by/.test(text))).toEqual([]);
  });

  it("posts a disposal with a loss as a sale at the net book value less the loss, and puts the loss back in the expenses", async () => {
    const { source, profitBeforeTax } = await sourceWithGain(-1000);
    expect(saleLines(source)).toHaveLength(1);
    expect(saleLines(source)[0]).toMatchObject({ sourceJournalID: "sales", accountMainID: "4006", amount: 5000 });
    expect(expenseLine(source)).toMatchObject({ sourceJournalID: "purchases", accountMainID: "5501", amount: 5000 });
    const results = await resultsOf(source.book, source.lines);
    closeTo(results.PubBalSht.F6, 0);
    closeTo(results["PubP&L"].F49, profitBeforeTax);
    expect(source.differences.filter((text) => /dispos|fall by/.test(text))).toEqual([]);
  });
});

describe("a plain XBRL instance", () => {
  const instance = xbrlInstance(
    `<uk-bus:UKCompaniesHouseRegisteredNumber contextRef="CY">12345678</uk-bus:UKCompaniesHouseRegisteredNumber>
<uk-bus:EntityCurrentLegalOrRegisteredName contextRef="CY">Instance Ltd</uk-bus:EntityCurrentLegalOrRegisteredName>
<uk-bus:StartDateForPeriodCoveredByReport contextRef="CY_END">2024-04-01</uk-bus:StartDateForPeriodCoveredByReport>
<uk-bus:EndDateForPeriodCoveredByReport contextRef="CY_END">2025-03-31</uk-bus:EndDateForPeriodCoveredByReport>
<core:FixedAssets contextRef="CY_END" unitRef="GBP" decimals="0">1000</core:FixedAssets>
<core:FixedAssets contextRef="PY_END" unitRef="GBP" decimals="0">900</core:FixedAssets>
<core:CurrentAssets contextRef="CY_END" unitRef="GBP" decimals="0">3000</core:CurrentAssets>
<core:CurrentAssets contextRef="PY_END" unitRef="GBP" decimals="0">2000</core:CurrentAssets>
<core:Equity contextRef="CY_END" unitRef="GBP" decimals="0">4000</core:Equity>
<core:Equity contextRef="PY_END" unitRef="GBP" decimals="0">2900</core:Equity>`,
  );

  it("is sniffed as xbrl and reads as a Company book", async () => {
    const bytes = new TextEncoder().encode(instance);
    expect(await detectBookSource(bytes, "accounts.xml")).toBe("xbrl");
    const source = await readBookSource(bytes, "accounts.xml");
    expect(source.kind).toBe("xbrl");
    expect(source.product).toBe("ltd");
    expect(source.accounts.company).toEqual({ number: "12345678", name: "Instance Ltd" });
    expectTotals(totals(await resultsOf(source.book, source.lines)), { fixedAssets: 1000, currentAssets: 3000, netAssets: 4000 });
  });
});

describe("the other kinds are unchanged", () => {
  it("still refuses a file that is none of the kinds", async () => {
    await expect(readBookSource(new TextEncoder().encode("not a book"), "notes.txt")).rejects.toThrow(UnknownBookSourceError);
    expect(await detectBookSource(new TextEncoder().encode("<html><body/></html>"), "page.html")).toBe("unknown");
  });

  it("names iXBRL accounts among the kinds it reads", async () => {
    await expect(readBookSource(new TextEncoder().encode("nothing"), "x")).rejects.toThrow(/iXBRL accounts file/);
  });

  it("refuses an iXBRL file it cannot read with a message a customer reads", async () => {
    await expect(readBookSource(fixture("doctored-unknown-format.xhtml"), "x")).rejects.toThrow(/ixt2:numfoo/);
    await expect(readBookSource(fixture("doctored-unbalanced.xhtml"), "x", { expect: { companyNumber: "06846849" } })).rejects.toThrow(
      /does not balance|net current assets/,
    );
  });
});

describe("a year diya-gl has no tax tables for", () => {
  it("refuses with a message that names the year", async () => {
    const contexts = [context("CY_END", { instant: "2041-03-31" }), context("PY_END", { instant: "2040-03-31" })].join("");
    const body = [
      words("uk-bus:StartDateForPeriodCoveredByReport", "CY_END", "2040-04-01"),
      words("uk-bus:EndDateForPeriodCoveredByReport", "CY_END", "2041-03-31"),
      money("core:FixedAssets", "CY_END", "100"),
      money("core:FixedAssets", "PY_END", "100"),
      money("core:Equity", "CY_END", "100"),
      money("core:Equity", "PY_END", "100"),
    ].join("");
    await expect(readBookSource(new TextEncoder().encode(ixbrlDocument({ contexts, body })), "x")).rejects.toThrow(
      /no tax tables for the year ending 2041-03-31/,
    );
  });
});
