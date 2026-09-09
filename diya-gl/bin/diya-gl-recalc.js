#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-recalc.js — report.json and bookchecks.json from a diya-gl book
// or a populated Excel package. See `diya-gl recalc --help` for usage, or
// app/bin/report.js in the source repository for the full option list.

import { runDistBin } from "./run-dist-bin.js";
runDistBin("app/bin/report.js", process.argv.slice(2));
