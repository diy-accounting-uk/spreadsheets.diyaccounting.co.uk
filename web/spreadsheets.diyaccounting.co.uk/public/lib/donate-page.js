// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// Safe wrapper - gtag may not be loaded if blocked by consent/adblocker
function trackEvent(eventName, params) {
  if (typeof gtag === "function") {
    gtag("event", eventName, params);
  }
}

// Read query parameters from download page
const params = new URLSearchParams(window.location.search);
const productId = params.get("product") || "";
const filename = params.get("filename");
const downloadUrl = filename ? "/zips/" + encodeURIComponent(filename) : null;

// Save download context to sessionStorage for donation return flow
if (downloadUrl) {
  sessionStorage.setItem("donateProduct", productId);
  sessionStorage.setItem("donateFilename", filename);
}

// Show download link if a specific file was selected
if (downloadUrl) {
  const linkContainer = document.getElementById("download-link-container");
  const skipLink = document.getElementById("skip-donate-link");
  const browseContainer = document.getElementById("browse-products-container");
  linkContainer.classList.remove("hidden");
  browseContainer.classList.add("hidden");
  skipLink.href = downloadUrl;

  // GA4 ecommerce: begin_checkout when donate page loads with a product
  trackEvent("begin_checkout", {
    currency: "GBP",
    value: 0,
    items: [
      {
        item_id: productId,
        item_name: productId,
        price: 0,
        currency: "GBP",
      },
    ],
  });

  // GA4 ecommerce: add_to_cart when user clicks "Download without donating"
  skipLink.addEventListener("click", function () {
    trackEvent("add_to_cart", {
      currency: "GBP",
      value: 0,
      items: [
        {
          item_id: productId,
          item_name: productId,
          price: 0,
          currency: "GBP",
        },
      ],
    });
  });
}

// Fixed-price Stripe links carry a known amount before the redirect; a "custom"
// link lets the buyer set the amount on Stripe's own page, so it isn't known here.
document.querySelectorAll(".stripe-donate-link").forEach(function (link) {
  link.addEventListener("click", function () {
    const amount = this.getAttribute("data-amount");
    const value = amount === "custom" ? 0 : parseFloat(amount);
    if (amount === "custom") {
      sessionStorage.removeItem("donateAmount");
      sessionStorage.removeItem("donateCurrency");
    } else {
      sessionStorage.setItem("donateAmount", String(value));
      sessionStorage.setItem("donateCurrency", "GBP");
    }
    trackEvent("begin_checkout", {
      currency: "GBP",
      value: value,
      payment_method: "stripe",
      items: [
        {
          item_id: productId,
          item_name: productId,
          price: value,
          currency: "GBP",
        },
      ],
    });
  });
});

// GA4 ecommerce: begin_checkout when user submits the PayPal donate form.
// PayPal's donate button has no fixed amount - the buyer sets it on PayPal's
// own page, so it isn't known here.
document.getElementById("paypal-donate-form").addEventListener("submit", function () {
  sessionStorage.removeItem("donateAmount");
  sessionStorage.removeItem("donateCurrency");
  trackEvent("begin_checkout", {
    currency: "GBP",
    value: 0,
    payment_method: "paypal",
    items: [
      {
        item_id: productId,
        item_name: productId,
        price: 0,
        currency: "GBP",
      },
    ],
  });
});
