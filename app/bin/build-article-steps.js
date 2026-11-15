#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// build-article-steps.js — Put the "File this return with HMRC" step at the foot of every
// knowledge base article, and tag the Submit links already in an article's text with the
// placement "article". Safe to run again: it replaces the step it wrote before.
//
// Usage:
//   node app/bin/build-article-steps.js
//
// Reads and writes: web/spreadsheets.diyaccounting.co.uk/public/articles/*.html

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { format, resolveConfig } from "prettier";
import { withArticleStep, tagArticleSubmitLinks } from "../lib/submit-step.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTICLES_DIR = resolve(__dirname, "..", "..", "web", "spreadsheets.diyaccounting.co.uk", "public", "articles");

let changed = 0;
const files = readdirSync(ARTICLES_DIR).filter((file) => file.endsWith(".html"));
for (const file of files) {
  const path = resolve(ARTICLES_DIR, file);
  const slug = file.replace(/\.html$/, "");
  const before = readFileSync(path, "utf8");
  // The pages are kept in the repository's Prettier format, so the output is formatted the same way.
  const config = await resolveConfig(path);
  const after = await format(withArticleStep(tagArticleSubmitLinks(before, slug), slug), { ...config, filepath: path });
  if (after !== before) {
    writeFileSync(path, after, "utf8");
    changed += 1;
  }
}
console.log(`Article steps: ${files.length} articles, ${changed} written`);
