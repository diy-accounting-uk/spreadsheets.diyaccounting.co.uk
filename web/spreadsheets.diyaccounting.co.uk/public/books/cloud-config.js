// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// books/cloud-config.js
//
// The two environments the books pages' cloud sign-in can talk to, chosen by
// location.hostname the same way the rest of the site tells ci from prod.
// The client id is a public OAuth identifier (no secret rides with it), so
// it is committed here rather than injected at deploy time: each value is
// the BooksUserPoolClientId output of Submit's IdentityStack for that
// environment. A null id keeps every cloud control off the page
// (cloud.js's isEnabled()).
(function () {
  "use strict";

  var CONFIGS = {
    prod: {
      apiBase: "https://submit.diyaccounting.co.uk/api/v1",
      hostedUi: "https://prod-auth.diyaccounting.co.uk",
      clientId: "1c8hjrjp5g5ipm8o47t6qkks4r",
    },
    ci: {
      apiBase: "https://ci-submit.diyaccounting.co.uk/api/v1",
      hostedUi: "https://ci-auth.diyaccounting.co.uk",
      clientId: "53op0ccvcaseceue5t8kfr1vq1",
    },
  };

  function resolveEnvironment(hostname) {
    return hostname === "spreadsheets.diyaccounting.co.uk" ? "prod" : "ci";
  }

  var environment = resolveEnvironment(window.location.hostname);
  var config = Object.assign({}, CONFIGS[environment]);

  // A browser test's addInitScript sets this before any page script runs
  // to pin the id (or null it) -- nothing else about the resolved config
  // changes for it.
  if ("DIYA_GL_CLOUD_TEST_CLIENT_ID" in window) config.clientId = window.DIYA_GL_CLOUD_TEST_CLIENT_ID;

  window.DIYA_GL_CLOUD_CONFIG = config;
})();
