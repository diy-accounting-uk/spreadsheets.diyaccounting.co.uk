// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/browser-tests/spreadsheets-download-generate.browser.test.js
// The Generate option on the download page, with the public deadlines and register routes stubbed.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { startStaticServer } from "./serve.js";
import { buildSheetMap, loadSharedStrings, readCellValue } from "../../app/lib/xlsx-parts.js";

const publicDir = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");
const deadlinesUrl = "https://submit.diyaccounting.co.uk/api/v1/public/company-deadlines**";
const registerUrl = "https://submit.diyaccounting.co.uk/api/v1/public/company-register**";
const filedAccounts = fs.readFileSync(path.join(process.cwd(), "app/test/fixtures/ixbrl/diya-2025-accounts.xhtml"), "utf8");

const catalogue = `generated = "2026-11-22"

[[products]]
id = "Company"
name = "Company"
description = "Company accounts"

  [[products.periods]]
  date = "2026-03-31"
  label = "31 March 2026"
  short = "Any"
  format = "Excel 2007"
  filename = "GB Accounts Company 2026-03-31 (Any) Excel 2007.zip"

  [[products.periods]]
  date = "2025-03-31"
  label = "31 March 2025"
  short = "Any"
  format = "Excel 2007"
  filename = "GB Accounts Company 2025-03-31 (Any) Excel 2007.zip"
`;

const matchesAnswer = {
  items: [{ companyNumber: "06846849", companyName: "DIY ACCOUNTING LIMITED", companyStatus: "active", companyType: "ltd" }],
};

function deadlinesFor(profile) {
  return {
    companyNumber: profile.companyNumber,
    companyName: profile.companyName,
    companyStatus: "active",
    companyType: "ltd",
    accountsNextPeriodStart: profile.accountsNextPeriodStart,
    accountsNextPeriodEnd: profile.accountsNextPeriodEnd,
    accountsNextDue: "2026-12-31",
    accountsOverdue: false,
  };
}

const profile = {
  companyNumber: "06846849",
  companyName: "DIY ACCOUNTING LIMITED",
  dateOfCreation: "2009-03-13",
  registeredOffice: { addressLine1: "1 Test Street", cityOrTown: "Testtown", postalCode: "TT1 2AB", country: "England" },
  accountsNextPeriodStart: "2025-04-01",
  accountsNextPeriodEnd: "2026-03-31",
  accountsLastPeriodStart: "2024-04-01",
  accountsLastPeriodEnd: "2025-03-31",
  accountsLastType: "micro-entity",
};

const officers = [
  { name: "CARTWRIGHT, Antony Christopher", officerRole: "director", appointedOn: "2009-03-13" },
  { name: "CARTWRIGHT, Samantha Ashley", officerRole: "secretary", appointedOn: "2010-02-01" },
];

const ixbrlAnswer = {
  profile,
  officers,
  filedAccounts: {
    status: "ixbrl",
    madeUpDate: "2025-03-31",
    accountsType: "micro-entity",
    filedOn: "2025-12-01",
    ixbrl: filedAccounts,
  },
};

const pdfAnswer = {
  profile,
  officers,
  filedAccounts: { status: "pdf", madeUpDate: "2025-03-31", accountsType: "micro-entity", filedOn: "2025-12-01" },
};

const newCompanyProfile = {
  companyNumber: "06846849",
  companyName: "DIY ACCOUNTING LIMITED",
  dateOfCreation: "2025-04-01",
  accountsNextPeriodStart: "2025-04-01",
  accountsNextPeriodEnd: "2026-03-31",
};

function json(body, status = 200, headers = {}) {
  return {
    status,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*", ...headers },
    body: JSON.stringify(body),
  };
}

// Loading the engine and the templates and writing the package takes several seconds.
const BUILD_TIMEOUT = 60_000;

let server;

test.beforeAll(async () => {
  server = await startStaticServer(publicDir);
});

test.afterAll(async () => {
  await server.close();
});

// Opens the page, finds the company and chooses the first unfiled period. handleRegister answers the register route.
async function chooseFirstPeriod(page, handleRegister, answerProfile = profile) {
  await page.route(`${server.baseUrl}/catalogue.toml`, (route) =>
    route.fulfill({ status: 200, contentType: "text/plain", body: catalogue }),
  );
  await page.route(deadlinesUrl, (route) => {
    const url = new URL(route.request().url());
    return route.fulfill(url.searchParams.has("q") ? json(matchesAnswer) : json(deadlinesFor(answerProfile)));
  });
  await page.route(registerUrl, handleRegister);
  await page.goto(`${server.baseUrl}/download.html?product=Company`);
  await expect(page.locator("#company-lookup")).toBeVisible();
  await page.locator("#company-query").fill("diy accounting");
  await page.getByRole("button", { name: "Find company" }).click();
  await page.getByRole("button", { name: /06846849/ }).click();
  await page.getByRole("list", { name: "Periods with accounts not yet filed" }).getByRole("button").first().click();
  await expect(page.locator("#company-generate")).toBeVisible();
}

async function generate(page) {
  await page.getByRole("button", { name: "Generate", exact: true }).click();
}

async function cellReader(zip, entries, workbookName, sheetName) {
  const workbook = await JSZip.loadAsync(await zip.file(entries.find((entry) => entry.endsWith(`/${workbookName}`))).async("uint8array"));
  const xml = await workbook.file((await buildSheetMap(workbook)).get(sheetName)).async("string");
  const sharedStrings = await loadSharedStrings(workbook);
  return (cell) => readCellValue(xml, cell, sharedStrings);
}

async function downloadedZip(page) {
  const download = page.waitForEvent("download");
  await page.locator("#company-generate-download").click();
  const saved = await download;
  const zip = await JSZip.loadAsync(fs.readFileSync(await saved.path()));
  return { name: saved.suggestedFilename(), entries: Object.keys(zip.files), zip };
}

test.describe("Download page generate option", () => {
  test("a company with filed iXBRL accounts gets a package to download", async ({ page }) => {
    const requests = [];
    page.on("request", (request) => requests.push(request.url()));
    const registerRequests = [];
    await chooseFirstPeriod(page, (route) => {
      registerRequests.push(route.request());
      return route.fulfill(json(ixbrlAnswer));
    });
    await expect(page.locator("#company-generate-prompt")).toContainText("DIY ACCOUNTING LIMITED, year ended 31 March 2026");
    expect(requests.filter((url) => url.includes("/generate/"))).toEqual([]);

    await generate(page);
    await expect(page.locator("#company-generate-status")).toHaveText("The package is ready.", { timeout: BUILD_TIMEOUT });
    expect(registerRequests).toHaveLength(1);
    expect(registerRequests[0].url()).toBe("https://submit.diyaccounting.co.uk/api/v1/public/company-register?number=06846849");
    expect(requests.some((url) => url.endsWith("/generate/engine/diya-gl-engine.js"))).toBe(true);

    const contents = page.locator("#company-generate-result");
    await expect(contents).toContainText(
      "Opening balance sheet on the OpenAccounts sheet, from the accounts filed for the year ended 31 March 2025.",
    );
    await expect(contents).toContainText("Directors and secretary: 2, in Companysecretary.xlsx.");
    await expect(contents).toContainText("Register of members: left for you. The public Companies House data lists no shareholders.");
    await page.screenshot({ path: "target/browser-test-results/download-generate-ready.png", fullPage: true });

    const { name, entries, zip } = await downloadedZip(page);
    expect(name).toBe("GB Accounts Company 2026-03-31 (Mar26) Excel 2007.zip");
    expect(entries.filter((entry) => entry.endsWith("Financialaccounts.xlsx"))).toHaveLength(1);
    const read = (workbookName, sheetName) => cellReader(zip, entries, workbookName, sheetName);
    const directors = await read("Companysecretary.xlsx", "Directors&Secretary");
    expect(directors("A2")).toBe("Antony Christopher CARTWRIGHT");
    expect(directors("D2")).toBe("Director");
    expect(directors("A3")).toBe("Samantha Ashley CARTWRIGHT");
    expect(directors("D3")).toBe("Company Secretary");
    const opening = await read("Financialaccounts.xlsx", "OpenAccounts");
    expect(opening("E2")).toBe("DIY ACCOUNTING LIMITED");
    expect(opening("E18")).toBe(3353);
    expect(opening("E20")).toBe(3219);
    expect(opening("E34")).toBe(134);
  });

  test("a company whose last accounts are a PDF gets a package with no opening figures and the reason", async ({ page }) => {
    await chooseFirstPeriod(page, (route) => route.fulfill(json(pdfAnswer)));
    await generate(page);
    await expect(page.locator("#company-generate-status")).toHaveText("The package is ready.", { timeout: BUILD_TIMEOUT });
    const contents = page.locator("#company-generate-result");
    await expect(contents).toContainText("No opening balance sheet. The accounts last filed, for the year ended 31 March 2025, are a PDF");
    await expect(contents).toContainText("Type the opening balances from the filed accounts.");
    await expect(contents).toContainText("Directors and secretary: 2");
    const { entries } = await downloadedZip(page);
    expect(entries.some((entry) => entry.endsWith("Companysecretary.xlsx"))).toBe(true);
  });

  test("a company with no accounts filed gets a package that starts empty", async ({ page }) => {
    await chooseFirstPeriod(
      page,
      (route) => route.fulfill(json({ profile: newCompanyProfile, officers, filedAccounts: { status: "none" } })),
      newCompanyProfile,
    );
    await generate(page);
    await expect(page.locator("#company-generate-status")).toHaveText("The package is ready.", { timeout: BUILD_TIMEOUT });
    const contents = page.locator("#company-generate-result");
    await expect(contents).toContainText("No opening balance sheet. Companies House holds no accounts figures for this company.");
    await expect(contents).toContainText("The company has filed no accounts, so the book starts empty.");
    await expect(page.locator("#company-generate-download")).toBeVisible();
  });

  test("a period that is not twelve whole months gets no package and the reason", async ({ page }) => {
    const firstPeriod = { ...newCompanyProfile, dateOfCreation: "2025-06-02", accountsNextPeriodStart: "2025-06-02" };
    await chooseFirstPeriod(
      page,
      (route) => route.fulfill(json({ profile: firstPeriod, officers, filedAccounts: { status: "none" } })),
      firstPeriod,
    );
    await generate(page);
    await expect(page.locator("#company-generate-status")).toContainText(
      "No package is built for the period 2 June 2025 to 31 March 2026.",
      { timeout: BUILD_TIMEOUT },
    );
    await expect(page.locator("#company-generate-status")).toContainText("twelve whole months");
    await expect(page.locator("#company-generate-download")).toHaveCount(0);
  });

  for (const [label, status, headers, message] of [
    ["a 404", 404, {}, "Companies House has no company with that number."],
    ["a 413", 413, {}, "The last filed accounts of this company are too large for this page to read."],
    ["a 429", 429, { "retry-after": "120" }, "Companies House is busy. Try again in a few minutes."],
    ["a 502", 502, {}, "The package builder is not available now."],
  ]) {
    test(`${label} shows a message beside the option and the rest of the page works`, async ({ page }) => {
      await chooseFirstPeriod(page, (route) => route.fulfill(json({ message: "no" }, status, headers)));
      await generate(page);
      await expect(page.locator("#company-generate-status")).toContainText(message);
      await expect(page.locator("#company-generate-download")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Generate", exact: true })).toBeEnabled();
      await page.locator("#period-select").selectOption("1");
      await expect(page.locator("#download-donate-btn")).toHaveAttribute("href", /2025-03-31/);
    });
  }

  test("a call that fails to connect shows a message and the rest of the page works", async ({ page }) => {
    await chooseFirstPeriod(page, (route) => route.abort());
    await generate(page);
    await expect(page.locator("#company-generate-status")).toContainText("The package builder is not available now.");
    await page.locator("#period-select").selectOption("1");
    await expect(page.locator("#download-donate-btn")).toHaveAttribute("href", /2025-03-31/);
  });
});
