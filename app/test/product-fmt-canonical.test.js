// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// Each product's fmt() formats a report section value for its unit. It must
// agree with canonicalForUnit rather than rounding straight off the binary
// float: a value that lands a hair under the half-penny boundary (an
// arithmetic difference, not a decimal literal) rounds down under naive
// two-decimal formatting and up once the working-precision pass absorbs the
// float noise first.

import { describe, it, expect } from "vitest";
import * as bst from "../products/bst.js";
import * as taxi from "../products/taxi.js";
import * as se from "../products/se.js";
import * as ltd from "../products/ltd.js";
import { canonicalForUnit } from "../lib/canonical-report-value.js";

const PRODUCTS = { bst, taxi, se, ltd };

// A value whose nearest double sits fractionally under the half-penny it
// represents: 12.35 - 0.005 stores as 12.344999999999999, not 12.345.
const HALF_PENNY_UNDERSHOOT = 12.35 - 0.005;

// Formatting a naive two-decimal round the way the old fmt() did, so the
// half-penny case below can show the two disagree.
function naiveFormat(v) {
  return v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

describe("naive rounding disagrees with canonicalForUnit on a half-penny undershoot", () => {
  it("proves the case this test guards against is real", () => {
    expect(HALF_PENNY_UNDERSHOOT).not.toBe(12.345);
    expect(naiveFormat(HALF_PENNY_UNDERSHOOT)).toBe("12.34");
    expect(canonicalForUnit(HALF_PENNY_UNDERSHOOT, "money")).toBe("12.35");
  });
});

describe.each(Object.entries(PRODUCTS))("%s fmt()", (name, product) => {
  it("formats a money value through canonicalForUnit, not naive rounding", () => {
    expect(product.fmt(HALF_PENNY_UNDERSHOOT, "money")).toBe("12.35");
    expect(product.fmt(HALF_PENNY_UNDERSHOOT, "money")).not.toBe(naiveFormat(HALF_PENNY_UNDERSHOOT));
  });

  it("agrees with canonicalForUnit across a spread of money values", () => {
    const values = [0, 100, 1234.5, 1234.567, -42.005, 0.005, 999999.995, HALF_PENNY_UNDERSHOOT];
    for (const v of values) {
      const expected = Number(canonicalForUnit(v, "money")).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      expect(product.fmt(v, "money")).toBe(expected);
    }
  });

  it("agrees with canonicalForUnit for a rate value", () => {
    const values = [0.2, 0.045, 1 / 3, 0.1999999999999999];
    for (const v of values) {
      const expected = Number(canonicalForUnit(v, "rate")).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      expect(product.fmt(v, "rate")).toBe(expected);
    }
  });

  it("leaves a count value untouched", () => {
    expect(product.fmt(1365, "count")).toBe("1,365");
  });

  it("passes text and blank values through unrounded", () => {
    expect(product.fmt("Acme Ltd", "text")).toBe("Acme Ltd");
    expect(product.fmt(null, "money")).toBe("—");
    expect(product.fmt(undefined, "money")).toBe("—");
  });
});
