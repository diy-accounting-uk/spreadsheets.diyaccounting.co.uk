// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// server.js — the MCP method table: initialize, tools/list and tools/call,
// wired to the four diya-gl tools over one in-memory session per server
// instance. No engine code lives here or in diya-gl-tools.js -- every tool
// call is one landed function from export.js, diya-gl-edits.js or
// product-workbook.js.

import { TOOLS, createSession } from "./diya-gl-tools.js";

export const SERVER_INFO = { name: "diya-gl-bst", version: "0.1.0" };

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
