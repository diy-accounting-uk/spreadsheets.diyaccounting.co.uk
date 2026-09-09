#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-write-workbook.js — writes the Excel package a diya-gl book
// composes onto its product's template, with no LibreOffice: the same
// client-side compose path the DIYA-GL pages use. See
// app/bin/write-workbook.js in the source repository for the full option
// list (--data or --file, plus --zip for the package download).

import { runDistBin } from "./run-dist-bin.js";
runDistBin("app/bin/write-workbook.js", process.argv.slice(2));
