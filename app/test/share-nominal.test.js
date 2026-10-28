// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import { memberNominalValue, registerNominalValue, bookFormatNumber } from "../lib/share-nominal.js";
import { validateBook } from "../lib/diya-gl-schema.js";
import * as ltd from "../products/ltd.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(__dirname, "..");
const LTD_DATA = resolve(ROOT, "examples", "precision-code-ltd", "full");
const REGISTER_CHECK = "RegisterofMembers: nominal value x shares issued = PubBalSht share capital";

// The fixture's 100 shares of £1, restated as 500 shares of £0.20: the same
// £100 of share capital.
function twentyPenceBook(book, { formatVersion = "diya-gl/2", stated = true } = {}) {
  const restate = (holding) => ({ ...holding, shares: holding.shares * 5, ...(stated ? { nominalValue: 0.2 } : {}) });
  const restated = {
    ...book,
    documentInfo: { ...book.documentInfo, "diya-gl:formatVersion": formatVersion },
    members: book.members.map(restate),
    directors: book.directors.map((director) => (director.shares === undefined ? director : { ...director, shares: director.shares * 5 })),
  };
  return restated;
}

function runBook(book, lines) {
  const taxData = parseTOML(readFileSync(resolve(APP_DIR, "data", "ltd-2024.toml"), "utf8"));
  const scenario = diyaGlToScenario(book, lines, "ltd");
  const results = calculateFromDiyaGl(book, lines, "ltd", taxData, scenario);
  const yearEnd = new Date(book.documentInfo.periodCoveredEnd).toISOString().slice(0, 10);
  const checks = ltd.checkCompliance({ ...results }, { ...scenario, ...scenario.expected }, taxData, calculateExpectedTax, yearEnd);
  return { scenario, results, checks };
}

describe("memberNominalValue", () => {
  const member = { name: "Carol Smith", shares: 60 };

  it("returns the value a member states", () => {
    expect(memberNominalValue({ ...member, nominalValue: 0.2 }, { documentInfo: { "diya-gl:formatVersion": "diya-gl/2" } })).toBe(0.2);
  });

  it("reads a book with no format marker as £1 a share", () => {
    expect(memberNominalValue(member, { documentInfo: {} })).toBe(1);
  });

  it("reads a book stamped diya-gl/1 as £1 a share", () => {
    expect(memberNominalValue(member, { documentInfo: { "diya-gl:formatVersion": "diya-gl/1" } })).toBe(1);
  });

  it("refuses a member with no value in a book stamped diya-gl/2", () => {
    expect(() => memberNominalValue(member, { documentInfo: { "diya-gl:formatVersion": "diya-gl/2" } })).toThrow(/Carol Smith.*no nominalValue/);
  });

  it("reads the number off any format marker", () => {
    expect(bookFormatNumber({ documentInfo: { "diya-gl:formatVersion": "diya-gl-books/1" } })).toBe(1);
  });
});

describe("registerNominalValue", () => {
  it("returns the one value every member shares", () => {
    expect(registerNominalValue([0.2, 0.2])).toBe(0.2);
  });

  it("returns undefined for an empty register", () => {
    expect(registerNominalValue([])).toBeUndefined();
  });

  it("refuses members priced differently", () => {
    expect(() => registerNominalValue([0.2, 1])).toThrow(/one nominal value/);
  });
});

describe("a company with shares of £0.20", () => {
  const { book, lines } = loadDiyaGlData(LTD_DATA);

  it("passes the book schema with a nominalValue on each member", () => {
    expect(validateBook(twentyPenceBook(book)).errors).toEqual([]);
  });

  it("carries the value from the book to the scenario's members", () => {
    const scenario = diyaGlToScenario(twentyPenceBook(book), lines, "ltd");
    expect(scenario.members.map((member) => member.nominal_value)).toEqual([0.2, 0.2, 0.2]);
    expect(scenario.members.map((member) => member.shares)).toEqual([300, 125, 75]);
  });

  it("puts the nominal value in F1 of the members register", () => {
    const { results } = runBook(twentyPenceBook(book), lines);
    const register = results["Companysecretary.xlsx!RegisterofMembers"];
    expect(register.F1).toBe(0.2);
    expect(register.G1).toBe(500);
  });

  it("passes the check that nominal value x shares issued equals the balance sheet's share capital", () => {
    const { checks } = runBook(twentyPenceBook(book), lines);
    const verdict = checks.find((check) => check.name === REGISTER_CHECK);
    expect(verdict.pass).toBe(true);
  });

  it("fails the same register when the book predates the value, so the shares read as £1 each", () => {
    const predating = twentyPenceBook(book, { formatVersion: "diya-gl/1", stated: false });
    const { checks } = runBook(predating, lines);
    expect(checks.find((check) => check.name === REGISTER_CHECK).pass).toBe(false);
  });

  it("refuses a diya-gl/2 book whose members state no value", () => {
    expect(() => diyaGlToScenario(twentyPenceBook(book, { stated: false }), lines, "ltd")).toThrow(/no nominalValue/);
  });
});

describe("the £1 fixtures", () => {
  const { book, lines } = loadDiyaGlData(LTD_DATA);

  it("read as £1 a share and pass the register check", () => {
    const { results, checks } = runBook(book, lines);
    expect(results["Companysecretary.xlsx!RegisterofMembers"].F1).toBe(1);
    expect(checks.find((check) => check.name === REGISTER_CHECK).pass).toBe(true);
  });
});
