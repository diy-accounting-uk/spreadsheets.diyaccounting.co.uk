// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// ltd-register-package.test.js — the Company package generated from what
// Companies House holds: a filed accounts document is read back by the
// engine's mapIxbrlAccounts, the book is built by buildBookFromRegister, the
// package is written, and the OpenAccounts sheet states the filed balance
// sheet while Companysecretary.xlsx names the officers. The page reads the
// same functions through the engine bundle.

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import * as engine from "../lib/diya-gl-engine.js";
import { buildSheetMap, loadSharedStrings, readCellValue } from "../lib/xlsx-parts.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(resolve(HERE, "fixtures", "ixbrl", name));

const OFFICERS = [
  { name: "CARTWRIGHT, Antony Christopher", officerRole: "director", appointedOn: "2009-03-13" },
  { name: "CARTWRIGHT, Samantha Ashley", officerRole: "secretary", appointedOn: "2010-02-01" },
];

const diyaProfile = {
  companyNumber: "06846849",
  companyName: "DIY ACCOUNTING LIMITED",
  dateOfCreation: "2009-03-13",
  registeredOffice: { addressLine1: "1 Test Street", cityOrTown: "Testtown", postalCode: "TT1 2AB" },
  accountsNextPeriodStart: "2025-04-01",
  accountsNextPeriodEnd: "2026-03-31",
  accountsLastPeriodStart: "2024-04-01",
  accountsLastPeriodEnd: "2025-03-31",
  accountsLastType: "micro-entity",
};

const stadiumProfile = {
  companyNumber: "03176906",
  companyName: "MILLENNIUM STADIUM PLC",
  dateOfCreation: "1996-03-20",
  accountsNextPeriodStart: "2026-01-01",
  accountsNextPeriodEnd: "2026-12-31",
  accountsLastPeriodStart: "2025-01-01",
  accountsLastPeriodEnd: "2025-12-31",
};

async function generate(profile, document, officers, periodEnd) {
  const lastAccounts = engine.mapIxbrlAccounts(document, {
    companyNumber: profile.companyNumber,
    periodEnd: profile.accountsLastPeriodEnd,
    regime: "any",
    firstAccounts: profile.accountsLastPeriodStart === profile.dateOfCreation,
  });
  const built = await engine.buildBookFromRegister({ profile, officers, lastAccounts, periodEnd });
  const { zip } = await engine.savePackageZip(built.book, built.lines);
  return { lastAccounts, built, zip: await JSZip.loadAsync(zip) };
}

async function workbook(zip, name) {
  const entry = Object.keys(zip.files).find((file) => file.endsWith(`/${name}`));
  return JSZip.loadAsync(await zip.file(entry).async("uint8array"));
}

async function sheetReader(zip, workbookName, sheetName) {
  const book = await workbook(zip, workbookName);
  const xml = await book.file((await buildSheetMap(book)).get(sheetName)).async("string");
  const sharedStrings = await loadSharedStrings(book);
  return (cell) => readCellValue(xml, cell, sharedStrings);
}

// The formula of E37, which the spreadsheet app evaluates on open: the opening balance sheet balances
// when the assets less the liabilities equal the capital and reserves.
const ASSET_CELLS = ["E13", "E15", "E16", "E18", "E28"];
const LIABILITY_CELLS = ["E20", "E21", "E22", "E23", "E24", "E26", "E30", "E31"];
const EQUITY_CELLS = ["E33", "E34", "E35"];

async function openingSheet(zip) {
  const read = await sheetReader(zip, "Financialaccounts.xlsx", "OpenAccounts");
  const sum = (cells) => cells.reduce((total, cell) => total + (Number(read(cell)) || 0), 0);
  return { read, assets: sum(ASSET_CELLS), liabilities: sum(LIABILITY_CELLS), equity: sum(EQUITY_CELLS) };
}

describe("the package generated from a filed micro-entity set", () => {
  let result;

  beforeAll(async () => {
    result = await generate(diyaProfile, fixture("diya-2025-accounts.xhtml"), OFFICERS);
  }, 600000);

  it("writes the opening balance sheet that balances and equals the filed one", async () => {
    const { assets, liabilities, equity } = await openingSheet(result.zip);
    const filed = result.lastAccounts.balanceSheet.currentYear;
    expect(assets - liabilities).toBe(equity);
    expect(assets - liabilities).toBe(filed.netAssets);
    expect(equity).toBe(filed.capitalAndReserves);
    expect(assets).toBe(filed.currentAssets + filed.fixedAssets);
    expect(liabilities).toBe(filed.creditorsWithinOneYear + filed.creditorsAfterOneYear);
  });

  it("writes the company and its registered office on OpenAccounts", async () => {
    const { read } = await openingSheet(result.zip);
    expect(read("E2")).toBe("DIY ACCOUNTING LIMITED");
    expect(String(read("E3"))).toContain("6846849");
    expect(read("J3")).toBe("1 Test Street");
    expect(read("J4")).toBe("Testtown");
  });

  it("names the directors and the secretary in Companysecretary.xlsx", async () => {
    const read = await sheetReader(result.zip, "Companysecretary.xlsx", "Directors&Secretary");
    expect(read("A2")).toBe("Antony Christopher CARTWRIGHT");
    expect(read("D2")).toBe("Director");
    expect(read("A3")).toBe("Samantha Ashley CARTWRIGHT");
    expect(read("D3")).toBe("Company Secretary");
  });

  it("leaves the register of members empty, since the public data states no shareholders", async () => {
    const read = await sheetReader(result.zip, "Companysecretary.xlsx", "RegisterofMembers");
    expect(read("A3") ?? "").toBe("");
    expect(result.built.book.members).toBeUndefined();
  });
});

describe("the package generated from a filed set with called up share capital", () => {
  it("writes the share capital on OpenAccounts and the opening balance sheet balances", async () => {
    const result = await generate(stadiumProfile, fixture("builder-small-filleted.xhtml"), []);
    const { read, assets, liabilities, equity } = await openingSheet(result.zip);
    const filed = result.lastAccounts.balanceSheet.currentYear;
    expect(read("E33")).toBe(filed.calledUpShareCapital);
    expect(filed.calledUpShareCapital).toBeGreaterThan(0);
    expect(assets - liabilities).toBe(equity);
    expect(assets - liabilities).toBe(filed.netAssets);
    expect(assets).toBe(filed.currentAssets + filed.fixedAssets);
    expect(liabilities).toBe(filed.creditorsWithinOneYear + filed.creditorsAfterOneYear);
    expect(result.built.differences.filter((difference) => difference.code === "filed-accounts")).toEqual([]);
  }, 600000);
});
