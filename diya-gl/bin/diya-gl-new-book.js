#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-new-book.js — start an empty book for a new business.

import { runDistBin } from "./run-dist-bin.js";
runDistBin("app/bin/new-book.js", process.argv.slice(2));
