// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// books/sw.js -- the DIYA-GL pages' service worker, scoped to /books/.
//
// Precaches the shell scripts and stylesheets, the engine bundle, the two
// published schemas, and the tax year, form-layout and example-book data
// every page's example buttons need, so the four DIYA-GL pages -- and one
// example book on each -- keep working with no network at all. The exact
// list and the cache name both come from build-stamp.js
// (scripts/build-books-bundle.mjs writes it, so this file never needs
// editing when a page's own scripts or examples change): the cache name is
// a hash of every precached file's own bytes, so a rebuild that changed
// nothing keeps the same cache, and one that changed a single file gets a
// new one and drops the old.
//
// Everything else -- an upload, a save, or a new book started from a
// template -- still needs the network; this worker never claims otherwise.

importScripts("./build-stamp.js");

const CACHE_PREFIX = "diya-gl-books-";
const CACHE_NAME = CACHE_PREFIX + self.DIYA_GL_BUILD_STAMP;
const PRECACHE_URLS = self.DIYA_GL_PRECACHE_URLS;
const SCOPE_PATH = "/books/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          PRECACHE_URLS.map((url) =>
            cache.add(url).catch((error) => {
              // One missing entry -- built against a checkout that has since
              // moved on -- fails that file only. Everything else still
              // caches, and a page that never asks for the missing one is
              // none the worse for it.
              console.warn(`sw.js: could not precache ${url}: ${error}`);
            }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

// Network-first for a page navigation, so a freshly deployed page shows up
// the moment it's reachable, falling back to the cached page when it is
// not. Cache-first for everything else in scope -- the engine, the tax and
// form data, an example book -- with a network fetch on a miss, cached for
// next time, so a resource this build did not foresee still works online
// and is available offline from then on.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(SCOPE_PATH) && !url.pathname.startsWith("/schema/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}
