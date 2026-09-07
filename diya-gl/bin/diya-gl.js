#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl.js — the dispatcher: diya-gl <recalc|read-workbook|write-workbook|mcp> [args].
// Each subcommand is also its own bin (diya-gl-recalc, and so on), for a
// caller that wants one command on its PATH without the others.

import { runDistBin } from "./run-dist-bin.js";

const SUBCOMMANDS = {
  "recalc": "app/bin/report.js",
  "read-workbook": "app/bin/export.js",
  "write-workbook": "app/bin/write-workbook.js",
  "mcp": "app/bin/diya-gl-mcp.js",
};

const [subcommand, ...rest] = process.argv.slice(2);
const target = SUBCOMMANDS[subcommand];
if (!target) {
  console.error(`Usage: diya-gl <${Object.keys(SUBCOMMANDS).join("|")}> [args]`);
  process.exit(1);
}
runDistBin(target, rest);
