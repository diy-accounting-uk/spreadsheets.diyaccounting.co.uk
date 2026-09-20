// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

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

// CloudWatch RUM. SpreadsheetsStack writes /lib/rum-config.js at deploy time with the
// app monitor id, identity pool and guest role; the local server and the browser tests
// have no such file, so a failed load is silent and initRum() returns.
function hasAnalyticsConsent() {
  try {
    return localStorage.getItem("consent.analytics") === "granted";
  } catch (error) {
    console.warn("Failed to read analytics consent from localStorage:", error);
    return false;
  }
}

function initRum() {
  if (window.__RUM_INIT_DONE__) return;
  if (!hasAnalyticsConsent()) return;
  const c = window.__RUM_CONFIG__;
  if (!c || !c.appMonitorId || !c.identityPoolId || !c.guestRoleArn || !c.region) return;

  /* eslint-disable sonarjs/no-parameter-reassignment */
  (function (n, i, v, r, s, config, u, x, z) {
    x = window.AwsRumClient = { q: [], n: n, i: i, v: v, r: r, c: config, u: u };
    window[n] = function (c, p) {
      x.q.push({ c: c, p: p });
    };
    z = document.createElement("script");
    z.async = true;
    z.src = s;
    z.onload = function () {
      window.__RUM_INIT_DONE__ = true;
    };
    z.onerror = function (e) {
      console.warn("Failed to load RUM client:", e);
    };
    document.head.appendChild(z);
  })("cwr", c.appMonitorId, "0.1.0", c.region, "https://client.rum.us-east-1.amazonaws.com/1.25.0/cwr.js", {
    sessionSampleRate: c.sessionSampleRate ?? 1,
    guestRoleArn: c.guestRoleArn,
    identityPoolId: c.identityPoolId,
    endpoint: `https://dataplane.rum.${c.region}.amazonaws.com`,
    telemetries: ["performance", "errors", "http"],
    allowCookies: true,
    enableXRay: true,
  });
  /* eslint-enable sonarjs/no-parameter-reassignment */
}

const rumConfigScript = document.createElement("script");
rumConfigScript.async = true;
rumConfigScript.src = "/lib/rum-config.js";
rumConfigScript.onload = initRum;
rumConfigScript.onerror = () => {};
document.head.appendChild(rumConfigScript);
