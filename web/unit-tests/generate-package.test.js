// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/unit-tests/generate-package.test.js
//
// What the download page's Generate option takes from the register answer and how it words the cases.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";

const context = createContext({});
for (const file of ["company-lookup.js", "generate-package.js"]) {
  runInContext(readFileSync(resolve(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public/lib", file), "utf8"), context);
}
const run = (expression) => JSON.parse(runInContext(`JSON.stringify(${expression})`, context));

describe("profileForBook", () => {
  it("copies the fields the book is built from and nothing else", () => {
    const profile = {
      companyNumber: "06846849",
      companyName: "EXAMPLE LIMITED",
      dateOfCreation: "2009-03-13",
      registeredOffice: { addressLine1: "1 Test Street", cityOrTown: "Testtown", postalCode: "TT1 2AB", country: "England", secret: "x" },
      accountsNextPeriodStart: "2025-04-01",
      accountsNextPeriodEnd: "2026-03-31",
      accountsLastPeriodEnd: "2025-03-31",
      dateOfBirth: "1970-01-01",
      nationality: "British",
    };
    const copied = run(`profileForBook(${JSON.stringify(profile)})`);
    expect(Object.keys(copied).sort()).toEqual([
      "accountsLastPeriodEnd",
      "accountsNextPeriodEnd",
      "accountsNextPeriodStart",
      "companyName",
      "companyNumber",
      "dateOfCreation",
      "registeredOffice",
    ]);
    expect(copied.registeredOffice).toEqual({ addressLine1: "1 Test Street", cityOrTown: "Testtown", postalCode: "TT1 2AB" });
    expect(JSON.stringify(copied)).not.toContain("1970");
    expect(JSON.stringify(copied)).not.toContain("British");
  });
});

describe("officersForBook", () => {
  it("copies each officer's name, role and appointment date and nothing else", () => {
    const officers = [
      {
        name: "CARTWRIGHT, Antony",
        officerRole: "director",
        appointedOn: "2009-03-13",
        dateOfBirth: { year: 1970, month: 1 },
        nationality: "British",
      },
    ];
    expect(run(`officersForBook(${JSON.stringify(officers)})`)).toEqual([
      { name: "CARTWRIGHT, Antony", officerRole: "director", appointedOn: "2009-03-13" },
    ]);
  });

  it("gives an empty list for an answer with no officers", () => {
    expect(run("officersForBook(undefined)")).toEqual([]);
  });
});

describe("isFirstAccounts", () => {
  it("is true when the last set starts on the date of creation", () => {
    expect(run('isFirstAccounts({ dateOfCreation: "2025-04-01", accountsLastPeriodStart: "2025-04-01" })')).toBe(true);
    expect(run('isFirstAccounts({ dateOfCreation: "2009-03-13", accountsLastPeriodStart: "2024-04-01" })')).toBe(false);
    expect(run('isFirstAccounts({ dateOfCreation: "2025-04-01" })')).toBe(false);
  });
});

describe("registerFailureMessage", () => {
  it("words each status the route answers", () => {
    expect(run("registerFailureMessage(404)")).toBe("Companies House has no company with that number.");
    expect(run("registerFailureMessage(413)")).toContain("too large for this page to read");
    expect(run("registerFailureMessage(429)")).toContain("Companies House is busy");
    expect(run("registerFailureMessage(502)")).toContain("not available now");
    expect(run("registerFailureMessage(0)")).toContain("not available now");
  });
});

describe("notTwelveMonthsMessage", () => {
  it("names the period and why it has no package", () => {
    const message = run('notTwelveMonthsMessage("2025-06-02", "2026-03-31")');
    expect(message).toContain("2 June 2025 to 31 March 2026");
    expect(message).toContain("twelve whole months");
  });
});
