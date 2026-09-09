// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// books/cloud-config.js
//
// The one environment the DIYA-GL pages' cloud sign-in talks to, on every
// host: Submit's released environment. The client id is a public OAuth
// identifier (no secret rides with it), so it is committed here rather than
// injected at deploy time -- it is the BooksUserPoolClientId output of
// Submit's IdentityStack. A null id keeps every cloud control off the page
// (cloud.js's isEnabled()).
(function () {
  "use strict";

  var config = {
    apiBase: "https://submit.diyaccounting.co.uk/api/v1",
    hostedUi: "https://prod-auth.diyaccounting.co.uk",
    clientId: "1c8hjrjp5g5ipm8o47t6qkks4r",
  };

  // A browser test's addInitScript sets this before any page script runs
  // to pin the id (or null it) -- nothing else about the resolved config
  // changes for it.
  if ("DIYA_GL_CLOUD_TEST_CLIENT_ID" in window) config.clientId = window.DIYA_GL_CLOUD_TEST_CLIENT_ID;

  window.DIYA_GL_CLOUD_CONFIG = config;
})();
