/* SPDX-License-Identifier: AGPL-3.0-only */
/* Copyright (C) 2025-2026 DIY Accounting Ltd */

// Cookie consent banner for GA4 analytics (spreadsheets.diyaccounting.co.uk)
// Ports the grant/restore mechanism from submit.diyaccounting.co.uk so
// consent behaviour is uniform across the estate: analytics_storage stays
// denied until the visitor accepts, and their choice is remembered in
// localStorage under the same "consent.analytics" key.
function hasConsentChoice() {
  try {
    return localStorage.getItem("consent.analytics") !== null;
  } catch (error) {
    console.warn("Failed to read consent choice from localStorage:", error);
    return false;
  }
}

function updateAnalyticsConsent(granted) {
  try {
    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", { analytics_storage: granted ? "granted" : "denied" });
    }
  } catch (error) {
    console.warn("Failed to update analytics consent:", error);
  }
}

function showConsentBannerIfNeeded() {
  if (hasConsentChoice()) return;
  if (document.getElementById("consent-banner")) return;
  const banner = document.createElement("div");
  banner.id = "consent-banner";
  banner.setAttribute("role", "region");
  banner.setAttribute("aria-label", "Cookie consent");
  banner.innerHTML = `
    <span>We use cookies to monitor performance and understand how people use this site. We'll only turn them on if you say yes. See our <a href="https://submit.diyaccounting.co.uk/privacy.html">privacy policy</a>.</span>
    <div class="consent-actions">
      <button id="consent-accept">Accept</button>
      <button id="consent-decline">Decline</button>
    </div>`;
  document.body.appendChild(banner);
  document.getElementById("consent-accept").onclick = () => {
    try {
      localStorage.setItem("consent.analytics", "granted");
    } catch (error) {
      console.warn("Failed to store consent in localStorage:", error);
    }
    document.body.removeChild(banner);
    updateAnalyticsConsent(true);
  };
  document.getElementById("consent-decline").onclick = () => {
    try {
      localStorage.setItem("consent.analytics", "declined");
    } catch (error) {
      console.warn("Failed to store consent in localStorage:", error);
    }
    document.body.removeChild(banner);
    updateAnalyticsConsent(false);
  };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", showConsentBannerIfNeeded);
} else {
  showConsentBannerIfNeeded();
}
