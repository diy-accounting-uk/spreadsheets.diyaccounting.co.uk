#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// build-feed.js — Write the Atom feed of recently updated articles for the spreadsheets site
//
// Usage:
//   node app/bin/build-feed.js
//
// Reads:  web/spreadsheets.diyaccounting.co.uk/public/recently-updated.toml
//         web/spreadsheets.diyaccounting.co.uk/public/articles/<article>.html
// Writes: web/spreadsheets.diyaccounting.co.uk/public/feed.xml

import { parse as parseTOML } from "smol-toml";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { renderAtomFeed } from "../lib/atom-feed.js";
import { feedEntries, SPREADSHEETS_SITE } from "../lib/llms-txt.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const PUBLIC_DIR = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public");

const updated = parseTOML(readFileSync(resolve(PUBLIC_DIR, "recently-updated.toml"), "utf8")).entry || [];
const entries = feedEntries(SPREADSHEETS_SITE, updated, (article) =>
  readFileSync(resolve(PUBLIC_DIR, "articles", `${article}.html`), "utf8"),
);
const xml = renderAtomFeed({
  siteUrl: `${SPREADSHEETS_SITE.origin}/recently-updated.html`,
  feedUrl: `${SPREADSHEETS_SITE.origin}/feed.xml`,
  title: `${SPREADSHEETS_SITE.name}: recently updated articles`,
  subtitle: "Knowledge base articles that were reviewed, citation-checked or updated most recently.",
  authorName: "DIY Accounting",
  entries,
});
writeFileSync(resolve(PUBLIC_DIR, "feed.xml"), xml, "utf8");
console.log(`Atom feed: ${resolve(PUBLIC_DIR, "feed.xml")} (${entries.length} entries)`);
