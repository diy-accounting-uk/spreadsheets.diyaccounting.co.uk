// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// ltd-officer-dates.test.js — The register of directors dates each officer
// from the book's own dates, whether the book states them as dates or, after
// a round trip through JSON, as ISO date-time strings, and in a package for
// a year after the book's own. Pure JS: the cell writer and the verdict
// function, no recalculation.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import { parseDate } from "../lib/scenario-loader.js";
import { cellWrites, checkCompliance } from "../products/ltd.js";
import { toExcelSerial } from "../lib/spreadsheet-runner.js";

const TAX_DATA = parseTOML(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "..", "data", "ltd-2026.toml"), "utf8"));
const APPOINTED_SERIAL = toExcelSerial(2021, 2, 1);
const SHARES_ACQUIRED_SERIAL = toExcelSerial(2021, 3, 1);

function scenarioWith(appointed, acquired) {
  return {
    business: { name: "Roll Co" },
    period_start_month: 4,
    directors: [{ name: "Dee Director", role: "Director", appointed }],
    members: [{ name: "Dee Director", shares: 10, acquired }],
  };
}

function officerSheetsFor(scenario, targetStartYear) {
  const writes = cellWrites(scenario, targetStartYear, 3)["Companysecretary.xlsx"];
  return {
    "Companysecretary.xlsx!Directors&Secretary": writes["Directors&Secretary"],
    "Companysecretary.xlsx!DirectorsInterests": writes.DirectorsInterests,
  };
}

// The verdict function reads cells across the whole workbook; every sheet
// but the two registers answers 0 for any cell, which the officer verdicts
// never look at.
function officerVerdicts(scenario, results) {
  const zeroSheet = () => new Proxy({}, { get: () => 0 });
  const workbook = new Proxy(results, { get: (target, key) => (key in target ? target[key] : zeroSheet()) });
  return checkCompliance(workbook, scenario, TAX_DATA, calculateExpectedTax)
    .filter((c) => /^Directors(&Secretary|Interests):/.test(c.name))
    .map((c) => [c.name, c.pass]);
}

describe("parseDate", () => {
  it.each([
    ["2021-02-01", "2021-02-01"],
    ["2021-02-01T00:00:00.000Z", "2021-02-01"],
    ["2021-02-01T00:00:00Z", "2021-02-01"],
    ["2021-02-01T00:00:00+01:00", "2021-02-01"],
  ])("reads %s as %s", (text, day) => {
    expect(parseDate(text).toISOString().slice(0, 10)).toBe(day);
  });

  it.each(["", "February 2021", "2021/02/01", "01-02-2021", "2021-02-01 extra", undefined])("throws on %j", (text) => {
    expect(() => parseDate(text)).toThrow(/not a date/);
  });
});

describe("the officer registers in a package a year after the book's own", () => {
  it.each([
    ["a plain date", "2021-02-01", "2021-03-01"],
    ["an ISO date-time", "2021-02-01T00:00:00.000Z", "2021-03-01T00:00:00.000Z"],
  ])("write and pass their verdicts for %s", (_label, appointed, acquired) => {
    const scenario = scenarioWith(appointed, acquired);
    const results = officerSheetsFor(scenario, 2026);
    expect(results["Companysecretary.xlsx!Directors&Secretary"].C2).toBe(APPOINTED_SERIAL);
    expect(results["Companysecretary.xlsx!DirectorsInterests"].C2).toBe(SHARES_ACQUIRED_SERIAL);
    const verdicts = officerVerdicts(scenario, results);
    expect(verdicts.length).toBeGreaterThanOrEqual(4);
    expect(verdicts.filter(([, pass]) => !pass)).toEqual([]);
  });

  it("fails the appointment verdict on a wrong date", () => {
    const scenario = scenarioWith("2021-02-01T00:00:00.000Z", "2021-03-01T00:00:00.000Z");
    const results = officerSheetsFor(scenario, 2026);
    results["Companysecretary.xlsx!Directors&Secretary"].C2 = APPOINTED_SERIAL + 1;
    expect(officerVerdicts(scenario, results).filter(([, pass]) => !pass)).toEqual([
      ["Directors&Secretary: row 2 dates Dee Director's appointment", false],
    ]);
  });

  it("fails the interests verdict on a wrong date", () => {
    const scenario = scenarioWith("2021-02-01T00:00:00.000Z", "2021-03-01T00:00:00.000Z");
    const results = officerSheetsFor(scenario, 2026);
    results["Companysecretary.xlsx!DirectorsInterests"].C2 = SHARES_ACQUIRED_SERIAL - 1;
    expect(officerVerdicts(scenario, results).filter(([, pass]) => !pass).length).toBe(1);
  });
});
