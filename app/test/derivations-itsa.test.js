// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// derivations-itsa.test.js — deriveItsaQuarterlyUpdate and
// deriveItsaAnnualSubmission over the BrickWork Pro self-employed VAT book:
// the field slots follow the mapping's api.years, a cumulative year answers a
// running total, a field the template cannot source is omitted, and the
// refusals name what is wrong.

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { beforeEach, describe, expect, test } from "vitest";

import { loadDiyaGlData } from "../lib/diya-gl-loader.js";
import {
  annualFieldSlotsForTaxYear,
  deriveItsaAnnualSubmission,
  deriveItsaQuarterlyUpdate,
  quarterlyFieldSlots,
} from "../lib/derivations/itsa.js";

const EXAMPLES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "examples");
const SE_VAT = resolve(EXAMPLES_DIR, "brickwork-pro", "se-vat");
const LTD = resolve(EXAMPLES_DIR, "precision-code-ltd", "full");

function readPath(target, path) {
  return path.split(".").reduce((node, part) => (node && typeof node === "object" ? node[part] : undefined), target);
}

describe("the field slots", () => {
  test("the quarterly slots carry both fields of a shared box and the consolidated election", () => {
    const slots = quarterlyFieldSlots();
    expect(slots).toContain("periodIncome.turnover");
    expect(slots).toContain("periodExpenses.advertisingCosts");
    expect(slots).toContain("periodExpenses.businessEntertainmentCosts");
    expect(slots).toContain("periodExpenses.consolidatedExpenses");
    expect(slots).toContain("periodDisallowableExpenses.costOfGoodsDisallowable");
    expect(new Set(slots).size).toBe(slots.length);
  });

  test("the annual slots follow the mapping's api.years by tax year", () => {
    const y2324 = annualFieldSlotsForTaxYear("2023-24");
    const y2425 = annualFieldSlotsForTaxYear("2024-25");
    const y2526 = annualFieldSlotsForTaxYear("2025-26");
    const y2627 = annualFieldSlotsForTaxYear("2026-27");

    expect(y2324).not.toContain("adjustments.transitionProfitAmount");
    expect(y2425).toContain("adjustments.transitionProfitAmount");

    expect(y2425).toContain("allowances.zeroEmissionsGoodsVehicleAllowance");
    expect(y2425).toContain("allowances.electricChargePointAllowance");
    expect(y2526).not.toContain("allowances.zeroEmissionsGoodsVehicleAllowance");
    expect(y2526).not.toContain("allowances.electricChargePointAllowance");

    expect(y2526).toContain("adjustments.overlapReliefUsed");
    expect(y2627).not.toContain("adjustments.overlapReliefUsed");

    expect(y2627).not.toContain("adjustments.adjustmentToProfitsForClass4");
    expect(y2627).not.toContain("allowances.firstYearAllowanceOnPlantAndMachinery");
    expect(y2627).toContain("allowances.annualInvestmentAllowance");
  });

  test("an unknown tax year is refused", () => {
    expect(() => annualFieldSlotsForTaxYear("2019-20")).toThrow(/api.years carries no entry/);
  });
});

describe("deriveItsaQuarterlyUpdate", () => {
  let book;
  let lines;

  beforeEach(() => {
    ({ book, lines } = loadDiyaGlData(SE_VAT));
  });

  test("a cumulative year answers the running total through the period named", async () => {
    const answer = await deriveItsaQuarterlyUpdate(book, lines, { periodEndDate: "2025-10-05" });
    expect(answer.taxYear).toBe("2025-26");
    expect(answer.shape).toBe("cumulative-period-summary");
    expect(answer.quarterlyPeriodType).toBe("standard");
    expect(answer.periods).toHaveLength(1);
    const [period] = answer.periods;
    expect(period.periodDates).toEqual({ periodStartDate: "2025-04-06", periodEndDate: "2025-10-05" });
    expect(period.covers).toEqual(["2025-04-06 to 2025-07-05", "2025-07-06 to 2025-10-05"]);
    expect(period.periodIncome.turnover).toBe(28050 + 27900);
    expect(period.periodExpenses.paymentsToSubcontractors).toBe(9000 + 7500);
    expect(period.periodDisallowableExpenses.depreciationDisallowable).toBe(600);
  });

  test("with no period named every period is answered and the last covers the whole year", async () => {
    const answer = await deriveItsaQuarterlyUpdate(book, lines);
    expect(answer.periods).toHaveLength(4);
    const last = answer.periods[3];
    expect(last.covers).toHaveLength(4);
    expect(last.periodDates.periodStartDate).toBe("2025-04-06");
    expect(last.periodDates.periodEndDate).toBe("2026-04-05");
    const turnoverOfEach = [28050, 27900, 27750, 28800];
    expect(last.periodIncome.turnover).toBe(turnoverOfEach.reduce((a, b) => a + b, 0));
  });

  test("a slot the template cannot source is omitted, never sent as zero", async () => {
    const answer = await deriveItsaQuarterlyUpdate(book, lines, { periodEndDate: "2025-07-05" });
    const [period] = answer.periods;
    expect(period.omitted).toContain("periodDisallowableExpenses.costOfGoodsDisallowable");
    expect(period.omitted).toContain("periodExpenses.consolidatedExpenses");
    expect(period.omitted).toContain("periodExpenses.businessEntertainmentCosts");
    for (const slot of period.omitted) {
      expect(readPath(period, slot)).toBeUndefined();
    }
    for (const slot of answer.fieldSlots) {
      if (!period.omitted.includes(slot)) expect(typeof readPath(period, slot)).toBe("number");
    }
    expect(period.omitted.length + answer.fieldSlots.filter((slot) => readPath(period, slot) !== undefined).length).toBe(
      answer.fieldSlots.length,
    );
  });

  test("a dated year answers the period's own figures", async () => {
    const answer = await deriveItsaQuarterlyUpdate(book, lines, { taxYear: "2024-25", periodEndDate: "2025-04-05" });
    expect(answer.taxYear).toBe("2024-25");
    expect(answer.shape).toBe("period-summary");
    const [period] = answer.periods;
    expect(period.covers).toEqual(["2025-01-06 to 2025-04-05"]);
    expect(period.periodDates).toEqual({ periodStartDate: "2025-01-06", periodEndDate: "2025-04-05" });
    expect(typeof period.periodIncome.turnover).toBe("number");
  });

  test("a period end the year does not have is refused, naming the four it has", async () => {
    await expect(deriveItsaQuarterlyUpdate(book, lines, { periodEndDate: "2025-09-30" })).rejects.toThrow(
      /2025-07-05, 2025-10-05, 2026-01-05, 2026-04-05/,
    );
  });

  test("a calendar election moves the period ends", async () => {
    const answer = await deriveItsaQuarterlyUpdate(book, lines, { quarterlyPeriodType: "calendar", periodEndDate: "2025-09-30" });
    expect(answer.periods[0].periodDates.periodEndDate).toBe("2025-09-30");
  });

  test("an unknown period type is refused", async () => {
    await expect(deriveItsaQuarterlyUpdate(book, lines, { quarterlyPeriodType: "monthly" })).rejects.toThrow(
      /must be one of standard, calendar/,
    );
  });

  test("a malformed tax year is refused", async () => {
    await expect(deriveItsaQuarterlyUpdate(book, lines, { taxYear: "2025/26" })).rejects.toThrow(/must look like 2025-26/);
    await expect(deriveItsaQuarterlyUpdate(book, lines, { taxYear: "2025-27" })).rejects.toThrow(/consecutive/);
  });

  test("a company book is refused", async () => {
    const ltd = loadDiyaGlData(LTD);
    await expect(deriveItsaQuarterlyUpdate(ltd.book, ltd.lines)).rejects.toThrow(/"ltd" book/);
  });

  test("no book is refused", async () => {
    await expect(deriveItsaQuarterlyUpdate()).rejects.toThrow(/requires a book and its lines/);
  });
});

describe("deriveItsaAnnualSubmission", () => {
  let book;
  let lines;

  beforeEach(() => {
    ({ book, lines } = loadDiyaGlData(SE_VAT));
  });

  test("answers the year's allowances and adjustments from the book", async () => {
    const answer = await deriveItsaAnnualSubmission(book, lines);
    expect(answer.taxYear).toBe("2025-26");
    expect(answer.allowances.annualInvestmentAllowance).toBe(12000);
    expect(answer.fieldSlots).toEqual(annualFieldSlotsForTaxYear("2025-26"));
    expect(answer.omitted).toContain("adjustments.overlapReliefUsed");
    expect(answer.omitted).toContain("allowances.tradingIncomeAllowance");
    for (const slot of answer.omitted) expect(readPath(answer, slot)).toBeUndefined();
    expect(Array.isArray(answer.warnings)).toBe(true);
  });

  test("a field HMRC's schema no longer accepts for the year is dropped even when the book states it", async () => {
    book.tax = { selfEmployment: { allowances: { zeroEmissionsGoodsVehicleAllowance: 500, zeroEmissionsCarAllowance: 250 } } };
    const answer = await deriveItsaAnnualSubmission(book, lines);
    expect(answer.allowances.zeroEmissionsCarAllowance).toBe(250);
    expect(answer.allowances.zeroEmissionsGoodsVehicleAllowance).toBeUndefined();
    expect(answer.fieldSlots).not.toContain("allowances.zeroEmissionsGoodsVehicleAllowance");
    expect(answer.omitted).not.toContain("allowances.zeroEmissionsGoodsVehicleAllowance");
  });

  test("the same book in 2024-25 still files the zero-emission goods vehicle allowance", async () => {
    book.tax = { selfEmployment: { allowances: { zeroEmissionsGoodsVehicleAllowance: 500 } } };
    const answer = await deriveItsaAnnualSubmission(book, lines, { taxYear: "2024-25" });
    expect(answer.taxYear).toBe("2024-25");
    expect(answer.allowances.zeroEmissionsGoodsVehicleAllowance).toBe(500);
  });

  test("a company book is refused", async () => {
    const ltd = loadDiyaGlData(LTD);
    await expect(deriveItsaAnnualSubmission(ltd.book, ltd.lines)).rejects.toThrow(/"ltd" book/);
  });
});
