// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl-tools.js — the four MCP tools, each a thin call into a function
// phase 1 already tests: extract_book wraps export.js's --file pipeline
// (books-interchange.js underneath, so every kind it reads loads here too),
// report and edit_lines wrap the diya-gl-calculator/report-serializer loop
// and diya-gl-edits.js, save_workbook wraps bst-workbook.js for a workbook
// or package zip and books-interchange.js for the two diya-gl formats. No
// engine code lives here.
//
// State: one loaded book per session (a plain object this module owns the
// shape of), held in memory. extract_book replaces it outright. edit_lines
// applies a named edit to the session's current lines and keeps the result
// as the session's new lines, so a second edit_lines call composes onto the
// first the way undo-less in-memory editing implies -- report and
// save_workbook always see whatever the most recent extract_book or
// edit_lines left behind. report and edit_lines also accept an explicit
// {book, lines} pair, bypassing the session, for a caller (a test replaying
// a fixture with no .xlsx behind it) that wants the D-to-R loop without an
// extract_book call first.

import { resolve as resolvePath } from "path";
import { extractBstFromFile, buildFileReportDocument } from "../../bin/export.js";
import { canonicalBookToml, canonicalLinesJsonl } from "../diya-gl-canonical.js";
import { writeDiyaGlZip, writeBookJson } from "../books-interchange.js";
import { saveBstWorkbook, saveBstPackageZip } from "../bst-workbook.js";
import { addSaleLine, addPurchaseLine, changeLineAmount, removeLine, changeLinePostingDate, changeLineAccount } from "../diya-gl-edits.js";
import * as bst from "../../products/bst.js";

const EDITS = { addSaleLine, addPurchaseLine, changeLineAmount, removeLine, changeLinePostingDate, changeLineAccount };

/**
 * A fresh, empty session: no book loaded.
 * @returns {{book: Object|null, lines: Array|null, sourcePath: string|null}}
 */
export function createSession() {
  return { book: null, lines: null, sourcePath: null };
}

/**
 * Not an MCP tool: seed a session's book+lines directly from an
 * already-parsed diya-gl pair, for a caller that has D without a workbook to
 * run extract_book against (a fixture's own book.toml + lines.jsonl).
 * @param {Object} session
 * @param {Object} book
 * @param {Array} lines
 * @param {string|null} [sourcePath]
 */
export function loadIntoSession(session, book, lines, sourcePath = null) {
  session.book = book;
  session.lines = lines;
  session.sourcePath = sourcePath;
}

function requireLoaded(session) {
  if (!session.book || !session.lines) {
    throw new Error("No book is loaded. Call extract_book first.");
  }
}

function reportFor(book, lines) {
  return buildFileReportDocument(book, lines, "bst", bst);
}

// Every R key whose canonicalised value changed between two reports, with
// the numeric delta where both sides parse as a number -- the "moved
// figures" an edit's own effect is read off, generically, for whichever
// keys that particular edit happens to touch.
function diffFigures(beforeDocument, afterDocument) {
  const before = new Map(beforeDocument.values.map((entry) => [entry.key, entry.value]));
  const after = new Map(afterDocument.values.map((entry) => [entry.key, entry.value]));
  const keys = new Set([...before.keys(), ...after.keys()]);
  const moved = [];
  for (const key of keys) {
    const beforeValue = before.has(key) ? before.get(key) : null;
    const afterValue = after.has(key) ? after.get(key) : null;
    if (beforeValue === afterValue) continue;
    const beforeNumber = beforeValue === null ? null : Number(beforeValue);
    const afterNumber = afterValue === null ? null : Number(afterValue);
    const delta =
      beforeNumber !== null && afterNumber !== null && Number.isFinite(beforeNumber) && Number.isFinite(afterNumber)
        ? Number((afterNumber - beforeNumber).toFixed(6))
        : null;
    moved.push({ key, before: beforeValue, after: afterValue, delta });
  }
  moved.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return moved;
}

/**
 * extract_book: a .xlsx or .zip path in, D (book + lines, canonical and
 * parsed) and the overtype sidecar out. Replaces the session's loaded book.
 */
async function extractBook(session, { path }) {
  if (!path) throw new Error("extract_book requires a path");
  const resolved = resolvePath(path);
  const { book, lines, document, overtyped } = await extractBstFromFile(resolved, bst);
  loadIntoSession(session, book, lines, resolved);
  return {
    book,
    lines,
    bookToml: canonicalBookToml(book),
    linesJsonl: canonicalLinesJsonl(lines),
    report: document,
    overtyped,
  };
}

/**
 * report: D in (the session's loaded book, or an explicit {book, lines}), R
 * out. Never caches R -- always a fresh run of calculateFromDiyaGl and
 * checkCompliance over whichever D is in play.
 */
function report(session, params = {}) {
  const book = params.book ?? session.book;
  const lines = params.lines ?? session.lines;
  if (!book || !lines) requireLoaded(session);
  return { report: reportFor(book, lines) };
}

/**
 * edit_lines: a named edit from diya-gl-edits.js plus its params in, the
 * edited lines and the new R out, alongside the figures that moved between
 * the report just before the edit and the report just after it. The
 * session's lines become the edited lines, so a second edit_lines call
 * builds on this one.
 */
function editLines(session, { edit, params, book: explicitBook, lines: explicitLines } = {}) {
  if (!edit) throw new Error("edit_lines requires an edit name");
  const fn = EDITS[edit];
  if (!fn) throw new Error(`Unknown edit "${edit}". Known edits: ${Object.keys(EDITS).join(", ")}`);

  const book = explicitBook ?? session.book;
  const lines = explicitLines ?? session.lines;
  if (!book || !lines) requireLoaded(session);

  const before = reportFor(book, lines);
  const editedLines = fn(book, lines, params ?? {});
  const after = reportFor(book, editedLines);

  if (!explicitLines) session.lines = editedLines;

  return {
    lines: editedLines,
    linesJsonl: canonicalLinesJsonl(editedLines),
    report: after,
    movedFigures: diffFigures(before, after),
  };
}

/**
 * save_workbook: D in (the session's loaded book, or an explicit {book,
 * lines}), one of four downloads out, as base64 alongside its filename: a
 * recalculating workbook, its package zip, or D (and the R just computed
 * from it) as a diya-gl zip or a single JSON file.
 */
async function saveWorkbook(session, params = {}) {
  const book = params.book ?? session.book;
  const lines = params.lines ?? session.lines;
  if (!book || !lines) requireLoaded(session);

  const format = ["zip", "diya-gl-zip", "json"].includes(params.format) ? params.format : "xlsx";
  if (format === "zip") {
    const { zip, filename } = await saveBstPackageZip(book, lines);
    return { filename, format, base64: Buffer.from(zip).toString("base64") };
  }
  if (format === "diya-gl-zip") {
    const zip = await writeDiyaGlZip({ book, lines, report: reportFor(book, lines) });
    return { filename: "book-diya-gl.zip", format, base64: Buffer.from(zip).toString("base64") };
  }
  if (format === "json") {
    const json = writeBookJson(book, lines);
    return { filename: "book-diya-gl.json", format, base64: Buffer.from(json, "utf8").toString("base64") };
  }
  const { workbook, filename } = await saveBstWorkbook(book, lines);
  return { filename, format, base64: Buffer.from(workbook).toString("base64") };
}

/**
 * The four tools, keyed by their MCP name: schema plus handler. tools/list
 * reads name/description/inputSchema straight off this table; tools/call
 * looks the name up and calls handler(session, arguments).
 */
export const TOOLS = {
  extract_book: {
    name: "extract_book",
    description:
      "Extract a diya-gl book from a Basic Sole Trader .xlsx or .zip package: D (book.toml + lines.jsonl, canonical and parsed), R (the computed report) and the overtype sidecar (every template formula the upload carries as a typed value instead). Replaces the session's loaded book.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to a Basic Sole Trader .xlsx or .zip file" },
      },
      required: ["path"],
    },
    handler: extractBook,
  },
  report: {
    name: "report",
    description: "Compute R (figures, report sections and compliance check verdicts) from the session's currently loaded book.",
    inputSchema: {
      type: "object",
      properties: {
        book: { type: "object", description: "Optional: a diya-gl book, bypassing the session" },
        lines: { type: "array", description: "Optional: diya-gl lines, bypassing the session" },
      },
    },
    handler: report,
  },
  edit_lines: {
    name: "edit_lines",
    description:
      "Apply one named edit from app/lib/diya-gl-edits.js (addSaleLine, addPurchaseLine, changeLineAmount) to the session's currently loaded lines, and return the edited lines, the recomputed R, and the figures that moved.",
    inputSchema: {
      type: "object",
      properties: {
        edit: { type: "string", enum: Object.keys(EDITS), description: "The named edit to apply" },
        params: { type: "object", description: "Parameters for the named edit; see app/lib/diya-gl-edits.js" },
        book: { type: "object", description: "Optional: a diya-gl book, bypassing the session" },
        lines: { type: "array", description: "Optional: diya-gl lines, bypassing the session" },
      },
      required: ["edit", "params"],
    },
    handler: editLines,
  },
  save_workbook: {
    name: "save_workbook",
    description:
      "Write the session's currently loaded book into a Basic Sole Trader workbook, its package zip, a diya-gl zip (book.toml, lines.jsonl, report.json), or a single diya-gl JSON file, returned as base64 alongside its filename.",
    inputSchema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["xlsx", "zip", "diya-gl-zip", "json"], default: "xlsx" },
        book: { type: "object", description: "Optional: a diya-gl book, bypassing the session" },
        lines: { type: "array", description: "Optional: diya-gl lines, bypassing the session" },
      },
    },
    handler: saveWorkbook,
  },
};
