// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// app-resources-template-fetch.test.js — a packaged install has no
// app/templates, so the resource loader takes a template from the site once,
// states the terms it comes under, and reads its own cache from then on.

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer } from "http";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";

const TEMPLATE_BODY = 'spreadsheet = "bst-excel.xlsx"\n';

describe("a template the installed engine has no local copy of", () => {
  let server;
  let served;
  let requested;
  let appDir;
  let cacheDir;

  beforeAll(async () => {
    requested = [];
    served = TEMPLATE_BODY;
    server = createServer((request, response) => {
      requested.push(request.url);
      response.writeHead(200, { "content-type": "text/plain" });
      response.end(served);
    });
    await new Promise((ready) => server.listen(0, "127.0.0.1", ready));

    const scratch = mkdtempSync(resolve(tmpdir(), "diya-gl-template-fetch-"));
    appDir = resolve(scratch, "app");
    cacheDir = resolve(scratch, "cache");
    mkdirSync(appDir, { recursive: true });

    process.env.DIYA_GL_TEMPLATE_SOURCE = `http://127.0.0.1:${server.address().port}/books/assets/`;
    process.env.XDG_CACHE_HOME = cacheDir;
  });

  afterAll(async () => {
    delete process.env.DIYA_GL_TEMPLATE_SOURCE;
    delete process.env.XDG_CACHE_HOME;
    await new Promise((closed) => server.close(closed));
  });

  it("fetches it, states the terms once, then reads the cache", async () => {
    const { nodeResourceLoader } = await import("../lib/app-resources.js");
    const resources = nodeResourceLoader(appDir);
    const terms = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      expect(await resources.readText("templates/meta.toml")).toBe(TEMPLATE_BODY);
      expect(requested).toEqual(["/books/assets/templates/meta.toml"]);
      const announcements = terms.mock.calls.filter(([message]) => String(message).includes("PolyForm"));
      expect(announcements).toHaveLength(1);
      expect(existsSync(resolve(cacheDir, "diya-gl", "templates", "meta.toml"))).toBe(true);

      terms.mockClear();
      expect(await resources.readText("templates/meta.toml")).toBe(TEMPLATE_BODY);
      expect(requested).toHaveLength(1);
      expect(terms.mock.calls).toHaveLength(0);
    } finally {
      terms.mockRestore();
    }
  });

  it("names the address it could not read when the fetch fails", async () => {
    const { nodeResourceLoader, ResourceUnavailableError } = await import("../lib/app-resources.js");
    const resources = nodeResourceLoader(appDir);
    await new Promise((closed) => server.close(closed));

    await expect(resources.readBinary("templates/bst/bst-excel.xlsx")).rejects.toThrow(ResourceUnavailableError);
  });

  it("reads a local template without touching the network", async () => {
    const { nodeResourceLoader } = await import("../lib/app-resources.js");
    const local = mkdtempSync(resolve(tmpdir(), "diya-gl-template-local-"));
    mkdirSync(resolve(local, "templates"), { recursive: true });
    writeFileSync(resolve(local, "templates", "meta.toml"), 'spreadsheet = "local.xlsx"\n');

    const before = requested.length;
    expect(await nodeResourceLoader(local).readText("templates/meta.toml")).toBe('spreadsheet = "local.xlsx"\n');
    expect(requested).toHaveLength(before);
  });
});
