// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// save.js — the current book turned into a download, through the same
// engine bundle the rest of the page reads from.
//
// saveBstWorkbook and saveBstPackageZip are the exact functions the CLI and
// the MCP server write a workbook through (app/lib/bst-workbook.js), bundled
// for the browser by scripts/build-books-bundle.mjs. bst.js's save controls
// call buildSaveArtifact() then downloadArtifact(); the save browser test
// calls the same two functions directly against a book it loaded itself, so
// the shell and the test exercise one save path, not two.

const ENGINE_MODULE = "./engine/diya-gl-engine.js";
const RESOURCES_MODULE = "./bundle-resources.js";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ZIP_MIME = "application/zip";

/**
 * The current book turned into downloadable bytes.
 *
 * @param {Object} book - parsed book.toml
 * @param {Array} lines - parsed lines.jsonl entries
 * @param {"xlsx"|"zip"} format
 * @returns {Promise<{bytes: Uint8Array, filename: string, mimeType: string}>}
 */
export async function buildSaveArtifact(book, lines, format) {
  const [engine, resourcesModule] = await Promise.all([import(ENGINE_MODULE), import(RESOURCES_MODULE)]);
  const resources = resourcesModule.browserResourceLoader();

  if (format === "zip") {
    const { zip, filename } = await engine.saveBstPackageZip(book, lines, { resources });
    return { bytes: zip, filename, mimeType: ZIP_MIME };
  }
  const { workbook, filename } = await engine.saveBstWorkbook(book, lines, { resources });
  return { bytes: workbook, filename, mimeType: XLSX_MIME };
}

/**
 * Hands the browser an artifact to save: a Blob, an anchor with a download
 * attribute, one synthetic click. Nothing is uploaded -- the bytes never
 * leave this function.
 */
export function downloadArtifact({ bytes, filename, mimeType }) {
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
