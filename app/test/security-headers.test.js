// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resourcesDir = path.resolve(__dirname, "../../infra/main/resources");

// CloudFront's quota for one header value in a response headers policy.
const CLOUDFRONT_HEADER_VALUE_QUOTA = 1783;

// The regional Google hosts GA4's audience pixel is fetched from, one per reader region.
const REGIONAL_GOOGLE_HOSTS = [
  "ie",
  "es",
  "fr",
  "de",
  "nl",
  "pt",
  "it",
  "no",
  "se",
  "dk",
  "ch",
  "be",
  "pl",
  "com.au",
  "co.nz",
  "ca",
  "co.za",
  "co.in",
  "ae",
  "com.sg",
  "com.hk",
].map((tld) => `https://*.google.${tld}`);

function readCsp(fileName) {
  return JSON.parse(fs.readFileSync(path.join(resourcesDir, fileName), "utf8")).contentSecurityPolicy;
}

function directives(csp) {
  return Object.fromEntries(
    csp
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name, ...sources] = d.split(/\s+/);
        return [name, sources];
      }),
  );
}

describe.each(["security-headers.json", "diya-gl-security-headers.json"])("%s", (fileName) => {
  const csp = readCsp(fileName);
  const { "img-src": imgSrc, "connect-src": connectSrc } = directives(csp);

  it("img-src admits the Google regional hosts the audience pixel loads from", () => {
    expect(imgSrc).toEqual(expect.arrayContaining(["https://*.google.com", "https://*.google.co.uk", ...REGIONAL_GOOGLE_HOSTS]));
  });

  it("connect-src admits none of the regional hosts", () => {
    expect(connectSrc.filter((source) => REGIONAL_GOOGLE_HOSTS.includes(source))).toEqual([]);
  });

  it("the CSP stays inside CloudFront's header value quota", () => {
    expect(csp.length).toBeLessThanOrEqual(CLOUDFRONT_HEADER_VALUE_QUOTA);
  });
});
