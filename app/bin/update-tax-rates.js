#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// update-tax-rates.js — reads the gov.uk rate pages through Bedrock and updates
// app/data/se-YYYY-YYYY.toml and app/data/ltd-YYYY.toml (app/lib/tax-rate-update.js).
// .github/workflows/update-tax-rates.yml runs it each month under the OIDC role
// SPREADSHEETS_ACTIONS_ROLE_ARN, which allows bedrock:InvokeModel on the amazon models.
//
//   node app/bin/update-tax-rates.js --sources-dir <submit>/.claude/skills/tax-sources/sources --summary <file>
//
// Exit codes: 0 when every call answered (whether or not a file changed), 1 when a
// page list is empty or a model call fails twice.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import {
  DEFAULT_REGION,
  EXTRA_URLS,
  MODEL_ID,
  RATE_SOURCE_PREFIXES,
  pageText,
  summaryMarkdown,
  updateTaxRates,
} from "../lib/tax-rate-update.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

function parseArgs(argv) {
  const args = {
    dataDir: join(ROOT, "app", "data"),
    sourcesDir: null,
    summary: null,
    model: process.env.TAX_RATES_MODEL_ID || MODEL_ID,
    region: process.env.AWS_REGION || DEFAULT_REGION,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--data-dir") args.dataDir = resolve(argv[++i]);
    else if (arg === "--sources-dir") args.sourcesDir = resolve(argv[++i]);
    else if (arg === "--summary") args.summary = resolve(argv[++i]);
    else if (arg === "--model") args.model = argv[++i];
    else if (arg === "--region") args.region = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.sourcesDir) throw new Error("Missing --sources-dir (submit's .claude/skills/tax-sources/sources)");
  return args;
}

// Submit's rate sources, the pages scripts/hmrc-rate-urls.cjs lists for this
// year (with only the last two Budget annexes), and EXTRA_URLS.
function rateUrls(sourcesDir, year) {
  const fromSources = readdirSync(sourcesDir)
    .filter((name) => name.endsWith(".json") && RATE_SOURCE_PREFIXES.some((prefix) => name.startsWith(prefix)))
    .map((name) => JSON.parse(readFileSync(join(sourcesDir, name), "utf8")).url);
  const recentAnnex = new RegExp(`-(${year - 1}|${year})-overview-of-tax-legislation`);
  const fromScript = execFileSync(process.execPath, [join(ROOT, "scripts", "hmrc-rate-urls.cjs"), String(year)], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .filter((url) => !url.includes("overview-of-tax-legislation") || recentAnnex.test(url));
  return [...new Set([...fromSources, ...fromScript, ...EXTRA_URLS])].filter((url) => url.startsWith("https://www.gov.uk/"));
}

async function readPages(urls) {
  const pages = [];
  for (const url of urls) {
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`skip ${response.status} ${url}`);
      continue;
    }
    pages.push({ url, text: pageText(await response.text()) });
    console.log(`read ${url}`);
  }
  return pages;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const today = new Date().toISOString().slice(0, 10);
  const pages = await readPages(rateUrls(args.sourcesDir, Number(today.slice(0, 4))));
  const client = new BedrockRuntimeClient({ region: args.region });
  const result = await updateTaxRates({ dataDir: args.dataDir, pages, client, today, model: args.model });
  const summary = summaryMarkdown(result);
  console.log(summary);
  if (args.summary) writeFileSync(args.summary, summary);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
