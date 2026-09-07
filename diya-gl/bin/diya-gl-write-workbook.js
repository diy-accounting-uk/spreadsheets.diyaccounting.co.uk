#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl-write-workbook.js — writes the Excel package a diya-gl book
// composes onto its product's template, with no LibreOffice: the same
// client-side compose path the books page uses. See
// app/bin/write-workbook.js in the source repository for the full option
// list (--data or --file, plus --zip for the package download).

import { runDistBin } from "./run-dist-bin.js";
runDistBin("app/bin/write-workbook.js", process.argv.slice(2));
