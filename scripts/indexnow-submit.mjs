#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// scripts/indexnow-submit.mjs
//
// Tell IndexNow which pages changed in this deploy. For each site, read the built sitemap and
// send the URLs whose lastmod is the run date or the day before. A failure prints a warning annotation and
// the script still exits 0, so this step never fails a deploy.
//
// Usage: node scripts/indexnow-submit.mjs

import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ENDPOINT = "https://api.indexnow.org/indexnow";
const KEY_FILE = /^[0-9a-f]{32}\.txt$/;
const MAX_URLS = 10000;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SITES = [
  { host: "spreadsheets.diyaccounting.co.uk", publicDir: resolve(ROOT, "web/spreadsheets.diyaccounting.co.uk/public") },
  { host: "diya-gl.co.uk", publicDir: resolve(ROOT, "web/diya-gl.co.uk/public") },
];

function decodeXml(s) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function previousDay(date) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

// The URLs of a sitemap whose lastmod is the run date or the day before (UTC, YYYY-MM-DD), so a
// deploy that crosses midnight or a re-run the next day still sends them. No duplicates, at most MAX_URLS.
export function urlsChangedSince(sitemapXml, now) {
  const runDate = now.toISOString().slice(0, 10);
  const dates = [runDate, previousDay(runDate)];
  const urls = [];
  for (const [, body] of sitemapXml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>([^<]*)<\/loc>/.exec(body);
    const lastmod = /<lastmod>([^<]*)<\/lastmod>/.exec(body);
    if (loc && lastmod && dates.includes(lastmod[1].trim())) urls.push(decodeXml(loc[1].trim()));
  }
  return [...new Set(urls)].slice(0, MAX_URLS);
}

export function buildPayload(host, key, urlList) {
  return { host, key, keyLocation: `https://${host}/${key}.txt`, urlList };
}

// The key is the name of the one 32-hex-character .txt file in the site's public folder.
export function findKey(fileNames) {
  const keyFiles = fileNames.filter((name) => KEY_FILE.test(name));
  return keyFiles.length === 1 ? keyFiles[0].replace(/\.txt$/, "") : undefined;
}

async function submit(site, now) {
  const key = findKey(readdirSync(site.publicDir));
  if (!key) {
    console.log(`::warning::IndexNow found no single key file in ${site.publicDir}, nothing sent for ${site.host}`);
    return;
  }
  const urlList = urlsChangedSince(readFileSync(resolve(site.publicDir, "sitemap.xml"), "utf8"), now);
  if (urlList.length === 0) {
    console.log(`${site.host}: no URL changed today or yesterday, nothing sent`);
    return;
  }
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(buildPayload(site.host, key, urlList)),
  });
  if (response.status === 200 || response.status === 202) {
    console.log(`${site.host}: IndexNow accepted ${urlList.length} URLs (${response.status})`);
  } else {
    console.log(`::warning::IndexNow answered ${response.status} for ${site.host}`);
  }
}

async function main() {
  const now = new Date();
  for (const site of SITES) {
    try {
      await submit(site, now);
    } catch (error) {
      console.log(`::warning::IndexNow failed for ${site.host}: ${error.message}`);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
