// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-view-server.js — a read-only caching proxy on 127.0.0.1 for the
// diya-gl pages. A GET or HEAD for /<path> is answered from the cache
// directory when it holds the file; otherwise the file is fetched from the
// origin site, stored with its content type, and served. A non-2xx answer
// from the origin passes through with its status and is not stored.
//
// The pages are not part of the npm package: they are fetched from the site
// on first use. The service worker script is answered 404, so the browser
// never layers a second cache over this one.
//
// The workbook templates are fetched from the template source (the same site
// the engine's own template loader uses) and streamed back unchanged.

import { createServer } from "http";
import { mkdir, readFile, realpath, rename, writeFile } from "fs/promises";
import { extname, resolve, sep } from "path";

export const DEFAULT_ORIGIN = "https://diya-gl.co.uk";
export const DEFAULT_TEMPLATE_SOURCE = "https://spreadsheets.diyaccounting.co.uk/diya-gl/assets";
const TEMPLATE_URL_PREFIX = "/assets/templates/";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jsonl": "application/x-ndjson; charset=utf-8",
  ".toml": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
};

function send(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, { "Content-Type": contentType, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(body);
}

const SERVICE_WORKER_PATH = "/sw.js";

/**
 * The cache entry paths for a URL path, or null when the path would leave the
 * cache directory. The body and its content type are stored side by side.
 */
function cacheEntryFor(cacheReal, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0") || decoded.includes("\\")) return null;
  const segments = decoded.split("/").filter((segment) => segment !== "");
  if (segments.some((segment) => segment === "." || segment === "..")) return null;
  if (decoded.endsWith("/") || segments.length === 0) segments.push("index.html");
  const body = resolve(cacheReal, "body", ...segments);
  if (!body.startsWith(resolve(cacheReal, "body") + sep)) return null;
  return { body, type: resolve(cacheReal, "type", ...segments) };
}

async function readIfPresent(path, cacheReal) {
  try {
    const real = await realpath(path);
    if (!real.startsWith(cacheReal + sep)) return null;
    return await readFile(real);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR" || error.code === "EISDIR") return null;
    throw error;
  }
}

async function writeAtomically(path, data) {
  await mkdir(resolve(path, ".."), { recursive: true });
  const temporary = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(temporary, data);
  await rename(temporary, path);
}

async function serveFromOrigin(request, response, { origin, cacheReal, urlPath, search }) {
  const entry = cacheEntryFor(cacheReal, urlPath);
  if (!entry) {
    send(response, 404, "Not found\n");
    return;
  }
  const cachedBody = await readIfPresent(entry.body, cacheReal);
  const cachedType = cachedBody ? await readIfPresent(entry.type, cacheReal) : null;
  if (cachedBody && cachedType) {
    response.writeHead(200, {
      "Content-Type": cachedType.toString("utf8"),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : cachedBody);
    return;
  }
  const url = `${origin}${urlPath}${search}`;
  let upstream;
  try {
    upstream = await fetch(url);
  } catch (cause) {
    send(response, 502, `${url} could not be fetched: ${cause.message}\n`);
    return;
  }
  const body = Buffer.from(await upstream.arrayBuffer());
  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  if (!upstream.ok) {
    send(response, upstream.status, request.method === "HEAD" ? undefined : body, contentType);
    return;
  }
  await writeAtomically(entry.body, body);
  await writeAtomically(entry.type, contentType);
  send(response, 200, request.method === "HEAD" ? undefined : body, contentType);
}

async function proxyTemplate(response, templateSource, urlPath) {
  const url = `${templateSource.replace(/\/$/, "")}/templates/${urlPath.slice(TEMPLATE_URL_PREFIX.length)}`;
  let upstream;
  try {
    upstream = await fetch(url);
  } catch (cause) {
    send(response, 502, `The workbook template could not be fetched from ${url}: ${cause.message}\n`);
    return;
  }
  if (!upstream.ok) {
    send(response, upstream.status === 404 ? 404 : 502, `${url} returned ${upstream.status}\n`);
    return;
  }
  send(response, 200, Buffer.from(await upstream.arrayBuffer()), CONTENT_TYPES[extname(urlPath)] ?? "application/octet-stream");
}

/**
 * @param {Object} options
 * @param {string} options.cacheDir - the directory fetched files are stored in; created when absent
 * @param {string} [options.origin] - the site pages are fetched from
 * @param {number} [options.port] - 0 or absent lets the OS choose a free port
 * @param {string} [options.templateSource] - where /assets/templates/ requests are fetched from
 * @returns {Promise<{server: import("http").Server, port: number, host: string, origin: string, cacheDir: string, close: () => Promise<void>}>}
 */
export async function startViewServer({ cacheDir, origin = DEFAULT_ORIGIN, port = 0, templateSource = DEFAULT_TEMPLATE_SOURCE }) {
  await mkdir(cacheDir, { recursive: true });
  const cacheReal = await realpath(cacheDir);
  const host = "127.0.0.1";
  const originBase = origin.replace(/\/$/, "");

  const server = createServer(async (request, response) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        send(response, 405, "Method not allowed\n");
        return;
      }
      // The path as sent: new URL() would collapse dot segments before the escape check sees them.
      const queryAt = request.url.indexOf("?");
      const urlPath = queryAt === -1 ? request.url : request.url.slice(0, queryAt);
      const search = queryAt === -1 ? "" : request.url.slice(queryAt);
      if (!urlPath.startsWith("/") || urlPath === SERVICE_WORKER_PATH) {
        send(response, 404, "Not found\n");
        return;
      }
      if (urlPath.startsWith(TEMPLATE_URL_PREFIX)) {
        if (urlPath.includes("..")) {
          send(response, 404, "Not found\n");
          return;
        }
        await proxyTemplate(response, templateSource, urlPath);
        return;
      }
      await serveFromOrigin(request, response, { origin: originBase, cacheReal, urlPath, search });
    } catch (error) {
      send(response, 500, `${error.message}\n`);
    }
  });

  await new Promise((resolveListening, rejectListening) => {
    server.once("error", rejectListening);
    server.listen(port, host, resolveListening);
  });

  return {
    server,
    host,
    origin: originBase,
    cacheDir: cacheReal,
    port: server.address().port,
    close: () =>
      new Promise((resolveClosed) => {
        server.close(() => resolveClosed());
        server.closeAllConnections();
      }),
  };
}
