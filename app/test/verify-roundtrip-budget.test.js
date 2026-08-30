// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// EQ1 is an exact gate: a budget entry that holds a report-half count at
// zero must fail the moment a real run's counts rise above it, and must
// pass when the two engines agree. These cases pin that verdict down
// directly against two small report documents, without a package run.

import { describe, it, expect } from "vitest";
import { scoreReportDocuments, budgetBreaches } from "../bin/verify-roundtrip.js";

function reportDocument(values) {
  return { package: "test", values };
}

const EXACT_BUDGET_ENTRY = { differing: 0, noJsValue: 0, noExcelValue: 0 };

describe("the EQ1 exact gate", () => {
  it("reports the differing key and breaches a zero-held differing budget", () => {
    const excel = reportDocument([{ key: "cell/Sheet!A1", unit: "money", value: "100.00" }]);
    const js = reportDocument([{ key: "cell/Sheet!A1", unit: "money", value: "101.00" }]);

    const score = scoreReportDocuments(excel, js);
    expect(score.equal).toBe(0);
    expect(score.differing).toBe(1);
    expect(score.differingKeys).toEqual(["cell/Sheet!A1"]);

    const breaches = budgetBreaches(score, EXACT_BUDGET_ENTRY);
    expect(breaches).toEqual([["differing", 0]]);
  });

  it("passes a zero-held budget when the two engines agree on every key", () => {
    const excel = reportDocument([{ key: "cell/Sheet!A1", unit: "money", value: "100.00" }]);
    const js = reportDocument([{ key: "cell/Sheet!A1", unit: "money", value: "100.00" }]);

    const score = scoreReportDocuments(excel, js);
    expect(score.equal).toBe(1);
    expect(score.differing).toBe(0);

    expect(budgetBreaches(score, EXACT_BUDGET_ENTRY)).toEqual([]);
  });
});
