/* SPDX-License-Identifier: AGPL-3.0-only */
/* Copyright (C) 2025-2026 DIY Accounting Ltd */

// Google Analytics 4 — Spreadsheets (spreadsheets.diyaccounting.co.uk)
// Measurement ID: G-X4ZPD99X2K
window.dataLayer = window.dataLayer || [];
function gtag() {
  dataLayer.push(arguments);
}
gtag("consent", "default", { analytics_storage: "denied" });
// A returning visitor who already accepted the cookie banner shouldn't have
// to accept it again on every page — apply their saved choice straight away.
try {
  if (localStorage.getItem("consent.analytics") === "granted") {
    gtag("consent", "update", { analytics_storage: "granted" });
  }
} catch (error) {
  console.warn("Failed to read analytics consent from localStorage:", error);
}
gtag("js", new Date());
gtag("config", "G-X4ZPD99X2K");

// Dynamically load gtag.js (CSP: no inline scripts allowed)
const script = document.createElement("script");
script.async = true;
script.src = "https://www.googletagmanager.com/gtag/js?id=G-X4ZPD99X2K";
document.head.appendChild(script);
