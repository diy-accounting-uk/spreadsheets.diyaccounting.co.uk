// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { extname, resolve, sep } from "node:path";

const PUBLIC_DIR = resolve(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");

function buildServablePaths(publicDir) {
  const servablePaths = new Map();
  for (const entry of readdirSync(publicDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const entryDir = resolve(entry.parentPath ?? entry.path);
    const absolutePath = resolve(entryDir, entry.name);
    const urlPath =
      "/" +
      absolutePath
        .slice(publicDir.length + 1)
        .split(sep)
        .join("/");
    servablePaths.set(urlPath, absolutePath);
  }
  return servablePaths;
}

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".toml": "application/toml",
};

let server;
let baseUrl;

beforeAll(async () => {
  const servablePaths = buildServablePaths(PUBLIC_DIR);
  server = createServer((req, res) => {
    const urlPath = req.url === "/" ? "/index.html" : req.url;
    const filePath = servablePaths.get(urlPath);
    if (!filePath) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(readFileSync(filePath));
  });
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterAll(() => {
  if (server) server.close();
});

describe("Smoke test — local server renders pages", () => {
  it("index.html returns 200 and contains site name", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("DIY Accounting Spreadsheets");
  });

  it("index.html contains product cards", async () => {
    const res = await fetch(`${baseUrl}/`);
    const html = await res.text();
    expect(html).toContain("product-card");
    expect(html).toContain("download.html?product=");
  });

  it("download.html returns 200", async () => {
    const res = await fetch(`${baseUrl}/download.html`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Download");
  });

  it("donate.html returns 200 and has Stripe links", async () => {
    const res = await fetch(`${baseUrl}/donate.html`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("buy.stripe.com");
    expect(html).toContain("paypal.com/donate");
  });

  it("knowledge-base.html returns 200", async () => {
    const res = await fetch(`${baseUrl}/knowledge-base.html`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Knowledge Base");
  });

  it("non-existent page returns 404", async () => {
    const res = await fetch(`${baseUrl}/does-not-exist.html`);
    expect(res.status).toBe(404);
  });

  it("robots.txt returns 200", async () => {
    const res = await fetch(`${baseUrl}/robots.txt`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("User-agent");
  });

  it("spreadsheets.css returns 200", async () => {
    const res = await fetch(`${baseUrl}/spreadsheets.css`);
    expect(res.status).toBe(200);
  });
});
