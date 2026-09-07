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

  // ============================== storage ==============================
  // Every key this file writes carries this prefix, so sign-out can clear
  // all of them by prefix rather than naming each one by hand as new ones
  // are added.
  var STORAGE_PREFIX = "diya-gl.cloud.";

  function storageKey(name) {
    return STORAGE_PREFIX + name;
  }

  function readStorage(name) {
    try {
      return window.sessionStorage.getItem(storageKey(name));
    } catch (e) {
      return null;
    }
  }

  function writeStorage(name, value) {
    try {
      window.sessionStorage.setItem(storageKey(name), value);
    } catch (e) {
      /* private browsing or storage disabled: a later state check just fails closed */
    }
  }

  function removeStorage(name) {
    try {
      window.sessionStorage.removeItem(storageKey(name));
    } catch (e) {
      /* nothing to remove if storage never accepted the write */
    }
  }

  var TRANSIENT_KEYS = ["verifier", "state", "nonce", "returnTo"];

  function setTransient(values) {
    TRANSIENT_KEYS.forEach(function (key) {
      writeStorage(key, values[key]);
    });
  }

  function getTransient() {
    var out = {};
    TRANSIENT_KEYS.forEach(function (key) {
      out[key] = readStorage(key);
    });
    return out;
  }

  function clearTransient() {
    TRANSIENT_KEYS.forEach(removeStorage);
  }

  // ============================== PKCE ==============================

  function base64UrlEncode(bytes) {
    var binary = "";
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  // A 64-byte verifier, base64url-encoded to 86 characters -- inside RFC
  // 7636's 43-to-128 range with room to spare.
  function randomUrlSafe(numBytes) {
    var bytes = new Uint8Array(numBytes);
    window.crypto.getRandomValues(bytes);
    return base64UrlEncode(bytes);
  }

  function challengeFor(verifier) {
    var data = new TextEncoder().encode(verifier);
    return window.crypto.subtle.digest("SHA-256", data).then(function (digest) {
      return base64UrlEncode(new Uint8Array(digest));
    });
  }

  function base64UrlDecodeToString(value) {
    var padded = value.replace(/-/g, "+").replace(/_/g, "/");
    while (padded.length % 4) padded += "=";
    var binary = window.atob(padded);
    var percentEncoded = "";
    for (var i = 0; i < binary.length; i++) {
      percentEncoded += "%" + ("00" + binary.charCodeAt(i).toString(16)).slice(-2);
    }
    return decodeURIComponent(percentEncoded);
  }

  // No signature check -- the token came straight from the hosted UI's own
  // token endpoint over TLS, the same trust the authorization code itself
  // carries. This only reads the nonce and the two user fields out of it.
  function decodeIdTokenClaims(idToken) {
    var payload = idToken.split(".")[1];
    return JSON.parse(base64UrlDecodeToString(payload));
  }

  // ============================== events ==============================
  // books-events.js's builders and shell.js's own trackEvent both exist by
  // the time any of these fire -- the former loads before this script, the
  // latter is the last line of shell.js's own eval, which finishes before
  // DOMContentLoaded, which is what calls mount().
  function sendCloudEvent(event) {
    if (window.DiyaGlBooksPage && typeof window.DiyaGlBooksPage.trackEvent === "function") {
      window.DiyaGlBooksPage.trackEvent(event.name, event.params);
    }
  }

  function sendSignInEvent(step) {
    if (typeof window.buildCloudSignInEvent !== "function") return;
    sendCloudEvent(window.buildCloudSignInEvent(step));
  }

  // ============================== sign-in redirect and exchange ==============================

  function redirectUri() {
    return window.location.origin + window.location.pathname;
  }

  // Journey 3.2 steps 1-2: a fresh verifier, state and nonce, the reader's
  // current URL saved as returnTo (deep link and all), then a plain
  // navigation to the hosted UI -- no form post, so the CSP's form-action
  // needs no change.
  function signIn() {
    var config = window.DIYA_GL_CLOUD_CONFIG;
    var verifier = randomUrlSafe(64);
    var state = randomUrlSafe(16);
    var nonce = randomUrlSafe(16);
    setTransient({ verifier: verifier, state: state, nonce: nonce, returnTo: window.location.href });
    sendSignInEvent("started");
    return challengeFor(verifier).then(function (challenge) {
      var query = new URLSearchParams({
        response_type: "code",
        client_id: config.clientId,
        redirect_uri: redirectUri(),
        scope: "openid profile email",
        state: state,
        nonce: nonce,
        code_challenge: challenge,
        code_challenge_method: "S256",
      });
      window.location.assign(config.hostedUi + "/oauth2/authorize?" + query.toString());
    });
  }

  // Journey 3.2 steps 6-8: no Authorization header -- the client has no
  // secret to send. Resolves with the token endpoint's own body; the
  // caller checks response.ok and the nonce claim.
  function exchangeCode(code, verifier) {
    var config = window.DIYA_GL_CLOUD_CONFIG;
    var body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      code: code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    });
    return fetch(config.hostedUi + "/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }).then(function (response) {
      return response
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          if (!response.ok) {
            throw new Error(data.error_description || SIGN_IN_FAILURE_MESSAGE);
          }
          return data;
        });
    });
  }

  var SIGN_IN_FAILURE_MESSAGE = "Sign-in could not be verified. Please try again.";

  // Filled in as later steps of the build land: the topbar button, the
  // panel and its bindings.
  function mount() {
    if (!isEnabled()) return;
  }

  window.DiyaGlBooksCloud = {
    isEnabled: isEnabled,
    mount: mount,
    signIn: signIn,
    randomUrlSafe: randomUrlSafe,
    challengeFor: challengeFor,
  };
})();
