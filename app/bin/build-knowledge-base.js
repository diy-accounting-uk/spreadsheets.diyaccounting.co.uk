#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// build-knowledge-base.js — Write knowledge-base.toml, the list the knowledge base page reads
//
// Usage:
//   node app/bin/build-knowledge-base.js
//
// Reads:  web/spreadsheets.diyaccounting.co.uk/public/articles/*.html
//         app/data/knowledge-base-search.toml
// Writes: web/spreadsheets.diyaccounting.co.uk/public/knowledge-base.toml

import { parse as parseTOML } from "smol-toml";
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { buildKnowledgeBase, renderKnowledgeBaseToml } from "../lib/knowledge-base.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const PUBLIC_DIR = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public");
const ARTICLES_DIR = resolve(PUBLIC_DIR, "articles");
const SEARCH_TOML = resolve(ROOT, "app", "data", "knowledge-base-search.toml");
const OUTPUT = resolve(PUBLIC_DIR, "knowledge-base.toml");

const articles = readdirSync(ARTICLES_DIR)
  .filter((file) => file.endsWith(".html"))
  .map((file) => ({ id: file.replace(/\.html$/, ""), html: readFileSync(resolve(ARTICLES_DIR, file), "utf8") }))
  .sort((first, second) => first.id.localeCompare(second.id));
const searchEntries = parseTOML(readFileSync(SEARCH_TOML, "utf8")).article || [];

const entries = buildKnowledgeBase(articles, searchEntries);
writeFileSync(OUTPUT, renderKnowledgeBaseToml(entries), "utf8");
console.log(`Knowledge base: ${OUTPUT} (${entries.length} articles)`);
