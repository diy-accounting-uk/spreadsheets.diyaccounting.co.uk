// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { calculateIncomeTax, calculateExpectedTax } from "../../lib/tax/income-tax.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "..", "..", "data");

function taxDataFor(years) {
  return parseTOML(readFileSync(resolve(DATA_DIR, `${years}.toml`), "utf8"));
}

const TAX_DATA_2025_26 = taxDataFor("se-2025-2026");
const RATES_2025_26 = TAX_DATA_2025_26.income_tax;

const ALL_YEARS = ["se-2020-2021", "se-2021-2022", "se-2022-2023", "se-2023-2024", "se-2024-2025", "se-2025-2026", "se-2026-2027"];

describe("the shipped tax data carries every band the calculation needs", () => {
  it.each(ALL_YEARS)("%s declares the taper threshold, the higher band end and the additional rate", (name) => {
    const rates = taxDataFor(name).income_tax;
    expect(rates.personal_allowance_taper_threshold).toBe(100000);
    expect(rates.additional_rate).toBe(0.45);
    expect(rates.higher_band_end).toBeGreaterThan(rates.basic_band_end);
  });

  it("moves the higher band end from 150,000 to 125,140 for 2023-24", () => {
    expect(taxDataFor("se-2022-2023").income_tax.higher_band_end).toBe(150000);
    expect(taxDataFor("se-2023-2024").income_tax.higher_band_end).toBe(125140);
  });
});

describe("calculateIncomeTax", () => {
  it("returns zero tax for profit below personal allowance", () => {
    const result = calculateIncomeTax(10000, RATES_2025_26);
    expect(result.personalAllowance).toBe(12570);
    expect(result.taxableIncome).toBe(0);
    expect(result.totalIncomeTax).toBe(0);
  });

  it("calculates basic rate only for profit within basic band", () => {
    const result = calculateIncomeTax(30000, RATES_2025_26);
    expect(result.taxableIncome).toBe(17430);
    expect(result.basicRateTax).toBeCloseTo(3486, 2);
    expect(result.higherRateTax).toBe(0);
    expect(result.additionalRateTax).toBe(0);
    expect(result.totalIncomeTax).toBeCloseTo(3486, 2);
  });

  it("charges basic and higher rate below the taper threshold", () => {
    // 60,000 less the 12,570 allowance leaves 47,430: 37,700 at 20%, 9,730 at 40%.
    const result = calculateIncomeTax(60000, RATES_2025_26);
    expect(result.personalAllowance).toBe(12570);
    expect(result.taxableIncome).toBe(47430);
    expect(result.basicRateTax).toBeCloseTo(7540, 2);
    expect(result.higherRateTax).toBeCloseTo(3892, 2);
    expect(result.additionalRateTax).toBe(0);
    expect(result.totalIncomeTax).toBeCloseTo(11432, 2);
  });

  it("leaves the whole allowance at exactly the taper threshold", () => {
    const result = calculateIncomeTax(100000, RATES_2025_26);
    expect(result.personalAllowance).toBe(12570);
    expect(result.taxableIncome).toBe(87430);
  });

  it("withdraws a pound of allowance for every two pounds over the threshold", () => {
    // 110,000 sits 10,000 over, so the allowance falls to 12,570 - 5,000 = 7,570
    // and taxable income is 102,430.
    const result = calculateIncomeTax(110000, RATES_2025_26);
    expect(result.personalAllowance).toBe(7570);
    expect(result.taxableIncome).toBe(102430);
    expect(result.basicRateTax).toBeCloseTo(7540, 2);
    expect(result.higherRateTax).toBeCloseTo(25892, 2);
    expect(result.additionalRateTax).toBe(0);
    expect(result.totalIncomeTax).toBeCloseTo(33432, 2);
  });

  it("exhausts the allowance at 125,140 and charges no additional rate there", () => {
    const result = calculateIncomeTax(125140, RATES_2025_26);
    expect(result.personalAllowance).toBe(0);
    expect(result.taxableIncome).toBe(125140);
    expect(result.additionalRateTax).toBe(0);
    expect(result.totalIncomeTax).toBeCloseTo(42516, 2);
  });

  it("charges the additional rate above the higher band end", () => {
    // The BST basic fixture profit.
    const result = calculateIncomeTax(226508, RATES_2025_26);
    expect(result.personalAllowance).toBe(0);
    expect(result.taxableIncome).toBe(226508);
    expect(result.basicRateTax).toBeCloseTo(7540, 2);
    expect(result.higherRateTax).toBeCloseTo(34976, 2);
    expect(result.additionalRateTax).toBeCloseTo(45615.6, 2);
    expect(result.totalIncomeTax).toBeCloseTo(88131.6, 2);
  });

  it("charges the SE advanced fixture profit at all three rates", () => {
    const result = calculateIncomeTax(144715.391666666, RATES_2025_26);
    expect(result.personalAllowance).toBe(0);
    expect(result.basicRateTax).toBeCloseTo(7540, 2);
    expect(result.higherRateTax).toBeCloseTo(34976, 2);
    expect(result.additionalRateTax).toBeCloseTo(8808.92625, 2);
    expect(result.totalIncomeTax).toBeCloseTo(51324.92625, 2);
  });

  it("uses the 150,000 additional-rate threshold in force before 2023-24", () => {
    // 226,508 taxable in 2022-23: 37,700 at 20%, 112,300 at 40%, 76,508 at 45%.
    const result = calculateIncomeTax(226508, taxDataFor("se-2022-2023").income_tax);
    expect(result.higherRateTax).toBeCloseTo(44920, 2);
    expect(result.additionalRateTax).toBeCloseTo(34428.6, 2);
    expect(result.totalIncomeTax).toBeCloseTo(86888.6, 2);
  });

  it("handles exact personal allowance boundary", () => {
    const result = calculateIncomeTax(12570, RATES_2025_26);
    expect(result.taxableIncome).toBe(0);
    expect(result.totalIncomeTax).toBe(0);
  });
});

describe("calculateExpectedTax", () => {
  it("reports the tapered allowance alongside the charge", () => {
    const result = calculateExpectedTax(110000, TAX_DATA_2025_26);
    expect(result.personal_allowance).toBe(7570);
    expect(result.income_tax).toBe(33432);
  });

  it("splits the charge across the three bands for the BST basic scenario", () => {
    const result = calculateExpectedTax(226508, TAX_DATA_2025_26);
    expect(result.income_tax_basic).toBeCloseTo(7540, 2);
    expect(result.income_tax_higher).toBeCloseTo(34976, 2);
    expect(result.income_tax_additional).toBeCloseTo(45615.6, 2);
    expect(result.income_tax).toBe(88132);
    expect(result.ni_class4_lower).toBe(2262);
    expect(result.ni_class4_upper).toBe(3524.8);
    expect(result.total_tax_and_ni).toBe(93918);
  });

  it("returns zeros for profit below all thresholds", () => {
    const result = calculateExpectedTax(5000, TAX_DATA_2025_26);
    expect(result.income_tax).toBe(0);
    expect(result.personal_allowance).toBe(12570);
    expect(result.ni_class4_lower).toBe(0);
    expect(result.ni_class4_upper).toBe(0);
    expect(result.total_tax_and_ni).toBe(0);
  });

  it("returns the voluntary Class 2 amount below the small profits threshold", () => {
    const result = calculateExpectedTax(5000, TAX_DATA_2025_26);
    expect(result.ni_class2).toBe(182);
    expect(result.total_tax_and_ni).toBe(0);
  });

  it("returns nil Class 2 above it", () => {
    const result = calculateExpectedTax(30000, TAX_DATA_2025_26);
    expect(result.ni_class2).toBe(0);
  });

  it("carries the year's own threshold and a nil voluntary amount where the weekly rate is nil", () => {
    const result = calculateExpectedTax(5000, taxDataFor("se-2024-2025"));
    expect(result.ni_class2_weekly).toBe(0);
    expect(result.ni_class2_threshold).toBe(6725);
    expect(result.ni_class2).toBe(0);
  });
});
