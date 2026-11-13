#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// build-llms-txt.js — Write llms.txt and llms-full.txt for the spreadsheets site and for diya-gl.co.uk
//
// Usage:
//   node app/bin/build-llms-txt.js
//
// Reads:  <site>/public/sitemap.xml and the pages it lists (written by build:product-pages and build:sitemaps, which run first)
//         web/spreadsheets.diyaccounting.co.uk/public/catalogue.toml
// Writes: web/spreadsheets.diyaccounting.co.uk/public/llms.txt and llms-full.txt
//         web/diya-gl.co.uk/public/llms.txt and llms-full.txt

import { parse as parseTOML } from "smol-toml";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { buildLlmsFiles, SPREADSHEETS_SITE, DIYA_GL_SITE } from "../lib/llms-txt.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const SPREADSHEETS_PUBLIC = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public");
const DIYA_GL_PUBLIC = resolve(ROOT, "web", "diya-gl.co.uk", "public");
const CATALOGUE_TOML = resolve(SPREADSHEETS_PUBLIC, "catalogue.toml");

for (const required of [CATALOGUE_TOML, resolve(SPREADSHEETS_PUBLIC, "sitemap.xml"), resolve(DIYA_GL_PUBLIC, "sitemap.xml")]) {
  if (!existsSync(required)) {
    throw new Error(`build-llms-txt.js: ${required} is missing; run npm run build:packages and npm run build:sitemaps first`);
  }
}

const products = parseTOML(readFileSync(CATALOGUE_TOML, "utf8")).products || [];

function writeSite(site, publicDir, siteProducts) {
  const readPage = (path) => (existsSync(resolve(publicDir, path)) ? readFileSync(resolve(publicDir, path), "utf8") : null);
  const { llmsTxt, llmsFullTxt } = buildLlmsFiles({
    site,
    sitemapXml: readPage("sitemap.xml"),
    readPage,
    products: siteProducts,
  });
  writeFileSync(resolve(publicDir, "llms.txt"), llmsTxt, "utf8");
  writeFileSync(resolve(publicDir, "llms-full.txt"), llmsFullTxt, "utf8");
  console.log(`${site.name}: llms.txt ${llmsTxt.length} characters, llms-full.txt ${llmsFullTxt.length} characters`);
}

writeSite(SPREADSHEETS_SITE, SPREADSHEETS_PUBLIC, products);
writeSite(DIYA_GL_SITE, DIYA_GL_PUBLIC, []);
