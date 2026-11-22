// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/browser-tests/diya-gl-ltd-company-book.browser.test.js
//
// "New book from a company" on the Company books page, with the public deadlines and register
// routes of DIY Accounting Submit stubbed: the lookup, the book for the chosen period, each case
// of the register's answer, each failed call, and the link that starts the action.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { startStaticServer } from "./serve.js";

const publicDir = path.join(process.cwd(), "web/diya-gl.co.uk/public");
const deadlinesUrl = "https://submit.diyaccounting.co.uk/api/v1/public/company-deadlines**";
const registerUrl = "https://submit.diyaccounting.co.uk/api/v1/public/company-register**";
const filedAccounts = fs.readFileSync(path.join(process.cwd(), "app/test/fixtures/ixbrl/diya-2025-accounts.xhtml"), "utf8");
const screenshotDir = path.join(process.cwd(), "target/browser-test-results");
fs.mkdirSync(screenshotDir, { recursive: true });

const BUILD_TIMEOUT = 60_000;

const matchesAnswer = {
  items: [{ companyNumber: "06846849", companyName: "DIY ACCOUNTING LIMITED", companyStatus: "active", companyType: "ltd" }],
};

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
  dateOfBirth: "1970-01-01",
};

const officers = [
  { name: "CARTWRIGHT, Antony Christopher", officerRole: "director", appointedOn: "2009-03-13", nationality: "British" },
  { name: "CARTWRIGHT, Samantha Ashley", officerRole: "secretary", appointedOn: "2010-02-01" },
];

const ixbrlAnswer = {
  profile,
  officers,
  filedAccounts: { status: "ixbrl", madeUpDate: "2025-03-31", accountsType: "micro-entity", filedOn: "2025-12-01", ixbrl: filedAccounts },
};

const pdfAnswer = {
  profile,
  officers,
  filedAccounts: { status: "pdf", madeUpDate: "2025-03-31", accountsType: "micro-entity", filedOn: "2025-12-01" },
};

const firstPeriodProfile = {
  companyNumber: "06846849",
  companyName: "DIY ACCOUNTING LIMITED",
  dateOfCreation: "2025-06-02",
  accountsNextPeriodStart: "2025-06-02",
  accountsNextPeriodEnd: "2026-03-31",
};

function deadlinesFor(answerProfile) {
  return {
    companyNumber: answerProfile.companyNumber,
    companyName: answerProfile.companyName,
    companyStatus: "active",
    companyType: "ltd",
    accountsNextPeriodStart: answerProfile.accountsNextPeriodStart,
    accountsNextPeriodEnd: answerProfile.accountsNextPeriodEnd,
    accountsNextDue: "2026-12-31",
    accountsOverdue: true,
  };
}

function json(body, status = 200) {
  return { status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) };
}

let closeServer;
let baseUrl;

test.beforeAll(async () => {
  const server = await startStaticServer(publicDir, path.join(process.cwd(), "infra/main/resources/diya-gl-security-headers.json"));
  baseUrl = server.baseUrl;
  closeServer = server.close;
});

test.afterAll(async () => {
  await closeServer();
});

// Stubs both routes. handleRegister answers the register route; the deadlines route answers the
// search with one match and the number lookup with the unfiled periods of answerProfile.
async function stubRoutes(page, handleRegister, answerProfile = profile) {
  await page.route(deadlinesUrl, (route) => {
    const url = new URL(route.request().url());
    return route.fulfill(url.searchParams.has("q") ? json(matchesAnswer) : json(deadlinesFor(answerProfile)));
  });
  await page.route(registerUrl, handleRegister);
}

async function openCompanyPage(page, search = "") {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(`${baseUrl}/ltd.html${search}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.DiyaGlPage && window.DiyaGlPage.manifest, null, { timeout: 30_000 });
}

// Opens the action, finds the company and chooses its first unfiled period.
async function chooseFirstPeriod(page) {
  await openCompanyPage(page);
  await page.getByRole("button", { name: "New book from a company" }).click();
  await page.locator("#company-book-query").fill("diy accounting");
  await page.getByRole("button", { name: "Find company" }).click();
  await expect(page.getByRole("list", { name: "Matching companies" })).toBeVisible();
  await page.getByRole("button", { name: /06846849/ }).click();
  await page.getByRole("list", { name: "Periods with accounts not yet filed" }).getByRole("button").first().click();
}

test.describe("DIYA-GL Company page — new book from a company", () => {
  test("a company with filed iXBRL accounts opens as a book with its name, period and opening figures", async ({ page }) => {
    const registerRequests = [];
    await stubRoutes(page, (route) => {
      registerRequests.push(route.request().url());
      return route.fulfill(json(ixbrlAnswer));
    });
    await openCompanyPage(page);
    await page.getByRole("button", { name: "New book from a company" }).click();
    await page.locator("#company-book-query").fill("diy accounting");
    await page.getByRole("button", { name: "Find company" }).click();
    await page.getByRole("button", { name: /06846849/ }).click();
    const periods = page.getByRole("list", { name: "Periods with accounts not yet filed" });
    await expect(periods).toContainText("1 April 2025 to 31 March 2026, accounts due 31 December 2026");
    await expect(periods).toContainText("Overdue");
    await page.screenshot({ path: path.join(screenshotDir, "company-book-matches.png") });

    await periods.getByRole("button").first().click();
    await expect(page.locator("#app-title")).toContainText("DIY ACCOUNTING LIMITED", { timeout: BUILD_TIMEOUT });
    await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached();
    await expect(page.locator("#view-root")).toContainText("£3,353.00");
    expect(registerRequests).toEqual(["https://submit.diyaccounting.co.uk/api/v1/public/company-register?number=06846849"]);
    await expect(page.locator("#toast")).toContainText("Opened a book for DIY ACCOUNTING LIMITED from Companies House.");
    await expect(page.locator("#toast")).toContainText("the book carries no members");
    await page.screenshot({ path: path.join(screenshotDir, "company-book-opened.png") });

    const held = await page.evaluate(() => {
      const { book, lines } = window.DiyaGlPage.currentBook();
      return { book, lines, source: window.DIYA_GL_SNAPSHOT.source };
    });
    expect(held.source).toMatchObject({ kind: "register", product: "ltd" });
    expect(held.book.documentInfo.periodCoveredStart.toString().slice(0, 10)).toBe("2025-04-01");
    expect(held.book.documentInfo.periodCoveredEnd.toString().slice(0, 10)).toBe("2026-03-31");
    expect(held.book.directors.map((director) => director.name)).toEqual(["Antony Christopher CARTWRIGHT", "Samantha Ashley CARTWRIGHT"]);
    expect(held.lines.length).toBeGreaterThan(0);
    const text = JSON.stringify(held.book);
    expect(text).not.toContain("1970");
    expect(text).not.toContain("British");
    expect(held.book.members ?? []).toEqual([]);
  });

  test("a company whose last accounts are a PDF opens with its officers and no opening figures", async ({ page }) => {
    await stubRoutes(page, (route) => route.fulfill(json(pdfAnswer)));
    await chooseFirstPeriod(page);
    await expect(page.locator("#app-title")).toContainText("DIY ACCOUNTING LIMITED", { timeout: BUILD_TIMEOUT });
    await expect(page.locator("#toast")).toContainText("Type the opening balances from the filed accounts.");
    const held = await page.evaluate(() => window.DiyaGlPage.currentBook());
    expect(held.lines).toEqual([]);
    expect(held.book.directors).toHaveLength(2);
  });

  test("a company with no accounts filed opens with the company and its officers", async ({ page }) => {
    const answer = {
      profile: { ...firstPeriodProfile, dateOfCreation: "2025-04-01", accountsNextPeriodStart: "2025-04-01" },
      officers,
      filedAccounts: { status: "none" },
    };
    await stubRoutes(page, (route) => route.fulfill(json(answer)), answer.profile);
    await chooseFirstPeriod(page);
    await expect(page.locator("#app-title")).toContainText("DIY ACCOUNTING LIMITED", { timeout: BUILD_TIMEOUT });
    await expect(page.locator("#toast")).toContainText("The company has filed no accounts, so the book starts empty.");
    const held = await page.evaluate(() => window.DiyaGlPage.currentBook());
    expect(held.lines).toEqual([]);
    expect(held.book.directors).toHaveLength(2);
  });

  test("a period that is not twelve whole months opens, and the package save says why it builds none", async ({ page }) => {
    const answer = { profile: firstPeriodProfile, officers, filedAccounts: { status: "none" } };
    await stubRoutes(page, (route) => route.fulfill(json(answer)), firstPeriodProfile);
    await chooseFirstPeriod(page);
    await expect(page.locator("#app-title")).toContainText("DIY ACCOUNTING LIMITED", { timeout: BUILD_TIMEOUT });
    const held = await page.evaluate(() => window.DiyaGlPage.currentBook());
    expect(held.book.documentInfo.periodCoveredStart.toString().slice(0, 10)).toBe("2025-06-02");

    await page.locator("#save-btn").click();
    await page.getByRole("menuitem", { name: "Download as a spreadsheet package (.zip)" }).click();
    await expect(page.locator("#toast")).toContainText("No package is built for the period 2 June 2025 to 31 March 2026.");
    await expect(page.locator("#toast")).toContainText("Save the book as a diya-gl file instead.");
  });

  for (const [label, status, message] of [
    ["a 404", 404, "Companies House has no company with that number."],
    ["a 413", 413, "The last filed accounts of this company are too large for this page to read."],
    ["a 429", 429, "Companies House is busy. Try again in a few minutes."],
    ["a 502", 502, "The company book is not available now."],
  ]) {
    test(`${label} shows a message beside the action and the rest of the page works`, async ({ page }) => {
      await stubRoutes(page, (route) => route.fulfill(json({ message: "no" }, status)));
      await chooseFirstPeriod(page);
      await expect(page.locator("#company-book-status")).toContainText(message);
      await expect(page.locator("#app-title")).not.toContainText("DIY ACCOUNTING LIMITED");
      await expect(page.getByRole("button", { name: "Find company" })).toBeEnabled();
      await page.getByRole("button", { name: "Start a new book" }).click();
      await expect(page.locator("#new-book-form")).toBeVisible();
    });
  }

  test("a call that fails to connect shows a message beside the action", async ({ page }) => {
    await stubRoutes(page, (route) => route.abort());
    await chooseFirstPeriod(page);
    await expect(page.locator("#company-book-status")).toContainText("The company book is not available now.");
  });

  test("a failed lookup shows a message beside the action", async ({ page }) => {
    await page.route(deadlinesUrl, (route) => route.fulfill(json({ message: "busy" }, 429)));
    await openCompanyPage(page);
    await page.getByRole("button", { name: "New book from a company" }).click();
    await page.locator("#company-book-query").fill("diy accounting");
    await page.getByRole("button", { name: "Find company" }).click();
    await expect(page.locator("#company-book-status")).toContainText("Companies House is busy.");
  });

  test("?company= starts the action for that company and lists its periods", async ({ page }) => {
    await stubRoutes(page, (route) => route.fulfill(json(ixbrlAnswer)));
    await openCompanyPage(page, "?company=06846849");
    await expect(page.locator("#company-book-query")).toHaveValue("06846849");
    await expect(page.getByRole("list", { name: "Periods with accounts not yet filed" })).toContainText("1 April 2025 to 31 March 2026");
    expect(new URL(page.url()).search).toBe("");
  });

  test("?company= with &yearEnd= opens the book for that period", async ({ page }) => {
    await stubRoutes(page, (route) => route.fulfill(json(ixbrlAnswer)));
    await openCompanyPage(page, "?company=06846849&yearEnd=2026-03-31");
    await expect(page.locator("#app-title")).toContainText("DIY ACCOUNTING LIMITED", { timeout: BUILD_TIMEOUT });
    const held = await page.evaluate(() => window.DiyaGlPage.currentBook());
    expect(held.book.documentInfo.periodCoveredEnd.toString().slice(0, 10)).toBe("2026-03-31");
  });
});
