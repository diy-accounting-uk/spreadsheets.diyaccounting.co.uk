// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-view.test.js — the local server behind `diya-gl view` binds to
// 127.0.0.1, fetches a file from its origin once and serves it from the cache
// afterwards with the origin's content type, passes an origin error on
// uncached, refuses paths that leave the cache, and fetches a workbook
// template from the template source.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "fs";
import { createServer, request as httpRequest } from "http";
import { tmpdir } from "os";
import { resolve } from "path";

import { startViewServer } from "../lib/diya-gl-view-server.js";

describe("diya-gl view server", () => {
  let running;
  let originServer;
  let hits;
  let scratch;

  beforeAll(async () => {
    hits = [];
    originServer = createServer((request, response) => {
      hits.push(`${request.method} ${request.url}`);
      const files = {
        "/bst.html": ["text/html; charset=utf-8", "<title>bst</title>"],
        "/engine/diya-gl-engine.js": ["text/javascript; charset=utf-8", "export const engine = 1;"],
        "/templates/bst/meta.toml": ["text/plain", "template-bytes"],
      };
      const file = files[request.url];
      if (!file) {
        response.writeHead(404, { "Content-Type": "text/plain" });
        response.end("origin says no");
        return;
      }
      response.writeHead(200, { "Content-Type": file[0] });
      response.end(file[1]);
    });
    await new Promise((done) => originServer.listen(0, "127.0.0.1", done));
    const origin = `http://127.0.0.1:${originServer.address().port}`;
    scratch = mkdtempSync(resolve(tmpdir(), "diya-gl-view-"));
    running = await startViewServer({ cacheDir: resolve(scratch, "cache"), origin, port: 0, templateSource: `${origin}` });
  });

  afterAll(async () => {
    await running.close();
    await new Promise((done) => originServer.close(done));
    rmSync(scratch, { recursive: true, force: true });
  });

  const get = (path, options) => fetch(`http://127.0.0.1:${running.port}${path}`, options);
  // fetch() resolves dot segments before sending; a raw request sends the path as written.
  const rawStatus = (path) =>
    new Promise((resolveStatus, rejectStatus) => {
      const outgoing = httpRequest({ host: "127.0.0.1", port: running.port, path, method: "GET" }, (incoming) => {
        incoming.resume();
        resolveStatus(incoming.statusCode);
      });
      outgoing.on("error", rejectStatus);
      outgoing.end();
    });
  const hitCount = (path) => hits.filter((hit) => hit === `GET ${path}`).length;

  it("listens on 127.0.0.1 only", () => {
    expect(running.server.address().address).toBe("127.0.0.1");
    expect(running.port).toBeGreaterThan(0);
  });

  it("fetches a page from the origin on the first request and serves it from the cache on the second", async () => {
    const first = await get("/bst.html");
    expect(first.status).toBe(200);
    expect(await first.text()).toBe("<title>bst</title>");
    expect(hitCount("/bst.html")).toBe(1);

    const second = await get("/bst.html");
    expect(second.status).toBe(200);
    expect(await second.text()).toBe("<title>bst</title>");
    expect(hitCount("/bst.html")).toBe(1);
  });

  it("keeps the origin's content type for a fetched file and for its cached copy", async () => {
    for (let round = 0; round < 2; round++) {
      const page = await get("/bst.html");
      expect(page.headers.get("content-type")).toBe("text/html; charset=utf-8");
      const engine = await get("/engine/diya-gl-engine.js");
      expect(engine.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
      await engine.arrayBuffer();
    }
    expect(hitCount("/engine/diya-gl-engine.js")).toBe(1);
  });

  it("answers a HEAD request from the cache without a body", async () => {
    const response = await get("/bst.html", { method: "HEAD" });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(hitCount("/bst.html")).toBe(1);
  });

  it("passes the origin's 404 on and does not cache it", async () => {
    for (let round = 0; round < 2; round++) {
      const response = await get("/absent.html");
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("origin says no");
    }
    expect(hitCount("/absent.html")).toBe(2);
    expect(existsSync(resolve(running.cacheDir, "body", "absent.html"))).toBe(false);
  });

  it("answers 404 for a path above the cache without asking the origin", async () => {
    const before = hits.length;
    for (const path of [
      "/../package.json",
      "/%2e%2e/package.json",
      "/a/%2e%2e/%2e%2e/package.json",
      "/a%5c..%5cb",
      "/%2E%2E%2fpackage.json",
    ]) {
      expect(await rawStatus(path), path).toBe(404);
    }
    expect(hits.length).toBe(before);
  });

  it("answers 404 for the service worker script without asking the origin", async () => {
    const before = hits.length;
    expect((await get("/sw.js")).status).toBe(404);
    expect(hits.length).toBe(before);
  });

  it("refuses a method that writes", async () => {
    expect((await get("/bst.html", { method: "POST" })).status).toBe(405);
  });

  it("fetches a workbook template from the template source", async () => {
    const response = await get("/assets/templates/bst/meta.toml");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("template-bytes");
  });

  it("stores fetched files only under its cache directory", () => {
    expect(readdirSync(running.cacheDir).sort()).toEqual(["body", "type"]);
  });
});
