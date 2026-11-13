#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// build-sitemaps.js — Generate sitemap.xml for the spreadsheets site and for
// diya-gl.co.uk
//
// Usage:
//   node app/bin/build-sitemaps.js
//
// Reads:  web/spreadsheets.diyaccounting.co.uk/public/articles/*.html
//         web/spreadsheets.diyaccounting.co.uk/public/catalogue.toml (written by build:packages, which runs first)
// Writes: web/spreadsheets.diyaccounting.co.uk/public/sitemap.xml
//         web/diya-gl.co.uk/public/sitemap.xml

import { execFileSync } from "child_process";
import { parse as parseTOML } from "smol-toml";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { buildSitemapXml, buildDiyaGlSitemapXml } from "../lib/sitemap-builder.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const PUBLIC_DIR = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public");
const ARTICLES_DIR = resolve(PUBLIC_DIR, "articles");
const CATALOGUE_TOML = resolve(PUBLIC_DIR, "catalogue.toml");
const SITEMAP_PATH = resolve(PUBLIC_DIR, "sitemap.xml");
const DIYA_GL_SITEMAP_PATH = resolve(ROOT, "web", "diya-gl.co.uk", "public", "sitemap.xml");

const DIYA_GL_PAGES = ["index.html", "bst.html", "se.html", "taxi.html", "ltd.html", "spec.html"];

// The articles are the tracked .html pages.
const articles = existsSync(ARTICLES_DIR)
  ? readdirSync(ARTICLES_DIR)
      .filter((f) => f.endsWith(".html"))
      .map((f) => ({ id: f.replace(/\.html$/, "") }))
      .sort((x, y) => x.id.localeCompare(y.id))
  : [];

let products = [];
if (existsSync(CATALOGUE_TOML)) {
  const cat = parseTOML(readFileSync(CATALOGUE_TOML, "utf8"));
  products = cat.products || [];
}

// Reconciliation pages, discovered from the metadata files the page builder writes
const RECONCILIATION_DIR = resolve(PUBLIC_DIR, "reconciliation");
let reconciliationPages = [];
if (existsSync(RECONCILIATION_DIR)) {
  reconciliationPages = readdirSync(RECONCILIATION_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

const BUILD_DATE = new Date().toISOString().slice(0, 10);
// Date of the last commit that touched the page; the build date for a generated page or a file git does not know.
function lastCommitDate(path) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", path], { cwd: ROOT, encoding: "utf8" }).trim();
    return out || BUILD_DATE;
  } catch {
    return BUILD_DATE;
  }
}
const lastmodFor = (pagePath) => lastCommitDate(resolve(PUBLIC_DIR, pagePath));

const { xml, urlCount } = buildSitemapXml(products, articles, reconciliationPages, lastmodFor);
writeFileSync(SITEMAP_PATH, xml, "utf8");
console.log(`Spreadsheets sitemap: ${SITEMAP_PATH} (${urlCount} URLs)`);

const diyaGl = buildDiyaGlSitemapXml(DIYA_GL_PAGES, (page) => lastCommitDate(resolve(ROOT, "web", "diya-gl.co.uk", "public", page)));
writeFileSync(DIYA_GL_SITEMAP_PATH, diyaGl.xml, "utf8");
console.log(`diya-gl sitemap: ${DIYA_GL_SITEMAP_PATH} (${diyaGl.urlCount} URLs)`);
