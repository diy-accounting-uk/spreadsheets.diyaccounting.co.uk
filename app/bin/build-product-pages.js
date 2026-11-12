#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// build-product-pages.js — Generate one static page per spreadsheet product
//
// Usage:
//   node app/bin/build-product-pages.js
//
// Reads:  web/spreadsheets.diyaccounting.co.uk/public/catalogue.toml (written by build:packages, which runs first)
// Writes: web/spreadsheets.diyaccounting.co.uk/public/products/<slug>.html

import { parse as parseTOML } from "smol-toml";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { buildProductPageHtml, productPagePath } from "../lib/product-pages.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const PUBLIC_DIR = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public");
const CATALOGUE_TOML = resolve(PUBLIC_DIR, "catalogue.toml");

if (!existsSync(CATALOGUE_TOML)) {
  throw new Error(`build-product-pages.js: ${CATALOGUE_TOML} is missing; run npm run build:packages first`);
}

const products = parseTOML(readFileSync(CATALOGUE_TOML, "utf8")).products || [];
mkdirSync(resolve(PUBLIC_DIR, "products"), { recursive: true });
for (const product of products) {
  const out = resolve(PUBLIC_DIR, productPagePath(product));
  writeFileSync(out, buildProductPageHtml(product), "utf8");
  console.log(`Product page: ${out}`);
}
