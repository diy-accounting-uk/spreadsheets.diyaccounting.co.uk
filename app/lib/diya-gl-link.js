// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-link.js — a whole book carried in a URL fragment. The fragment
// payload is { toml, lines } as JSON, deflate-raw compressed, base64url
// without padding. The browser reads it with DecompressionStream
// ("deflate-raw") in web/diya-gl.co.uk/public/shell.js; this module is the
// Node side, for tools that build the link.

import { deflateRawSync, inflateRawSync } from "zlib";

export const FRAGMENT_KEY = "book";
export const WARNING_LENGTH = 64 * 1024;

function toBase64Url(bytes) {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text) {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error("The book link is not base64url text.");
  return Buffer.from(text.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/**
 * @param {{toml: string, lines: string}} book - the text of book.toml and of lines.jsonl
 * @returns {{fragment: string, length: number, warning: string|null}}
 */
export function encodeBookFragment({ toml, lines }) {
  if (typeof toml !== "string" || typeof lines !== "string") {
    throw new Error("encodeBookFragment needs the book.toml text as toml and the lines.jsonl text as lines.");
  }
  const fragment = toBase64Url(deflateRawSync(Buffer.from(JSON.stringify({ toml, lines }), "utf8"), { level: 9 }));
  const length = fragment.length;
  const warning =
    length > WARNING_LENGTH
      ? `This link is ${length.toLocaleString("en-GB")} characters, over 64 KB (about 2,000 lines). Browsers open it, but chat, email and QR codes may cut it off.`
      : null;
  return { fragment, length, warning };
}

/**
 * @param {string} fragment - the data after "#book="
 * @returns {{toml: string, lines: string}}
 */
export function decodeBookFragment(fragment) {
  const document = JSON.parse(inflateRawSync(fromBase64Url(fragment)).toString("utf8"));
  if (!document || typeof document.toml !== "string" || typeof document.lines !== "string") {
    throw new Error("The book link carries no toml and lines text.");
  }
  return { toml: document.toml, lines: document.lines };
}
