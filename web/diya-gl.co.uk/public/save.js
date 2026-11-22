// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// save.js — the current book turned into a download, through the same
// engine bundle the rest of the page reads from.
//
// writeDiyaGlZip and writeBookJson (app/lib/diya-gl-interchange.js, the same
// module the CLI's export.js writes through) turn the book into the diya-gl
// zip and the single-file JSON downloads. savePackageZip (the spreadsheet
// package) reads the templates the site serves, through bundle-resources.js.
// The other two need R -- shell.js passes it
// in through extras.report, the same document window.DIYA_GL_SNAPSHOT.report
// already carries, so nothing here recomputes a result the page already has.

const ENGINE_MODULE = "./engine/diya-gl-engine.js";
const RESOURCES_MODULE = "./bundle-resources.js";

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

function longDate(value) {
  const iso = value instanceof Date ? value.toISOString() : String(value);
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// A company's package holds twelve monthly sheets, a year of payroll and a year of tax rates, so
// the engine refuses a company book of any other period. This says why, in plain words, before it does.
function refuseUnlessCompanyYear(engine, book) {
  const productName = book.entityInformation && book.entityInformation["diya-gl:product"];
  if (engine.productIdOf(productName) !== "ltd") return;
  const { periodCoveredStart: start, periodCoveredEnd: end } = book.documentInfo;
  if (engine.isTwelveWholeMonths(start, end)) return;
  throw new Error(
    `No package is built for the period ${longDate(start)} to ${longDate(end)}. A package needs twelve whole months, from the first of a month. Save the book as a diya-gl file instead.`,
  );
}

/**
 * The current book turned into downloadable bytes.
 *
 * @param {Object} book - parsed book.toml
 * @param {Array} lines - parsed lines.jsonl entries
 * @param {"diya-gl-zip"|"json"|"package"} format
 * @param {Object} [extras] - {report, bookchecks?, overtyped?}
 * @returns {Promise<{bytes: Uint8Array, filename: string, mimeType: string}>}
 */
export async function buildSaveArtifact(book, lines, format, extras) {
  const engine = await import(ENGINE_MODULE);
  const withExtras = extras || {};
  if (format === "package") {
    refuseUnlessCompanyYear(engine, book);
    const { browserResourceLoader } = await import(RESOURCES_MODULE);
    const { zip, filename } = await engine.savePackageZip(book, lines, { resources: browserResourceLoader() });
    return { bytes: zip, filename, mimeType: ZIP_MIME };
  }
  if (!withExtras.report) {
    throw new Error(`buildSaveArtifact: format "${format}" needs extras.report, the current R document.`);
  }
  const slug = businessSlug(book);
  if (format === "json") {
    const text = engine.writeBookJson(book, lines);
    return { bytes: new TextEncoder().encode(text), filename: `${slug}-diya-gl.json`, mimeType: JSON_MIME };
  }
  const zipOptions = { book, lines, report: withExtras.report };
  if (withExtras.bookchecks !== undefined) zipOptions.bookchecks = withExtras.bookchecks;
  if (withExtras.overtyped !== undefined) zipOptions.overtyped = withExtras.overtyped;
  const bytes = await engine.writeDiyaGlZip(zipOptions);
  return { bytes, filename: `${slug}-diya-gl.zip`, mimeType: ZIP_MIME };
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
