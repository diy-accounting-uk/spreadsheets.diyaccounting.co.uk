#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl.js — the dispatcher: diya-gl <recalc|read-workbook|write-workbook|mcp> [args].
// Each subcommand is also its own bin (diya-gl-recalc, and so on), for a
// caller that wants one command on its PATH without the others.

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { runDistBin } from "./run-dist-bin.js";

const SUBCOMMANDS = {
  "recalc": "app/bin/report.js",
  "read-workbook": "app/bin/export.js",
  "write-workbook": "app/bin/write-workbook.js",
  "mcp": "app/bin/diya-gl-mcp.js",
};

const [subcommand, ...rest] = process.argv.slice(2);

if (subcommand === "--version" || subcommand === "-v") {
  const manifest = resolve(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  console.log(JSON.parse(readFileSync(manifest, "utf8")).version);
  console.log("Apache-2.0");
  console.log("Copyright (C) 2006-2026 DIY Accounting Limited");
  process.exit(0);
}

const target = SUBCOMMANDS[subcommand];
if (!target) {
  console.error(`Usage: diya-gl <${Object.keys(SUBCOMMANDS).join("|")}> [args], or diya-gl --version`);
  process.exit(1);
}
runDistBin(target, rest);
