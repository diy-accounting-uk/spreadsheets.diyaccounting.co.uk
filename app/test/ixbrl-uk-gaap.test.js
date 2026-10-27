// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// ixbrl-uk-gaap.test.js — the read-time translation of the 2009-09-01 UK GAAP
// suite to FRS 102 names, row by row, the refusal of any other date, and two
// small company filings of DIY Accounting Limited read as accounts and as books.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readIxbrl } from "../lib/ixbrl-reader.js";
import { UK_GAAP_TO_FRS_102, UK_GAAP_DIMENSIONS_TO_FRS_102 } from "../lib/ixbrl-uk-gaap.js";
import { mapIxbrlAccounts } from "../lib/ixbrl-accounts.js";
import { readBookSource } from "../lib/diya-gl-interchange.js";
import { diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { loadTaxDataForBook } from "../lib/product-workbook.js";
import { context, ixbrlDocument, words, STANDARD_CONTEXTS } from "./helpers/ixbrl-document.js";

const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures", "ixbrl");
const fixture = (name) => readFileSync(resolve(FIXTURES, name));

const UK_GAAP = "http://www.xbrl.org/uk/gaap/core/2009-09-01";
const UK_BUS = "http://www.xbrl.org/uk/cd/business/2009-09-01";
const UK_DIREP = "http://www.xbrl.org/uk/reports/direp/2009-09-01";
const NAMESPACES = `xmlns:gaap="${UK_GAAP}" xmlns:ukbus="${UK_BUS}" xmlns:ukdirep="${UK_DIREP}"`;
const PREFIX = { "uk-gaap": "gaap", "uk-bus": "ukbus", "uk-direp": "ukdirep" };
const SCHEMA_REF = `${UK_GAAP}/uk-gaap-full-2009-09-01.xsd`;

const MATURITIES = "gaap:MaturitiesDimension";
const CLASSES = "gaap:TangibleFixedAssetClassesDimension";
const MEMBER_CONTEXTS = [
  context("WITHIN", { instant: "2025-03-31", members: [[MATURITIES, "gaap:WithinOneYear"]] }),
  context("AFTER", { instant: "2025-03-31", members: [[MATURITIES, "gaap:AfterOneYear"]] }),
  context("FIXTURES", { instant: "2025-03-31", members: [[CLASSES, "gaap:FixturesFittings"]] }),
  context("PLANT", { instant: "2025-03-31", members: [[CLASSES, "gaap:PlantMachinery"]] }),
].join("");

const document = (body, schemaRef = SCHEMA_REF, namespaces = NAMESPACES) =>
  ixbrlDocument({ body, schemaRef, namespaces, contexts: STANDARD_CONTEXTS + MEMBER_CONTEXTS });

const local = (key) => key.slice(key.indexOf("#") + 1);
const dimensionsOf = (fact) => Object.fromEntries(Object.entries(fact.dimensions).map(([d, m]) => [local(d), local(m)]));
const readOne = (module, concept, contextRef = "CY_END", extraBody = "") =>
  readIxbrl(document(words(`${PREFIX[module]}:${concept}`, contextRef, "7") + extraBody)).facts.find(
    (fact) => fact.sourceConcept === concept || fact.localName === concept,
  );

describe("the translation table", () => {
  it("holds one row for each UK GAAP name", () => {
    const names = UK_GAAP_TO_FRS_102.map((entry) => `${entry.module}:${entry.concept}`);
    expect(new Set(names).size).toBe(names.length);
    expect(UK_GAAP_TO_FRS_102).toHaveLength(72);
  });

  it.each(UK_GAAP_TO_FRS_102.map((entry) => [`${entry.module}:${entry.concept} -> ${entry.to}`, entry]))("%s", (_name, entry) => {
    const fact = readOne(entry.module, entry.concept);
    expect(fact.localName).toBe(entry.to);
    expect(fact.sourceConcept).toBe(entry.concept);
    expect(fact.value).toBe("7");
    expect(dimensionsOf(fact)).toEqual(entry.dimension ? { [entry.dimension]: entry.member } : {});
  });

  it("renames the maturity dimension a fact sits on", () => {
    const within = readOne("uk-gaap", "TradeCreditors", "WITHIN");
    expect(dimensionsOf(within)).toEqual({ MaturitiesOrExpirationPeriodsDimension: "WithinOneYear" });
    const after = readOne("uk-gaap", "Debtors", "AFTER");
    expect(dimensionsOf(after)).toEqual({ MaturitiesOrExpirationPeriodsDimension: "AfterOneYear" });
  });

  it("renames the fixed asset class dimension and the members the suites name differently", () => {
    expect(UK_GAAP_DIMENSIONS_TO_FRS_102.TangibleFixedAssetClassesDimension.to).toBe("PropertyPlantEquipmentClassesDimension");
    expect(dimensionsOf(readOne("uk-gaap", "TangibleFixedAssetsCostOrValuation", "FIXTURES"))).toEqual({
      PropertyPlantEquipmentClassesDimension: "FurnitureFittings",
    });
    expect(dimensionsOf(readOne("uk-gaap", "TangibleFixedAssetsCostOrValuation", "PLANT"))).toEqual({
      PropertyPlantEquipmentClassesDimension: "PlantMachinery",
    });
  });

  it("gives other operating income its Format 1 name when the file states cost of sales or gross profit, else Format 2", () => {
    const without = readOne("uk-gaap", "OtherOperatingIncome");
    expect(without.localName).toBe("OtherOperatingIncomeFormat2");
    const gross = words("gaap:CostSales", "CY_END", "3");
    expect(readOne("uk-gaap", "OtherOperatingIncome", "CY_END", gross).localName).toBe("OtherOperatingIncomeFormat1");
    const grossProfit = words("gaap:GrossProfitLoss", "CY_END", "3");
    expect(readOne("uk-gaap", "OtherOperatingIncome", "CY_END", grossProfit).localName).toBe("OtherOperatingIncomeFormat1");
  });

  it("keeps one fact when a total and the same total within one year agree, and the first when they differ", () => {
    const agree = readIxbrl(
      document(words("gaap:TradeCreditors", "CY_END", "7") + words("gaap:TradeCreditorsWithinOneYear", "CY_END", "7")),
    );
    expect(agree.facts).toHaveLength(1);
    const differ = readIxbrl(
      document(words("gaap:TradeCreditors", "CY_END", "7") + words("gaap:TradeCreditorsWithinOneYear", "CY_END", "9")),
    );
    expect(differ.facts.map((fact) => [fact.localName, fact.value])).toEqual([
      ["TradeCreditorsTradePayables", "7"],
      ["TradeCreditorsWithinOneYear", "9"],
    ]);
  });
});

describe("a UK GAAP name the table does not hold", () => {
  it("keeps its own name and reaches the unmapped list under it", () => {
    const body =
      words("ukbus:UKCompaniesHouseRegisteredNumber", "CY", "12345678") +
      words("ukbus:BalanceSheetDate", "CY_END", "2025-03-31") +
      words("gaap:StatementOnBasisMeasurementPreparationAccounts", "CY", "Historical cost.");
    const read = readIxbrl(document(body));
    const fact = read.facts.find((f) => f.localName === "StatementOnBasisMeasurementPreparationAccounts");
    expect(fact.namespace).toBe(UK_GAAP);
    expect(fact.sourceConcept).toBeUndefined();
    const accounts = mapIxbrlAccounts(read, { firstAccounts: true });
    expect(accounts.unmapped.map((entry) => entry.concept)).toContain("StatementOnBasisMeasurementPreparationAccounts");
  });
});

describe("a UK GAAP file of another date", () => {
  it("refuses, naming the date", () => {
    const changed = document(words("gaap:FixedAssets", "CY_END", "7"))
      .replaceAll("2009-09-01", "2012-01-01")
      .replace("uk-gaap-full-2012-01-01", "uk-gaap-2012-01-01");
    expect(() => readIxbrl(changed)).toThrow("This file uses the UK GAAP taxonomy of 2012-01-01; the form reads the 2009-09-01 suite.");
  });
});

// The filing for the year ending 31 March 2015, with a profit and loss reserve and trade debtors.
describe("DIY Accounting Limited's accounts for the year to 31 March 2015", () => {
  const accounts = () => mapIxbrlAccounts(fixture("uk-gaap-small-2015.xhtml"), { companyNumber: "06846849" });

  it("reads as a small company's accounts of the 2009-09-01 suite", () => {
    const result = accounts();
    expect(result.suite).toMatchObject({ family: "UK-GAAP", date: "2009-09-01" });
    expect(result.regime).toBe("small");
    expect(result.company).toEqual({ number: "06846849", name: "DIY ACCOUNTING LIMITED" });
    expect(result.period).toEqual({ start: "2014-04-01", end: "2015-03-31" });
    expect(result.priorPeriod).toEqual({ start: "2013-04-01", end: "2014-03-31" });
    expect(result.directors).toEqual(["Antony Christopher Cartwright", "Jane Elizabeth Grundy", "Samantha Ashley Cartwright"]);
    expect(result.signer).toBe("Samantha Ashley Cartwright");
    expect(result.approvalDate).toBe("2015-04-11");
  });

  it("gives the balance sheet of each year the figures the document shows", () => {
    const { currentYear, priorYear } = accounts().balanceSheet;
    expect(currentYear).toMatchObject({
      fixedAssets: 160,
      debtors: 500,
      cashAtBank: 21541,
      currentAssets: 22041,
      tradeCreditors: 8661,
      otherCreditors: 3508,
      creditorsWithinOneYear: 12169,
      netCurrentAssets: 9872,
      netAssets: 10032,
      calledUpShareCapital: 500,
      profitAndLossAccount: 9532,
      capitalAndReserves: 10032,
    });
    expect(priorYear).toMatchObject({
      fixedAssets: 325,
      debtors: 6223,
      cashAtBank: 11137,
      currentAssets: 17360,
      tradeCreditors: 1622,
      otherCreditors: 6063,
      creditorsWithinOneYear: 7685,
      netAssets: 10000,
      calledUpShareCapital: 500,
      profitAndLossAccount: 9500,
    });
  });

  it("lists the share, debtor and intangible note lines under their FRS 102 names, which no accounts figure takes", () => {
    const unmapped = accounts().unmapped.map((entry) => entry.concept);
    expect(unmapped).toEqual(
      expect.arrayContaining(["TradeDebtorsTradeReceivables", "OtherDebtors", "IntangibleAssets", "ParValueShare", "ShareCapital"]),
    );
    for (const ukGaapName of [
      "TradeDebtors",
      "IntangibleFixedAssets",
      "ShareCapitalAllottedCalledUpPaid",
      "StocksInventory",
      "TotalInventories",
    ]) {
      expect(unmapped).not.toContain(ukGaapName);
    }
  });

  it("refuses a company number that is not the file's", () => {
    expect(() => mapIxbrlAccounts(fixture("uk-gaap-small-2015.xhtml"), { companyNumber: "01234567" })).toThrow(/is for company 06846849/);
  });

  it("refuses to be read as micro-entity accounts", () => {
    expect(() => mapIxbrlAccounts(fixture("uk-gaap-small-2015.xhtml"), { regime: "micro" })).toThrow(
      /small company's accounts; this page takes a micro-entity's accounts/,
    );
  });
});

describe("DIY Accounting Limited's abbreviated accounts for the year to 31 March 2016", () => {
  const accounts = () => mapIxbrlAccounts(fixture("uk-gaap-small-2016.xhtml"), { companyNumber: "06846849" });

  it("reads with no profit and loss account, as filleted accounts", () => {
    const result = accounts();
    expect(result.period).toEqual({ start: "2015-04-01", end: "2016-03-31" });
    expect(result.hasProfitAndLoss).toBe(false);
    expect(result.filleted).toBe(true);
    expect(result.profitAndLoss).toBeNull();
    expect(result.directors).toEqual(["Antony Cartwright"]);
  });

  it("gives the balance sheet of each year the figures the document shows", () => {
    const { currentYear, priorYear } = accounts().balanceSheet;
    expect(currentYear).toMatchObject({
      fixedAssets: 316,
      cashAtBank: 20102,
      currentAssets: 20102,
      tradeCreditors: 104,
      otherCreditors: 4451,
      creditorsWithinOneYear: 4555,
      netCurrentAssets: 15547,
      totalAssetsLessCurrentLiabilities: 15863,
      netAssets: 15863,
      calledUpShareCapital: 500,
      profitAndLossAccount: 15363,
      capitalAndReserves: 15863,
    });
    expect(priorYear).toMatchObject({
      fixedAssets: 160,
      debtors: 500,
      cashAtBank: 21541,
      currentAssets: 22041,
      tradeCreditors: 155,
      otherCreditors: 3508,
      creditorsWithinOneYear: 3663,
      netAssets: 18538,
      profitAndLossAccount: 18038,
    });
  });

  it("lists bank borrowings under the FRS 102 name, which no accounts figure takes", () => {
    const unmapped = accounts().unmapped.map((entry) => entry.concept);
    expect(unmapped).toContain("BankBorrowingsOverdrafts");
    expect(unmapped).not.toContain("BankBorrowingsOverdraftsWithinOneYear");
  });

  it("keeps the UK GAAP name of each fixed asset line", () => {
    expect(accounts().sourceConcepts).toMatchObject({
      PropertyPlantEquipment: "TangibleFixedAssets",
      TotalInventories: "StocksInventory",
      CashBankOnHand: "CashBankInHand",
      TaxationSocialSecurityPayable: "TaxationSocialSecurityDueWithinOneYear",
      Equity: "ShareholderFunds",
    });
  });
});

// The tax tables begin with the year to 2020, so the same filing is moved on nine years to build its books.
describe("the books of the 2016 filing", () => {
  const MOVES = [
    ["2016-03-31", "2025-03-31"],
    ["31 March 2016", "31 March 2025"],
    ["2015-06-15", "2025-06-15"],
    ["2015-04-01", "2024-04-01"],
    ["2015-03-31", "2024-03-31"],
    ["2014-04-01", "2023-04-01"],
    ["2014-03-31", "2023-03-31"],
  ];
  const moved = () =>
    Buffer.from(MOVES.reduce((text, [from, to]) => text.replaceAll(from, to), fixture("uk-gaap-small-2016.xhtml").toString("utf8")));

  const resultsOf = async (book, lines) => {
    const taxData = await loadTaxDataForBook(book);
    return calculateFromDiyaGl(book, lines, "ltd", taxData, diyaGlToScenario(book, lines, "ltd"));
  };
  const closeTo = (actual, expected) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);

  it("gives each year the totals the document shows", async () => {
    const source = await readBookSource(moved(), "accounts.xhtml");
    expect(source.kind).toBe("ixbrl");
    const current = await resultsOf(source.book, source.lines);
    closeTo(current.PubBalSht.F6, 316);
    closeTo(current.PubBalSht.E13, 20102);
    closeTo(current.PubBalSht.E20, 4555);
    closeTo(current.PubBalSht.F33, 15863);
    closeTo(current.PubBalSht.F39, 15863);
    const prior = await resultsOf(source.comparative.book, source.comparative.lines);
    closeTo(prior.PubBalSht.F6, 160);
    closeTo(prior.PubBalSht.E13, 22041);
    closeTo(prior.PubBalSht.E20, 3663);
    closeTo(prior.PubBalSht.F33, 18538);
  });

  it("writes the UK GAAP name of each line as its document reference", async () => {
    const source = await readBookSource(moved(), "accounts.xhtml");
    const references = new Set(source.lines.map((line) => line.documentReference));
    expect(references).toContain("IXBRL-TangibleFixedAssetsAdditions");
    expect(references).toContain("IXBRL-NetAssetsLiabilitiesIncludingPensionAssetLiability");
    expect(references).toContain("IXBRL-CreditorsDueWithinOneYear");
    expect(
      [...references].filter((reference) => reference.startsWith("IXBRL-") && /PropertyPlantEquipment|Equity$/.test(reference)),
    ).toEqual([]);
  });
});
