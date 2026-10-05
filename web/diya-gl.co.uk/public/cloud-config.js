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
// (drive.js's isOffered(), free and browser-only, no Submit sign-in) --
// its own web client, separate from the sign-in client above, with
// diya-gl.co.uk and ci.diya-gl.co.uk among its JavaScript origins (Submit's
// infra/google/gcp/oauth.toml, purpose drive_browser). A null id keeps
// every Drive control off the page.
//
// googlePickerApiKey is the restricted API key for the Google Picker on Drive
// operations (infra/google/gcp/api-keys.toml, id drive-picker-browser),
// stored in GitHub repository variables and read at build time. The key is
// public by design, with restrictions protecting it: only the Drive and Picker
// APIs, only the referrers listed in the key's config.
(function () {
  "use strict";

  var config = {
    apiBase: "https://submit.diyaccounting.co.uk/api/v1",
    submitOrigin: "https://submit.diyaccounting.co.uk",
    hostedUi: "https://prod-auth.diyaccounting.co.uk",
    clientId: "1c8hjrjp5g5ipm8o47t6qkks4r",
    googleClientId: "670010122633-56q89d0h9c4skb9cpj4h9j2gr3kq06vd.apps.googleusercontent.com",
    googlePickerApiKey: "",
  };

  // A browser test's addInitScript sets these before any page script runs
  // to pin an id (or null it) -- nothing else about the resolved config
  // changes for either.
  if ("DIYA_GL_CLOUD_TEST_CLIENT_ID" in window) config.clientId = window.DIYA_GL_CLOUD_TEST_CLIENT_ID;
  if ("DIYA_GL_DRIVE_TEST_CLIENT_ID" in window) config.googleClientId = window.DIYA_GL_DRIVE_TEST_CLIENT_ID;

  if ("DIYA_GL_SUBMIT_TEST_ORIGIN" in window) config.submitOrigin = window.DIYA_GL_SUBMIT_TEST_ORIGIN;

  window.DIYA_GL_CLOUD_CONFIG = config;
})();
