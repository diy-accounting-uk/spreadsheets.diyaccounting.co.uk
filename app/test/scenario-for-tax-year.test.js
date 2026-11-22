// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { describe, it, expect } from "vitest";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadScenario, scenarioForTaxYear } from "../lib/scenario-loader.js";

const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("scenarioForTaxYear", () => {
  const scenario = {
    basis_period: { overlapProfitBroughtForward: 2400, transitionProfitBroughtForward: 6000, transitionProfitAccelerationAmount: 1000 },
    basis_period_changes: [
      { firstTaxYearEnd: 2029, overlapProfitBroughtForward: 2400 },
      {
        firstTaxYearEnd: 2028,
        overlapProfitBroughtForward: 2400,
        transitionProfitBroughtForward: 6000,
        transitionProfitAccelerationAmount: 0,
      },
    ],
  };

  it("returns the scenario as it is for a tax year before the first change", () => {
    expect(scenarioForTaxYear(scenario, 2027)).toBe(scenario);
  });

  it("applies the last change the tax year has reached", () => {
    expect(scenarioForTaxYear(scenario, 2028).basis_period).toEqual({
      overlapProfitBroughtForward: 2400,
      transitionProfitBroughtForward: 6000,
      transitionProfitAccelerationAmount: 0,
    });
    expect(scenarioForTaxYear(scenario, 2029).basis_period).toEqual({ overlapProfitBroughtForward: 2400 });
    expect(scenarioForTaxYear(scenario, 2031).basis_period).toEqual({ overlapProfitBroughtForward: 2400 });
  });

  it("leaves a scenario with no changes as it is", () => {
    const plain = { basis_period: { overlapProfitBroughtForward: 2400 } };
    expect(scenarioForTaxYear(plain, 2030)).toBe(plain);
  });

  it("gives the advanced SE fixture its election to 2027, a nil election in 2028 and no balance from 2029", () => {
    const advanced = loadScenario(resolve(FIXTURES, "se-scenario-advanced.toml"));
    expect(scenarioForTaxYear(advanced, 2027).basis_period).toMatchObject({
      transitionProfitBroughtForward: 6000,
      transitionProfitAccelerationAmount: 1000,
    });
    expect(scenarioForTaxYear(advanced, 2028).basis_period).toMatchObject({
      transitionProfitBroughtForward: 6000,
      transitionProfitAccelerationAmount: 0,
    });
    const later = scenarioForTaxYear(advanced, 2029).basis_period;
    expect(later.transitionProfitBroughtForward).toBeUndefined();
    expect(later.transitionProfitAccelerationAmount).toBeUndefined();
  });
});
