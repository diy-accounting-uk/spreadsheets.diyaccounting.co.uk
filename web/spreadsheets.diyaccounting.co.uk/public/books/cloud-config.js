// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// books/cloud-config.js
//
// The two environments the books pages' cloud sign-in can talk to, chosen by
// location.hostname the same way the rest of the site tells ci from prod.
// The client id is a public OAuth identifier (no secret rides with it), so
// it is committed here rather than injected at deploy time; it stays null
// until Submit's IdentityStack (LP-15) is deployed and its output read back
// into this file, which keeps every cloud control off the page in every
// environment until then (cloud.js's isEnabled()).
(function () {
  "use strict";

  var CONFIGS = {
    prod: {
      apiBase: "https://submit.diyaccounting.co.uk/api/v1",
      hostedUi: "https://prod-auth.diyaccounting.co.uk",
      clientId: null,
    },
    ci: {
      apiBase: "https://ci-submit.diyaccounting.co.uk/api/v1",
      hostedUi: "https://ci-auth.diyaccounting.co.uk",
      clientId: null,
    },
  };

  function resolveEnvironment(hostname) {
    return hostname === "spreadsheets.diyaccounting.co.uk" ? "prod" : "ci";
  }

  var environment = resolveEnvironment(window.location.hostname);
  var config = Object.assign({}, CONFIGS[environment]);

  // A browser test's addInitScript sets this before any page script runs,
  // standing in for the id a build fills in once IdentityStack is deployed
  // -- nothing else about the resolved config changes for it.
  if (window.DIYA_GL_CLOUD_TEST_CLIENT_ID) config.clientId = window.DIYA_GL_CLOUD_TEST_CLIENT_ID;

  window.DIYA_GL_CLOUD_CONFIG = config;
})();
