// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/unit-tests/company-lookup.test.js
//
// The date rules of the company lookup on the download page.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";

const context = createContext({});
for (const file of ["company-register.js", "company-lookup.js"]) {
  runInContext(readFileSync(resolve(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public/lib", file), "utf8"), context);
}
const call = (expression) => runInContext(`JSON.stringify(${expression})`, context);
const run = (expression) => JSON.parse(call(expression));

describe("addMonthsIso", () => {
  it("keeps a month end at the month end", () => {
    expect(run('addMonthsIso("2024-02-29", 12)')).toBe("2025-02-28");
    expect(run('addMonthsIso("2025-03-31", 9)')).toBe("2025-12-31");
    expect(run('addMonthsIso("2025-06-30", 9)')).toBe("2026-03-31");
  });

  it("keeps an ordinary day and cuts it back in a shorter month", () => {
    expect(run('addMonthsIso("2025-05-15", 12)')).toBe("2026-05-15");
    expect(run('addMonthsIso("2025-11-30", 3)')).toBe("2026-02-28");
  });
});

describe("unfiledPeriods", () => {
  const stated = {
    accountsNextPeriodStart: "2024-04-01",
    accountsNextPeriodEnd: "2025-03-31",
    accountsNextDue: "2025-12-31",
    accountsOverdue: true,
  };

  it("lists the stated period then each computed period up to the current one", () => {
    const periods = run(`unfiledPeriods(${JSON.stringify(stated)}, "2026-11-22")`);
    expect(periods.map((p) => [p.start, p.end, p.due, p.overdue, p.computed])).toEqual([
      ["2024-04-01", "2025-03-31", "2025-12-31", true, false],
      ["2025-04-01", "2026-03-31", "2026-12-31", false, true],
      ["2026-04-01", "2027-03-31", "2027-12-31", false, true],
    ]);
  });

  it("lists only the stated period when it has not ended", () => {
    expect(run(`unfiledPeriods(${JSON.stringify(stated)}, "2025-01-10")`)).toHaveLength(1);
  });

  it("works from the fields it has", () => {
    const periods = run('unfiledPeriods({ accountsNextPeriodEnd: "2027-03-31" }, "2026-11-22")');
    expect(periods).toEqual([{ start: null, end: "2027-03-31", due: null, overdue: false, computed: false }]);
  });

  it("returns nothing without a next period end", () => {
    expect(run('unfiledPeriods({ accountsNextDue: "2025-12-31" }, "2026-11-22")')).toEqual([]);
    expect(run('unfiledPeriods(null, "2026-11-22")')).toEqual([]);
  });

  it("stops after three computed periods", () => {
    expect(run('unfiledPeriods({ accountsNextPeriodEnd: "2010-03-31" }, "2026-11-22")')).toHaveLength(4);
  });
});

describe("packageIndexForYearEnd", () => {
  it("finds the package for a year end and answers -1 for none", () => {
    const periods = '[{ "date": "2026-03-31" }, { "date": "2025-03-31" }]';
    expect(run(`packageIndexForYearEnd(${periods}, "2025-03-31")`)).toBe(1);
    expect(run(`packageIndexForYearEnd(${periods}, "2027-03-31")`)).toBe(-1);
  });
});
