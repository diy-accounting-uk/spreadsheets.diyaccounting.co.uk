// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// provenance.js — the five provenance stamps every diya-gl book and report
// carries: which format version it is written as, which engine build wrote
// it, which tax data it was calculated from, which template it reproduces
// (with that template's published reconciliation scorecard), and the commit
// whose CI reconciliation last passed for it.
//
// The values themselves live in provenance-data.js, generated once by
// scripts/build-provenance-data.mjs and committed. This module only shapes
// them for a book's documentInfo or a report's header, so it carries no fs,
// git or hashing of its own -- nothing here needs a Node-only stub in the
// browser bundle, and every surface (the CLI, the MCP server, the page)
// reads the exact same generated values.

import { PROVENANCE_DATA } from "./provenance-data.js";
import { productIdOf } from "./xlsx-exporter.js";

function productOf(book) {
  const schemaName = book?.entityInformation?.["diya-gl:product"];
  return schemaName === undefined ? undefined : productIdOf(schemaName);
}

/**
 * The five stamps for one product's book, as book.toml's documentInfo
 * extension keys.
 * @param {string} product - bst, taxi, se or ltd
 * @returns {Object}
 */
export function provenanceStamps(product) {
  const template = PROVENANCE_DATA.templates[product];
  if (!template) {
    throw new Error(`provenanceStamps(): "${product}" is not one of ${Object.keys(PROVENANCE_DATA.templates).join(", ")}`);
  }
  const stamps = {
    "diya-gl:formatVersion": PROVENANCE_DATA.formatVersion,
    "diya-gl:engineVersion": PROVENANCE_DATA.engineVersion,
    "diya-gl:taxDataHash": PROVENANCE_DATA.taxDataHash,
    "diya-gl:templateHash": template.hash,
    "diya-gl:templateScorecard": template.scorecard,
  };
  if (PROVENANCE_DATA.reconciledCommit) stamps["diya-gl:reconciledCommit"] = PROVENANCE_DATA.reconciledCommit;
  return stamps;
}

/**
 * A copy of book whose documentInfo carries this build's provenance
 * stamps, keyed to the book's own declared product. Every writer that
 * turns a book into book.toml, the JSON envelope or a diya-gl zip calls
 * this first -- CLI, MCP and browser all reach the same values from the
 * same generated data, so the stamps hold byte-identical across all three.
 * A book with no declared product is returned unchanged: the existing
 * "declares no product" refusals downstream still name that, rather than
 * this module guessing which template's stamps would apply.
 * @param {Object} book
 * @returns {Object}
 */
export function stampBook(book) {
  const product = productOf(book);
  if (!product) return book;
  return { ...book, documentInfo: { ...book.documentInfo, ...provenanceStamps(product) } };
}

/**
 * The same five stamps, shaped for report.json's header rather than
 * book.toml's documentInfo -- a plain object, not TOML's quoted
 * "diya-gl:"-prefixed keys.
 * @param {string} product - bst, taxi, se or ltd
 * @returns {Object}
 */
export function provenanceHeader(product) {
  const stamps = provenanceStamps(product);
  const header = {
    formatVersion: stamps["diya-gl:formatVersion"],
    engineVersion: stamps["diya-gl:engineVersion"],
    taxDataHash: stamps["diya-gl:taxDataHash"],
    templateHash: stamps["diya-gl:templateHash"],
    templateScorecard: stamps["diya-gl:templateScorecard"],
  };
  if (stamps["diya-gl:reconciledCommit"]) header.reconciledCommit = stamps["diya-gl:reconciledCommit"];
  return header;
}
