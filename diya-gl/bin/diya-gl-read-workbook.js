#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-read-workbook.js — reads an .xlsx, a package zip, or any of the
// diya-gl formats, and extracts book.toml, lines.jsonl, report.json and
// bookchecks.json. See app/bin/export.js in the source repository for the
// full option list (--file or --source-dir plus --package).

import { runDistBin } from "./run-dist-bin.js";
runDistBin("app/bin/export.js", process.argv.slice(2));
