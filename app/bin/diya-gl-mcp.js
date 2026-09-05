#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl-mcp.js — a stdio MCP server exposing the diya-gl pipeline as
// four tools: extract_book, report, edit_lines, save_workbook, over any of
// the four products (Basic Sole Trader, Taxi Driver, Self Employed, Company).
//
// Transport: hand-rolled newline-delimited JSON-RPC 2.0
// (app/lib/mcp/jsonrpc-stdio.js), not @modelcontextprotocol/sdk. The SDK's
// Node package pulls in express, hono, cors, jose and zod -- an HTTP
// server framework and an HTTP-transport dependency set -- to reach the
// three JSON-RPC methods a stdio-only server actually receives here
// (initialize, tools/list, tools/call). This repo carries no server
// framework at all (see CLAUDE.md's "what this repo does NOT have"): adding
// one to speak three methods over stdin/stdout would be exactly the heavy
// dependency the plan's own escape hatch names. The protocol surface this
// server implements is small enough to write directly and test without a
// mock of someone else's transport.
//
// Run directly: node app/bin/diya-gl-mcp.js
// Registered for this repo's own Claude Code sessions in .mcp.json.

import { createMethods } from "../lib/mcp/server.js";
import { serveJsonRpc } from "../lib/mcp/jsonrpc-stdio.js";

serveJsonRpc({ input: process.stdin, output: process.stdout, methods: createMethods() });
