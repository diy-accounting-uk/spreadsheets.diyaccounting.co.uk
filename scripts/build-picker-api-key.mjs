#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// build-picker-api-key.mjs — Write the Google Picker API key into the DIYA-GL
// pages' cloud-config.js at deploy time.
//
// Usage (deploy only):
//   GOOGLE_DRIVE_PICKER_API_KEY=... node scripts/build-picker-api-key.mjs
//
// Reads:  GOOGLE_DRIVE_PICKER_API_KEY (the repository variable of that name)
// Edits:  web/diya-gl.co.uk/public/cloud-config.js, the googlePickerApiKey field
//
// The committed cloud-config.js keeps googlePickerApiKey: "" so local builds
// and tests run without the key; drive.js disables the Picker while it is
// empty. Only deploy.yml runs this script, in its checkout, before the
// DIYA-GL bundle is built. An unset or empty variable fails the deploy.
// The key is never printed.

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLOUD_CONFIG_PATH = resolve(ROOT, "web", "diya-gl.co.uk", "public", "cloud-config.js");
const KEY_FIELD = /^(\s*googlePickerApiKey: )"[^"\n]*"(,?)$/m;

export function withPickerApiKey(source, key) {
  if (typeof key !== "string" || key.trim() === "") {
    throw new Error("build-picker-api-key.mjs: GOOGLE_DRIVE_PICKER_API_KEY is unset or empty");
  }
  if (!KEY_FIELD.test(source)) {
    throw new Error('build-picker-api-key.mjs: cloud-config.js has no `googlePickerApiKey: "..."` line to fill');
  }
  return source.replace(KEY_FIELD, (_, head, tail) => `${head}${JSON.stringify(key.trim())}${tail}`);
}

function main() {
  const source = readFileSync(CLOUD_CONFIG_PATH, "utf8");
  writeFileSync(CLOUD_CONFIG_PATH, withPickerApiKey(source, process.env.GOOGLE_DRIVE_PICKER_API_KEY), "utf8");
  console.log(`googlePickerApiKey written to ${CLOUD_CONFIG_PATH}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
