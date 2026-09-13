// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/browser-tests/site-ecommerce-events.browser.test.js
//
// The GA4 ecommerce events the plain site pages send: view_item_list on
// index.html, view_item and begin_checkout on download.html, runner_download
// on its offline-runner links, purchase on the Stripe/PayPal return trip,
// and begin_checkout/add_to_cart on the built donate.html. Same
// read-back-off-dataLayer approach as
// web/browser-tests/diya-gl-measurement.browser.test.js: analytics.js's
// local gtag() always queues onto window.dataLayer whether or not the
// remote gtag.js script reached googletagmanager.com, so that array is the
// signal to read.
//
// Every link under test here leaves the tab for a live domain (Stripe,
// PayPal) or a page this static checkout does not carry (donate.html's own
// donation-return redirect target). Aborting or faking the resulting
// request does not keep the tab on this page -- a failed top-level
// navigation still discards the current document for a network-error page,
// which would silently empty window.dataLayer before the test can read it
// back. The fix used throughout is to stop the navigation at the DOM level
// instead: a capturing preventDefault listener added right before the
// click (harmless to add after the page's own listener -- preventDefault()
// cancels the default action regardless of listener order) for a plain
// link or form, and a Content-Disposition: attachment response for the one
// case (the Stripe/PayPal return trip) that navigates via window.location
// rather than a click -- exactly how the real /zips/ download behaves, so
// the browser downloads rather than navigates and the document survives.

import { test, expect } from "@playwright/test";
import path from "node:path";
import { startStaticServer } from "./serve.js";

const PUBLIC_DIR = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");

let closeServer;
let baseUrl;

test.beforeAll(async () => {
  const server = await startStaticServer(PUBLIC_DIR);
  baseUrl = server.baseUrl;
  closeServer = server.close;
});

test.afterAll(async () => {
  await closeServer();
});

function gaEvents(page, eventName) {
  return page.evaluate(
    (name) => (window.dataLayer || []).filter((entry) => entry[0] === "event" && entry[1] === name).map((entry) => entry[2]),
    eventName,
  );
}

// Consent granted up front, the same as diya-gl-measurement.browser.test.js,
// so the cookie banner never covers the page and every trackEvent call
// queues onto dataLayer for the test to read back.
async function withConsent(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.localStorage.setItem("consent.analytics", "granted"));
  await page.reload({ waitUntil: "domcontentloaded" });
}

// Stops the element's next click (or submit) from navigating the page at
// all, while leaving every listener the page itself registered -- including
// the one that sends the GA4 event -- to run exactly as it would for a real
// visitor.
async function preventNextDefault(page, selector, eventType = "click") {
  await page.evaluate(
    ({ selector, eventType }) => document.querySelector(selector).addEventListener(eventType, (e) => e.preventDefault()),
    { selector, eventType },
  );
}

test.describe("index.html — GA4 events", () => {
  test("the product grid fires view_item_list once, for all five products", async ({ page }) => {
    await withConsent(page, `${baseUrl}/index.html`);

    const events = await gaEvents(page, "view_item_list");
    expect(events).toHaveLength(1);
    expect(events[0].item_list_name).toBe("Products");
    expect(events[0].items.map((item) => item.item_id)).toEqual(["BasicSoleTrader", "SelfEmployed", "Company", "TaxiDriver", "Payslip05"]);
  });
});

test.describe("download.html — GA4 events", () => {
  test("the catalogue loading fires view_item for the selected product", async ({ page }) => {
    await withConsent(page, `${baseUrl}/download.html`);
    await page.waitForSelector("#download-form:not(.hidden)");

    const events = await gaEvents(page, "view_item");
    expect(events.length).toBeGreaterThan(0);
    const selected = await page.locator("#product-select").inputValue();
    expect(events[events.length - 1].items[0].item_id).toBe(selected);
  });

  test("the donate button fires begin_checkout without navigating to donate.html", async ({ page }) => {
    await withConsent(page, `${baseUrl}/download.html`);
    await page.waitForSelector("#download-form:not(.hidden)");
    const selected = await page.locator("#product-select").inputValue();

    await preventNextDefault(page, "#download-donate-btn");
    await page.click("#download-donate-btn");

    const events = await gaEvents(page, "begin_checkout");
    expect(events).toHaveLength(1);
    expect(events[0].items[0].item_id).toBe(selected);
    // Still on download.html -- the click never navigated.
    await expect(page.locator("#download-form")).toBeVisible();
  });

  test("a runner download link fires runner_download with the product", async ({ page }) => {
    await withConsent(page, `${baseUrl}/download.html`);

    // Built by scripts/build-diya-gl-bundle.mjs, so this static checkout
    // carries no runners/ directory -- fulfil the request so the download
    // attribute still completes and the click handler's own event fires.
    // The download attribute means this never navigates the tab regardless.
    await page.route("**/runners/diya-gl-bst.html", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<html></html>" }),
    );
    const [download] = await Promise.all([page.waitForEvent("download"), page.click("#runner-bst-link")]);
    await download.cancel();

    const events = await gaEvents(page, "runner_download");
    expect(events).toEqual([{ product: "bst" }]);
  });

  test("returning from Stripe with a saved download fires purchase with the amount and currency", async ({ page }) => {
    await page.goto(`${baseUrl}/download.html`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.localStorage.setItem("consent.analytics", "granted");
      window.sessionStorage.setItem("donateProduct", "BasicSoleTrader");
      window.sessionStorage.setItem("donateFilename", "basic-sole-trader.xlsx");
      window.sessionStorage.setItem("donateAmount", "20");
      window.sessionStorage.setItem("donateCurrency", "GBP");
    });
    // A real /zips/ response carries no Content-Disposition -- the browser
    // still downloads it because <a download> drives the actual product
    // link, but window.location = fileUrl here relies on the S3 object's
    // own header. Serve the same header so this stays a download, not a
    // navigation, exactly like the real file would.
    await page.route("**/zips/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/octet-stream",
        headers: { "content-disposition": "attachment; filename=basic-sole-trader.xlsx" },
        body: "",
      }),
    );

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.goto(`${baseUrl}/download.html?stripe=success`, { waitUntil: "domcontentloaded" }),
    ]);
    await download.cancel();

    const events = await gaEvents(page, "purchase");
    expect(events).toHaveLength(1);
    expect(events[0].value).toBe(20);
    expect(events[0].currency).toBe("GBP");
    expect(events[0].items[0].item_id).toBe("BasicSoleTrader");
    expect(events[0].transaction_id.startsWith("stripe_")).toBe(true);
  });
});

test.describe("donate.html — GA4 events", () => {
  test("carries the four ci test-mode Stripe Payment Links, not the template placeholders", async ({ page }) => {
    await page.goto(`${baseUrl}/donate.html`, { waitUntil: "domcontentloaded" });

    const hrefs = await page.locator(".stripe-donate-link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(hrefs).toHaveLength(4);
    for (const href of hrefs) {
      expect(href).toMatch(/^https:\/\/buy\.stripe\.com\/test_/);
      expect(href).not.toContain("{{");
    }
  });

  test("a fixed-amount Stripe link fires begin_checkout with the amount and currency, without leaving the page", async ({ page }) => {
    await withConsent(page, `${baseUrl}/donate.html?product=BasicSoleTrader&filename=basic-sole-trader.xlsx`);

    await preventNextDefault(page, '.stripe-donate-link[data-amount="20"]');
    await page.click('.stripe-donate-link[data-amount="20"]');

    const events = await gaEvents(page, "begin_checkout");
    const stripeCheckout = events.find((event) => event.payment_method === "stripe");
    expect(stripeCheckout).toMatchObject({ currency: "GBP", value: 20, payment_method: "stripe" });
    expect(stripeCheckout.items[0].item_id).toBe("BasicSoleTrader");
    // Still on donate.html -- the click never reached buy.stripe.com.
    await expect(page.locator(".donate-amounts")).toBeVisible();
  });

  test("the PayPal form fires begin_checkout with payment_method paypal, without leaving the page", async ({ page }) => {
    await withConsent(page, `${baseUrl}/donate.html?product=BasicSoleTrader&filename=basic-sole-trader.xlsx`);

    await preventNextDefault(page, "#paypal-donate-form", "submit");
    await page.click("#paypal-donate-form button[type=submit]");

    const events = await gaEvents(page, "begin_checkout");
    const paypalCheckout = events.find((event) => event.payment_method === "paypal");
    expect(paypalCheckout).toBeTruthy();
    expect(paypalCheckout.items[0].item_id).toBe("BasicSoleTrader");
    await expect(page.locator(".donate-amounts")).toBeVisible();
  });

  test("downloading without donating fires add_to_cart, without leaving the page", async ({ page }) => {
    await withConsent(page, `${baseUrl}/donate.html?product=BasicSoleTrader&filename=basic-sole-trader.xlsx`);

    await preventNextDefault(page, "#skip-donate-link");
    await page.click("#skip-donate-link");

    const events = await gaEvents(page, "add_to_cart");
    expect(events).toHaveLength(1);
    expect(events[0].items[0].item_id).toBe("BasicSoleTrader");
  });
});
