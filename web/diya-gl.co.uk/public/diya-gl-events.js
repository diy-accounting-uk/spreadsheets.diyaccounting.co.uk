// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// diya-gl-events.js
//
// Pure GA4 event-payload builders for the DIYA-GL pages: a book loaded, a
// save and a donation prompt shown or followed. Kept apart from
// public/lib/ecommerce-events.js so this file can sit inside the DIYA-GL
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

// The three cloud sign-in and save events cloud.js sends through shell.js's
// own trackEvent (see books/cloud.js) -- kept here rather than in cloud.js
// itself so a corrupted analytics payload is a pure-function bug this
// file's own unit tests already catch the same way as the other builders.
function buildCloudSignInEvent(step) {
  return { name: "cloud_sign_in", params: { step: step } };
}

function buildCloudSaveEvent(product, outcome) {
  return { name: "cloud_save", params: { product: product, outcome: outcome } };
}

// Sent once when a signed-in reader's list comes back shorter than their
// last one and they deleted nothing themselves -- their sandbox books
// lapsed. missing is the drop in count.
function buildSandboxExpiredSeenEvent(missing) {
  return { name: "sandbox_expired_seen", params: { missing: missing } };
}

function buildCloudConflictEvent(resolution) {
  return { name: "cloud_conflict", params: { resolution: resolution } };
}

// Subscribe started and manage-subscription opened (books/cloud.js's
// startSubscription and openBillingPortal), the same builder shape as the
// three above.
function buildCloudBillingEvent(action) {
  return { name: "cloud_billing", params: { action: action } };
}

// The three Google Drive events (books/drive.js and books/cloud.js) -- kept
// apart from the S3 cloud_sign_in/cloud_save series so that series stays
// readable across this change.
function buildCloudDriveConnectEvent(step) {
  return { name: "cloud_drive_connect", params: { step: step } };
}

function buildCloudDriveSaveEvent(product, outcome) {
  return { name: "cloud_drive_save", params: { product: product, outcome: outcome } };
}

function buildCloudDriveOpenEvent(source) {
  return { name: "cloud_drive_open", params: { source: source } };
}

// GA4's own standard events, carrying the same meaning here as Submit's web client sends them
// (web/public/auth/loginWithCognitoCallback.html): method names the identity provider ("cognito"
// for a native email/password user), so login needs no separate step params the way
// cloud_sign_in does -- a fresh sign-in is the whole event.
function buildLoginEvent(method) {
  return { name: "login", params: { method: method } };
}

function buildLogoutEvent() {
  return { name: "logout", params: {} };
}

// A book opened from the reader's DIYA-GL account (the S3 store), the same latest/revision
// source split buildCloudDriveOpenEvent uses for the Drive store, so the two open series read
// the same way in the export.
function buildCloudOpenEvent(source) {
  return { name: "cloud_open", params: { source: source } };
}

if (typeof window !== "undefined") {
  window.buildBookLoadedEvent = buildBookLoadedEvent;
  window.buildBookSavedEvent = buildBookSavedEvent;
  window.buildDonationPromptEvent = buildDonationPromptEvent;
  window.buildCloudSignInEvent = buildCloudSignInEvent;
  window.buildCloudSaveEvent = buildCloudSaveEvent;
  window.buildSandboxExpiredSeenEvent = buildSandboxExpiredSeenEvent;
  window.buildCloudConflictEvent = buildCloudConflictEvent;
  window.buildCloudBillingEvent = buildCloudBillingEvent;
  window.buildCloudDriveConnectEvent = buildCloudDriveConnectEvent;
  window.buildCloudDriveSaveEvent = buildCloudDriveSaveEvent;
  window.buildCloudDriveOpenEvent = buildCloudDriveOpenEvent;
  window.buildLoginEvent = buildLoginEvent;
  window.buildLogoutEvent = buildLogoutEvent;
  window.buildCloudOpenEvent = buildCloudOpenEvent;
}
