// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// derivations-uk-property.test.js — deriveUkPropertyPeriod and
// deriveUkPropertyAnnual over a small landlord book: each figure sums the
// postings on the accounts the chart names, net of VAT, inside the period; a
// field with no posting is omitted; the refusals name what is wrong.

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { describe, expect, test } from "vitest";

import {
  deriveUkPropertyAnnual,
  deriveUkPropertyPeriod,
  UK_PROPERTY_FIELDS,
  UK_PROPERTY_ACCOUNT_FIELD,
} from "../lib/derivations/uk-property.js";

const SCHEMA = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "web",
  "spreadsheets.diyaccounting.co.uk",
  "public",
  "schema",
  "diya-gl-book-v2.schema.json",
);

function account(description, field) {
  return field ? { accountMainDescription: description, [UK_PROPERTY_ACCOUNT_FIELD]: field } : { accountMainDescription: description };
}

function landlordBook(extraPurchases = {}) {
  return {
    documentInfo: { periodCoveredStart: "2025-04-06", periodCoveredEnd: "2026-04-05" },
    entityInformation: { "diya-gl:product": "SelfEmployed", "diya-gl:vatRegistered": false },
    accounts: {
      sales: {
        4000: account("Rent received", "income.periodAmount"),
        4001: account("Lease premium", "income.premiumsOfLeaseGrant"),
        4002: account("Reverse premium", "income.reversePremiums"),
        4003: account("Other property income", "income.otherIncome"),
        4004: account("Private use", "adjustments.privateUseAdjustment"),
        4009: account("Not property income"),
      },
      purchases: {
        5200: account("Utilities and ground rent", "expenses.premisesRunningCosts"),
        5400: account("Repairs", "expenses.repairsAndMaintenance"),
        5803: account("Mortgage interest", "expenses.financialCosts"),
        5800: account("Letting agent", "expenses.professionalFees"),
        5001: account("Cleaning", "expenses.costOfServices"),
        5002: account("Sundries", "expenses.other"),
        5804: account("Residential finance", "expenses.residentialFinancialCost"),
        5401: account("New appliances", "allowances.costOfReplacingDomesticItems"),
        5900: account("Boiler", "allowances.annualInvestmentAllowance"),
        5101: account("Not property"),
        ...extraPurchases,
      },
    },
  };
}

const sale = (n, date, id, amount, extra = {}) => ({
  entryNumber: `S-${n}`,
  sourceJournalID: "sales",
  postingDate: date,
  accountMainID: id,
  amount,
  taxRate: 0,
  ...extra,
});
const purchase = (n, date, id, amount, extra = {}) => ({
  entryNumber: `P-${n}`,
  sourceJournalID: "purchases",
  postingDate: date,
  accountMainID: id,
  amount,
  taxRate: 0,
  ...extra,
});

const LINES = [
  sale(1, "2025-04-06", "4000", 1000),
  sale(2, "2025-05-06", "4000", 1000),
  sale(3, "2025-07-10", "4000", 1000),
  sale(4, "2025-05-20", "4001", 500),
  sale(5, "2025-05-21", "4002", 250),
  sale(6, "2025-05-22", "4003", 75.5),
  sale(7, "2025-05-23", "4009", 9999),
  sale(8, "2025-05-30", "4004", 120),
  purchase(1, "2025-05-02", "5200", 300),
  purchase(2, "2025-05-03", "5400", 450.25),
  purchase(3, "2025-05-04", "5400", 100, { documentType: "credit-note" }),
  purchase(4, "2025-05-05", "5803", 210),
  purchase(5, "2025-05-06", "5800", 120, { taxRate: 0.2 }),
  purchase(6, "2025-05-07", "5001", 60),
  purchase(7, "2025-05-08", "5002", 15),
  purchase(8, "2025-05-09", "5804", 80),
  purchase(9, "2025-05-10", "5101", 7777),
  purchase(10, "2025-05-11", "5401", 640),
  purchase(11, "2025-05-12", "5900", 1800),
  purchase(12, "2025-07-12", "5400", 33),
  purchase(13, "2026-06-01", "5400", 11),
];

describe("the field names", () => {
  test("the book schema's ukPropertyField enum lists exactly the derivation's fields", () => {
    const schema = JSON.parse(readFileSync(SCHEMA, "utf8"));
    expect(schema.$defs.accountDefinition.properties[UK_PROPERTY_ACCOUNT_FIELD].enum).toEqual(UK_PROPERTY_FIELDS);
  });
});

describe("deriveUkPropertyPeriod", () => {
  test("income sums the postings on the named accounts inside the period", () => {
    const answer = deriveUkPropertyPeriod(landlordBook(), LINES, { periodStartDate: "2025-04-06", periodEndDate: "2025-07-05" });
    expect(answer.periodDates).toEqual({ periodStartDate: "2025-04-06", periodEndDate: "2025-07-05" });
    expect(answer.income).toEqual({ periodAmount: 2000, premiumsOfLeaseGrant: 500, reversePremiums: 250, otherIncome: 75.5 });
  });

  test("expenses sum by field, a credit note takes from its field and VAT is taken out", () => {
    const { expenses } = deriveUkPropertyPeriod(landlordBook(), LINES, { periodStartDate: "2025-04-06", periodEndDate: "2025-07-05" });
    expect(expenses).toEqual({
      premisesRunningCosts: 300,
      repairsAndMaintenance: 350.25,
      financialCosts: 210,
      professionalFees: 100,
      costOfServices: 60,
      other: 15,
      residentialFinancialCost: 80,
    });
  });

  test("a posting outside the period is left out, both ends inclusive", () => {
    const first = deriveUkPropertyPeriod(landlordBook(), LINES, { periodStartDate: "2025-07-10", periodEndDate: "2025-07-12" });
    expect(first.income).toEqual({ periodAmount: 1000 });
    expect(first.expenses).toEqual({ repairsAndMaintenance: 33 });
    expect(first.lines.map((line) => line.date)).toEqual(["2025-07-10", "2025-07-12"]);
  });

  test("an account with no property field, and an annual field, never reach the period", () => {
    const answer = deriveUkPropertyPeriod(landlordBook(), LINES, { periodStartDate: "2025-04-06", periodEndDate: "2026-04-05" });
    expect(answer.lines.some((line) => ["4009", "5101", "4004", "5401", "5900"].includes(line.account))).toBe(false);
    expect(answer.omitted).toContain("income.taxDeducted");
    expect(answer.omitted).toContain("expenses.consolidatedExpenses");
    expect(answer.omitted).not.toContain("income.periodAmount");
  });

  test("a field with no posting is omitted, never sent as zero", () => {
    const answer = deriveUkPropertyPeriod(landlordBook(), LINES, { periodStartDate: "2025-07-10", periodEndDate: "2025-07-12" });
    expect(answer.income).not.toHaveProperty("otherIncome");
    expect(answer.omitted).toContain("income.otherIncome");
    expect(answer.omitted.length + Object.keys(answer.income).length + Object.keys(answer.expenses).length).toBe(answer.fieldSlots.length);
  });

  test("a period with no posting answers empty figures and a warning", () => {
    const answer = deriveUkPropertyPeriod(landlordBook(), LINES, { periodStartDate: "2024-04-06", periodEndDate: "2024-07-05" });
    expect(answer.income).toEqual({});
    expect(answer.expenses).toEqual({});
    expect(answer.warnings).toHaveLength(1);
  });

  test("a book with no split of expenses answers the consolidated figure", () => {
    const book = landlordBook({ 5600: account("All costs", "expenses.consolidatedExpenses") });
    const lines = [sale(1, "2025-05-06", "4000", 900), purchase(1, "2025-05-07", "5600", 400)];
    const answer = deriveUkPropertyPeriod(book, lines, { periodStartDate: "2025-04-06", periodEndDate: "2025-07-05" });
    expect(answer.expenses).toEqual({ consolidatedExpenses: 400 });
  });

  test("consolidated expenses beside itemised expenses are refused", () => {
    const book = landlordBook({ 5600: account("All costs", "expenses.consolidatedExpenses") });
    const lines = [purchase(1, "2025-05-07", "5600", 400), purchase(2, "2025-05-08", "5400", 50)];
    expect(() => deriveUkPropertyPeriod(book, lines, { periodStartDate: "2025-04-06", periodEndDate: "2025-07-05" })).toThrow(
      /consolidated expenses and itemised expenses/,
    );
  });

  test("the refusals name what is wrong", () => {
    const period = { periodStartDate: "2025-04-06", periodEndDate: "2025-07-05" };
    expect(() => deriveUkPropertyPeriod(undefined, LINES, period)).toThrow(/requires a book and its lines/);
    expect(() => deriveUkPropertyPeriod(landlordBook(), LINES, { periodStartDate: "2025-04-06" })).toThrow(/YYYY-MM-DD/);
    expect(() => deriveUkPropertyPeriod(landlordBook(), LINES, { periodStartDate: "2025-08-01", periodEndDate: "2025-07-05" })).toThrow(
      /after it ends/,
    );
    const ltd = landlordBook();
    ltd.entityInformation["diya-gl:product"] = "Company";
    expect(() => deriveUkPropertyPeriod(ltd, LINES, period)).toThrow(/ltd/);
    const wrong = landlordBook({ 5600: account("Typo", "expenses.rentt") });
    expect(() => deriveUkPropertyPeriod(wrong, LINES, period)).toThrow(/not a UK property field/);
  });
});

describe("deriveUkPropertyAnnual", () => {
  test("the year's adjustments and allowances sum the named accounts", () => {
    const answer = deriveUkPropertyAnnual(landlordBook(), LINES, { taxYear: "2025-26" });
    expect(answer.taxYear).toBe("2025-26");
    expect(answer.adjustments).toEqual({ privateUseAdjustment: 120 });
    expect(answer.allowances).toEqual({ costOfReplacingDomesticItems: 640, annualInvestmentAllowance: 1800 });
  });

  test("the year defaults to the one the book's period end falls in", () => {
    expect(deriveUkPropertyAnnual(landlordBook(), LINES).taxYear).toBe("2025-26");
  });

  test("a posting in another tax year is left out", () => {
    const lines = [...LINES, purchase(20, "2026-04-06", "5900", 5000), purchase(21, "2025-04-05", "5900", 4000)];
    expect(deriveUkPropertyAnnual(landlordBook(), lines, { taxYear: "2025-26" }).allowances.annualInvestmentAllowance).toBe(1800);
    expect(deriveUkPropertyAnnual(landlordBook(), lines, { taxYear: "2026-27" }).allowances).toEqual({ annualInvestmentAllowance: 5000 });
  });

  test("the fields it cannot source are omitted and the elections are left to the page", () => {
    const answer = deriveUkPropertyAnnual(landlordBook(), LINES, { taxYear: "2025-26" });
    expect(answer.omitted).toContain("adjustments.balancingCharge");
    expect(answer.omitted).toContain("allowances.zeroEmissionsCarAllowance");
    expect(answer.omitted).not.toContain("allowances.annualInvestmentAllowance");
    expect(answer.leftToPage.map((entry) => entry.field)).toEqual([
      "allowances.propertyIncomeAllowance",
      "adjustments.nonResidentLandlord",
      "adjustments.rentARoom.jointlyLet",
    ]);
  });

  test("the refusals name what is wrong", () => {
    expect(() => deriveUkPropertyAnnual(landlordBook(), LINES, { taxYear: "2025/26" })).toThrow(/look like 2025-26/);
    expect(() => deriveUkPropertyAnnual(landlordBook(), LINES, { taxYear: "2025-27" })).toThrow(/consecutive years/);
    const noDates = landlordBook();
    delete noDates.documentInfo;
    expect(() => deriveUkPropertyAnnual(noDates, LINES)).toThrow(/taxYear is required/);
  });
});
