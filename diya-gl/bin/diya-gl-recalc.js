#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl-recalc.js — report.json and bookchecks.json from a diya-gl book
// or a populated Excel package. See `diya-gl recalc --help` for usage, or
// app/bin/report.js in the source repository for the full option list.

import { runDistBin } from "./run-dist-bin.js";
runDistBin("app/bin/report.js", process.argv.slice(2));
