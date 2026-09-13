// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
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

// budgetBreaches() itself is never called by any other test: the four
// roundtrip-<product> CI jobs are the only thing that exercises the
// comparison this gate makes. These pin the comparison down directly against
// synthetic counts, with no report document or package run involved.
describe("budgetBreaches", () => {
  it("passes a count under a nonzero budget", () => {
    expect(budgetBreaches({ differing: 3 }, { differing: 5 })).toEqual([]);
  });

  it("passes a count exactly at a nonzero budget, since the limit is inclusive", () => {
    expect(budgetBreaches({ differing: 5 }, { differing: 5 })).toEqual([]);
  });

  it("breaches the moment a count exceeds a nonzero budget", () => {
    expect(budgetBreaches({ differing: 6 }, { differing: 5 })).toEqual([["differing", 5]]);
  });

  it("treats a metric absent from the counts as zero", () => {
    expect(budgetBreaches({}, { differing: 0 })).toEqual([]);
    expect(budgetBreaches({}, { differing: 1 })).toEqual([]);
  });

  it("breaches on nothing for an empty budget, however large the counts are", () => {
    expect(budgetBreaches({ differing: 1000, noJsValue: 1000 }, {})).toEqual([]);
  });

  it("names every metric that breaches, not just the first", () => {
    expect(budgetBreaches({ differing: 1, noJsValue: 2, noExcelValue: 0 }, { differing: 0, noJsValue: 0, noExcelValue: 0 })).toEqual([
      ["differing", 0],
      ["noJsValue", 0],
    ]);
  });
});
