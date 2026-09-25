// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// diya-gl/cloud.js
//
// Sign-in and "save to my account" for the DIYA-GL pages: a book stays a
// browser-only file until a reader chooses to put it in their DIYA-GL account,
// held by Submit's Cognito pool and the four /api/v1/books routes. This
// script never merges with a conflicting account copy and never overwrites
// one without asking -- a clash always shows a card with the choice.
//
// shell.js calls into the functions this file publishes on
// window.DiyaGlCloud; nothing here calls back into shell.js except
// through the narrow surface window.DiyaGlPage exposes (currentBook,
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

  // Section 6: Stripe returns the browser to returnTo?checkout=success or
  // ?checkout=canceled, session_id and all. returnTo carries no query of
  // its own (the checkout body sends origin+pathname only), so stripping
  // these two known keys is enough -- there is no deep link to restore.
  var pendingCheckoutReturn = null;

  function captureCheckoutReturn() {
    var params = new URLSearchParams(window.location.search);
    var checkout = params.get("checkout");
    if (!checkout) return;
    pendingCheckoutReturn = checkout;
    params.delete("checkout");
    params.delete("session_id");
    var search = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (search ? "?" + search : "") + window.location.hash);
  }

  captureCheckoutReturn();

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
  // diya-gl-events.js's builders and shell.js's own trackEvent both exist by
  // the time any of these fire -- the former loads before this script, the
  // latter is the last line of shell.js's own eval, which finishes before
  // DOMContentLoaded, which is what calls mount().
  function sendCloudEvent(event) {
    if (window.DiyaGlPage && typeof window.DiyaGlPage.trackEvent === "function") {
      window.DiyaGlPage.trackEvent(event.name, event.params);
    }
  }

  function sendSignInEvent(step) {
    if (typeof window.buildCloudSignInEvent !== "function") return;
    sendCloudEvent(window.buildCloudSignInEvent(step));
  }

  // The identity provider Cognito recorded, the same reading Submit's web client takes of the
  // same claim (web/public/auth/loginWithCognitoCallback.html): identities is a JSON string for
  // a federated user, absent for a native email/password one, which falls back to "cognito".
  function loginMethodFromClaims(claims) {
    try {
      var identities = typeof claims.identities === "string" ? JSON.parse(claims.identities) : claims.identities;
      if (Array.isArray(identities) && identities[0] && identities[0].providerName) {
        return identities[0].providerName;
      }
    } catch (e) {
      /* malformed identities claim: fall back to "cognito" */
    }
    return "cognito";
  }

  function sendLoginEvent(claims) {
    if (typeof window.buildLoginEvent !== "function") return;
    sendCloudEvent(window.buildLoginEvent(loginMethodFromClaims(claims)));
  }

  function sendLogoutEvent() {
    if (typeof window.buildLogoutEvent !== "function") return;
    sendCloudEvent(window.buildLogoutEvent());
  }

  function sendCloudOpenEvent(source) {
    if (typeof window.buildCloudOpenEvent !== "function") return;
    sendCloudEvent(window.buildCloudOpenEvent(source));
  }

  function sendBillingEvent(action) {
    if (typeof window.buildCloudBillingEvent !== "function") return;
    sendCloudEvent(window.buildCloudBillingEvent(action));
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

  // ============================== session storage ==============================

  function getSession() {
    var idToken = readStorage("idToken");
    if (!idToken) return null;
    var expiresAtRaw = readStorage("expiresAt");
    var userRaw = readStorage("user");
    return {
      idToken: idToken,
      accessToken: readStorage("accessToken"),
      refreshToken: readStorage("refreshToken"),
      expiresAt: expiresAtRaw ? Number(expiresAtRaw) : 0,
      user: userRaw ? JSON.parse(userRaw) : null,
    };
  }

  function setSession(session) {
    writeStorage("idToken", session.idToken);
    writeStorage("accessToken", session.accessToken);
    writeStorage("refreshToken", session.refreshToken);
    writeStorage("expiresAt", String(session.expiresAt));
    writeStorage("user", JSON.stringify(session.user));
  }

  var SESSION_KEYS = ["idToken", "accessToken", "refreshToken", "expiresAt", "user"];

  function clearSession() {
    SESSION_KEYS.forEach(removeStorage);
  }

  // The tab's cloud link for the currently loaded book (C6): never written
  // into book.toml, so a save never changes the book's own bytes.
  function getLink() {
    var raw = readStorage("link");
    return raw ? JSON.parse(raw) : null;
  }

  function setLink(link) {
    writeStorage("link", JSON.stringify(link));
  }

  function clearLink() {
    removeStorage("link");
  }

  // The tab's Drive link for the currently loaded book (LP-24): fileId and
  // headRevisionId, kept beside the S3 link rather than replacing it, since
  // a book can be tracked in one store, the other, both or neither.
  function getDriveLink() {
    var raw = readStorage("driveLink");
    return raw ? JSON.parse(raw) : null;
  }

  function setDriveLink(link) {
    if (!link) {
      removeStorage("driveLink");
      return;
    }
    writeStorage("driveLink", JSON.stringify(link));
  }

  // Journey 3.7 step 2: every diya-gl.cloud.* key, whatever this build has
  // added since, so sign-out is never one key short of a clean tab.
  function clearAllStorage() {
    try {
      var toRemove = [];
      for (var i = 0; i < window.sessionStorage.length; i++) {
        var key = window.sessionStorage.key(i);
        if (key && key.indexOf(STORAGE_PREFIX) === 0) toRemove.push(key);
      }
      toRemove.forEach(function (key) {
        window.sessionStorage.removeItem(key);
      });
    } catch (e) {
      /* nothing stored, or storage disabled entirely */
    }
  }

  // ============================== refresh and the API wrapper ==============================

  // Journey 3.3 step 2: a 200 replaces idToken/accessToken/expiresAt,
  // keeping the old refresh token when the response carries none.
  function refreshSession() {
    var session = getSession();
    if (!session || !session.refreshToken) return Promise.reject(new Error("no refresh token"));
    var config = window.DIYA_GL_CLOUD_CONFIG;
    var body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      refresh_token: session.refreshToken,
    });
    return fetch(config.hostedUi + "/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    })
      .then(function (response) {
        if (!response.ok) throw new Error("refresh failed");
        return response.json();
      })
      .then(function (data) {
        var updated = {
          idToken: data.id_token,
          accessToken: data.access_token,
          refreshToken: data.refresh_token || session.refreshToken,
          expiresAt: Date.now() + data.expires_in * 1000,
          user: session.user,
        };
        setSession(updated);
        return updated;
      });
  }

  // Journey 3.3 step 4: a failed refresh, or a second 401, ends the local
  // session -- never a merge, never a silent retry beyond the one the
  // journey allows.
  function CloudSignedOutError() {
    this.message = "Your session ended. Sign in again.";
  }
  CloudSignedOutError.prototype = Object.create(Error.prototype);

  function fetchWithToken(path, options, idToken) {
    var config = window.DIYA_GL_CLOUD_CONFIG;
    var headers = Object.assign({}, options.headers, { Authorization: "Bearer " + idToken });
    return fetch(config.apiBase + path, Object.assign({}, options, { headers: headers }));
  }

  // Every books-API call goes through this: a proactive refresh when the
  // token is within a minute of expiry, one refresh and one retry on a 401.
  // Any other status (400/403/404/409/412/413/422/500) is returned as-is
  // for the caller to read the error body from -- only an auth failure ends
  // the session.
  function apiFetch(path, options) {
    var session = getSession();
    if (!session) return Promise.reject(new CloudSignedOutError());
    var opts = options || {};
    var needsRefresh = session.expiresAt - Date.now() < 60000;
    var start = needsRefresh ? refreshSession().catch(rethrowAsSignedOut) : Promise.resolve(session);
    return start
      .then(function (tok) {
        return fetchWithToken(path, opts, tok.idToken);
      })
      .then(function (response) {
        if (response.status !== 401) return response;
        return refreshSession()
          .catch(rethrowAsSignedOut)
          .then(function (freshTok) {
            return fetchWithToken(path, opts, freshTok.idToken);
          })
          .then(function (retryResponse) {
            if (retryResponse.status === 401) throw new CloudSignedOutError();
            return retryResponse;
          });
      })
      .catch(function (error) {
        if (error instanceof CloudSignedOutError) clearSession();
        throw error;
      });
  }

  function rethrowAsSignedOut() {
    throw new CloudSignedOutError();
  }

  function parseJsonBody(response) {
    return response.json().catch(function () {
      return {};
    });
  }

  function apiError(status, body) {
    var error = new Error((body && body.message) || "Request failed");
    error.status = status;
    error.code = body && body.code;
    return error;
  }

  // Section 5's error table, for whichever call hit it -- 409/412 (the
  // conflict journeys) and the sign-out path are handled by their own
  // callers before this is ever reached.
  function messageForApiError(error) {
    if (error.status === 400 && (error.code === "invalid-book-id" || error.code === "invalid-request")) {
      return "That book could not be saved: " + error.message + ".";
    }
    if (error.status === 403 && error.code === "book-limit-reached") {
      return "Your account holds 20 books, the most it keeps. Delete one to save another.";
    }
    if (error.status === 404) {
      return "That book is no longer in your account.";
    }
    if (error.status === 413) {
      return "This book is larger than the 2 MB an account holds. The download still works.";
    }
    if (error.status === 422) {
      return "The saved file was not a diya-gl package.";
    }
    return "Your account could not be reached. Your book is safe on this page -- try the download.";
  }

  // ============================== the panel ==============================

  var panelEl = null;
  var backdropEl = null;
  var accountBtnEl = null;
  var panelState = { status: "signed-out" };

  function esc(value) {
    return String(value === null || value === undefined ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function ensurePanel() {
    if (panelEl) return;
    panelEl = document.createElement("div");
    panelEl.id = "account-panel";
    panelEl.className = "account-panel hidden";
    panelEl.setAttribute("role", "dialog");
    panelEl.setAttribute("aria-label", "Your DIYA-GL account");
    panelEl.addEventListener("click", handlePanelClick);
    document.body.appendChild(panelEl);

    backdropEl = document.createElement("div");
    backdropEl.id = "account-backdrop";
    backdropEl.className = "account-backdrop hidden";
    backdropEl.addEventListener("click", closePanel);
    document.body.appendChild(backdropEl);
  }

  // The accessible name (aria-label) must contain the visible label ("Sign
  // in" or "Account") as a literal substring -- WCAG 2.5.3 Label in Name.
  // The email goes in aria-label and title so it stays discoverable to both
  // a screen reader and a sighted user hovering the button, but it never
  // replaces the visible label as the name.
  function syncAccountButton() {
    if (!accountBtnEl) return;
    var session = getSession();
    var label = accountBtnEl.querySelector(".btn-label");
    if (session) {
      var email = session.user && session.user.email;
      accountBtnEl.title = email || "Account";
      accountBtnEl.setAttribute("aria-label", email ? "Account, signed in as " + email : "Account");
      if (label) label.textContent = "Account";
    } else {
      var signInTitle = "Sign in to save to a 35-day sandbox: your books are kept for 35 days after each save, on any device.";
      accountBtnEl.title = signInTitle;
      accountBtnEl.setAttribute("aria-label", signInTitle);
      if (label) label.textContent = "Sign in";
    }
  }

  function isPanelOpen() {
    return !!(panelEl && !panelEl.classList.contains("hidden"));
  }

  // Shows the panel with whatever panelState the caller has already set --
  // callers that want a fresh list call fetchBooksList() (which sets
  // "loading" and calls this itself), never this directly with a stale
  // state.
  function openPanel() {
    ensurePanel();
    panelEl.classList.remove("hidden");
    backdropEl.classList.remove("hidden");
    if (accountBtnEl) accountBtnEl.setAttribute("aria-expanded", "true");
    renderPanel();
  }

  function closePanel() {
    if (panelEl) panelEl.classList.add("hidden");
    if (backdropEl) backdropEl.classList.add("hidden");
    if (accountBtnEl) accountBtnEl.setAttribute("aria-expanded", "false");
  }

  function showSignInFailure(message) {
    panelState = { status: "failure", message: message };
    openPanel();
  }

  function periodLabel(book) {
    if (!book.periodCoveredStart || !book.periodCoveredEnd) return "period not set";
    return book.periodCoveredStart + " to " + book.periodCoveredEnd;
  }

  function kb(bytes) {
    return Math.round((bytes || 0) / 1024) + " KB";
  }

  function expiryLabel(book) {
    if (book.retention === "resident") return "kept until you delete it";
    if (!book.expiresAt) return "";
    var remainingMs = Math.max(0, new Date(book.expiresAt).getTime() - Date.now());
    var days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
    if (days > 1) return "expires in " + days + " days";
    if (days === 1) return "expires in 1 day";
    return "expires today";
  }

  function storeBadge(book) {
    return book.store === "drive" ? '<span class="account-row-badge">Drive</span> ' : "";
  }

  function renderBookRow(book) {
    var versions = book.versions || [];
    var expanded = panelState.expandedBookId === book.bookId;
    var versionsHtml = "";
    if (expanded) {
      versionsHtml =
        '<div class="account-versions">' +
        versions
          .slice()
          .reverse()
          .map(function (v) {
            return (
              '<div class="account-row">' +
              "<span>version " +
              v.version +
              ", " +
              kb(v.size) +
              ", " +
              esc(new Date(v.createdAt).toLocaleString()) +
              "</span>" +
              '<button type="button" class="btn" data-action="open" data-book-id="' +
              esc(book.bookId) +
              '" data-version="' +
              v.version +
              '">Open</button>' +
              "</div>"
            );
          })
          .join("") +
        "</div>";
    }
    return (
      '<div class="account-row" data-book-id="' +
      esc(book.bookId) +
      '">' +
      "<div>" +
      "<strong>" +
      esc(book.title) +
      "</strong>" +
      '<div class="account-row-meta">' +
      storeBadge(book) +
      esc(book.product) +
      ", " +
      esc(periodLabel(book)) +
      "<br>version " +
      book.latestVersion +
      ", saved " +
      esc(new Date(book.updatedAt).toLocaleString()) +
      "<br>" +
      kb(book.latestSize) +
      '<br><span class="account-row-expiry">' +
      esc(expiryLabel(book)) +
      "</span>" +
      (book.provenance && book.provenance.engineVersion ? "<br><small>" + esc(book.provenance.engineVersion) + "</small>" : "") +
      "</div>" +
      "</div>" +
      '<div class="account-row-actions">' +
      '<button type="button" class="btn" data-action="open" data-book-id="' +
      esc(book.bookId) +
      '">Open</button>' +
      '<button type="button" class="btn" data-action="toggle-versions" data-book-id="' +
      esc(book.bookId) +
      '">Versions</button>' +
      '<button type="button" class="btn" data-action="delete" data-book-id="' +
      esc(book.bookId) +
      '" data-title="' +
      esc(book.title) +
      '" data-versions-count="' +
      versions.length +
      '">Delete</button>' +
      "</div>" +
      versionsHtml +
      "</div>"
    );
  }

  // Journey step 2 of the Drive design: a subscribed reader with no Drive
  // token sees this above the list; the Drive save item opens the panel
  // straight onto it. panelState.driveConnectMessage carries the refused
  // or expired wording, cleared the next time the row would not show.
  function renderDriveConnectRow(entitlement) {
    var reason = entitlement && entitlement.reason;
    if (reason !== "active-subscription") return "";
    if (window.DiyaGlDrive && window.DiyaGlDrive.hasToken()) return "";
    var message = panelState.driveConnectMessage;
    return (
      '<div class="account-drive-connect">' +
      (message ? '<p class="account-row-meta account-error">' + esc(message) + "</p>" : "") +
      '<button type="button" class="btn" data-action="connect-drive">Connect Google Drive</button>' +
      "</div>"
    );
  }

  function renderList(books, entitlement, session) {
    var sorted = (books || []).slice().sort(function (a, b) {
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
    var current = window.DiyaGlPage && window.DiyaGlPage.currentBook();
    var rowsHtml = sorted.length
      ? sorted.map(renderBookRow).join("")
      : '<p class="account-empty">No books in your account yet.' + (current ? " Save this book to my account." : "") + "</p>";
    return (
      DEVICE_ROW_SLOT +
      '<div class="account-panel-head">' +
      esc((session.user && session.user.email) || "Your account") +
      "</div>" +
      renderDriveConnectRow(entitlement) +
      rowsHtml +
      renderEntitlement(entitlement) +
      '<button type="button" class="btn" data-action="sign-out">Sign out</button>'
    );
  }

  // ============================== on this device ==============================
  // The one autosave slot shell.js keeps (autosave.js), surfaced at the top
  // of the account panel whichever side of sign-in the reader is on.
  // renderList and renderSignedOut leave an empty slot; mountDeviceRow()
  // reads the record fresh on every panel open (never cached here, so a
  // Clear made through the continue offer or New shows up the next time the
  // panel opens) and fills the slot once loadWorkingBook() resolves --
  // never rejects, so the row simply stays absent when there is no record.
  var DEVICE_ROW_SLOT = '<div id="account-device-row-slot"></div>';
  var deviceRowToken = 0;

  function deviceRowHtml(record) {
    if (!record) return "";
    var label = (record.source && record.source.label) || "your working book";
    var formatSavedAt = window.DiyaGlPage && window.DiyaGlPage.formatSavedAt;
    var when = typeof formatSavedAt === "function" ? formatSavedAt(record.savedAt) : "";
    return (
      '<div class="account-device-row">' +
      "<div>" +
      "<strong>On this device — " +
      esc(label) +
      "</strong>" +
      '<div class="account-row-meta">' +
      (when ? "saved " + esc(when) + "<br>" : "") +
      "kept on this device until you clear your browser data; download the file to keep it for good" +
      "</div>" +
      "</div>" +
      '<button type="button" class="btn" data-action="clear-device-book">Clear</button>' +
      "</div>"
    );
  }

  function mountDeviceRow() {
    var token = ++deviceRowToken;
    if (!window.DiyaGlAutosave) return;
    window.DiyaGlAutosave.loadWorkingBook().then(function (record) {
      if (token !== deviceRowToken || !panelEl) return;
      var slot = panelEl.querySelector("#account-device-row-slot");
      if (slot) slot.innerHTML = deviceRowHtml(record);
    });
  }

  // Routed through window.DiyaGlPage so shell.js's own state.savedBook and
  // the continue offer clear in the same call -- the panel never calls
  // DiyaGlAutosave.clearWorkingBook() itself, which would clear the store
  // twice over.
  function clearDeviceBook() {
    if (!(window.DiyaGlPage && typeof window.DiyaGlPage.discardSavedBook === "function")) return;
    window.DiyaGlPage.discardSavedBook().then(mountDeviceRow);
  }

  var RESIDENT_LAPSE_GRACE_DAYS = 30;

  function entitlementDate(value) {
    return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  }

  function subscribeButton() {
    return (
      '<div class="account-row-actions"><button type="button" class="btn btn-primary" data-action="subscribe" data-interval="annual">Subscribe</button></div>' +
      '<p class="account-entitlement-monthly"><button type="button" class="account-entitlement-monthly-link" data-action="subscribe" data-interval="monthly">or £3.99 a month</button></p>'
    );
  }

  // tier-disabled always renders the plain sandbox card; an active
  // subscription renders the subscribed card regardless of the flag (a
  // reader already paying keeps their card even if the tier were switched
  // off under them). no-subscription and expired render the upgrade offer
  // only where residentTier is true -- everywhere else they fall through to
  // the plain sandbox card with no Subscribe button.
  function renderEntitlement(entitlement) {
    var reason = entitlement && entitlement.reason;
    if (reason === "active-subscription") {
      return (
        '<div class="account-entitlement"><span class="account-entitlement-label">Subscribed: kept until you delete it</span>' +
        '<div class="account-row-actions"><button type="button" class="btn" data-action="manage-subscription">Manage subscription</button></div>' +
        "</div>"
      );
    }
    if (entitlement && entitlement.residentTier) {
      if (reason === "no-subscription") {
        return (
          '<div class="account-entitlement"><span class="account-entitlement-label">35-day sandbox. Keep your books for £39 a year.</span>' +
          subscribeButton() +
          "</div>"
        );
      }
      if (reason === "expired") {
        var expiredOn = entitlementDate(entitlement.expiry);
        var booksExpireOn = entitlementDate(new Date(entitlement.expiry).getTime() + RESIDENT_LAPSE_GRACE_DAYS * 24 * 60 * 60 * 1000);
        return (
          '<div class="account-entitlement"><span class="account-entitlement-label">Your subscription ended ' +
          expiredOn +
          ". These books expire " +
          booksExpireOn +
          ".</span>" +
          subscribeButton() +
          "</div>"
        );
      }
    }
    return '<div class="account-entitlement"><span class="account-entitlement-label">35-day sandbox</span></div>';
  }

  function renderSignedOut() {
    return (
      DEVICE_ROW_SLOT +
      '<p class="account-panel-head">Sign in to save to a 35-day sandbox: your books are kept for 35 days after each save, on any device.</p>' +
      '<button type="button" class="btn btn-primary" data-action="sign-in">Sign in</button>'
    );
  }

  function renderFailure(message) {
    return (
      '<p class="account-panel-head account-error">' +
      esc(message) +
      "</p>" +
      '<button type="button" class="btn btn-primary" data-action="sign-in">Sign in</button>'
    );
  }

  function renderError(message) {
    return (
      '<p class="account-panel-head account-error">' +
      esc(message) +
      "</p>" +
      '<button type="button" class="btn" data-action="retry-list">Retry</button>'
    );
  }

  function renderConfirm(confirm) {
    if (confirm.kind === "open") {
      return (
        '<p class="account-panel-head">Opening replaces the book on this page. Your unsaved changes are not in your account yet.</p>' +
        '<div class="account-row-actions">' +
        '<button type="button" class="btn btn-primary" data-action="confirm-open" data-book-id="' +
        esc(confirm.bookId) +
        '" data-version="' +
        esc(confirm.version || "") +
        '">Open</button>' +
        '<button type="button" class="btn" data-action="cancel-confirm">Cancel</button>' +
        "</div>"
      );
    }
    if (confirm.store === "drive") {
      return (
        '<p class="account-panel-head">Delete ' +
        esc(confirm.title) +
        "? It moves to your Google Drive bin.</p>" +
        '<div class="account-row-actions">' +
        '<button type="button" class="btn btn-primary" data-action="confirm-delete" data-book-id="' +
        esc(confirm.bookId) +
        '">Delete</button>' +
        '<button type="button" class="btn" data-action="cancel-confirm">Cancel</button>' +
        "</div>"
      );
    }
    return (
      '<p class="account-panel-head">Delete ' +
      esc(confirm.title) +
      " and all " +
      confirm.versionsCount +
      " versions from your account? This cannot be undone.</p>" +
      '<div class="account-row-actions">' +
      '<button type="button" class="btn btn-primary" data-action="confirm-delete" data-book-id="' +
      esc(confirm.bookId) +
      '">Delete</button>' +
      '<button type="button" class="btn" data-action="cancel-confirm">Cancel</button>' +
      "</div>"
    );
  }

  // The Drive equivalent of renderConflict's etag-mismatch card: Drive has
  // no version counter, only headRevisionId, so the second line reads off
  // the file's own modifiedTime instead of a version number.
  function renderDriveConflict(state) {
    return (
      '<div class="account-conflict">' +
      '<p class="account-panel-head">This book changed in Google Drive.</p>' +
      '<div class="account-row"><span>In your Drive — saved ' +
      esc(new Date(state.current.modifiedTime).toLocaleString()) +
      "</span></div>" +
      '<div class="account-row-actions">' +
      '<button type="button" class="btn btn-primary" data-action="drive-conflict-retry">Try again</button>' +
      '<button type="button" class="btn" data-action="drive-conflict-cancel">Cancel</button>' +
      "</div>" +
      "</div>"
    );
  }

  // Journey 3.6: a 412 (etag-mismatch) shows both timestamps and three
  // choices; a 409 (write-conflict) shows the shorter "try again" card.
  function renderConflict(state) {
    if (state.conflictKind === "write-conflict") {
      return (
        '<div class="account-conflict">' +
        '<p class="account-panel-head">Another save landed at the same moment. Try again.</p>' +
        '<button type="button" class="btn btn-primary" data-action="retry-save">Try again</button>' +
        "</div>"
      );
    }
    var accountBook = state.accountBook;
    var accountLine = accountBook
      ? "In your account — version " + accountBook.latestVersion + ", saved " + esc(new Date(accountBook.updatedAt).toLocaleString())
      : "In your account — a version this page could not read back";
    return (
      '<div class="account-conflict">' +
      '<p class="account-panel-head">This book changed somewhere else.</p>' +
      '<div class="account-row"><span>On this page — edited ' +
      esc(new Date(state.pending.editedAt).toLocaleString()) +
      ", not in your account</span></div>" +
      '<div class="account-row"><span>' +
      accountLine +
      "</span></div>" +
      '<div class="account-row-actions">' +
      '<button type="button" class="btn btn-primary" data-action="conflict-new-book">Save as a new book</button>' +
      '<button type="button" class="btn" data-action="conflict-open-account">Open the account&#39;s copy</button>' +
      '<button type="button" class="btn" data-action="conflict-cancel">Cancel</button>' +
      "</div>" +
      "</div>"
    );
  }

  // Journey 3.5 step 4: a near-duplicate found before minting a fresh id.
  function renderDuplicate(state) {
    var duplicate = state.duplicate;
    return (
      '<p class="account-panel-head">This looks like ' +
      esc(duplicate.title) +
      ", already in your account as version " +
      duplicate.latestVersion +
      ". Update it, or save as a new book?</p>" +
      '<div class="account-row-actions">' +
      '<button type="button" class="btn btn-primary" data-action="duplicate-update">Update</button>' +
      '<button type="button" class="btn" data-action="duplicate-new">New book</button>' +
      "</div>"
    );
  }

  function renderPanel() {
    if (!panelEl) return;
    if (panelState.status === "failure") {
      panelEl.innerHTML = renderFailure(panelState.message);
      return;
    }
    if (panelState.status === "signed-out") {
      panelEl.innerHTML = renderSignedOut();
      mountDeviceRow();
      return;
    }
    if (panelState.confirm) {
      panelEl.innerHTML = renderConfirm(panelState.confirm);
      return;
    }
    if (panelState.status === "conflict") {
      panelEl.innerHTML = renderConflict(panelState);
      return;
    }
    if (panelState.status === "duplicate") {
      panelEl.innerHTML = renderDuplicate(panelState);
      return;
    }
    if (panelState.status === "drive-conflict") {
      panelEl.innerHTML = renderDriveConflict(panelState);
      return;
    }
    if (panelState.status === "loading") {
      panelEl.innerHTML = '<p class="account-panel-head">Loading your books…</p>';
      return;
    }
    if (panelState.status === "error") {
      panelEl.innerHTML = renderError(panelState.message);
      return;
    }
    if (panelState.status === "list") {
      panelEl.innerHTML = renderList(panelState.books, panelState.entitlement, getSession());
      mountDeviceRow();
      return;
    }
    panelEl.innerHTML = renderSignedOut();
  }

  // Journey 3.3 step 4: the signed-out panel carries the session-ended
  // wording, not the plain sign-in prompt -- reusing "failure"'s render
  // (a message plus a Sign in button) is exactly that shape.
  function handlePanelError(error) {
    if (error instanceof CloudSignedOutError) {
      panelState = { status: "failure", message: error.message };
      syncAccountButton();
      renderPanel();
      return;
    }
    panelState = { status: "error", message: messageForApiError(error) };
    renderPanel();
  }

  // Section 5's error table for Drive: a dropped-token error (drive.js
  // already cleared it on a 401/403, or the silent re-request came back
  // empty) just re-lists, which is what brings the Connect row back. Every
  // other Drive failure gets the reach-failure card, storageQuotaExceeded's
  // own wording aside.
  function driveErrorMessage(error) {
    if (error && error.name === "DriveApiError" && error.status === 403 && error.reason === "storageQuotaExceeded") {
      return "Your Drive is full. The download still works.";
    }
    return messageForApiError({ status: (error && error.status) || 0 });
  }

  function handleDriveError(error) {
    if (error && error.name === "DriveSignedOutError") {
      fetchBooksList();
      return;
    }
    panelState = { status: "error", message: driveErrorMessage(error) };
    renderPanel();
  }

  // Every list carries the reader's entitlement; the page hears it here
  // (shell.js's tier strip shows the resident tier only where residentTier
  // is reported) without reading the panel.
  function fetchAllBooks() {
    return apiFetch("/books", { method: "GET" }).then(function (response) {
      return parseJsonBody(response).then(function (body) {
        if (!response.ok) throw apiError(response.status, body);
        document.dispatchEvent(new CustomEvent("diya-gl:entitlement", { detail: body.entitlement }));
        return { books: body.books || [], entitlement: body.entitlement };
      });
    });
  }

  // Listing and opening stay available whenever a Drive token is held,
  // subscribed or not -- those files are the reader's own. A listing
  // failure (an expired token whose silent re-request came back empty, or
  // any other Drive error) drops back to the account's own books rather
  // than failing the whole panel: drive.js has already cleared the token on
  // a 401/403, so the Connect row is what the reader sees next.
  function mergeDriveBooks(accountBooks) {
    if (!(window.DiyaGlDrive && window.DiyaGlDrive.hasToken())) return Promise.resolve(accountBooks);
    return window.DiyaGlDrive.list()
      .then(function (driveBooks) {
        return accountBooks.concat(driveBooks);
      })
      .catch(function () {
        return accountBooks;
      });
  }

  function fetchBooksList() {
    panelState = { status: "loading" };
    openPanel();
    return fetchAllBooks()
      .then(function (result) {
        trackSandboxExpiry(result.books);
        return mergeDriveBooks(result.books).then(function (merged) {
          panelState = { status: "list", books: merged, entitlement: result.entitlement };
          renderPanel();
        });
      })
      .catch(function (error) {
        handlePanelError(error);
      });
  }

  function findBookInPanel(bookId) {
    return (panelState.books || []).find(function (candidate) {
      return candidate.bookId === bookId;
    });
  }

  function bytesFromBase64(base64) {
    var binary = window.atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function bytesToBase64(bytes) {
    var binary = "";
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
  }

  // A revision opened from a Drive row's own version, or the row's current
  // headRevisionId when no specific one was picked -- either way the bytes
  // come back through alt=media and load the same File-based path an
  // uploaded file already uses.
  function performDriveOpen(book, revisionId) {
    panelState = { status: "loading" };
    renderPanel();
    window.DiyaGlDrive.open(book.driveFileId, revisionId || null)
      .then(function (blob) {
        var file = new File([blob], (book.title || "book") + ".zip", { type: "application/zip" });
        return window.DiyaGlPage.loadFile(file).then(function () {
          clearLink();
          setDriveLink({ fileId: book.driveFileId, headRevisionId: revisionId || book.driveHeadRevisionId });
          sendCloudEvent(window.buildCloudDriveOpenEvent(revisionId ? "revision" : "latest"));
          closePanel();
        });
      })
      .catch(function (error) {
        handleDriveError(error);
      });
  }

  function performOpen(bookId, version) {
    var book = findBookInPanel(bookId);
    if (book && book.store === "drive") {
      performDriveOpen(book, version);
      return;
    }
    panelState = { status: "loading" };
    renderPanel();
    apiFetch("/books/" + encodeURIComponent(bookId) + "/versions/" + encodeURIComponent(version || "latest"), { method: "GET" })
      .then(function (response) {
        return parseJsonBody(response).then(function (body) {
          if (!response.ok) throw apiError(response.status, body);
          var bytes = bytesFromBase64(body.zipBase64);
          var file = new File([bytes], (body.metadata.title || "book") + ".zip", { type: "application/zip" });
          return window.DiyaGlPage.loadFile(file).then(function () {
            setLink({
              bookId: body.metadata.bookId,
              latestETag: body.metadata.latestETag,
              latestVersion: body.metadata.latestVersion,
            });
            setDriveLink(null);
            sendCloudOpenEvent(version ? "revision" : "latest");
            closePanel();
          });
        });
      })
      .catch(function (error) {
        handlePanelError(error);
      });
  }

  function requestOpen(bookId, version) {
    if (window.DiyaGlPage && window.DiyaGlPage.isEdited()) {
      var before = panelState;
      panelState = {
        status: before.status,
        books: before.books,
        confirm: { kind: "open", bookId: bookId, version: version },
        previous: before,
      };
      renderPanel();
      return;
    }
    performOpen(bookId, version);
  }

  // Trashing puts the file in the reader's own Drive bin (the confirm card
  // already named it so), so there is no equivalent of the S3 path's
  // link-forgetting step -- the file still exists, just not in the folder.
  function performDriveDelete(book) {
    panelState = { status: "loading" };
    renderPanel();
    window.DiyaGlDrive.trash(book.driveFileId)
      .then(function () {
        var driveLink = getDriveLink();
        if (driveLink && driveLink.fileId === book.driveFileId) setDriveLink(null);
        return fetchBooksList();
      })
      .catch(function (error) {
        handleDriveError(error);
      });
  }

  function performDelete(bookId) {
    var book = findBookInPanel(bookId);
    if (book && book.store === "drive") {
      performDriveDelete(book);
      return;
    }
    // The tab holds this book's bookId and latestETag. Once it is deleted that
    // points at nothing, so a later save would send an If-Match for a book the
    // account no longer has and the API would answer 412. Forget it here, in
    // the same breath as the panel going to loading, rather than when the
    // response lands: the panel's rows disappear now, so anything reading the
    // stored link between now and then would read a link the screen has
    // already stopped showing. A save after a delete that then fails creates a
    // new book, which is recoverable; a save that 412s is not.
    var link = getLink();
    if (link && link.bookId === bookId) clearLink();
    panelState = { status: "loading" };
    renderPanel();
    apiFetch("/books/" + encodeURIComponent(bookId), { method: "DELETE" })
      .then(function (response) {
        return parseJsonBody(response).then(function (body) {
          if (!response.ok) throw apiError(response.status, body);
          removeStorage(LAST_BOOK_COUNT_KEY);
          return fetchBooksList();
        });
      })
      .catch(function (error) {
        handlePanelError(error);
      });
  }

  function requestDelete(bookId, title, versionsCount) {
    var book = findBookInPanel(bookId);
    var before = panelState;
    panelState = {
      status: before.status,
      books: before.books,
      confirm: { kind: "delete", bookId: bookId, title: title, versionsCount: versionsCount, store: book && book.store },
      previous: before,
    };
    renderPanel();
  }

  // ============================== save, conflict and entitlement ==============================

  var toastTimer = null;

  // shell.js's own showToast is not part of window.DiyaGlPage's
  // surface, so this writes the same shared #toast element directly --
  // the plain-message half of shell.js's own behaviour (no action button).
  function showToastMessage(message) {
    var toastEl = document.getElementById("toast");
    if (!toastEl) return;
    toastEl.textContent = message;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.textContent = "";
    }, 4000);
  }

  function sendSaveEvent(product, outcome) {
    if (typeof window.buildCloudSaveEvent !== "function") return;
    sendCloudEvent(window.buildCloudSaveEvent(product, outcome));
  }

  // DG-6: the reader's own deletes reset this (performDelete), so a shorter
  // list here always means their sandbox books lapsed, never a removal they
  // asked for. Nothing is stored until the first list of the session, so
  // that one never fires a false drop against a session that read no count
  // yet.
  var LAST_BOOK_COUNT_KEY = "lastBookCount";

  function sendSandboxExpiredEvent(missing) {
    if (typeof window.buildSandboxExpiredSeenEvent !== "function") return;
    sendCloudEvent(window.buildSandboxExpiredSeenEvent(missing));
  }

  function trackSandboxExpiry(books) {
    var count = (books || []).length;
    var storedRaw = readStorage(LAST_BOOK_COUNT_KEY);
    if (storedRaw !== null) {
      var stored = Number(storedRaw);
      if (count < stored) sendSandboxExpiredEvent(stored - count);
    }
    writeStorage(LAST_BOOK_COUNT_KEY, String(count));
  }

  function sendConflictEvent(resolution) {
    if (typeof window.buildCloudConflictEvent !== "function") return;
    sendCloudEvent(window.buildCloudConflictEvent(resolution));
  }

  function bookTitle(book) {
    return (book.entityInformation && book.entityInformation.organizationIdentifier) || "";
  }

  // Section 5's provenance shape: the five diya-gl:* stamps off
  // documentInfo, each sent as null when the book carries none.
  function bookProvenance(book) {
    var info = (book && book.documentInfo) || {};
    return {
      formatVersion: info["diya-gl:formatVersion"] || null,
      engineVersion: info["diya-gl:engineVersion"] || null,
      taxDataHash: info["diya-gl:taxDataHash"] || null,
      templateHash: info["diya-gl:templateHash"] || null,
      reconciledCommit: info["diya-gl:reconciledCommit"] || null,
    };
  }

  // Journey 3.5 step 4: same product, same title, same two dates.
  function findNearDuplicate(books, book, product) {
    var title = bookTitle(book);
    var info = book.documentInfo || {};
    return (books || []).find(function (candidate) {
      return (
        candidate.product === product &&
        candidate.title === title &&
        candidate.periodCoveredStart === info.periodCoveredStart &&
        candidate.periodCoveredEnd === info.periodCoveredEnd
      );
    });
  }

  function performPut(bookId, ifMatch, artifact, book, product) {
    var info = book.documentInfo || {};
    var payload = {
      title: bookTitle(book),
      product: product,
      periodCoveredStart: info.periodCoveredStart || null,
      periodCoveredEnd: info.periodCoveredEnd || null,
      provenance: bookProvenance(book),
      zipBase64: bytesToBase64(artifact.bytes),
    };
    var headers = { "Content-Type": "application/json" };
    if (ifMatch) headers["If-Match"] = '"' + ifMatch + '"';
    return apiFetch("/books/" + encodeURIComponent(bookId), {
      method: "PUT",
      headers: headers,
      body: JSON.stringify(payload),
    });
  }

  // Journey 3.6: a 412 means the account's copy moved on -- nothing is ever
  // merged or overwritten. The account's own current version is read back
  // with a fresh list call so the card's second timestamp is not stale.
  function handleConflict(bookId, artifact, book, product, editedAt) {
    sendConflictEvent("shown");
    return fetchAllBooks()
      .then(function (result) {
        var accountBook = result.books.find(function (candidate) {
          return candidate.bookId === bookId;
        });
        panelState = {
          status: "conflict",
          conflictKind: "etag-mismatch",
          accountBook: accountBook,
          pending: { bookId: bookId, artifact: artifact, book: book, product: product, editedAt: editedAt },
        };
        openPanel();
      })
      .catch(function () {
        panelState = {
          status: "conflict",
          conflictKind: "etag-mismatch",
          accountBook: null,
          pending: { bookId: bookId, artifact: artifact, book: book, product: product, editedAt: editedAt },
        };
        openPanel();
      });
  }

  function handleWriteConflict(bookId, ifMatch, artifact, book, product, editedAt) {
    panelState = {
      status: "conflict",
      conflictKind: "write-conflict",
      pending: { bookId: bookId, ifMatch: ifMatch, artifact: artifact, book: book, product: product, editedAt: editedAt },
    };
    openPanel();
  }

  // Journey 3.5 steps 5-7: the one call every save path (a fresh id, an
  // existing link, a duplicate's id, or a conflict's retry) ends at.
  function submitPut(bookId, ifMatch, artifact, book, product, isNew, editedAt) {
    return performPut(bookId, ifMatch, artifact, book, product).then(function (response) {
      return parseJsonBody(response).then(function (body) {
        if (response.status === 412) {
          return handleConflict(bookId, artifact, book, product, editedAt);
        }
        if (response.status === 409 && body.code === "write-conflict") {
          handleWriteConflict(bookId, ifMatch, artifact, book, product, editedAt);
          return;
        }
        if (!response.ok) {
          sendSaveEvent(product, "failed");
          showToastMessage(messageForApiError(apiError(response.status, body)));
          return;
        }
        setLink({ bookId: bookId, latestETag: body.metadata.latestETag, latestVersion: body.metadata.latestVersion });
        sendSaveEvent(product, isNew ? "created" : "updated");
        showToastMessage("Saved to your account as version " + body.metadata.latestVersion + ".");
        if (isPanelOpen()) fetchBooksList();
      });
    });
  }

  // Journey 3.5: the save menu's "Save to my account" item.
  function saveCurrentBook() {
    var current = window.DiyaGlPage && window.DiyaGlPage.currentBook();
    if (!current) return;
    // Journey 3.1 step 4: signed out, this opens the plain sign-in prompt
    // rather than discovering the missing session deep inside the PUT call,
    // which would show the "session ended" wording instead.
    if (!getSession()) {
      panelState = { status: "signed-out" };
      openPanel();
      return;
    }
    var product = window.DiyaGlPage.productId();
    var editedAt = new Date().toISOString();
    window.DiyaGlPage.buildArtifact("diya-gl-zip")
      .then(function (artifact) {
        var link = getLink();
        if (link) {
          return submitPut(link.bookId, link.latestETag, artifact, current.book, product, false, editedAt);
        }
        return fetchAllBooks().then(function (result) {
          var duplicate = findNearDuplicate(result.books, current.book, product);
          if (duplicate) {
            panelState = {
              status: "duplicate",
              duplicate: duplicate,
              pending: { artifact: artifact, book: current.book, product: product, editedAt: editedAt },
            };
            openPanel();
            return;
          }
          return submitPut(window.crypto.randomUUID(), null, artifact, current.book, product, true, editedAt);
        });
      })
      .catch(function (error) {
        if (error instanceof CloudSignedOutError) {
          handlePanelError(error);
        } else {
          showToastMessage(messageForApiError(error && error.status ? error : { status: 0 }));
        }
        sendSaveEvent(product, "failed");
      });
  }

  // ============================== Google Drive ==============================

  function sendDriveConnectEvent(step) {
    if (typeof window.buildCloudDriveConnectEvent !== "function") return;
    sendCloudEvent(window.buildCloudDriveConnectEvent(step));
  }

  function sendDriveSaveEvent(product, outcome) {
    if (typeof window.buildCloudDriveSaveEvent !== "function") return;
    sendCloudEvent(window.buildCloudDriveSaveEvent(product, outcome));
  }

  // Journey step 3-4 of the Drive design: performDriveSave() re-reads
  // currentBook() and rebuilds the artifact fresh each time it runs, so a
  // retry off the conflict card carries whatever the page shows right now,
  // never a stale copy from the first attempt.
  function performDriveSave() {
    var current = window.DiyaGlPage && window.DiyaGlPage.currentBook();
    if (!current) return;
    var product = window.DiyaGlPage.productId();
    window.DiyaGlPage.buildArtifact("diya-gl-zip")
      .then(function (artifact) {
        var driveLink = getDriveLink();
        var info = (current.book && current.book.documentInfo) || {};
        var params = {
          fileId: driveLink ? driveLink.fileId : null,
          headRevisionId: driveLink ? driveLink.headRevisionId : null,
          title: bookTitle(current.book),
          product: product,
          periodStart: info.periodCoveredStart || null,
          periodEnd: info.periodCoveredEnd || null,
          engineVersion: bookProvenance(current.book).engineVersion,
          bytes: artifact.bytes,
        };
        return window.DiyaGlDrive.save(params).then(function (fileMeta) {
          setDriveLink({ fileId: fileMeta.id, headRevisionId: fileMeta.headRevisionId });
          sendDriveSaveEvent(product, driveLink ? "updated" : "created");
          showToastMessage("Saved to your DIYA-GL folder in Google Drive.");
          if (isPanelOpen()) fetchBooksList();
        });
      })
      .catch(function (error) {
        if (error && error.name === "DriveConflictError") {
          panelState = { status: "drive-conflict", current: error.current };
          openPanel();
          return;
        }
        if (error && error.name === "DriveSignedOutError") {
          fetchBooksList();
          return;
        }
        sendDriveSaveEvent(product, "failed");
        showToastMessage(driveErrorMessage(error));
      });
  }

  // Set the moment "Save to my Google Drive" is chosen without a token
  // held; connectDrive()'s success callback reads it back and saves rather
  // than merely re-listing.
  var pendingDriveSaveRequested = false;

  function connectDrive() {
    sendDriveConnectEvent("started");
    window.DiyaGlDrive.connect()
      .then(function () {
        sendDriveConnectEvent("granted");
        panelState.driveConnectMessage = null;
        if (pendingDriveSaveRequested) {
          pendingDriveSaveRequested = false;
          performDriveSave();
        } else {
          fetchBooksList();
        }
      })
      .catch(function () {
        sendDriveConnectEvent("refused");
        pendingDriveSaveRequested = false;
        panelState.driveConnectMessage = "Google Drive was not connected.";
        renderPanel();
      });
  }

  // The save menu's "Save to my Google Drive" item: a token already held
  // saves straight away; otherwise the panel opens on the Connect card and
  // the save runs once the reader connects.
  function saveToDrive() {
    var current = window.DiyaGlPage && window.DiyaGlPage.currentBook();
    if (!current) return;
    if (window.DiyaGlDrive && window.DiyaGlDrive.hasToken()) {
      performDriveSave();
      return;
    }
    pendingDriveSaveRequested = true;
    fetchBooksList();
  }

  // A Drive row's versions are not carried in the list response (unlike an
  // S3 book's), so the first expand fetches them; a later toggle on the
  // same row reuses what is already there.
  function toggleVersions(bookId) {
    if (panelState.expandedBookId === bookId) {
      panelState.expandedBookId = null;
      renderPanel();
      return;
    }
    var book = findBookInPanel(bookId);
    if (book && book.store === "drive" && !(book.versions && book.versions.length)) {
      window.DiyaGlDrive.revisions(book.driveFileId)
        .then(function (revisions) {
          book.versions = revisions.map(function (revision) {
            return { version: revision.id, size: Number(revision.size) || 0, createdAt: revision.modifiedTime };
          });
          panelState.expandedBookId = bookId;
          renderPanel();
        })
        .catch(function (error) {
          handleDriveError(error);
        });
      return;
    }
    panelState.expandedBookId = bookId;
    renderPanel();
  }

  // Every billing failure -- a bad response, a network error, a missing
  // url field -- lands on messageForApiError's own default branch, the
  // same "try the download" wording the books routes already show for a
  // reach failure. Only a signed-out session gets the different panel.
  function handleBillingError(error) {
    if (error instanceof CloudSignedOutError) {
      handlePanelError(error);
      return;
    }
    showToastMessage(messageForApiError(error && error.status ? error : { status: 0 }));
  }

  // Section 6: the checkout route. Submit's server sets metadata.hashedSub
  // from the id token; the panel re-reads entitlement from the next list
  // call once the reader returns from Stripe (processPendingCheckoutReturn).
  function startSubscription(interval) {
    if (!getSession()) return;
    sendBillingEvent("subscribe-started");
    apiFetch("/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundleId: "resident-diya-gl", interval: interval || "annual", returnTo: redirectUri() }),
    })
      .then(function (response) {
        return parseJsonBody(response).then(function (body) {
          if (!response.ok || !body.checkoutUrl) throw apiError(response.status, body);
          window.location.assign(body.checkoutUrl);
        });
      })
      .catch(handleBillingError);
  }

  // The entitlement card's "Manage subscription" action: Submit's portal
  // route returns the customer-portal URL for the reader's own Stripe
  // customer, read back through the same returnTo the checkout route takes.
  function openBillingPortal() {
    if (!getSession()) return;
    sendBillingEvent("manage-opened");
    var query = new URLSearchParams({ returnTo: redirectUri() });
    apiFetch("/billing/portal?" + query.toString(), { method: "GET" })
      .then(function (response) {
        return parseJsonBody(response).then(function (body) {
          if (!response.ok || !body.portalUrl) throw apiError(response.status, body);
          window.location.assign(body.portalUrl);
        });
      })
      .catch(handleBillingError);
  }

  // Ends the session server-side before the local one: revokes the refresh token (Cognito's
  // /oauth2/revoke, so a copied refresh token stops working) and tells Submit's authenticated
  // sign-out route to publish "logout" and delete the session item, both keepalive fetches so
  // they survive the navigation this function ends with. Neither is awaited -- only started --
  // because awaiting a fetch's response right before navigating away has hung headless Chrome
  // in Submit's own behaviour tests; keepalive already guarantees delivery survives the page
  // going away, and the reader ends signed out locally whatever the server answers.
  function revokeAndSignOut(session, config) {
    if (session.refreshToken) {
      fetch(config.hostedUi + "/oauth2/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: session.refreshToken, client_id: config.clientId }).toString(),
        keepalive: true,
      }).catch(function () {
        /* revoke failures are expected (offline, ad blockers) -- local sign-out still proceeds */
      });
    }
    fetch(config.apiBase + "/session/sign-out", {
      method: "POST",
      headers: { Authorization: "Bearer " + session.idToken },
      keepalive: true,
    }).catch(function () {
      /* sign-out failures are expected (offline, ad blockers) -- local sign-out still proceeds */
    });
  }

  function signOut() {
    var config = window.DIYA_GL_CLOUD_CONFIG;
    var session = getSession();
    if (session) revokeAndSignOut(session, config);
    clearAllStorage();
    closePanel();
    syncAccountButton();
    sendLogoutEvent();
    var query = new URLSearchParams({ client_id: config.clientId, logout_uri: redirectUri() });
    window.location.assign(config.hostedUi + "/logout?" + query.toString());
  }

  function handlePanelClick(event) {
    var target = event.target.closest ? event.target.closest("[data-action]") : null;
    if (!target) return;
    var action = target.getAttribute("data-action");
    var bookId = target.getAttribute("data-book-id");
    if (action === "sign-in") {
      signIn();
    } else if (action === "sign-out") {
      signOut();
    } else if (action === "clear-device-book") {
      clearDeviceBook();
    } else if (action === "retry-list") {
      fetchBooksList();
    } else if (action === "open") {
      requestOpen(bookId, target.getAttribute("data-version") || null);
    } else if (action === "toggle-versions") {
      toggleVersions(bookId);
    } else if (action === "connect-drive") {
      connectDrive();
    } else if (action === "drive-conflict-retry") {
      performDriveSave();
    } else if (action === "drive-conflict-cancel") {
      closePanel();
    } else if (action === "delete") {
      requestDelete(bookId, target.getAttribute("data-title"), Number(target.getAttribute("data-versions-count")));
    } else if (action === "confirm-open") {
      performOpen(bookId, target.getAttribute("data-version") || null);
    } else if (action === "confirm-delete") {
      performDelete(bookId);
    } else if (action === "cancel-confirm") {
      panelState = panelState.previous || { status: panelState.status, books: panelState.books };
      renderPanel();
    } else if (action === "subscribe") {
      startSubscription(target.getAttribute("data-interval"));
    } else if (action === "manage-subscription") {
      openBillingPortal();
    } else if (action === "duplicate-update") {
      var updatePending = panelState.pending;
      var duplicate = panelState.duplicate;
      submitPut(
        duplicate.bookId,
        duplicate.latestETag,
        updatePending.artifact,
        updatePending.book,
        updatePending.product,
        false,
        updatePending.editedAt,
      );
    } else if (action === "duplicate-new") {
      var newBookPending = panelState.pending;
      submitPut(
        window.crypto.randomUUID(),
        null,
        newBookPending.artifact,
        newBookPending.book,
        newBookPending.product,
        true,
        newBookPending.editedAt,
      );
    } else if (action === "conflict-new-book") {
      var conflictPending = panelState.pending;
      sendConflictEvent("new-book");
      submitPut(
        window.crypto.randomUUID(),
        null,
        conflictPending.artifact,
        conflictPending.book,
        conflictPending.product,
        true,
        conflictPending.editedAt,
      );
    } else if (action === "conflict-open-account") {
      sendConflictEvent("reloaded");
      requestOpen(panelState.pending.bookId, null);
    } else if (action === "conflict-cancel") {
      sendConflictEvent("cancelled");
      closePanel();
    } else if (action === "retry-save") {
      var retryPending = panelState.pending;
      submitPut(
        retryPending.bookId,
        retryPending.ifMatch,
        retryPending.artifact,
        retryPending.book,
        retryPending.product,
        false,
        retryPending.editedAt,
      );
    }
  }

  // Journey 3.2 steps 5-8, run once the topbar button and panel exist so a
  // failure or a success both have somewhere to render.
  function processPendingReturn() {
    if (!pendingReturn) return;
    var result = pendingReturn;
    pendingReturn = null;
    var transient = getTransient();

    if (result.error) {
      clearTransient();
      sendSignInEvent("failed");
      showSignInFailure(result.errorDescription || result.error);
      return;
    }
    if (!transient.verifier || !transient.state || result.state !== transient.state) {
      clearTransient();
      sendSignInEvent("failed");
      showSignInFailure(SIGN_IN_FAILURE_MESSAGE);
      return;
    }

    exchangeCode(result.code, transient.verifier)
      .then(function (data) {
        var claims = decodeIdTokenClaims(data.id_token);
        if (claims.nonce !== transient.nonce) throw new Error(SIGN_IN_FAILURE_MESSAGE);
        setSession({
          idToken: data.id_token,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + data.expires_in * 1000,
          user: { sub: claims.sub, email: claims.email },
        });
        clearTransient();
        sendSignInEvent("returned");
        sendLoginEvent(claims);
        syncAccountButton();
        fetchBooksList();
      })
      .catch(function (error) {
        clearTransient();
        sendSignInEvent("failed");
        showSignInFailure((error && error.message) || SIGN_IN_FAILURE_MESSAGE);
      });
  }

  // Section 6, the return from Stripe: never trust the query flag as proof
  // of entitlement -- the entitlement card renders from the next list
  // call's top-level entitlement.reason, not from checkout=success itself.
  function processPendingCheckoutReturn() {
    if (!pendingCheckoutReturn) return;
    var result = pendingCheckoutReturn;
    pendingCheckoutReturn = null;
    if (result === "success") {
      showToastMessage("Thanks, your subscription is active. Saving to your account is on.");
      if (getSession()) fetchBooksList();
    } else if (result === "canceled") {
      showToastMessage("Checkout cancelled. Your book is safe on this page.");
    }
  }

  function mount() {
    if (!isEnabled()) return;
    accountBtnEl = document.getElementById("account-btn");
    if (!accountBtnEl) return;
    accountBtnEl.classList.remove("hidden");
    syncAccountButton();
    accountBtnEl.addEventListener("click", function () {
      if (isPanelOpen()) {
        closePanel();
        return;
      }
      if (getSession()) {
        fetchBooksList();
      } else {
        panelState = { status: "signed-out" };
        openPanel();
      }
    });
    processPendingReturn();
    processPendingCheckoutReturn();
  }

  window.DiyaGlCloud = {
    isEnabled: isEnabled,
    mount: mount,
    openPanel: openPanel,
    closePanel: closePanel,
    signIn: signIn,
    signOut: signOut,
    saveCurrentBook: saveCurrentBook,
    saveToDrive: saveToDrive,
    startSubscription: startSubscription,
    randomUrlSafe: randomUrlSafe,
    challengeFor: challengeFor,
  };
})();
