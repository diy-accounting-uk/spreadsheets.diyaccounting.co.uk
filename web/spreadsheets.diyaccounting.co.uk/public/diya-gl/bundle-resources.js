// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// bundle-resources.js — the resource loader the DIYA-GL page hands the engine.
//
// Same interface as nodeResourceLoader in app/lib/app-resources.js, backed by
// fetch. The engine names its files under two roots and this maps each one to
// a URL:
//
//   schema/<file>   -> /schema/<file>          the site already publishes these
//   <anything else> -> /diya-gl/assets/<path>  copied there by the bundle build
//
// The layout under diya-gl/assets mirrors app/ one for one:
//
//   diya-gl/assets/data/se-2025-2026.toml            app/data/
//   diya-gl/assets/templates/meta.toml               app/templates/
//   diya-gl/assets/templates/bst/bst-excel.xlsx      app/templates/bst/
//   diya-gl/assets/examples/<name>/bst/book.toml     examples/<name>/bst/
//   diya-gl/assets/examples/<name>/bst/lines.jsonl

const SCHEMA_PREFIX = "schema/";

/**
 * @param {Object} [options]
 * @param {string} [options.assetRoot] - where the copied app/ files are served from
 * @param {string} [options.schemaRoot] - where the published JSON Schemas are served from
 */
export function browserResourceLoader(options = {}) {
  const assetRoot = (options.assetRoot ?? "/diya-gl/assets").replace(/\/$/, "");
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
