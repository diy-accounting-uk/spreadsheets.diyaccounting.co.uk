// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// Dividend tax rates by year in app/data/ltd-*.toml. From 6 April 2026 the
// ordinary and upper rates are 10.75% and 35.75%; the additional rate stays
// at 39.35%. Section 455 tax on a director's loan reads the upper rate.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse as parseTOML } from "smol-toml";

function dividendTax(file) {
  const path = fileURLToPath(new URL(`../data/${file}`, import.meta.url));
  return parseTOML(readFileSync(path, "utf8")).dividend_tax;
}

describe("Ltd dividend tax rates", () => {
  it("keeps the 2025-26 rates for the year to 5 April 2026", () => {
    expect(dividendTax("ltd-2025.toml")).toMatchObject({ basic_rate: 0.0875, higher_rate: 0.3375, additional_rate: 0.3935 });
  });

  it.each(["ltd-2026.toml", "ltd-2027.toml"])("uses 10.75%% and 35.75%% from 6 April 2026 in %s", (file) => {
    expect(dividendTax(file)).toMatchObject({ allowance: 500, basic_rate: 0.1075, higher_rate: 0.3575, additional_rate: 0.3935 });
  });
});
