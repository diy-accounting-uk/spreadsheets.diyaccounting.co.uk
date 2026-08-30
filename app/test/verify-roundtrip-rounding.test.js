// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// canonicalForUnit rounds a money value to a working precision before the
// penny, so binary-float noise below the working precision cannot decide
// which way a value on the penny boundary falls. These cases pin that
// behaviour down: the boundary cases it must still resolve the same way,
// and the noisy-input case it now resolves the same way on both engines.

import { describe, it, expect } from "vitest";
import { canonicalForUnit, entriesEqual } from "../bin/verify-roundtrip.js";

function money(value) {
  return { value, unit: "money" };
}

describe("canonicalForUnit money rounding", () => {
  it("still rounds a clean value down below the half-pence boundary", () => {
    expect(canonicalForUnit("100.004", "money")).toBe("100.00");
    expect(canonicalForUnit("0.004", "money")).toBe("0.00");
  });

  it("still rounds a clean value up at or above the half-pence boundary", () => {
    expect(canonicalForUnit("100.006", "money")).toBe("100.01");
    expect(canonicalForUnit("0.006", "money")).toBe("0.01");
  });

  it("agrees on a value carrying binary-float noise from an Excel roundtrip", () => {
    // 32,861.2349999998 is what LibreOffice's xls roundtrip re-serialises a
    // stored 32,861.235 as. Rounding straight to the penny reads its sixth
    // decimal digit as a 4 and rounds down; rounding to six places first
    // reads the noise as carrying the value to .235000 and then rounds up,
    // same as the clean JS-side figure.
    const excel = canonicalForUnit("32861.2349999998", "money");
    const js = canonicalForUnit("32861.235", "money");
    expect(excel).toBe(js);
    expect(excel).toBe("32861.24");
  });

  it("keeps entriesEqual agreeing on the same noisy figure", () => {
    expect(entriesEqual(money("32861.2349999998"), money("32861.235"))).toBe(true);
  });

  it("still tells apart two figures a penny or more apart once the noise is absorbed", () => {
    expect(canonicalForUnit("32861.2349999998", "money")).not.toBe(canonicalForUnit("32861.225", "money"));
  });
});
