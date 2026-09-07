// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// books/pwa.js -- registers books/sw.js on every DIYA-GL page, so the page
// keeps working offline once it has been opened once online. Registration
// runs after the page has finished loading, so it never competes with the
// engine and resources the page itself is fetching on first paint.

(function () {
  "use strict";
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function (error) {
      console.warn("pwa.js: service worker registration failed:", error);
    });
  });
})();
