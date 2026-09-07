#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl-mcp.js — the stdio MCP server, four tools over a loaded diya-gl
// book: extract_book, report, edit_lines, save_workbook. See
// app/lib/mcp/server.js in the source repository for the method table.

import { runDistBin } from "./run-dist-bin.js";
runDistBin("app/bin/diya-gl-mcp.js", process.argv.slice(2));
