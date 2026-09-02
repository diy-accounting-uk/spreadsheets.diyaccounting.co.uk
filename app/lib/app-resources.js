// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
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
    const { readFileSync } = await import("fs");
    const { resolve, dirname } = await import("path");
    const { fileURLToPath } = await import("url");
    const base = appDir ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const full = path.startsWith(SCHEMA_PREFIX)
      ? resolve(base, ...SCHEMA_ROOT_FROM_APP, path.slice(SCHEMA_PREFIX.length))
      : resolve(base, path);
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
