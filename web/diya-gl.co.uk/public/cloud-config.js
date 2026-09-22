// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/diya-gl.co.uk/public/cloud-config.js
//
// Configuration for cloud sign-in on diya-gl.co.uk and ci.diya-gl.co.uk.
// Both hosts talk to Submit's released environment. The client id is a
// public OAuth identifier (no secret rides with it), so it is committed
// here rather than injected at deploy time -- it is the BooksUserPoolClientId
// output of Submit's IdentityStack. A null id keeps every cloud control off
// the page (cloud.js's isEnabled()).
//
// googleClientId is the same kind of public identifier for the Drive store
// (drive.js's isOffered()) -- Submit's Google OAuth client id, once the
// operator's console steps (PLAN_DIYA_GL_LAUNCH.md, LP-24 "Operator steps")
// have added diya-gl.co.uk and ci.diya-gl.co.uk as authorised origins. It
// stays null until then, which keeps every Drive control off the page.
(function () {
  "use strict";

  var config = {
    apiBase: "https://submit.diyaccounting.co.uk/api/v1",
    hostedUi: "https://prod-auth.diyaccounting.co.uk",
    clientId: "1c8hjrjp5g5ipm8o47t6qkks4r",
    googleClientId: null,
  };

  // A browser test's addInitScript sets these before any page script runs
  // to pin an id (or null it) -- nothing else about the resolved config
  // changes for either.
  if ("DIYA_GL_CLOUD_TEST_CLIENT_ID" in window) config.clientId = window.DIYA_GL_CLOUD_TEST_CLIENT_ID;
  if ("DIYA_GL_DRIVE_TEST_CLIENT_ID" in window) config.googleClientId = window.DIYA_GL_DRIVE_TEST_CLIENT_ID;

  window.DIYA_GL_CLOUD_CONFIG = config;
})();
