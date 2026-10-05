#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-roll-forward.js — start the next year of a book.

import { runDistBin } from "./run-dist-bin.js";
runDistBin("app/bin/roll-forward.js", process.argv.slice(2));
