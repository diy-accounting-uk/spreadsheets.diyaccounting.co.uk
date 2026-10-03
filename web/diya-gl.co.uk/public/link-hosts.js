// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/diya-gl.co.uk/public/link-hosts.js
//
// Which URLs ?book=<url> may fetch. The page fetches whatever the link names
// and loads it as a book, so the hosts are an allow-list: https only, and a
// host on the list. The Content-Security-Policy connect-src cannot name a
// bucket-name prefix, so this list is the narrow gate and the policy the
// wider one.

(function (global) {
  "use strict";

  var BOOK_LINK_HOSTS = ["d2hg4qibpn6ch3.cloudfront.net", /^chat-with-diya-gl-data[a-z0-9-]*\.s3(\.eu-west-2)?\.amazonaws\.com$/];
  var LOCAL_HOSTS = ["127.0.0.1", "localhost"];

  var REFUSAL =
    "This page opens books only from the chat-with-diya-gl demo (d2hg4qibpn6ch3.cloudfront.net and its chat-with-diya-gl-data storage on eu-west-2 S3), over https.";

  function hostIsAllowed(hostname) {
    return BOOK_LINK_HOSTS.some(function (entry) {
      return typeof entry === "string" ? entry === hostname : entry.test(hostname);
    });
  }

  /**
   * @param {string} text - the ?book= value
   * @returns {{ok: true, url: string} | {ok: false, message: string}}
   */
  function checkBookUrl(text) {
    var parsed;
    try {
      parsed = new URL(text);
    } catch (error) {
      return { ok: false, message: "The book link is not a web address. " + REFUSAL };
    }
    var host = parsed.hostname.toLowerCase();
    var local = LOCAL_HOSTS.indexOf(host) !== -1 && (parsed.protocol === "http:" || parsed.protocol === "https:");
    var remote = parsed.protocol === "https:" && parsed.username === "" && parsed.password === "" && hostIsAllowed(host);
    if (!local && !remote) return { ok: false, message: REFUSAL };
    return { ok: true, url: parsed.href };
  }

  global.DiyaGlLinkHosts = { checkBookUrl: checkBookUrl };
})(typeof window !== "undefined" ? window : globalThis);
