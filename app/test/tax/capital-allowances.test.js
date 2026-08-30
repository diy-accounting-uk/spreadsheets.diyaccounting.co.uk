// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect } from "vitest";
import { assetCapitalAllowance, calculateCapitalAllowances } from "../../lib/tax/capital-allowances.js";

// The percentages the Ltd Admin sheet injects for FY2024: the whole cost of a
// purchase, and the schedule's own 20% on an asset brought forward.
const RATES = { investmentAllowancePercent: 100, writingDownPercent: 20 };

describe("assetCapitalAllowance", () => {
  it("claims the investment allowance on the whole cost of a purchase", () => {
    const claim = assetCapitalAllowance({ acquiredInYear: true, cost: 52500 }, RATES);
    expect(claim.investmentAllowance).toBe(52500);
    expect(claim.writingDownAllowance).toBe(0);
    expect(claim.poolCarriedForward).toBe(0);
  });

  it("claims the writing down allowance on an asset brought forward", () => {
    const claim = assetCapitalAllowance({ acquiredInYear: false, cost: 30000, taxWrittenDownValue: 24000 }, RATES);
    expect(claim.investmentAllowance).toBe(0);
    expect(claim.writingDownAllowance).toBe(4800);
    expect(claim.poolCarriedForward).toBe(19200);
  });

  it("throws off a balancing charge when the proceeds beat the pool", () => {
    const claim = assetCapitalAllowance({ acquiredInYear: true, cost: 1500, disposalProceeds: 12500 }, RATES);
    expect(claim.poolCarriedForward).toBe(0);
    expect(claim.balancingCharge).toBe(12500);
    expect(claim.balancingAllowance).toBe(0);
  });

  it("throws off a balancing allowance when the proceeds fall short of the pool", () => {
    const claim = assetCapitalAllowance({ acquiredInYear: false, cost: 30000, taxWrittenDownValue: 24000, disposalProceeds: 15000 }, RATES);
    expect(claim.balancingAllowance).toBe(4200);
    expect(claim.balancingCharge).toBe(0);
  });

  it("settles a scrapped asset's whole pool as a balancing allowance", () => {
    const claim = assetCapitalAllowance({ acquiredInYear: false, taxWrittenDownValue: 24000, disposed: true }, RATES);
    expect(claim.balancingAllowance).toBe(19200);
  });

  it("claims nothing on an asset with no cost and no written-down value", () => {
    const claim = assetCapitalAllowance({ acquiredInYear: true, cost: 0 }, RATES);
    expect(claim).toMatchObject({ investmentAllowance: 0, writingDownAllowance: 0, poolCarriedForward: 0, balancingCharge: 0 });
  });
});

describe("calculateCapitalAllowances", () => {
  it("nets the balancing charge off the total the computation deducts", () => {
    // The Precision Code year: 52,500 of new plant, of which 1,500 was sold
    // for 12,500 net of VAT.
    const claim = calculateCapitalAllowances(
      [
        { acquiredInYear: true, cost: 51000 },
        { acquiredInYear: true, cost: 1500, disposalProceeds: 12500 },
      ],
      RATES,
    );
    expect(claim.investmentAllowance).toBe(52500);
    expect(claim.balancingCharge).toBe(12500);
    expect(claim.total).toBe(40000);
  });

  it("adds a balancing allowance to the total", () => {
    const claim = calculateCapitalAllowances(
      [{ acquiredInYear: false, cost: 30000, taxWrittenDownValue: 24000, disposalProceeds: 15000 }],
      RATES,
    );
    expect(claim.total).toBe(4800 + 4200);
  });

  it("claims nothing when there are no assets", () => {
    expect(calculateCapitalAllowances([], RATES).total).toBe(0);
    expect(calculateCapitalAllowances(undefined, RATES).total).toBe(0);
  });
});
