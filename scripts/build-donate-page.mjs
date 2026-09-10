#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// build-donate-page.mjs — Generate donate.html from a template with
// per-environment Stripe Payment Links.
//
// Usage:
//   node scripts/build-donate-page.mjs
//   ENVIRONMENT_NAME=prod node scripts/build-donate-page.mjs
//
// Reads:  web/spreadsheets.diyaccounting.co.uk/donate.template.html
//         web/spreadsheets.diyaccounting.co.uk/donate-links.toml
// Writes: web/spreadsheets.diyaccounting.co.uk/public/donate.html
//
// ENVIRONMENT_NAME picks the [ci] or [prod] section of donate-links.toml --
// the same name deploy.yml already resolves for the CDK deploy step
// (needs.params.outputs.environment-name). Defaults to "ci": unset is the
// safe direction, so a forgotten ENVIRONMENT_NAME builds test-mode links,
// never live ones.

import { parse as parseTOML } from "smol-toml";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SITE_DIR = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk");
const TEMPLATE_PATH = resolve(SITE_DIR, "donate.template.html");
const LINKS_TOML_PATH = resolve(SITE_DIR, "donate-links.toml");
const OUTPUT_PATH = resolve(SITE_DIR, "public", "donate.html");

// Placeholder in the template -> its key in donate-links.toml's section.
const PLACEHOLDERS = {
  "{{DONATE_LINK_10}}": "amount10",
  "{{DONATE_LINK_20}}": "amount20",
  "{{DONATE_LINK_45}}": "amount45",
  "{{DONATE_LINK_CUSTOM}}": "custom",
};

function main() {
  const environment = process.env.ENVIRONMENT_NAME || "ci";
  if (environment !== "ci" && environment !== "prod") {
    throw new Error(`build-donate-page.mjs: ENVIRONMENT_NAME must be "ci" or "prod", got "${environment}"`);
  }

  const config = parseTOML(readFileSync(LINKS_TOML_PATH, "utf8"));
  const links = config[environment];
  if (!links) {
    throw new Error(`build-donate-page.mjs: donate-links.toml has no [${environment}] section`);
  }

  for (const key of Object.values(PLACEHOLDERS)) {
    if (!links[key]) {
      throw new Error(`build-donate-page.mjs: donate-links.toml [${environment}] is missing "${key}"`);
    }
  }

  // ci must never carry a live Payment Link -- that is the bug this build
  // step exists to close. Stripe's test-mode Payment Links carry "/test_" in
  // the path; anything else in [ci] would take a real payment.
  if (environment === "ci") {
    for (const [key, url] of Object.entries(links)) {
      if (!url.includes("/test_")) {
        throw new Error(
          `build-donate-page.mjs: donate-links.toml [ci] "${key}" is not a Stripe test-mode link (${url}). ` +
            `Run STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-spreadsheets-setup.js to mint one.`,
        );
      }
    }
  }

  let html = readFileSync(TEMPLATE_PATH, "utf8");
  for (const [placeholder, key] of Object.entries(PLACEHOLDERS)) {
    html = html.split(placeholder).join(links[key]);
  }

  writeFileSync(OUTPUT_PATH, html, "utf8");
  console.log(`donate.html written for environment "${environment}": ${OUTPUT_PATH}`);
}

main();
