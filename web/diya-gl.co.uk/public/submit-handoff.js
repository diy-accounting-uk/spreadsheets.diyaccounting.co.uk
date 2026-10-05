// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/diya-gl.co.uk/public/submit-handoff.js
//
// Sends figures the loaded book derives to DIY Accounting Submit. The figures ride in the URL
// fragment of Submit's filing page as "#books=<base64url of UTF-8 JSON>", which no server or log
// receives; Submit's widgets/books-import.js and lib/auth-url-builder.js read it and validate it.
// The JSON is { kind, sourceFileName, packageVersion, period, figures }:
//   kind "vat"             period { periodStart, periodEnd }
//                          figures the seven VAT box ids
//   kind "itsa-quarterly"  period { taxYear, periodStartDate, periodEndDate }
//                          figures { periodIncome, periodExpenses, periodDisallowableExpenses }
//   kind "itsa-annual"     period { taxYear }, figures { allowances, adjustments }
// A manifest names the kinds its product offers in submitActivities.

(function (global) {
  "use strict";

  var FRAGMENT_PREFIX = "#books=";
  var MAX_ENCODED_LENGTH = 32768;
  var MAX_TEXT_LENGTH = 200;

  var VAT_BOX_IDS = [
    "vatDueSales",
    "vatDueAcquisitions",
    "vatReclaimedCurrPeriod",
    "totalValueSalesExVAT",
    "totalValuePurchasesExVAT",
    "totalValueGoodsSuppliedExVAT",
    "totalAcquisitionsExVAT",
  ];

  var ACTIVITIES = {
    "vat": { label: "VAT return", path: "/hmrc/vat/submitVat.html" },
    "itsa-quarterly": { label: "Income Tax quarterly update", path: "/hmrc/itsa/selfEmploymentPeriod.html" },
    "itsa-annual": { label: "Income Tax annual submission", path: "/hmrc/itsa/annualSubmission.html" },
  };

  function encodeBase64Url(text) {
    var bytes = new TextEncoder().encode(text);
    var binary = "";
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function numbersOnly(source, label) {
    var copy = {};
    Object.keys(source || {}).forEach(function (name) {
      var figure = source[name];
      if (typeof figure !== "number" || !isFinite(figure)) throw new Error(label + " " + name + " is not a number");
      copy[name] = figure;
    });
    return copy;
  }

  // The kinds this book can file: the ones the product's manifest names, and VAT only for a
  // company book that declares itself VAT registered.
  function activitiesFor(manifest, book) {
    var named = (manifest && manifest.submitActivities) || [];
    var vatRegistered = !!(book && book.entityInformation && book.entityInformation["diya-gl:vatRegistered"] === true);
    return named.filter(function (kind) {
      return kind !== "vat" || vatRegistered;
    });
  }

  // The period ends the book can answer, for the period choice. VAT has no list to offer (any
  // quarter end in the accounting year), so it returns null and the page asks for a date.
  async function periodChoices(engine, kind, book, lines, resources) {
    if (kind === "vat") return null;
    if (kind === "itsa-quarterly") {
      var quarterly = await engine.deriveItsaQuarterlyUpdate(book, lines, { resources: resources });
      return quarterly.periods.map(function (period) {
        return { value: period.periodDates.periodEndDate, label: "Period ending " + period.periodDates.periodEndDate };
      });
    }
    var annual = await engine.deriveItsaAnnualSubmission(book, lines, { resources: resources });
    return [{ value: annual.taxYear, label: "Tax year " + annual.taxYear }];
  }

  // resources is the loader the engine reads tax data through; omitted under Node.
  // The handoff object for one kind and one period choice (VAT: the period end date; quarterly:
  // the period end date; annual: the tax year).
  async function buildHandoff(engine, kind, book, lines, choice, source, resources) {
    var head = { kind: kind, sourceFileName: source.sourceFileName, packageVersion: source.packageVersion };
    if (kind === "vat") {
      var vat = await engine.deriveVatReturn(book, lines, { periodEnd: choice, resources: resources });
      var boxes = {};
      VAT_BOX_IDS.forEach(function (id) {
        boxes[id] = vat.hmrc[id];
      });
      return Object.assign(head, {
        period: { periodStart: vat.periodStart, periodEnd: vat.periodEnd },
        figures: numbersOnly(boxes, "the VAT figure"),
      });
    }
    if (kind === "itsa-quarterly") {
      var derived = await engine.deriveItsaQuarterlyUpdate(book, lines, { periodEndDate: choice, resources: resources });
      var period = derived.periods[0];
      return Object.assign(head, {
        period: {
          taxYear: derived.taxYear,
          periodStartDate: period.periodDates.periodStartDate,
          periodEndDate: period.periodDates.periodEndDate,
        },
        figures: {
          periodIncome: numbersOnly(period.periodIncome, "the income figure"),
          periodExpenses: numbersOnly(period.periodExpenses, "the expense figure"),
          periodDisallowableExpenses: numbersOnly(period.periodDisallowableExpenses, "the disallowable expense figure"),
        },
      });
    }
    if (kind === "itsa-annual") {
      var annual = await engine.deriveItsaAnnualSubmission(book, lines, { taxYear: choice, resources: resources });
      var allowances = numbersOnly(annual.allowances, "the allowance");
      var adjustments = numbersOnly(annual.adjustments, "the adjustment");
      if (Object.keys(allowances).length === 0 && Object.keys(adjustments).length === 0) {
        throw new Error("The book carries no allowances and no adjustments for " + annual.taxYear + ", so there is nothing to send.");
      }
      return Object.assign(head, { period: { taxYear: annual.taxYear }, figures: { allowances: allowances, adjustments: adjustments } });
    }
    throw new Error("Unknown kind of filing " + kind);
  }

  function encodeFragment(handoff) {
    ["sourceFileName", "packageVersion"].forEach(function (name) {
      var text = handoff[name];
      if (typeof text !== "string" || text.length === 0) throw new Error("The handoff has no " + name);
    });
    handoff.sourceFileName = handoff.sourceFileName.slice(0, MAX_TEXT_LENGTH);
    handoff.packageVersion = handoff.packageVersion.slice(0, MAX_TEXT_LENGTH);
    var encoded = encodeBase64Url(JSON.stringify(handoff));
    if (encoded.length > MAX_ENCODED_LENGTH) throw new Error("The figures are too large to send in a link.");
    return FRAGMENT_PREFIX + encoded;
  }

  function submitUrl(origin, kind, fragment) {
    var activity = ACTIVITIES[kind];
    if (!activity) throw new Error("Unknown kind of filing " + kind);
    return origin.replace(/\/$/, "") + activity.path + fragment;
  }

  global.DiyaGlSubmitHandoff = {
    ACTIVITIES: ACTIVITIES,
    VAT_BOX_IDS: VAT_BOX_IDS,
    MAX_ENCODED_LENGTH: MAX_ENCODED_LENGTH,
    activitiesFor: activitiesFor,
    periodChoices: periodChoices,
    buildHandoff: buildHandoff,
    encodeFragment: encodeFragment,
    submitUrl: submitUrl,
  };
})(typeof window !== "undefined" ? window : globalThis);
