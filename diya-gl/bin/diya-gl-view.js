#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-view.js — open a book in the full diya-gl pages, served locally
// from this package.

import { runDistBin } from "./run-dist-bin.js";
runDistBin("app/bin/view.js", process.argv.slice(2));
