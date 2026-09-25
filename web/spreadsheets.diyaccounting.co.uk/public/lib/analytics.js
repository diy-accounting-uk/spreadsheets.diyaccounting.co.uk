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

// The three hosts sharing GA4 property 523400333, so a visit that starts on
// one and continues on another stays one session instead of two.
const GA4_LINKER_DOMAINS = ["diyaccounting.co.uk", "spreadsheets.diyaccounting.co.uk", "submit.diyaccounting.co.uk"];

gtag("js", new Date());
gtag("config", "G-X4ZPD99X2K", { linker: { domains: GA4_LINKER_DOMAINS } });

// This is a plain script, loaded before any module, so it keeps its own copy of the same
// crawler/agent list and the same behaviour-test marker Submit's web/public/lib/analytics.js
// classifies visits with (kept in step by web/unit-tests/analytics.test.js).
const GA4_BOT_USER_AGENT_PATTERNS = [
  "googlebot",
  "bingbot",
  "applebot",
  "slurp",
  "duckduckbot",
  "baiduspider",
  "yandexbot",
  "claudedesktop",
  "chatgpt-user",
  "perplexity-user",
  "google-extended",
  "diyaccounting-probe-monitor",
];

// Classifies this session for the visitor panels: "bot" for crawlers, AI agents and the
// canaries; "synthetic" for the behaviour-test suites, which mark themselves by setting
// requestIdPrefix in sessionStorage; "human" otherwise.
function classifyVisitorKindForGa4() {
  let userAgent = "";
  try {
    userAgent = (navigator.userAgent || "").toLowerCase();
  } catch {
    userAgent = "";
  }
  if (GA4_BOT_USER_AGENT_PATTERNS.some((pattern) => userAgent.includes(pattern))) {
    return "bot";
  }
  try {
    if (sessionStorage.getItem("requestIdPrefix") === "test_") {
      return "synthetic";
    }
  } catch {
    // sessionStorage unavailable: fall through to human
  }
  return "human";
}

gtag("set", "user_properties", { visitor_kind: classifyVisitorKindForGa4() });

// Dynamically load gtag.js (CSP: no inline scripts allowed)
const script = document.createElement("script");
script.async = true;
script.src = "https://www.googletagmanager.com/gtag/js?id=G-X4ZPD99X2K";
document.head.appendChild(script);

// CloudWatch RUM. SpreadsheetsStack overwrites /lib/rum-config.js at deploy time with the
// app monitor id, identity pool and guest role; the committed copy sets no config, so
// initRum() returns on a local server and in the browser tests.
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
document.head.appendChild(rumConfigScript);
