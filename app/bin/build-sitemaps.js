#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 DIY Accounting Ltd
//
// build-sitemaps.js — Generate sitemap.xml for spreadsheets site
//
// Usage:
//   node app/bin/build-sitemaps.js
//
// Reads:  web/spreadsheets.diyaccounting.co.uk/public/knowledge-base.toml
//         web/spreadsheets.diyaccounting.co.uk/public/catalogue.toml
// Writes: web/spreadsheets.diyaccounting.co.uk/public/sitemap.xml

import { parse as parseTOML } from "smol-toml";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { buildSitemapXml } from "../lib/sitemap-builder.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const PUBLIC_DIR = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public");
const KB_TOML = resolve(PUBLIC_DIR, "knowledge-base.toml");
const CATALOGUE_TOML = resolve(PUBLIC_DIR, "catalogue.toml");
const SITEMAP_PATH = resolve(PUBLIC_DIR, "sitemap.xml");

let articles = [];
if (existsSync(KB_TOML)) {
  const kb = parseTOML(readFileSync(KB_TOML, "utf8"));
  articles = kb.article || [];
}

let products = [];
if (existsSync(CATALOGUE_TOML)) {
  const cat = parseTOML(readFileSync(CATALOGUE_TOML, "utf8"));
  products = cat.products || [];
}

const { xml, urlCount } = buildSitemapXml(products, articles);
writeFileSync(SITEMAP_PATH, xml, "utf8");
console.log(`Spreadsheets sitemap: ${SITEMAP_PATH} (${urlCount} URLs)`);
