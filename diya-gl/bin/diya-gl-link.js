#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-link.js — print the diya-gl.co.uk link that opens a whole book,
// the book carried in the URL fragment.

import { runDistBin } from "./run-dist-bin.js";
runDistBin("app/bin/link.js", process.argv.slice(2));
