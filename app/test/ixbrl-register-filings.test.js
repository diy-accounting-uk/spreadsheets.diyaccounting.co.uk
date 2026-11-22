// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// ixbrl-register-filings.test.js — filed accounts from the Companies House
// register, written by other accounts software, read as accounts. Each
// expected balance sheet is read by hand from the document's tagged facts and
// their contexts; a figure the document does not tag is absent.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { mapIxbrlAccounts } from "../lib/ixbrl-accounts.js";

const REGISTER = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures", "ixbrl", "register");
const filed = (name) => readFileSync(resolve(REGISTER, name));

const COMPANIES_HOUSE = "register-micro-entity-companies-house-both-years.xhtml";
const FILING_TOOL = "register-micro-entity-filing-tool-both-years.xhtml";
const IRIS = "register-small-company-filleted-iris-both-years.xhtml";
const ACORAH = "register-small-company-filleted-acorah-both-years.xhtml";
const DIGITA = "register-micro-entity-filleted-digita-current-year-only.xhtml";

describe("filed accounts from the register", () => {
  it("reads Companies House's own filing tool's micro-entity accounts, both years", () => {
    const accounts = mapIxbrlAccounts(filed(COMPANIES_HOUSE), { companyNumber: "14948707" });
    expect(accounts).toMatchObject({
      regime: "micro",
      period: { start: "2024-07-01", end: "2025-06-30" },
      approvalDate: "2026-03-24",
      dormant: false,
      filleted: false,
      profitAndLoss: null,
    });
    expect(accounts.balanceSheet.currentYear).toEqual({
      currentAssets: 4618,
      creditorsWithinOneYear: 1529,
      netCurrentAssets: 3089,
      totalAssetsLessCurrentLiabilities: 3089,
      netAssets: 3089,
      capitalAndReserves: 3089,
    });
    expect(accounts.balanceSheet.priorYear).toEqual({
      currentAssets: 3924,
      creditorsWithinOneYear: 1268,
      netCurrentAssets: 2656,
      totalAssetsLessCurrentLiabilities: 2656,
      netAssets: 2656,
      capitalAndReserves: 2656,
    });
  });

  it("reads the FRS 105 filing tool's micro-entity accounts, both years, with the accruals and deferred income its net assets take off", () => {
    const accounts = mapIxbrlAccounts(filed(FILING_TOOL), { companyNumber: "06487952" });
    expect(accounts).toMatchObject({
      regime: "micro",
      period: { start: "2024-02-01", end: "2025-01-31" },
      company: { number: "06487952" },
      approvalDate: "2025-10-21",
      dormant: false,
      profitAndLoss: null,
    });
    expect(accounts.balanceSheet.currentYear).toEqual({
      fixedAssets: 29615,
      currentAssets: 1590,
      creditorsWithinOneYear: 21159,
      netCurrentAssets: -19569,
      totalAssetsLessCurrentLiabilities: 10046,
      accrualsDeferredIncome: 1440,
      netAssets: 8606,
      capitalAndReserves: 8606,
    });
    expect(accounts.balanceSheet.priorYear).toEqual({
      fixedAssets: 34841,
      currentAssets: 4883,
      creditorsWithinOneYear: 24653,
      netCurrentAssets: -19770,
      totalAssetsLessCurrentLiabilities: 15071,
      accrualsDeferredIncome: 1200,
      netAssets: 13871,
      capitalAndReserves: 13871,
    });
    expect(accounts.unmapped.map((fact) => fact.concept)).not.toContain("AccruedLiabilitiesDeferredIncome");
  });

  // IRIS's creditors note lists trade creditors 963, corporation tax 0, other taxation 0, other
  // creditors 0, accruals 3,800 and directors' current accounts 183,649, which carries no tag, to a
  // total of 188,412. The tagged lines give 4,763, so the small company's lines do not explain the total.
  it("reads IRIS's balance sheet totals, and refuses the creditors whose untagged line its lines do not explain", () => {
    expect(() => mapIxbrlAccounts(filed(IRIS), { companyNumber: "04095977" })).toThrow(
      "The current-year creditors within one year of 188412 differ from the lines under it, which add up to 4763.",
    );
  });

  // Acorah tags its creditors of 13,859 on no maturity; its net current assets of -9,009 are 4,850 less
  // 13,859, which places them within one year. Its creditors note lists trade creditors 1,022, other
  // creditors 12,784, which carries no tag, and taxation and social security 53.
  it("places Acorah's creditors on no maturity within one year by its net current assets, and refuses the creditors whose untagged line its lines do not explain", () => {
    expect(() => mapIxbrlAccounts(filed(ACORAH), { companyNumber: "14618153" })).toThrow(
      "The current-year creditors within one year of 13859 differ from the lines under it, which add up to 1075.",
    );
  });

  // Digita tags the accruals and deferred income of 1,200 with sign="-", so the fact's value is -1,200,
  // while the document takes 1,200 off its net assets: 40,948 - 17,087 - 1,200 = 22,661.
  it("reads Digita's creditors on the financial instruments members, and refuses the accruals its minus sign makes negative", () => {
    expect(() => mapIxbrlAccounts(filed(DIGITA), { companyNumber: "16140216", firstAccounts: true })).toThrow(
      "The current-year balance sheet does not balance: fixed assets plus current assets less creditors is 25061, the file states net assets of 22661.",
    );
  });
});
