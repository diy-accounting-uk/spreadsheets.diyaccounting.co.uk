// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// app-resources.js — the one resource loader the engine reads its own data
// files through.
//
// The engine needs four kinds of file it does not compute: the two published
// v2 JSON Schemas, the app/data/<year>.toml a book's dates name, the BST
// template xlsx, and the template meta.toml beside it. Every one of those
// reads goes through a loader with this interface, so a caller outside Node
// can supply its own:
//
//   readText(path)   -> Promise<string>
//   readBinary(path) -> Promise<Uint8Array>
//
// Paths are slash-separated and relative to the resource space below. The
// default loader reads this repo; the books page supplies one backed by fetch.
//
// Node's own modules load on the first read rather than with this file, so a
// bundle whose caller supplies a loader never pulls them in.

// The resource space is app/ with one named exception. The two v2 schemas are
// published by the site, not carried in app/, and the site serves them at
// /schema/ — so "schema/" is a root of its own rather than a directory under
// app/. A browser loader maps the same two roots onto its own URLs.
const SCHEMA_PREFIX = "schema/";
const SCHEMA_ROOT_FROM_APP = ["..", "web", "spreadsheets.diyaccounting.co.uk", "public", "schema"];

// The workbook templates are the company's own work and carry their own terms,
// so the published npm package and the image leave them out. A repository
// checkout has app/templates and reads it straight off disk. A packaged install
// has not, so the loader takes the same file from the site, which already
// serves the templates the DIYA-GL pages use, and keeps it in a user cache so
// every later run works with no network.
//
// This stays on /books/ while the site still serves the pages there. Every
// published version fetches this URL, so it moves only once the live site
// redirects it, and the redirect keeps the older versions working after that.
const TEMPLATE_PREFIX = "templates/";
const DEFAULT_TEMPLATE_SOURCE = "https://spreadsheets.diyaccounting.co.uk/books/assets/";

let templateTermsAnnounced = false;

function templateSource() {
  return (process.env.DIYA_GL_TEMPLATE_SOURCE || DEFAULT_TEMPLATE_SOURCE).replace(/\/$/, "");
}

function announceTemplateTerms(source) {
  if (templateTermsAnnounced) return;
  templateTermsAnnounced = true;
  console.error(
    [
      `diya-gl: the workbook templates are not part of this package. Fetching them from ${source} and caching them.`,
      "The templates are Copyright (C) 2006-2026 DIY Accounting Limited, licensed under the PolyForm Internal Use",
      "License 1.0.0 with an additional grant: use them for your own accounts, or for your clients' accounts if you",
      "are an accountant or a bookkeeper, and do not redistribute them. The terms are at",
      "https://github.com/diy-accounting-uk/spreadsheets.diyaccounting.co.uk/blob/main/LICENSE",
    ].join("\n"),
  );
}

/**
 * A template the packaged engine has no local copy of, taken from the site once
 * and read from the user cache every time after.
 *
 * @param {string} path - the resource path, always under "templates/"
 * @returns {Promise<Uint8Array>}
 */
async function fetchTemplate(path) {
  const { existsSync, mkdirSync, readFileSync, writeFileSync } = await import("fs");
  const { dirname, resolve } = await import("path");
  const { homedir } = await import("os");

  const cacheRoot = process.env.XDG_CACHE_HOME || resolve(homedir(), ".cache");
  const cached = resolve(cacheRoot, "diya-gl", path);
  if (existsSync(cached)) return readFileSync(cached);

  const source = templateSource();
  announceTemplateTerms(source);

  const url = `${source}/${path}`;
  let response;
  try {
    response = await fetch(url);
  } catch (cause) {
    throw new ResourceUnavailableError(path, `${url} could not be reached: ${cause.message}`);
  }
  if (!response.ok) {
    throw new ResourceUnavailableError(path, `${url} returned ${response.status} ${response.statusText}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  mkdirSync(dirname(cached), { recursive: true });
  writeFileSync(cached, bytes);
  return bytes;
}

/**
 * A resource read attempted where the file system is not reachable.
 */
export class ResourceUnavailableError extends Error {
  constructor(path, why) {
    super(`cannot read resource "${path}": ${why}`);
    this.name = "ResourceUnavailableError";
    this.path = path;
  }
}

/**
 * The default resource loader: this repo's own files.
 *
 * @param {string} [appDir] - the app/ directory; defaults to the one this file sits in
 * @returns {{readText: (path: string) => Promise<string>, readBinary: (path: string) => Promise<Uint8Array>}}
 */
export function nodeResourceLoader(appDir) {
  async function read(path, encoding) {
    const { existsSync, readFileSync } = await import("fs");
    const { resolve, dirname } = await import("path");
    const { fileURLToPath } = await import("url");
    const base = appDir ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const full = path.startsWith(SCHEMA_PREFIX)
      ? resolve(base, ...SCHEMA_ROOT_FROM_APP, path.slice(SCHEMA_PREFIX.length))
      : resolve(base, path);
    if (path.startsWith(TEMPLATE_PREFIX) && !existsSync(full)) {
      const bytes = await fetchTemplate(path);
      return encoding ? new TextDecoder(encoding).decode(bytes) : bytes;
    }
    return readFileSync(full, encoding);
  }

  return {
    readText: (path) => read(path, "utf8"),
    readBinary: (path) => read(path, undefined),
  };
}

/**
 * The two roots a loader has to serve, for a caller building its own.
 * "schema" is the published JSON Schema directory; "app" is everything else.
 */
export function resourceRoot(path) {
  return path.startsWith(SCHEMA_PREFIX) ? "schema" : "app";
}

/**
 * The path within its root, with the root prefix stripped.
 */
export function resourcePathWithinRoot(path) {
  return path.startsWith(SCHEMA_PREFIX) ? path.slice(SCHEMA_PREFIX.length) : path;
}

export const BOOK_SCHEMA_RESOURCE = `${SCHEMA_PREFIX}diya-gl-book-v2.schema.json`;
export const LINES_SCHEMA_RESOURCE = `${SCHEMA_PREFIX}diya-gl-lines-v2.schema.json`;
