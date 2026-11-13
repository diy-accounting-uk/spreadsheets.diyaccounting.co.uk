#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// build-references.js — Write references.toml, the records the references and sources pages read
//
// Usage:
//   node app/bin/build-references.js
//
// Reads:  web/spreadsheets.diyaccounting.co.uk/public/data/references-core.toml
//         web/spreadsheets.diyaccounting.co.uk/public/data/ref-additions/*.toml
// Writes: web/spreadsheets.diyaccounting.co.uk/public/references.toml

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { mergeReferences, renderReferencesToml } from "../lib/references.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const PUBLIC_DIR = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public");
const DATA_DIR = resolve(PUBLIC_DIR, "data");
const ADDITIONS_DIR = resolve(DATA_DIR, "ref-additions");
const OUTPUT = resolve(PUBLIC_DIR, "references.toml");

const files = [
  { name: "data/references-core.toml", text: readFileSync(resolve(DATA_DIR, "references-core.toml"), "utf8") },
  ...readdirSync(ADDITIONS_DIR)
    .filter((file) => file.endsWith(".toml"))
    .sort()
    .map((file) => ({ name: `data/ref-additions/${file}`, text: readFileSync(resolve(ADDITIONS_DIR, file), "utf8") })),
];

const records = mergeReferences(files);
writeFileSync(OUTPUT, renderReferencesToml(records), "utf8");
console.log(`References: ${OUTPUT} (${records.length} records, highest ${records.at(-1).id})`);
