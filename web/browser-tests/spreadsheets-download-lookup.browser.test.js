// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/browser-tests/spreadsheets-download-lookup.browser.test.js
// The company lookup on the download page, with the public deadlines route stubbed.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { startStaticServer } from "./serve.js";

const publicDir = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");
const lookupUrl = "https://submit.diyaccounting.co.uk/api/v1/public/company-deadlines**";

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

[[products]]
id = "SelfEmployed"
name = "Self Employed"
description = "Self employed"

  [[products.periods]]
  date = "2026-03-31"
  label = "31 March 2026"
  short = "Any"
  format = "Excel 2007"
  filename = "GB Accounts SelfEmployed 2026-03-31 (Any) Excel 2007.zip"
`;

const matchesAnswer = {
  items: [
    { companyNumber: "00000006", companyName: "EXAMPLE TRADING LIMITED", companyStatus: "active", companyType: "ltd" },
    { companyNumber: "00000007", companyName: "EXAMPLE TRADING SERVICES LIMITED", companyStatus: "active", companyType: "ltd" },
  ],
};

const deadlinesAnswer = {
  companyNumber: "00000006",
  companyName: "EXAMPLE TRADING LIMITED",
  companyStatus: "active",
  companyType: "ltd",
  accountsNextPeriodStart: "2024-04-01",
  accountsNextPeriodEnd: "2025-03-31",
  accountsNextDue: "2025-12-31",
  accountsOverdue: true,
  accountsLastPeriodEnd: "2024-03-31",
};

function json(body, status = 200) {
  return { status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) };
}

let server;

test.beforeAll(async () => {
  server = await startStaticServer(publicDir);
});

test.afterAll(async () => {
  await server.close();
});

async function openPage(page, handleLookup) {
  await page.clock.install({ time: new Date("2026-11-22T10:00:00Z") });
  await page.route(`${server.baseUrl}/catalogue.toml`, (route) =>
    route.fulfill({ status: 200, contentType: "text/plain", body: catalogue }),
  );
  await page.route(lookupUrl, handleLookup);
  await page.goto(`${server.baseUrl}/download.html?product=Company`);
  await expect(page.locator("#company-lookup")).toBeVisible();
}

function answerBothCalls(route) {
  const url = new URL(route.request().url());
  return route.fulfill(url.searchParams.has("q") ? json(matchesAnswer) : json(deadlinesAnswer));
}

test.describe("Download page company lookup", () => {
  test("a search shows the close matches", async ({ page }) => {
    await openPage(page, answerBothCalls);
    await page.getByLabel("Find your company to see its year ends").fill("example trading");
    await page.getByRole("button", { name: "Find company" }).click();
    const list = page.getByRole("list", { name: "Matching companies" });
    await expect(list.getByRole("button")).toHaveCount(2);
    await expect(list).toContainText("EXAMPLE TRADING LIMITED (00000006, active)");
    await expect(page.locator("#company-status")).toHaveText("2 companies match. Choose one.");
  });

  test("the request goes to the Submit route with the typed text", async ({ page }) => {
    const urls = [];
    await openPage(page, (route) => {
      urls.push(route.request().url());
      return answerBothCalls(route);
    });
    await page.locator("#company-query").fill("example trading");
    await page.locator("#company-query").press("Enter");
    await expect(page.getByRole("list", { name: "Matching companies" })).toBeVisible();
    await page.getByRole("button", { name: /00000006/ }).click();
    await expect(page.getByRole("list", { name: "Periods with accounts not yet filed" })).toBeVisible();
    expect(urls).toEqual([
      "https://submit.diyaccounting.co.uk/api/v1/public/company-deadlines?q=example%20trading",
      "https://submit.diyaccounting.co.uk/api/v1/public/company-deadlines?number=00000006",
    ]);
  });

  test("picking a company shows the unfiled periods, the overdue one first and marked", async ({ page }) => {
    await openPage(page, answerBothCalls);
    await page.locator("#company-query").fill("example trading");
    await page.getByRole("button", { name: "Find company" }).click();
    await page.getByRole("button", { name: /00000006/ }).click();
    const periods = page.getByRole("list", { name: "Periods with accounts not yet filed" }).getByRole("button");
    await expect(periods).toHaveCount(3);
    await expect(periods.nth(0)).toContainText("1 April 2024 to 31 March 2025, accounts due 31 December 2025");
    await expect(periods.nth(0)).toContainText("Overdue");
    await expect(periods.nth(0)).not.toContainText("Computed");
    await expect(periods.nth(1)).toContainText("1 April 2025 to 31 March 2026, accounts due 31 December 2026");
    await expect(periods.nth(1)).toContainText("Computed as the twelve months after the period before");
    await expect(periods.nth(1)).not.toContainText("Overdue");
    await page.screenshot({ path: "target/browser-test-results/download-company-lookup.png", fullPage: true });
  });

  test("choosing a period selects its year end in the list and marks the package ready", async ({ page }) => {
    await openPage(page, answerBothCalls);
    await page.locator("#company-query").fill("example trading");
    await page.getByRole("button", { name: "Find company" }).click();
    await page.getByRole("button", { name: /00000006/ }).click();
    const periods = page.getByRole("list", { name: "Periods with accounts not yet filed" }).getByRole("button");
    await expect(periods.nth(0)).toContainText("Package ready to download");
    await periods.nth(1).click();
    await expect(page.locator("#period-select")).toHaveValue("0");
    await periods.nth(0).click();
    await expect(page.locator("#period-select")).toHaveValue("1");
    await expect(page.locator("#company-status")).toContainText("Selected in the year-end list. A package is ready to download.");
    await expect(page.locator("#download-donate-btn")).toHaveAttribute("href", /2025-03-31/);
  });

  test("a year end with no package shows that none is built yet and leaves the list alone", async ({ page }) => {
    await openPage(page, answerBothCalls);
    await page.locator("#company-query").fill("example trading");
    await page.getByRole("button", { name: "Find company" }).click();
    await page.getByRole("button", { name: /00000006/ }).click();
    const periods = page.getByRole("list", { name: "Periods with accounts not yet filed" }).getByRole("button");
    const before = await page.locator("#period-select").inputValue();
    await expect(periods.nth(2)).toContainText("No package built yet");
    await periods.nth(2).click();
    await expect(page.locator("#company-status")).toContainText("No package is built for this year end yet.");
    await expect(page.locator("#period-select")).toHaveValue(before);
  });

  test("an answer with no period start, overdue mark or last period end shows what it holds", async ({ page }) => {
    await openPage(page, (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.has("q")) return route.fulfill(json(matchesAnswer));
      return route.fulfill(
        json({
          companyNumber: "00000006",
          companyName: "EXAMPLE TRADING LIMITED",
          accountsNextPeriodEnd: "2027-03-31",
          accountsNextDue: "2027-12-31",
        }),
      );
    });
    await page.locator("#company-query").fill("example trading");
    await page.getByRole("button", { name: "Find company" }).click();
    await page.getByRole("button", { name: /00000006/ }).click();
    const periods = page.getByRole("list", { name: "Periods with accounts not yet filed" }).getByRole("button");
    await expect(periods).toHaveCount(1);
    await expect(periods.nth(0)).toContainText("Period ending 31 March 2027, accounts due 31 December 2027");
    await expect(periods.nth(0)).not.toContainText("Overdue");
  });

  test("a failed call shows a message and the period list still works", async ({ page }) => {
    await openPage(page, (route) => route.fulfill(json({ message: "broken" }, 502)));
    await page.locator("#company-query").fill("example trading");
    await page.getByRole("button", { name: "Find company" }).click();
    await expect(page.locator("#company-status")).toContainText("The company lookup is not available now.");
    await page.locator("#period-select").selectOption("1");
    await expect(page.locator("#period-select")).toHaveValue("1");
    await expect(page.locator("#download-donate-btn")).toHaveAttribute("href", /2025-03-31/);
  });

  test("a 429 and an empty result each show their own message", async ({ page }) => {
    let status = 429;
    await openPage(page, (route) => (status === 429 ? route.fulfill(json({ message: "busy" }, 429)) : route.fulfill(json({ items: [] }))));
    await page.locator("#company-query").fill("example trading");
    await page.getByRole("button", { name: "Find company" }).click();
    await expect(page.locator("#company-status")).toContainText("Companies House is busy.");
    status = 200;
    await page.getByRole("button", { name: "Find company" }).click();
    await expect(page.locator("#company-status")).toHaveText("No company matches that name or number.");
  });

  test("the lookup is hidden for a product that is not the Company one", async ({ page }) => {
    await openPage(page, answerBothCalls);
    await page.locator("#product-select").selectOption("SelfEmployed");
    await expect(page.locator("#company-lookup")).toBeHidden();
  });
});
