// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// The step on the download page that points a reader at DIY Accounting Submit. It follows the
// product the reader picked and offers only a filing production has for that product. A product
// with no filing today (Basic Sole Trader, Payslips) gets no step.

var PRICE_LINE = "It costs £9.99 a year (£0.99 a month), with a free day pass to try it.";

var SUBMIT_STEPS_BY_PRODUCT = {
  Company: {
    heading: "File your accounts with Companies House",
    text:
      "DIY Accounting Submit files micro-entity and small company accounts and confirmation statements to Companies House. " + PRICE_LINE,
    campaign: "company",
  },
  SelfEmployed: {
    heading: "File this return with HMRC",
    text: "If your business is VAT registered, DIY Accounting Submit is HMRC recognised and files your VAT return. " + PRICE_LINE,
    campaign: "self-employed",
  },
  TaxiDriver: {
    heading: "File this return with HMRC",
    text: "If your business is VAT registered, DIY Accounting Submit is HMRC recognised and files your VAT return. " + PRICE_LINE,
    campaign: "taxi-driver",
  },
};

var SUBMIT_STEP_LINK_TEXT = "File with DIY Accounting Submit";

// The step for a product id and a placement (download or donate-thanks), or null for no step.
function submitStepForProduct(productId, medium) {
  var step = SUBMIT_STEPS_BY_PRODUCT[productId];
  if (!step) return null;
  return {
    heading: step.heading,
    text: step.text,
    linkText: SUBMIT_STEP_LINK_TEXT,
    href:
      "https://submit.diyaccounting.co.uk/?utm_source=spreadsheets&utm_medium=" +
      encodeURIComponent(medium) +
      "&utm_campaign=" +
      encodeURIComponent(step.campaign),
  };
}

// Fill one step section from its step, or hide the section when there is none.
function renderSubmitStep(section, step) {
  if (!section) return;
  if (!step) {
    section.classList.add("hidden");
    return;
  }
  section.querySelector("h3").textContent = step.heading;
  section.setAttribute("aria-label", step.heading);
  section.querySelector("p").textContent = step.text;
  var link = section.querySelector("a");
  link.textContent = step.linkText;
  link.setAttribute("href", step.href);
  section.classList.remove("hidden");
}
