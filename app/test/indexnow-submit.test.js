// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// indexnow-submit.test.js — the URL list and payload that scripts/indexnow-submit.mjs sends.
// No test makes a network call.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { urlsChangedSince, buildPayload, findKey } from "../../scripts/indexnow-submit.mjs";

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.test/</loc><lastmod>2026-11-12</lastmod><priority>1.0</priority></url>
  <url><loc>https://example.test/old.html</loc><lastmod>2026-01-02</lastmod><priority>0.9</priority></url>
  <url><loc>https://example.test/a.html?x=1&amp;y=2</loc><lastmod>2026-11-12</lastmod><priority>0.9</priority></url>
  <url><loc>https://example.test/</loc><lastmod>2026-11-12</lastmod><priority>1.0</priority></url>
  <url><loc>https://example.test/nodate.html</loc><priority>0.5</priority></url>
</urlset>`;

const at = (iso) => new Date(iso);

describe("urlsChangedSince", () => {
  it("keeps URLs whose lastmod is the run date or the day before, decoded and without duplicates", () => {
    expect(urlsChangedSince(sitemap, at("2026-11-12T10:00:00Z"))).toEqual(["https://example.test/", "https://example.test/a.html?x=1&y=2"]);
    expect(urlsChangedSince(sitemap, at("2026-11-13T00:30:00Z"))).toEqual(["https://example.test/", "https://example.test/a.html?x=1&y=2"]);
  });

  it("drops URLs two days old or more", () => {
    expect(urlsChangedSince(sitemap, at("2026-11-14T00:30:00Z"))).toEqual([]);
  });

  it("takes the day before across a month boundary", () => {
    expect(urlsChangedSince(sitemap.replaceAll("2026-11-12", "2026-10-31"), at("2026-11-01T01:00:00Z"))).toHaveLength(2);
  });

  it("sends at most 10,000 URLs", () => {
    const many = Array.from(
      { length: 10050 },
      (_, i) => `<url><loc>https://example.test/${i}</loc><lastmod>2026-11-12</lastmod></url>`,
    ).join("");
    expect(urlsChangedSince(`<urlset>${many}</urlset>`, at("2026-11-12T10:00:00Z"))).toHaveLength(10000);
  });
});

describe("findKey", () => {
  it("returns the name of the single key file", () => {
    expect(findKey(["a.html", "9e6145dabe58574f94487e531aa32c7f.txt", "robots.txt"])).toBe("9e6145dabe58574f94487e531aa32c7f");
  });

  it("returns nothing for none or for two", () => {
    expect(findKey(["robots.txt"])).toBeUndefined();
    expect(findKey(["9e6145dabe58574f94487e531aa32c7f.txt", "0e6145dabe58574f94487e531aa32c7f.txt"])).toBeUndefined();
  });
});

describe("buildPayload", () => {
  it("names the host, key and key location", () => {
    expect(buildPayload("diya-gl.co.uk", "abc", ["https://diya-gl.co.uk/"])).toEqual({
      host: "diya-gl.co.uk",
      key: "abc",
      keyLocation: "https://diya-gl.co.uk/abc.txt",
      urlList: ["https://diya-gl.co.uk/"],
    });
  });
});

describe("key files", () => {
  it.each(["web/spreadsheets.diyaccounting.co.uk/public", "web/diya-gl.co.uk/public"])(
    "%s has one key file holding its own name",
    (dir) => {
      const publicDir = resolve(__dirname, "../..", dir);
      const key = findKey(readdirSync(publicDir));
      expect(key).toBeDefined();
      expect(readFileSync(resolve(publicDir, `${key}.txt`), "utf8")).toBe(key);
    },
  );
});
