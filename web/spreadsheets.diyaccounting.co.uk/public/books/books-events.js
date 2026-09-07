/* SPDX-License-Identifier: AGPL-3.0-only */
/* Copyright (C) 2025-2026 DIY Accounting Ltd */

// books/books-events.js
//
// Pure GA4 event-payload builders for the books pages: a book loaded, a
// save and a donation prompt shown or followed. Kept apart from
// public/lib/ecommerce-events.js so this file can sit inside the /books/
// service worker's cache scope and never risks that file's own
// view_item_list guard. shell.js calls these and sends the result through
// its own trackEvent; nothing here touches gtag or the DOM.

// Coarse enough to read a downloads-to-donations ratio off the GA4 export
// without every internal sniff kind splitting it further: an upload's own
// workbook/package distinction collapses to "xlsx", and a diya-gl zip or a
// zipped diya-gl JSON both collapse to "zip". An example, a brand new book
// and a plain diya-gl JSON already read the way the export wants.
function bookLoadedSource(rawSourceKind) {
  if (rawSourceKind === "workbook" || rawSourceKind === "package-zip" || rawSourceKind === "package-set") return "xlsx";
  if (rawSourceKind === "diya-gl-zip" || rawSourceKind === "json-zip") return "zip";
  return rawSourceKind;
}

function buildBookLoadedEvent(product, rawSourceKind) {
  return { name: "book_loaded", params: { product: product, source: bookLoadedSource(rawSourceKind) } };
}

function buildBookSavedEvent(product, format) {
  return { name: "book_saved", params: { product: product, format: format } };
}

function buildDonationPromptEvent(prompt, action) {
  return { name: "donation_prompt", params: { prompt: prompt, action: action } };
}

if (typeof window !== "undefined") {
  window.buildBookLoadedEvent = buildBookLoadedEvent;
  window.buildBookSavedEvent = buildBookSavedEvent;
  window.buildDonationPromptEvent = buildDonationPromptEvent;
}
