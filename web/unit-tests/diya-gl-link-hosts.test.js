// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/unit-tests/diya-gl-link-hosts.test.js
//
// link-hosts.js is a classic browser script; it runs here in a bare context
// the way the page runs it.

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";

let checkBookUrl;

beforeAll(() => {
  const context = createContext({ URL });
  context.window = context;
  const file = resolve(process.cwd(), "web/diya-gl.co.uk/public/link-hosts.js");
  runInContext(readFileSync(file, "utf8"), context, { filename: file });
  checkBookUrl = context.DiyaGlLinkHosts.checkBookUrl;
});

describe("checkBookUrl accepts", () => {
  it.each([
    "https://d2hg4qibpn6ch3.cloudfront.net/books/a.zip",
    "https://chat-with-diya-gl-data-bucket-1a2b3c4d.s3.eu-west-2.amazonaws.com/a.zip?X-Amz-Signature=abc",
    "https://chat-with-diya-gl-data.s3.amazonaws.com/a.zip",
    "http://127.0.0.1:8123/book.zip",
    "http://localhost:3000/book.json",
  ])("%s", (url) => {
    expect(checkBookUrl(url)).toEqual({ ok: true, url: new URL(url).href });
  });
});

describe("checkBookUrl refuses, naming where books open from", () => {
  it.each([
    "https://example.com/x.zip",
    "http://d2hg4qibpn6ch3.cloudfront.net/a.zip",
    "https://evil.s3.eu-west-2.amazonaws.com/a.zip",
    "https://chat-with-diya-gl-data.s3.us-east-1.amazonaws.com/a.zip",
    "https://chat-with-diya-gl-data.s3.eu-west-2.amazonaws.com.evil.example/a.zip",
    "https://xchat-with-diya-gl-data.s3.eu-west-2.amazonaws.com/a.zip",
    "https://d2hg4qibpn6ch3.cloudfront.net@evil.example/a.zip",
    "https://user:pw@d2hg4qibpn6ch3.cloudfront.net/a.zip",
    "https://amazonaws.com/a.zip",
    "https://127.0.0.1.evil.example/a.zip",
    "ftp://127.0.0.1/a.zip",
    "javascript:alert(1)",
    "not a url",
    "",
  ])("%j", (url) => {
    const result = checkBookUrl(url);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("opens books only from");
  });
});
