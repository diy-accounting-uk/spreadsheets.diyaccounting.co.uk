/* SPDX-License-Identifier: AGPL-3.0-only */
/* Copyright (C) 2025-2026 DIY Accounting Ltd */

// Builds the GA4 purchase payload for a completed donation. Pass the amount
// the buyer actually paid (a number) when it is known; pass null when it
// isn't, so the event reports no revenue rather than a guessed figure.
function buildPurchaseEvent(provider, product, amount, currency) {
  const resolvedCurrency = currency || "GBP";
  const value = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return {
    transaction_id: provider + "_" + Date.now(),
    value: value,
    currency: resolvedCurrency,
    items: [
      {
        item_id: product,
        item_name: product,
        price: value,
        currency: resolvedCurrency,
      },
    ],
  };
}

if (typeof window !== "undefined") {
  window.buildPurchaseEvent = buildPurchaseEvent;
}

// Builds the GA4 payload for a runner download -- the single-file HTML
// runner a reader can fetch without going through the donate flow, so the
// download and donation events reach GA4 in the shape a downloads-to-
// donations ratio can read straight off the export.
function buildRunnerDownloadEvent(product) {
  return { name: "runner_download", params: { product: product } };
}

if (typeof window !== "undefined") {
  window.buildRunnerDownloadEvent = buildRunnerDownloadEvent;
}

// GA4 ecommerce: view_item_list on the product catalogue page (index.html).
// Guarded on the product grid so this file can also be loaded on other pages
// for its builder functions without firing a duplicate event there.
(function () {
  if (typeof gtag !== "function") return;
  if (typeof document === "undefined" || !document.querySelector(".product-cards")) return;

  gtag("event", "view_item_list", {
    item_list_name: "Products",
    items: [
      { item_id: "BasicSoleTrader", item_name: "Basic Sole Trader", price: 0, currency: "GBP" },
      { item_id: "SelfEmployed", item_name: "Self Employed", price: 0, currency: "GBP" },
      { item_id: "Company", item_name: "Company Accounts", price: 0, currency: "GBP" },
      { item_id: "TaxiDriver", item_name: "Taxi Driver (Cabsmart)", price: 0, currency: "GBP" },
      { item_id: "Payslip05", item_name: "Payslips", price: 0, currency: "GBP" },
    ],
  });
})();
