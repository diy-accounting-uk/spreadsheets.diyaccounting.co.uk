// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// jsonrpc-stdio.js — a minimal JSON-RPC 2.0 framing over two Node streams:
// one JSON object per line in, one JSON object per line out. This is the
// whole of the MCP stdio transport this spike needs, hand-written rather
// than pulling in @modelcontextprotocol/sdk. See app/bin/diya-gl-mcp.js for
// why that trade favours the hand-rolled framing here.
//
// The framing itself: a request carries an "id" and gets exactly one
// response line back, success or error; a notification carries no "id" and
// gets no response at all. Both are newline-delimited JSON -- no
// Content-Length header, matching the stdio transport every MCP client
// (Claude Code included) speaks.

import { createInterface } from "readline";

/**
 * Wire a JSON-RPC 2.0 request/notification dispatcher to a readable and a
 * writable stream.
 *
 * @param {Object} options
 * @param {NodeJS.ReadableStream} options.input
 * @param {NodeJS.WritableStream} options.output
 * @param {Object<string, Function>} options.methods - method name -> async
 *   (params) => result. A handler for a notification's result is discarded;
 *   a thrown Error becomes a JSON-RPC error response for a request, and is
 *   swallowed for a notification (nothing reads it).
 * @returns {{close: Function}}
 */
export function serveJsonRpc({ input, output, methods }) {
  const rl = createInterface({ input, terminal: false });

  function send(message) {
    output.write(`${JSON.stringify(message)}\n`);
  }

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let message;
    try {
      message = JSON.parse(trimmed);
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      return;
    }

    const { id, method, params } = message;
    const handler = methods[method];
    if (!handler) {
      if (id !== undefined) send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
      return;
    }

    try {
      const result = await handler(params ?? {});
      if (id !== undefined) send({ jsonrpc: "2.0", id, result: result ?? {} });
    } catch (err) {
      if (id !== undefined) send({ jsonrpc: "2.0", id, error: { code: -32000, message: err.message } });
    }
  });

  return { close: () => rl.close() };
}
