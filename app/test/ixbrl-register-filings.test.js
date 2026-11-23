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

  // IRIS's creditors note lists trade creditors 963 (2024: 104,422), taxation 0 (676), social security
  // and other taxes 0 (1,314), other creditors 0 (160), directors' current accounts 183,649 (203,407),
  // which carries no tag, and accruals 3,800 (3,325), to totals of 188,412 and 313,304. Its stated net
  // current assets are worked from those totals.
  it("reads IRIS's accounts, both years, with the creditors total above the lines it tags", () => {
    const accounts = mapIxbrlAccounts(filed(IRIS), { companyNumber: "04095977" });
    expect(accounts).toMatchObject({
      regime: "small",
      period: { start: "2024-11-01", end: "2025-10-31" },
      company: { number: "04095977" },
      approvalDate: "2026-05-14",
      dormant: false,
      filleted: true,
    });
    expect(accounts.balanceSheet.currentYear).toEqual({
      fixedAssets: 4834,
      stocks: 0,
      debtors: 13438,
      cashAtBank: 290899,
      currentAssets: 304337,
      tradeCreditors: 963,
      corporationTax: 0,
      otherCreditors: 0,
      taxationSocialSecurity: 0,
      accruals: 3800,
      creditorsWithinOneYear: 188412,
      netCurrentAssets: 115925,
      totalAssetsLessCurrentLiabilities: 120759,
      calledUpShareCapital: 110,
      profitAndLossAccount: 120649,
      capitalAndReserves: 120759,
    });
    expect(accounts.balanceSheet.priorYear).toEqual({
      fixedAssets: 6445,
      stocks: 140000,
      debtors: 92208,
      cashAtBank: 210352,
      currentAssets: 442560,
      tradeCreditors: 104422,
      corporationTax: 676,
      otherCreditors: 160,
      taxationSocialSecurity: 1314,
      accruals: 3325,
      creditorsWithinOneYear: 313304,
      netCurrentAssets: 129256,
      totalAssetsLessCurrentLiabilities: 135701,
      calledUpShareCapital: 110,
      profitAndLossAccount: 135591,
      capitalAndReserves: 135701,
    });
  });

  // Acorah tags its creditors of 13,859 on no maturity; its net current assets of -9,009 are 4,850 less
  // 13,859, which places them within one year. Its creditors note lists trade creditors 1,022 (2025: 576),
  // other creditors 12,784 (10,717), which carries no tag, and taxation and social security 53 (0).
  it("reads Acorah's accounts, both years, with its creditors on no maturity placed within one year by its net current assets", () => {
    const accounts = mapIxbrlAccounts(filed(ACORAH), { companyNumber: "14618153" });
    expect(accounts).toMatchObject({
      regime: "small",
      period: { start: "2025-02-01", end: "2026-01-31" },
      company: { number: "14618153" },
      approvalDate: "2026-03-06",
      dormant: false,
      filleted: true,
    });
    expect(accounts.balanceSheet.currentYear).toEqual({
      debtors: 2113,
      cashAtBank: 2737,
      currentAssets: 4850,
      tradeCreditors: 1022,
      taxationSocialSecurity: 53,
      creditorsWithinOneYear: 13859,
      netCurrentAssets: -9009,
      totalAssetsLessCurrentLiabilities: -9009,
      netAssets: -9009,
      calledUpShareCapital: 1,
      profitAndLossAccount: -9010,
    });
    expect(accounts.balanceSheet.priorYear).toEqual({
      debtors: 1112,
      cashAtBank: 6085,
      currentAssets: 7197,
      tradeCreditors: 576,
      taxationSocialSecurity: 0,
      creditorsWithinOneYear: 11293,
      netCurrentAssets: -4096,
      totalAssetsLessCurrentLiabilities: -4096,
      netAssets: -4096,
      calledUpShareCapital: 1,
      profitAndLossAccount: -4097,
    });
  });

  it("refuses a small company's creditors total above its lines when no stated total is worked from it", () => {
    const iris = filed(IRIS).toString("utf-8");
    const withoutWorkedTotals = iris.replace(
      /<ix:nonFraction contextRef="cfwd_31_10_2025"[^>]*name="ns5:(NetCurrentAssetsLiabilities|TotalAssetsLessCurrentLiabilities|Equity)"[^>]*>[^<]*<\/ix:nonFraction>/g,
      "",
    );
    expect(withoutWorkedTotals).not.toBe(iris);
    expect(() => mapIxbrlAccounts(withoutWorkedTotals, { companyNumber: "04095977" })).toThrow(
      "The current-year creditors within one year of 188412 differ from the lines under it, which add up to 4763.",
    );
  });

  it("refuses creditor lines that add up to more than their total", () => {
    const iris = filed(IRIS).toString("utf-8");
    const linesAboveTotal = iris.replace(
      /(contextRef="CreditorsHypercube_cfwd_31_10_2025_Set1"[^>]*name="ns5:TradeCreditorsTradePayables"[^>]*>)963</,
      "$1190,000<",
    );
    expect(linesAboveTotal).not.toBe(iris);
    expect(() => mapIxbrlAccounts(linesAboveTotal, { companyNumber: "04095977" })).toThrow(
      "The current-year creditors within one year of 188412 differ from the lines under it, which add up to 193800.",
    );
  });

  // Digita tags the accruals and deferred income of 1,200 with sign="-", so the fact's value is -1,200,
  // while the document takes 1,200 off its net assets: 40,948 - 17,087 - 1,200 = 22,661.
  it("reads Digita's first accounts, with the accruals its own totals take off read as positive and named in a note", () => {
    const accounts = mapIxbrlAccounts(filed(DIGITA), { companyNumber: "16140216", firstAccounts: true });
    expect(accounts).toMatchObject({
      regime: "micro",
      period: { start: "2024-12-17", end: "2025-12-31" },
      company: { number: "16140216" },
      approvalDate: "2026-07-29",
      dormant: false,
      firstAccounts: true,
      profitAndLoss: null,
    });
    expect(accounts.balanceSheet.currentYear).toEqual({
      fixedAssets: 28562,
      currentAssets: 38642,
      creditorsWithinOneYear: 26256,
      netCurrentAssets: 12386,
      totalAssetsLessCurrentLiabilities: 40948,
      creditorsAfterOneYear: 17087,
      accrualsDeferredIncome: 1200,
      netAssets: 22661,
      capitalAndReserves: 22661,
    });
    expect(accounts.balanceSheet.priorYear).toEqual({});
    expect(accounts.notes).toEqual([
      "Current year: accrualsDeferredIncome is tagged as -1200, which the file's own totals contradict; it is read as 1200.",
    ]);
  });

  const digita = () => filed(DIGITA).toString("utf-8");
  const restated = (text, concept, value) => {
    const changed = text.replace(new RegExp(`(contextRef="FY1\\.END"[^>]*name="core:${concept}"[^>]*>)[^<]*`), `$1${value}`);
    expect(changed).not.toBe(text);
    return changed;
  };

  it("keeps a minus sign that the stated totals agree with", () => {
    const agreeing = restated(restated(digita(), "NetAssetsLiabilities", "25,061"), "Equity", "25,061");
    const accounts = mapIxbrlAccounts(agreeing, { companyNumber: "16140216", firstAccounts: true });
    expect(accounts.balanceSheet.currentYear.accrualsDeferredIncome).toBe(-1200);
    expect(accounts.notes).toEqual([]);
  });

  it("refuses a year whose stated totals need more than one minus sign reversed", () => {
    const text = digita();
    const twoSigns = text.replace(/(name="core:Creditors" )(unitRef="GBP">17,087)/, '$1sign="-" $2');
    expect(twoSigns).not.toBe(text);
    expect(() => mapIxbrlAccounts(twoSigns, { companyNumber: "16140216", firstAccounts: true })).toThrow(
      "The current-year balance sheet does not balance: fixed assets plus current assets less creditors is 59235, the file states net assets of 22661.",
    );
  });

  it("keeps a minus sign that no stated total settles", () => {
    const text = digita();
    const unsettled = text.replace(
      /<ix:nonFraction[^>]*contextRef="FY1\.END"[^>]*name="core:(NetAssetsLiabilities|Equity)"[^>]*>[^<]*<\/ix:nonFraction>/g,
      "",
    );
    expect(unsettled).not.toBe(text);
    const accounts = mapIxbrlAccounts(unsettled, { companyNumber: "16140216", firstAccounts: true });
    expect(accounts.balanceSheet.currentYear.accrualsDeferredIncome).toBe(-1200);
    expect(accounts.notes).toEqual([]);
  });
});
