// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect } from "vitest";
import { packageYearEnd } from "../bin/reconcile.js";

describe("packageYearEnd", () => {
  it("reads the year-end date out of the package directory name", () => {
    expect(packageYearEnd("GB Accounts Company 2026-03-31 (Mar26) Excel 2007")).toBe("2026-03-31");
  });

  it("reads a non-March year-end the same way", () => {
    expect(packageYearEnd("GB Accounts Company 2026-06-30 (Jun26) Excel 2007")).toBe("2026-06-30");
  });

  it("returns null when the directory name carries no date", () => {
    expect(packageYearEnd("GB Accounts Company Excel 2007")).toBeNull();
  });
});
