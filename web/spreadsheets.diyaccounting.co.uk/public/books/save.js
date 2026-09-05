// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// save.js — the current book turned into a download, through the same
// engine bundle the rest of the page reads from.
//
// saveWorkbook and savePackageZip are the exact functions the CLI and
// the MCP server write a workbook through (app/lib/product-workbook.js), bundled
// for the browser by scripts/build-books-bundle.mjs. shell.js's save controls
// call buildSaveArtifact() then downloadArtifact(); the save browser test
// calls the same two functions directly against a book it loaded itself, so
// the shell and the test exercise one save path, not two.
//
// writeDiyaGlZip and writeBookJson (app/lib/books-interchange.js, the same
// module the CLI's export.js writes through) turn the book into the other
// two downloads: the diya-gl zip and the single-file JSON. Both need R --
// shell.js passes it in through extras.report, the same document
// window.DIYA_BOOKS_SNAPSHOT.report already carries, so nothing here
// recomputes a result the page already has.

const ENGINE_MODULE = "./engine/diya-gl-engine.js";
const RESOURCES_MODULE = "./bundle-resources.js";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ZIP_MIME = "application/zip";
const JSON_MIME = "application/json";

// The business name turned into a file-name-safe slug: lower case, runs of
// anything that is not a letter or digit collapsed to one hyphen, no
// leading or trailing hyphen. A book with no name yet (should not happen --
// the schema requires organizationIdentifier) falls back to a plain label
// rather than producing an empty file name.
function businessSlug(book) {
  const name = (book.entityInformation && book.entityInformation.organizationIdentifier) || "";
  const slug = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "diya-gl-book";
}

async function buildDiyaGlArtifact(engine, book, lines, format, extras) {
  if (!extras.report) {
    throw new Error(`buildSaveArtifact: format "${format}" needs extras.report, the current R document.`);
  }
  const slug = businessSlug(book);
  if (format === "json") {
    const text = engine.writeBookJson(book, lines);
    return { bytes: new TextEncoder().encode(text), filename: `${slug}-diya-gl.json`, mimeType: JSON_MIME };
  }
  const zipOptions = { book, lines, report: extras.report };
  if (extras.bookchecks !== undefined) zipOptions.bookchecks = extras.bookchecks;
  if (extras.overtyped !== undefined) zipOptions.overtyped = extras.overtyped;
  const bytes = await engine.writeDiyaGlZip(zipOptions);
  return { bytes, filename: `${slug}-diya-gl.zip`, mimeType: ZIP_MIME };
}

/**
 * The current book turned into downloadable bytes.
 *
 * @param {Object} book - parsed book.toml
 * @param {Array} lines - parsed lines.jsonl entries
 * @param {"xlsx"|"zip"|"diya-gl-zip"|"json"} format
 * @param {Object} [extras] - "diya-gl-zip" and "json" only: {report, bookchecks?, overtyped?}
 * @returns {Promise<{bytes: Uint8Array, filename: string, mimeType: string}>}
 */
export async function buildSaveArtifact(book, lines, format, extras) {
  const [engine, resourcesModule] = await Promise.all([import(ENGINE_MODULE), import(RESOURCES_MODULE)]);
  const resources = resourcesModule.browserResourceLoader();

  if (format === "diya-gl-zip" || format === "json") {
    return buildDiyaGlArtifact(engine, book, lines, format, extras || {});
  }
  if (format === "zip") {
    const { zip, filename } = await engine.savePackageZip(book, lines, { resources });
    return { bytes: zip, filename, mimeType: ZIP_MIME };
  }
  const { workbook, filename } = await engine.saveWorkbook(book, lines, { resources });
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
