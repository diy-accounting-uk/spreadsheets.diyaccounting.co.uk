// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// server.js — the MCP method table: initialize, tools/list and tools/call,
// wired to the four diya-gl tools over one in-memory session per server
// instance. No engine code lives here or in diya-gl-tools.js -- every tool
// call is one landed function from export.js, diya-gl-edits.js or
// product-workbook.js.

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { TOOLS, createSession } from "./diya-gl-tools.js";

// One directory layout serves both homes: app/lib/mcp in a checkout puts the
// repository's package.json three levels up, and dist/app/lib/mcp in an
// install puts the package's own there. prepack refuses a tarball whose two
// versions disagree, so either answer is the version the caller is running.
const PACKAGE_JSON = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "package.json");

export const SERVER_INFO = { name: "diya-gl", version: JSON.parse(readFileSync(PACKAGE_JSON, "utf8")).version };

export const SOURCE_URL = "https://github.com/diy-accounting-uk/spreadsheets.diyaccounting.co.uk";

// MCP's Implementation object has no licence field, so the terms travel in the
// instructions the client shows alongside the tools.
const INSTRUCTIONS = [
  "Read, check, edit and write DIYA-GL books: a UK sole trader's or company's accounts as a book.toml",
  "and a lines.jsonl file. Load a workbook or a book with extract_book, then call report for the",
  "figures and checks, edit_lines to change transactions, and save_workbook to write the package.",
  "",
  `This server is licensed under Apache-2.0. Copyright (C) 2006-2026 DIY Accounting Limited. Source: ${SOURCE_URL}`,
  "The workbook templates save_workbook writes onto are fetched from spreadsheets.diyaccounting.co.uk",
  "under the PolyForm Internal Use License 1.0.0 with an additional grant.",
].join("\n");

/**
 * Build the JSON-RPC method table for one server session (one loaded book).
 * A fresh call with no session makes a fresh one, so a test driving two
 * servers in the same process never shares state between them; a test that
 * wants to seed the session directly (diya-gl-tools.js's loadIntoSession,
 * for a fixture with no .xlsx to run extract_book against) can build a
 * session itself and pass it in.
 * @param {Object} [session] - defaults to a fresh, empty session
 * @returns {Object<string, Function>}
 */
export function createMethods(session = createSession()) {
  return {
    async "initialize"(params) {
      return {
        protocolVersion: params?.protocolVersion || "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      };
    },

    // A notification: jsonrpc-stdio.js never responds to it regardless of
    // what this returns.
    async "notifications/initialized"() {
      return undefined;
    },

    async "ping"() {
      return {};
    },

    async "tools/list"() {
      return {
        tools: Object.values(TOOLS).map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    },

    async "tools/call"(params) {
      const tool = TOOLS[params?.name];
      if (!tool) throw new Error(`Unknown tool: ${params?.name}`);
      const result = await tool.handler(session, params?.arguments || {});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
        isError: false,
      };
    },
  };
}
