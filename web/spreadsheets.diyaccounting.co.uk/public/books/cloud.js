// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// books/cloud.js
//
// Sign-in and "save to my account" for the books pages: a book stays a
// browser-only file until a reader chooses to put it in their DIYA account,
// held by Submit's Cognito pool and the four /api/v1/books routes. This
// script never merges with a conflicting account copy and never overwrites
// one without asking -- a clash always shows a card with the choice.
//
// shell.js calls into the functions this file publishes on
// window.DiyaGlBooksCloud; nothing here calls back into shell.js except
// through the narrow surface window.DiyaGlBooksPage exposes (currentBook,
// loadFile, productId, isEdited, trackEvent, buildArtifact). This file
// imports nothing else and dispatches no custom events of its own.
(function () {
  "use strict";

  // isEnabled()'s three guards: a real client id (committed once
  // IdentityStack deploys), a page origin the OAuth exchange can trust, and
  // the crypto.subtle PKCE needs. Any one of these failing turns the whole
  // feature off -- the topbar carries no button, the save menu keeps its
  // two items, and the file:// runner (which fails the second and third
  // guards on its own) needs no extra guard of its own.
  function isEnabled() {
    var config = window.DIYA_GL_CLOUD_CONFIG;
    if (!config || !config.clientId) return false;
    var isHttps = window.location.protocol === "https:";
    var isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (!isHttps && !isLocal) return false;
    if (!(window.crypto && window.crypto.subtle)) return false;
    return true;
  }

  // Journey 3.2 step 4: run at script-eval time, before shell.js's
  // DOMContentLoaded handler, so an OAuth ?code=.../?error=... query never
  // reaches shell.js's parseDeepLinkParams(). The reader's own deep link
  // (?example=...&view=...) rides in sessionStorage as "returnTo" from the
  // moment signIn() fires and comes back here.
  var pendingReturn = null;

  function captureOAuthReturn() {
    var params = new URLSearchParams(window.location.search);
    var code = params.get("code");
    var error = params.get("error");
    if (!code && !error) return;
    pendingReturn = {
      code: code,
      state: params.get("state"),
      error: error,
      errorDescription: params.get("error_description"),
    };
    var returnTo = null;
    try {
      returnTo = window.sessionStorage.getItem("diya-gl.cloud.returnTo");
    } catch (e) {
      /* sessionStorage unavailable: fall back to the plain page URL below */
    }
    window.history.replaceState(null, "", returnTo || window.location.origin + window.location.pathname);
  }

  captureOAuthReturn();

  // Filled in as later steps of the build land: the topbar button, the
  // panel and its bindings.
  function mount() {
    if (!isEnabled()) return;
  }

  window.DiyaGlBooksCloud = {
    isEnabled: isEnabled,
    mount: mount,
  };
})();
