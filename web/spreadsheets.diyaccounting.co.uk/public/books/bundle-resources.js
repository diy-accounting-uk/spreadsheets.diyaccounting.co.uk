// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// bundle-resources.js — the resource loader the books page hands the engine.
//
// Same interface as nodeResourceLoader in app/lib/app-resources.js, backed by
// fetch. The engine names its files under two roots and this maps each one to
// a URL:
//
//   schema/<file>   -> /schema/<file>          the site already publishes these
//   <anything else> -> /books/assets/<path>    copied there by the bundle build
//
// The layout under books/assets mirrors app/ one for one:
//
//   books/assets/data/se-2025-2026.toml            app/data/
//   books/assets/templates/meta.toml               app/templates/
//   books/assets/templates/bst/bst-excel.xlsx      app/templates/bst/
//   books/assets/examples/<name>/bst/book.toml     examples/<name>/bst/
//   books/assets/examples/<name>/bst/lines.jsonl

const SCHEMA_PREFIX = "schema/";

/**
 * @param {Object} [options]
 * @param {string} [options.assetRoot] - where the copied app/ files are served from
 * @param {string} [options.schemaRoot] - where the published JSON Schemas are served from
 */
export function browserResourceLoader(options = {}) {
  const assetRoot = (options.assetRoot ?? "/books/assets").replace(/\/$/, "");
  const schemaRoot = (options.schemaRoot ?? "/schema").replace(/\/$/, "");

  function urlFor(path) {
    return path.startsWith(SCHEMA_PREFIX) ? `${schemaRoot}/${path.slice(SCHEMA_PREFIX.length)}` : `${assetRoot}/${path}`;
  }

  async function get(path) {
    const url = urlFor(path);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`cannot read resource "${path}": ${url} returned ${response.status}`);
    return response;
  }

  return {
    readText: async (path) => (await get(path)).text(),
    readBinary: async (path) => new Uint8Array(await (await get(path)).arrayBuffer()),
  };
}
