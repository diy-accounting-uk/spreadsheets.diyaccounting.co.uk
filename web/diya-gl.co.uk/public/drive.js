// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// diya-gl/drive.js
//
// Google Drive as a second store for a DIYA-GL book (PLAN_DIYA_GL_LAUNCH.md,
// "LP-24 design: Google Drive as a second store"). Cognito's hosted UI never
// carries a Google Drive token -- Google's own token stays out of the user
// pool -- so this file asks Google for one of its own, scoped to
// drive.file (files this page creates, nothing else in the reader's Drive),
// and keeps it in sessionStorage under the same "diya-gl.cloud." prefix
// cloud.js already clears on sign-out.
//
// Pure functions: buildMetadata, driveFileName, titleFromFileName,
// toBookRow, multipartBody. Everything else either holds the module's own
// state (the cached folder id, the token) or makes a network call.
//
// cloud.js calls into the surface this file publishes on window.DiyaGlDrive;
// nothing here calls back into cloud.js or shell.js except reading the
// signed-in session's email (for the consent screen's hint) and the
// "diya-gl:entitlement" event cloud.js already dispatches.
(function () {
  "use strict";

  var STORAGE_PREFIX = "diya-gl.cloud.";
  var DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
  var GIS_SRC = "https://accounts.google.com/gsi/client";
  var DRIVE_API = "https://www.googleapis.com/drive/v3";
  var DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
  var FOLDER_NAME = "DIYA-GL";
  var TOKEN_EXPIRY_MARGIN_MS = 60000;

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

  // ============================== configuration and entitlement ==============================

  function isConfigured() {
    var config = window.DIYA_GL_CLOUD_CONFIG;
    if (!config || !config.googleClientId) return false;
    var isHttps = window.location.protocol === "https:";
    var isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    return isHttps || isLocal;
  }

  // The save item and the Connect row show only for a subscribed reader
  // (entitlement.reason "active-subscription"); cloud.js's fetchAllBooks
  // already dispatches this event on every list, so this file tracks it
  // without calling back into cloud.js.
  var lastEntitlementReason = null;

  document.addEventListener("diya-gl:entitlement", function (event) {
    lastEntitlementReason = event.detail && event.detail.reason;
  });

  function isOffered() {
    return isConfigured() && lastEntitlementReason === "active-subscription";
  }

  // ============================== the token ==============================

  function readToken() {
    var token = readStorage("driveToken");
    var expiresAt = Number(readStorage("driveTokenExpiresAt") || 0);
    return { token: token, expiresAt: expiresAt };
  }

  function storeToken(accessToken, expiresInSeconds) {
    writeStorage("driveToken", accessToken);
    writeStorage("driveTokenExpiresAt", String(Date.now() + expiresInSeconds * 1000));
  }

  function clearToken() {
    removeStorage("driveToken");
    removeStorage("driveTokenExpiresAt");
  }

  // A present-but-expired token still counts: the design's "token expired"
  // row runs the silent re-request first and only falls back to the
  // Connect row on its failure, so the UI (and mergeDriveBooks) must still
  // attempt a call rather than treating expiry here as no token at all.
  // ensureToken() is what actually enforces expiry, for every real call.
  function hasToken() {
    return !!readToken().token;
  }

  function DriveSignedOutError() {
    this.name = "DriveSignedOutError";
    this.message = "Google Drive is not connected.";
  }
  DriveSignedOutError.prototype = Object.create(Error.prototype);

  function DriveConflictError(current) {
    this.name = "DriveConflictError";
    this.current = current;
    this.message = "This book changed in Google Drive.";
  }
  DriveConflictError.prototype = Object.create(Error.prototype);

  var gisLoadPromise = null;

  function loadGis() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
    if (gisLoadPromise) return gisLoadPromise;
    gisLoadPromise = new Promise(function (resolveLoad, rejectLoad) {
      var script = document.createElement("script");
      script.src = GIS_SRC;
      script.onload = resolveLoad;
      script.onerror = function () {
        gisLoadPromise = null;
        rejectLoad(new Error("Google Identity Services could not be loaded."));
      };
      document.head.appendChild(script);
    });
    return gisLoadPromise;
  }

  // The consent screen's hint: the email off the reader's signed-in Cognito
  // session, read straight out of storage rather than through cloud.js so
  // this file needs no reference back to it.
  function emailHint() {
    var raw = readStorage("user");
    if (!raw) return undefined;
    try {
      var user = JSON.parse(raw);
      return (user && user.email) || undefined;
    } catch (e) {
      return undefined;
    }
  }

  // requestAccessToken() must run inside the same click that started this,
  // or the browser's popup blocker takes the consent window -- callers
  // (connect(), and the silent re-request within 60s of expiry) both run
  // synchronously off a user gesture or an already-open flow.
  function requestToken(prompt) {
    var config = window.DIYA_GL_CLOUD_CONFIG;
    return loadGis().then(function () {
      return new Promise(function (resolveToken, rejectToken) {
        var client = window.google.accounts.oauth2.initTokenClient({
          client_id: config.googleClientId,
          scope: DRIVE_SCOPE,
          hint: emailHint(),
          callback: function (response) {
            if (!response || response.error) {
              rejectToken(new Error((response && response.error) || "consent was not granted"));
              return;
            }
            // A reader can approve less than was asked; hasGrantedAllScopes
            // catches that rather than treating a partial grant as success.
            if (
              typeof window.google.accounts.oauth2.hasGrantedAllScopes === "function" &&
              !window.google.accounts.oauth2.hasGrantedAllScopes(response, DRIVE_SCOPE)
            ) {
              rejectToken(new Error("Google Drive access was not fully granted."));
              return;
            }
            storeToken(response.access_token, response.expires_in);
            resolveToken(response.access_token);
          },
        });
        client.requestAccessToken({ prompt: prompt });
      });
    });
  }

  function connect() {
    return requestToken("consent");
  }

  // Every Drive call goes through this: a token held and not within 60
  // seconds of expiry is used as-is; otherwise one silent re-request runs
  // (prompt: "", no window), and its own failure drops the token so the
  // panel falls back to the Connect card.
  function ensureToken() {
    var current = readToken();
    if (!current.token) return Promise.reject(new DriveSignedOutError());
    if (Date.now() < current.expiresAt - TOKEN_EXPIRY_MARGIN_MS) return Promise.resolve(current.token);
    return requestToken("").catch(function () {
      clearToken();
      throw new DriveSignedOutError();
    });
  }

  // ============================== the fetch wrapper ==============================

  function driveFetch(url, options, token) {
    var headers = Object.assign({}, (options && options.headers) || {}, { Authorization: "Bearer " + token });
    return fetch(url, Object.assign({}, options, { headers: headers }));
  }

  function parseJsonSafe(response) {
    return response
      .text()
      .then(function (text) {
        return text ? JSON.parse(text) : {};
      })
      .catch(function () {
        return {};
      });
  }

  function driveErrorReason(body) {
    return (body && body.error && body.error.errors && body.error.errors[0] && body.error.errors[0].reason) || null;
  }

  function DriveApiError(status, reason, message) {
    this.name = "DriveApiError";
    this.status = status;
    this.reason = reason;
    this.message = message || "Drive request failed";
  }
  DriveApiError.prototype = Object.create(Error.prototype);

  // The one folder id this tab has resolved, re-resolved from scratch
  // whenever a call answers 404 -- the folder can only have moved (renamed,
  // trashed) since the last resolve, never disappeared from the account.
  var folderId = null;

  // Every Drive request goes through this: it carries the bearer token, and
  // any non-2xx response becomes a DriveApiError (dropping the token first
  // on a 401/403, since either means the grant itself is no longer good).
  function driveRequest(token, url, options) {
    return driveFetch(url, options || {}, token).then(function (response) {
      if (response.status === 404) folderId = null;
      if (response.ok) return response;
      return parseJsonSafe(response).then(function (body) {
        if (response.status === 401 || response.status === 403) clearToken();
        throw new DriveApiError(response.status, driveErrorReason(body), (body.error && body.error.message) || "Drive request failed");
      });
    });
  }

  // ============================== the folder ==============================

  function findFolder(token) {
    var query = new URLSearchParams({
      q: "name='" + FOLDER_NAME + "' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: "files(id,name)",
      spaces: "drive",
    });
    return driveRequest(token, DRIVE_API + "/files?" + query.toString(), { method: "GET" })
      .then(function (response) {
        return response.json();
      })
      .then(function (body) {
        return (body.files && body.files[0] && body.files[0].id) || null;
      });
  }

  function createFolder(token) {
    return driveRequest(token, DRIVE_API + "/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder", appProperties: { diyaGl: "folder" } }),
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (body) {
        return body.id;
      });
  }

  function ensureFolder(token) {
    if (folderId) return Promise.resolve(folderId);
    return findFolder(token).then(function (id) {
      if (id) {
        folderId = id;
        return id;
      }
      return createFolder(token).then(function (createdId) {
        folderId = createdId;
        return createdId;
      });
    });
  }

  // ============================== upload ==============================

  // A key and its value are capped at 124 bytes together, so the title
  // stays in the file name rather than in appProperties.
  function driveFileName(title, periodEnd) {
    var base = title || "Untitled";
    return periodEnd ? base + " " + periodEnd + ".diya-gl.zip" : base + ".diya-gl.zip";
  }

  function titleFromFileName(name, periodEnd) {
    var suffix = periodEnd ? " " + periodEnd + ".diya-gl.zip" : ".diya-gl.zip";
    if (name.length > suffix.length && name.slice(-suffix.length) === suffix) return name.slice(0, -suffix.length);
    return name.replace(/\.diya-gl\.zip$/, "");
  }

  function buildMetadata(params) {
    return {
      name: driveFileName(params.title, params.periodEnd),
      appProperties: {
        product: params.product || "",
        periodStart: params.periodStart || "",
        periodEnd: params.periodEnd || "",
        engineVersion: params.engineVersion || "",
      },
    };
  }

  // A multipart/related body: the metadata JSON part, then the zip bytes as
  // application/zip. Built as a Blob so the browser's own fetch handles the
  // final content-length and boundary framing.
  function multipartBody(metadata, bytes, boundary) {
    var delimiter = "--" + boundary + "\r\n";
    var closeDelimiter = "\r\n--" + boundary + "--";
    var metadataPart = delimiter + "Content-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(metadata) + "\r\n";
    var mediaHeader = delimiter + "Content-Type: application/zip\r\n\r\n";
    return new Blob([metadataPart, mediaHeader, bytes, closeDelimiter], { type: "multipart/related; boundary=" + boundary });
  }

  function uploadFile(token, folderIdForNewFile, metadataBase, bytes, existingFileId) {
    var metadata = Object.assign({}, metadataBase);
    if (!existingFileId) metadata.parents = [folderIdForNewFile];
    var boundary = "diya-gl-" + Math.random().toString(36).slice(2);
    var body = multipartBody(metadata, bytes, boundary);
    var base = existingFileId ? DRIVE_UPLOAD_API + "/files/" + existingFileId : DRIVE_UPLOAD_API + "/files";
    var fields = existingFileId ? "id,size,modifiedTime,headRevisionId" : "id,name,size,modifiedTime,appProperties,headRevisionId";
    return driveRequest(token, base + "?uploadType=multipart&fields=" + fields, {
      method: existingFileId ? "PATCH" : "POST",
      headers: { "Content-Type": "multipart/related; boundary=" + boundary },
      body: body,
    }).then(function (response) {
      return response.json();
    });
  }

  // Drive prunes an unstarred binary revision past 30 days or 100
  // revisions; keepForever holds it, up to 200 kept-forever revisions per
  // file. Its own failure never fails the save -- the upload already
  // landed.
  function keepRevision(token, fileId, revisionId) {
    return driveRequest(token, DRIVE_API + "/files/" + fileId + "/revisions/" + revisionId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keepForever: true }),
    })
      .then(function (response) {
        return response.json();
      })
      .catch(function () {
        return null;
      });
  }

  // Drive's files.update takes no precondition header, so a save over an
  // existing file re-reads headRevisionId first: the window between that
  // read and the write stays open (the open problem the design names), but
  // it catches every ordinary case of the same book saved from two tabs.
  function save(params) {
    var token;
    return ensureToken()
      .then(function (tok) {
        token = tok;
        if (!params.fileId) {
          return ensureFolder(token).then(function (fid) {
            return uploadFile(token, fid, buildMetadata(params), params.bytes, null);
          });
        }
        return driveRequest(token, DRIVE_API + "/files/" + params.fileId + "?fields=headRevisionId", { method: "GET" })
          .then(function (response) {
            return response.json();
          })
          .then(function (current) {
            if (current.headRevisionId !== params.headRevisionId) throw new DriveConflictError(current);
            return uploadFile(token, null, buildMetadata(params), params.bytes, params.fileId);
          });
      })
      .then(function (fileMeta) {
        return keepRevision(token, fileMeta.id, fileMeta.headRevisionId).then(function () {
          return fileMeta;
        });
      });
  }

  // ============================== list, open, revisions, trash ==============================

  function toBookRow(file) {
    var props = file.appProperties || {};
    return {
      store: "drive",
      bookId: file.id,
      driveFileId: file.id,
      driveHeadRevisionId: file.headRevisionId,
      title: titleFromFileName(file.name, props.periodEnd),
      product: props.product || null,
      latestVersion: file.headRevisionId,
      latestETag: file.headRevisionId,
      latestSize: Number(file.size) || 0,
      updatedAt: file.modifiedTime,
      periodCoveredStart: props.periodStart || null,
      periodCoveredEnd: props.periodEnd || null,
      versions: [],
      provenance: { engineVersion: props.engineVersion || null },
      retention: "resident",
      expiresAt: null,
    };
  }

  function list() {
    return ensureToken().then(function (token) {
      return ensureFolder(token).then(function (fid) {
        var query = new URLSearchParams({
          q: "'" + fid + "' in parents and trashed=false",
          fields: "files(id,name,size,modifiedTime,appProperties,headRevisionId)",
          orderBy: "modifiedTime desc",
          pageSize: "100",
        });
        return driveRequest(token, DRIVE_API + "/files?" + query.toString(), { method: "GET" })
          .then(function (response) {
            return response.json();
          })
          .then(function (body) {
            return (body.files || []).map(toBookRow);
          });
      });
    });
  }

  function open(fileId, revisionId) {
    return ensureToken().then(function (token) {
      var url = revisionId
        ? DRIVE_API + "/files/" + fileId + "/revisions/" + revisionId + "?alt=media"
        : DRIVE_API + "/files/" + fileId + "?alt=media";
      return driveRequest(token, url, { method: "GET" }).then(function (response) {
        return response.blob();
      });
    });
  }

  function revisions(fileId) {
    return ensureToken().then(function (token) {
      return driveRequest(token, DRIVE_API + "/files/" + fileId + "/revisions?fields=revisions(id,modifiedTime,size,keepForever)", {
        method: "GET",
      })
        .then(function (response) {
          return response.json();
        })
        .then(function (body) {
          return body.revisions || [];
        });
    });
  }

  // Trashing lands the file in the reader's own Drive bin, not a hard
  // delete -- the confirm card names it so.
  function trash(fileId) {
    return ensureToken().then(function (token) {
      return driveRequest(token, DRIVE_API + "/files/" + fileId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trashed: true }),
      }).then(function (response) {
        return response.json();
      });
    });
  }

  window.DiyaGlDrive = {
    isOffered: isOffered,
    hasToken: hasToken,
    connect: connect,
    list: list,
    save: save,
    open: open,
    revisions: revisions,
    trash: trash,
  };
})();
