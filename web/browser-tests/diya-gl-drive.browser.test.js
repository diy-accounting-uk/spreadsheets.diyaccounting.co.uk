// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/browser-tests/diya-gl-drive.browser.test.js
//
// Google Drive as a second store (drive.js, and cloud.js's own Drive panel
// state), free and browser-only with no Submit sign-in -- exercised with
// Google Identity Services faked through addInitScript (no consent window
// ever opens) and every googleapis.com endpoint stubbed through
// page.route. No real Google account, Drive or Cognito pool is reached.

import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import JSZip from "jszip";
import { startStaticServer } from "./serve.js";
import { parseDiyaGlData } from "../../app/lib/diya-gl-loader.js";

const PUBLIC_DIR = path.join(process.cwd(), "web/diya-gl.co.uk/public");
const PRECISION_DIR = path.join(process.cwd(), "examples/precision-code-ltd/bst");
const PROD_API_BASE = "https://submit.diyaccounting.co.uk/api/v1";
const GOOGLE_API = "https://www.googleapis.com";

let closeServer;
let baseUrl;
let precisionBookToml;
let precisionLinesJsonl;

test.beforeAll(async () => {
  const server = await startStaticServer(PUBLIC_DIR, path.join(process.cwd(), "infra/main/resources/diya-gl-security-headers.json"));
  baseUrl = server.baseUrl;
  closeServer = server.close;
  precisionBookToml = fs.readFileSync(path.join(PRECISION_DIR, "book.toml"), "utf-8");
  precisionLinesJsonl = fs.readFileSync(path.join(PRECISION_DIR, "lines.jsonl"), "utf-8");
  // A broken fixture should fail here, not as a mystifying page-side load
  // error several tests later.
  parseDiyaGlData(precisionBookToml, precisionLinesJsonl);
});

test.afterAll(async () => {
  await closeServer();
});

function bstUrl() {
  return `${baseUrl}/bst.html`;
}

async function withTestClientIds(page) {
  await page.addInitScript(() => {
    window.DIYA_GL_CLOUD_TEST_CLIENT_ID = "test-diya-gl-client";
    window.DIYA_GL_DRIVE_TEST_CLIENT_ID = "test-drive-client";
  });
}

// A signed-in tab, without going through the OAuth exchange -- the same
// seeding diya-gl-cloud.browser.test.js uses.
async function withSignedInSession(page) {
  await page.addInitScript(() => {
    function b64url(obj) {
      const json = JSON.stringify(obj);
      const base64 = btoa(unescape(encodeURIComponent(json)));
      return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    var claims = { sub: "user-1", email: "reader@example.com" };
    var idToken = b64url({ alg: "none" }) + "." + b64url(claims) + ".sig";
    window.sessionStorage.setItem("diya-gl.cloud.idToken", idToken);
    window.sessionStorage.setItem("diya-gl.cloud.accessToken", "access-1");
    window.sessionStorage.setItem("diya-gl.cloud.refreshToken", "refresh-1");
    window.sessionStorage.setItem("diya-gl.cloud.expiresAt", String(Date.now() + 3600_000));
    window.sessionStorage.setItem("diya-gl.cloud.user", JSON.stringify(claims));
  });
}

// A Drive token already held, bypassing connect() -- for cases that start
// from "already connected" rather than exercising the consent step itself.
async function withDriveToken(page, expiresInMs = 3600_000) {
  await page.addInitScript((ms) => {
    window.sessionStorage.setItem("diya-gl.cloud.driveToken", "seeded-drive-token");
    window.sessionStorage.setItem("diya-gl.cloud.driveTokenExpiresAt", String(Date.now() + ms));
  }, expiresInMs);
}

// Fakes google.accounts.oauth2 so Connect (and the silent re-request) never
// opens a real window or reaches accounts.google.com. Every call's prompt
// option is recorded; window.__driveTokenOutcome ("granted" by default,
// "refused", or "empty" for a silent retry that comes back with nothing, as
// an expired Google session does) controls what the callback receives.
async function withFakeGoogleIdentity(page) {
  await page.addInitScript(() => {
    window.__driveRequestAccessTokenCalls = [];
    window.__driveTokenOutcome = "granted";
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: function (config) {
            return {
              requestAccessToken: function (opts) {
                window.__driveRequestAccessTokenCalls.push(opts);
                var outcome = window.__driveTokenOutcome;
                setTimeout(function () {
                  if (outcome === "refused") {
                    config.callback({ error: "access_denied" });
                  } else if (outcome === "empty") {
                    config.callback({ error: "immediate_failed" });
                  } else {
                    config.callback({ access_token: "fake-drive-token", expires_in: 3600 });
                  }
                }, 0);
              },
            };
          },
          hasGrantedAllScopes: function () {
            return true;
          },
        },
      },
    };
  });
}

// Fakes google.picker (call after withFakeGoogleIdentity, which owns
// window.google) so the Picker never loads apis.google.com or opens a frame.
// Each built picker is recorded; window.__pickerOutcome ("picked" by default,
// or "cancel") and window.__pickedFile say what the callback receives.
async function withFakeGooglePicker(page) {
  await page.addInitScript(() => {
    window.__pickerBuilds = [];
    window.__pickerOutcome = "picked";
    window.__pickedFile = { id: "picked-1", name: "Picked Book.diya-gl.zip" };
    window.google.picker = {
      ViewId: { DOCS: "docs" },
      Response: { ACTION: "action", DOCUMENTS: "docs" },
      Action: { PICKED: "picked", CANCEL: "cancel" },
      Document: { ID: "id", NAME: "name" },
      DocsView: function (viewId) {
        this.viewId = viewId;
        this.setMimeTypes = function (mimeTypes) {
          this.mimeTypes = mimeTypes;
          return this;
        };
      },
      PickerBuilder: function () {
        var record = {};
        var builder = this;
        window.__pickerBuilds.push(record);
        builder.addView = function (view) {
          record.mimeTypes = view.mimeTypes;
          return builder;
        };
        builder.setOAuthToken = function (token) {
          record.token = token;
          return builder;
        };
        builder.setDeveloperKey = function (key) {
          record.developerKey = key;
          return builder;
        };
        builder.setAppId = function (appId) {
          record.appId = appId;
          return builder;
        };
        builder.setCallback = function (callback) {
          record.callback = callback;
          return builder;
        };
        builder.build = function () {
          return {
            setVisible: function () {
              setTimeout(function () {
                var data = {};
                data.action = window.__pickerOutcome;
                if (window.__pickerOutcome === "picked") data.docs = [window.__pickedFile];
                record.callback(data);
              }, 0);
            },
          };
        };
      },
    };
  });
}

// The Picker API key lives in cloud-config.js; a test sets it on the resolved
// config once the page has loaded.
async function withPickerApiKey(page) {
  await page.evaluate(() => {
    window.DIYA_GL_CLOUD_CONFIG.googlePickerApiKey = "test-picker-key";
  });
}

async function loadExample(page) {
  await page.getByRole("button", { name: /bst-scenario-basic/ }).click();
  await expect(page.locator(".year-table-scroll, .month-cards").first()).toBeAttached({ timeout: 30_000 });
}

function gaEvents(page, eventName) {
  return page.evaluate(
    (name) => (window.dataLayer || []).filter((entry) => entry[0] === "event" && entry[1] === name).map((entry) => entry[2]),
    eventName,
  );
}

async function openAccountPanel(page) {
  await page.click("#account-btn");
  await expect(page.locator("#account-panel")).toBeVisible();
}

async function closeAccountPanel(page) {
  await page.click("#account-btn");
  await expect(page.locator("#account-panel")).toBeHidden();
}

function routeBooks(page, entitlement, books) {
  return page.route(`${PROD_API_BASE}/books`, (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ books: books || [], entitlement: entitlement }),
    });
  });
}

const NO_SUBSCRIPTION = { reason: "no-subscription", expiry: null, residentTier: true };

async function diyaGlZipBytes() {
  const zip = new JSZip();
  zip.file("book.toml", precisionBookToml);
  zip.file("lines.jsonl", precisionLinesJsonl);
  zip.file("report.json", "{}\n");
  return zip.generateAsync({ type: "nodebuffer" });
}

// A minimal fake of the handful of Drive v3 endpoints drive.js calls,
// backed by an in-memory file list so a test can seed it, drive the page
// against it, and read back what was called. Every route this page never
// calls (oauth2.googleapis.com, anything under /drive/v3 this file does not
// implement) simply 404s, the same as a real misrouted call would.
function createDriveBackend(seedFiles) {
  const files = (seedFiles || []).map((f) => Object.assign({ revisions: [], trashed: false }, f));
  const calls = { folderSearches: 0, folderCreates: 0, list: 0, get: [], uploads: [], keepRevision: [], revisionsList: 0, trash: [] };
  let folderId = null;
  let nextFileId = 1;
  let nextRevisionId = 100;

  function findFile(id) {
    return files.find((f) => f.id === id);
  }

  async function handle(route) {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (pathname === "/drive/v3/files" && method === "GET") {
      const q = url.searchParams.get("q") || "";
      if (q.indexOf("mimeType='application/vnd.google-apps.folder'") !== -1) {
        calls.folderSearches += 1;
        return json(200, { files: folderId ? [{ id: folderId, name: "DIYA-GL" }] : [] });
      }
      calls.list += 1;
      return json(200, {
        files: files
          .filter((f) => !f.trashed)
          .map((f) => ({
            id: f.id,
            name: f.name,
            size: f.size,
            modifiedTime: f.modifiedTime,
            appProperties: f.appProperties,
            headRevisionId: f.headRevisionId,
          })),
      });
    }
    if (pathname === "/drive/v3/files" && method === "POST") {
      calls.folderCreates += 1;
      folderId = "folder-1";
      return json(200, { id: folderId, name: "DIYA-GL" });
    }
    const revisionMatch = pathname.match(/^\/drive\/v3\/files\/([^/]+)\/revisions\/([^/]+)$/);
    if (revisionMatch && method === "GET") {
      const [, fileId, revisionId] = revisionMatch;
      if (url.searchParams.get("alt") === "media") {
        const bytes = await diyaGlZipBytes();
        return route.fulfill({ status: 200, contentType: "application/zip", body: bytes });
      }
      calls.get.push(fileId + "/revisions/" + revisionId);
      return json(200, { id: revisionId });
    }
    if (revisionMatch && method === "PATCH") {
      calls.keepRevision.push(revisionMatch[2]);
      return json(200, { id: revisionMatch[2], keepForever: true });
    }
    const revisionsListMatch = pathname.match(/^\/drive\/v3\/files\/([^/]+)\/revisions$/);
    if (revisionsListMatch && method === "GET") {
      calls.revisionsList += 1;
      const file = findFile(revisionsListMatch[1]);
      return json(200, { revisions: (file && file.revisions) || [] });
    }
    const fileMatch = pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (fileMatch && method === "GET") {
      const file = findFile(fileMatch[1]);
      if (!file) return json(404, { error: { message: "File not found", errors: [{ reason: "notFound" }] } });
      if (url.searchParams.get("alt") === "media") {
        const bytes = await diyaGlZipBytes();
        return route.fulfill({ status: 200, contentType: "application/zip", body: bytes });
      }
      calls.get.push(file.id);
      return json(200, { id: file.id, headRevisionId: file.headRevisionId });
    }
    if (fileMatch && method === "PATCH") {
      const file = findFile(fileMatch[1]);
      calls.trash.push(fileMatch[1]);
      if (file) file.trashed = true;
      return json(200, { id: fileMatch[1], trashed: true });
    }
    if (pathname.indexOf("/upload/drive/v3/files") === 0) {
      const body = request.postDataBuffer();
      const existingMatch = pathname.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/);
      const existingFileId = existingMatch ? existingMatch[1] : null;
      nextRevisionId += 1;
      const revisionId = String(nextRevisionId);
      calls.uploads.push({ method, existingFileId, body });
      if (existingFileId) {
        const file = findFile(existingFileId);
        if (file) file.headRevisionId = revisionId;
        return json(200, { id: existingFileId, size: body.length, modifiedTime: new Date().toISOString(), headRevisionId: revisionId });
      }
      const id = "file-" + nextFileId++;
      const newFile = {
        id: id,
        name: "Uploaded Book.diya-gl.zip",
        size: body.length,
        modifiedTime: new Date().toISOString(),
        headRevisionId: revisionId,
        appProperties: {},
        revisions: [],
        trashed: false,
      };
      files.push(newFile);
      return json(200, {
        id: id,
        name: newFile.name,
        size: newFile.size,
        modifiedTime: newFile.modifiedTime,
        appProperties: newFile.appProperties,
        headRevisionId: revisionId,
      });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  }

  return { handle, calls, files };
}

function multipartUploadStartsWithZipMagic(buffer) {
  const marker = Buffer.from("Content-Type: application/zip\r\n\r\n", "latin1");
  const index = buffer.indexOf(marker);
  if (index === -1) return false;
  const start = index + marker.length;
  return buffer[start] === 0x50 && buffer[start + 1] === 0x4b; // "PK"
}

test.beforeEach(async ({ page }) => {
  await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.sessionStorage.clear());
});

// Opens the save menu and clicks the Drive item -- the one entry point
// into the Drive panel, connected or not, signed into Submit or not.
async function clickSaveToDrive(page) {
  await page.click("#save-btn");
  const driveItem = page.getByRole("menuitem", { name: "Save to my Google Drive", exact: true });
  await expect(driveItem).toBeVisible();
  await driveItem.click();
}

test.describe("DIYA-GL page — Drive gate", () => {
  test("no Drive client id configured offers no Drive save item, and calls no googleapis endpoint", async ({ page }) => {
    await page.addInitScript(() => {
      window.DIYA_GL_DRIVE_TEST_CLIENT_ID = null;
    });
    await withFakeGoogleIdentity(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    let googleapisHit = false;
    await page.route(`${GOOGLE_API}/**`, (route) => {
      googleapisHit = true;
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await loadExample(page);
    await page.click("#save-btn");
    await expect(page.getByRole("menu")).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Save to my Google Drive" })).toHaveCount(0);

    expect(googleapisHit).toBe(false);
  });

  test("Drive is offered signed out, with no token: the save menu's Drive item opens the Connect card, with no call to Submit", async ({
    page,
  }) => {
    await withTestClientIds(page);
    await withFakeGoogleIdentity(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    let booksApiHit = false;
    await page.route(`${PROD_API_BASE}/**`, (route) => {
      booksApiHit = true;
      return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    });

    await loadExample(page);
    await clickSaveToDrive(page);

    await expect(page.locator("#account-panel")).toBeVisible();
    await expect(page.locator("#account-panel")).toContainText("DIYA-GL");
    await page.locator('[data-action="connect-drive"]').waitFor({ state: "visible" });

    expect(booksApiHit).toBe(false);
  });
});

test.describe("DIYA-GL page — save to Google Drive", () => {
  test("connecting creates the DIYA-GL folder and uploads a zip; a second save updates it without repeating the search", async ({
    page,
  }) => {
    await withTestClientIds(page);
    await withFakeGoogleIdentity(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    const backend = createDriveBackend();
    await page.route(`${GOOGLE_API}/**`, backend.handle);

    await loadExample(page);
    await clickSaveToDrive(page);
    await page.locator('[data-action="connect-drive"]').click();

    await expect(page.locator("#toast")).toContainText("DIYA-GL folder", { timeout: 10_000 });
    expect(backend.calls.folderSearches).toBe(1);
    expect(backend.calls.folderCreates).toBe(1);
    expect(backend.calls.uploads).toHaveLength(1);
    expect(backend.calls.uploads[0].existingFileId).toBeNull();
    expect(multipartUploadStartsWithZipMagic(backend.calls.uploads[0].body)).toBe(true);
    expect(backend.calls.keepRevision).toHaveLength(1);

    // The second save: the folder is already known, so nothing searches or
    // creates it again; the upload carries the file id from the first save.
    // The successful first save left the account panel open (its own
    // re-list), which sits over the save button -- close it first. The
    // toast text from the first save can still be showing when the second
    // click returns (dismissed on its own 4-second timer, not on this
    // click), so the upload count -- not the toast -- is what proves the
    // second save actually ran.
    await closeAccountPanel(page);
    await clickSaveToDrive(page);
    await expect.poll(() => backend.calls.uploads.length, { timeout: 10_000 }).toBe(2);
    await expect.poll(() => backend.calls.keepRevision.length, { timeout: 10_000 }).toBe(2);

    expect(backend.calls.folderSearches).toBe(1);
    expect(backend.calls.folderCreates).toBe(1);
    expect(backend.calls.uploads[1].existingFileId).toBe(backend.files[0].id);

    await expect.poll(() => gaEvents(page, "cloud_drive_save"), { timeout: 10_000 }).toHaveLength(2);
    const saveEvents = await gaEvents(page, "cloud_drive_save");
    expect(saveEvents).toEqual([
      { product: "bst", outcome: "created" },
      { product: "bst", outcome: "updated" },
    ]);
  });

  test("a moved headRevisionId shows the conflict card and sends no upload", async ({ page }) => {
    await withTestClientIds(page);
    await withFakeGoogleIdentity(page);
    await withDriveToken(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.sessionStorage.setItem("diya-gl.cloud.driveLink", JSON.stringify({ fileId: "file-1", headRevisionId: "stale-revision" }));
    });

    const backend = createDriveBackend([
      {
        id: "file-1",
        name: "Precision Code Trading.diya-gl.zip",
        size: 100,
        modifiedTime: "2026-03-01T09:00:00.000Z",
        headRevisionId: "fresh-revision",
        appProperties: {},
      },
    ]);
    await page.route(`${GOOGLE_API}/**`, backend.handle);

    await loadExample(page);
    await clickSaveToDrive(page);

    const conflict = page.locator(".account-conflict");
    await expect(conflict).toBeVisible({ timeout: 10_000 });
    await expect(conflict).toContainText("This book changed in Google Drive.");
    expect(backend.calls.uploads).toHaveLength(0);
  });

  test("an expired token's silent re-request comes back empty: the save falls back to the Connect card", async ({ page }) => {
    await withTestClientIds(page);
    await withFakeGoogleIdentity(page);
    // Already past expiry, so ensureToken's silent re-request fires on the
    // very first Drive call this test makes.
    await withDriveToken(page, -1000);
    await page.addInitScript(() => {
      window.__driveTokenOutcome = "empty";
    });
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    let googleapisHit = false;
    await page.route(`${GOOGLE_API}/**`, (route) => {
      googleapisHit = true;
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await loadExample(page);
    await clickSaveToDrive(page);

    await page.locator('[data-action="connect-drive"]').waitFor({ state: "visible", timeout: 10_000 });

    // The silent retry runs through the faked token client, never a real
    // HTTP call, and the retry itself failed before any Drive endpoint
    // could be reached.
    expect(googleapisHit).toBe(false);
    expect(await page.evaluate(() => window.sessionStorage.getItem("diya-gl.cloud.driveToken"))).toBeNull();
  });
});

test.describe("DIYA-GL page — Drive's own list, separate from the account's books", () => {
  test("the Drive list carries only Drive files, never an account book, and the account list carries none of Drive's", async ({ page }) => {
    await withTestClientIds(page);
    await withFakeGoogleIdentity(page);
    await withSignedInSession(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await routeBooks(page, NO_SUBSCRIPTION, [
      {
        bookId: "s3-book",
        title: "Older Trading Ltd",
        product: "bst",
        latestVersion: 1,
        latestETag: "etag-1",
        latestSize: 15000,
        updatedAt: "2026-01-01T09:00:00.000Z",
        periodCoveredStart: "2025-01-01",
        periodCoveredEnd: "2025-12-31",
        versions: [],
        provenance: {},
      },
    ]);

    const backend = createDriveBackend();
    await page.route(`${GOOGLE_API}/**`, backend.handle);

    await loadExample(page);
    await clickSaveToDrive(page);
    await page.locator('[data-action="connect-drive"]').click();
    await expect(page.locator("#toast")).toContainText("DIYA-GL folder", { timeout: 10_000 });

    const driveRows = page.locator(".account-row");
    await expect(driveRows).toHaveCount(1);
    await expect(driveRows.first()).not.toContainText("Older Trading Ltd");

    await closeAccountPanel(page);
    await openAccountPanel(page);
    const accountRows = page.locator(".account-row");
    await expect(accountRows).toHaveCount(1);
    await expect(accountRows.first()).toContainText("Older Trading Ltd");
    await expect(page.locator(".account-row-badge")).toHaveCount(0);
  });

  test("opening a Drive book's older revision fetches its revisions, then that revision's bytes", async ({ page }) => {
    await withTestClientIds(page);
    await withFakeGoogleIdentity(page);
    await withDriveToken(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    const backend = createDriveBackend([
      {
        id: "drive-book",
        name: "Precision Code Trading 2025-12-31.diya-gl.zip",
        size: 15000,
        modifiedTime: "2026-03-01T09:00:00.000Z",
        headRevisionId: "rev-head",
        appProperties: { product: "bst", periodStart: "2025-01-01", periodEnd: "2025-12-31" },
        revisions: [
          { id: "rev-old", modifiedTime: "2026-01-01T09:00:00.000Z", size: 14000, keepForever: true },
          { id: "rev-head", modifiedTime: "2026-03-01T09:00:00.000Z", size: 15000, keepForever: true },
        ],
      },
    ]);
    await page.route(`${GOOGLE_API}/**`, backend.handle);

    // Already connected, so this save both creates a second file in the
    // folder and re-lists it -- the pre-seeded drive-book row is what the
    // rest of this test reads from.
    await loadExample(page);
    await clickSaveToDrive(page);
    await expect(page.locator("#toast")).toContainText("DIYA-GL folder", { timeout: 10_000 });

    const row = page.locator('.account-row[data-book-id="drive-book"]');
    await row.getByRole("button", { name: "Versions", exact: true }).click();
    expect(backend.calls.revisionsList).toBe(1);

    await row.locator('[data-action="open"][data-version="rev-old"]').click();
    // The month-cards/year-table from the example already loaded stay
    // attached throughout, so they prove nothing here -- the panel closing
    // is performDriveOpen's own last step, once loadFile and the event
    // both landed.
    await expect(page.locator("#account-panel")).toBeHidden({ timeout: 15_000 });

    const opened = await gaEvents(page, "cloud_drive_open");
    expect(opened).toEqual([{ source: "revision" }]);
  });

  test("deleting a Drive book trashes it in Drive and the row goes", async ({ page }) => {
    await withTestClientIds(page);
    await withFakeGoogleIdentity(page);
    await withDriveToken(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });

    const backend = createDriveBackend([
      {
        id: "drive-book",
        name: "Older Save.diya-gl.zip",
        size: 15000,
        modifiedTime: "2026-03-01T09:00:00.000Z",
        headRevisionId: "rev-head",
        appProperties: {},
      },
    ]);
    await page.route(`${GOOGLE_API}/**`, backend.handle);

    await loadExample(page);
    await clickSaveToDrive(page);
    await expect(page.locator("#toast")).toContainText("DIYA-GL folder", { timeout: 10_000 });

    const row = page.locator('.account-row[data-book-id="drive-book"]');
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Delete", exact: true }).click();
    const confirm = page.locator('[data-action="confirm-delete"]');
    await expect(page.locator("#account-panel")).toContainText("Google Drive bin");
    await confirm.click();

    await expect(page.locator('.account-row[data-book-id="drive-book"]')).toHaveCount(0, { timeout: 15_000 });
    expect(backend.calls.trash).toEqual(["drive-book"]);
  });
});

test.describe("DIYA-GL page — Open from Google Drive through the Picker", () => {
  test("no Picker API key configured keeps the Open from Google Drive button off the panel", async ({ page }) => {
    await withTestClientIds(page);
    await withFakeGoogleIdentity(page);
    await withFakeGooglePicker(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.DIYA_GL_CLOUD_CONFIG.googlePickerApiKey = null;
    });
    await loadExample(page);
    await clickSaveToDrive(page);
    await page.locator('[data-action="connect-drive"]').waitFor({ state: "visible" });
    await expect(page.locator('[data-action="pick-drive"]')).toHaveCount(0);
  });

  test("signed out and not connected: the button asks for drive.file, opens the Picker with the key and project, and opens the picked book", async ({
    page,
  }) => {
    await withTestClientIds(page);
    await withFakeGoogleIdentity(page);
    await withFakeGooglePicker(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await withPickerApiKey(page);

    let booksApiHit = false;
    await page.route(`${PROD_API_BASE}/**`, (route) => {
      booksApiHit = true;
      return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    });
    const backend = createDriveBackend([
      {
        id: "picked-1",
        name: "Picked Book.diya-gl.zip",
        size: 15000,
        modifiedTime: "2026-03-01T09:00:00.000Z",
        headRevisionId: "rev-picked",
        appProperties: {},
      },
    ]);
    await page.route(`${GOOGLE_API}/**`, backend.handle);

    await loadExample(page);
    await clickSaveToDrive(page);
    await page.locator('[data-action="pick-drive"]').click();

    await expect(page.locator("#account-panel")).toBeHidden({ timeout: 15_000 });
    const builds = await page.evaluate(() =>
      window.__pickerBuilds.map((b) => ({ token: b.token, developerKey: b.developerKey, appId: b.appId, mimeTypes: b.mimeTypes })),
    );
    expect(builds).toEqual([
      {
        token: "fake-drive-token",
        developerKey: "test-picker-key",
        appId: "test-drive-client".split("-")[0],
        mimeTypes: "application/zip,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json",
      },
    ]);
    expect(await page.evaluate(() => window.__driveRequestAccessTokenCalls)).toEqual([{ prompt: "consent" }]);
    expect(await page.evaluate(() => JSON.parse(window.sessionStorage.getItem("diya-gl.cloud.driveLink")))).toEqual({
      fileId: "picked-1",
      headRevisionId: "rev-picked",
    });
    expect(await gaEvents(page, "cloud_drive_open")).toEqual([{ source: "picker" }]);
    expect(booksApiHit).toBe(false);
  });

  test("a token already held skips the consent step before the Picker opens", async ({ page }) => {
    await withTestClientIds(page);
    await withFakeGoogleIdentity(page);
    await withFakeGooglePicker(page);
    await withDriveToken(page);
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await withPickerApiKey(page);

    const backend = createDriveBackend([
      {
        id: "picked-1",
        name: "Picked Book.diya-gl.zip",
        size: 15000,
        modifiedTime: "2026-03-01T09:00:00.000Z",
        headRevisionId: "rev-picked",
        appProperties: {},
      },
    ]);
    await page.route(`${GOOGLE_API}/**`, backend.handle);

    await loadExample(page);
    await clickSaveToDrive(page);
    await expect(page.locator("#toast")).toContainText("DIYA-GL folder", { timeout: 10_000 });
    await page.locator('[data-action="pick-drive"]').click();

    await expect(page.locator("#account-panel")).toBeHidden({ timeout: 15_000 });
    expect(await page.evaluate(() => window.__driveRequestAccessTokenCalls)).toEqual([]);
    expect((await page.evaluate(() => window.__pickerBuilds)).length).toBe(1);
  });

  test("closing the Picker without a choice opens nothing and leaves the panel as it was", async ({ page }) => {
    await withTestClientIds(page);
    await withFakeGoogleIdentity(page);
    await withFakeGooglePicker(page);
    await withDriveToken(page);
    await page.addInitScript(() => {
      window.__pickerOutcome = "cancel";
    });
    await page.goto(bstUrl(), { waitUntil: "domcontentloaded" });
    await withPickerApiKey(page);

    const backend = createDriveBackend();
    await page.route(`${GOOGLE_API}/**`, backend.handle);

    await loadExample(page);
    await clickSaveToDrive(page);
    await expect(page.locator("#toast")).toContainText("DIYA-GL folder", { timeout: 10_000 });
    await page.locator('[data-action="pick-drive"]').click();

    await expect.poll(() => page.evaluate(() => window.__pickerBuilds.length)).toBe(1);
    await expect(page.locator("#account-panel")).toBeVisible();
    expect(await gaEvents(page, "cloud_drive_open")).toEqual([]);
    expect(backend.calls.get).toEqual([]);
  });
});
