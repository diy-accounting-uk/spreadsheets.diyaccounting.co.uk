// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// bst-workbook.js — a Basic Sole Trader book turned into a workbook buffer.
//
// The same steps the CLI runs to populate a package, with the filesystem behind
// an injectable resource loader: the default reads this repo's app/ directory,
// a browser supplies one backed by fetch. Nothing here recalculates; the
// workbook carries fullCalcOnLoad="1" so the spreadsheet app computes it on open.

import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";

import { generateSpreadsheet, packageNaming } from "./generator.js";
import { applyCellWrites } from "./spreadsheet-runner.js";
import { diyaGlToScenario } from "./diya-gl-loader.js";
import { nodeResourceLoader } from "./app-resources.js";
import { cellWrites as bstCellWrites } from "../products/bst.js";

const BST_TEMPLATE_DIR = "templates/bst";
const SHARED_META = "templates/meta.toml";

/**
 * A book that cannot be written into a workbook, naming the field that is missing.
 */
export class BookFieldError extends Error {
  constructor(field, why) {
    super(`book has no ${field}, so ${why}`);
    this.name = "BookFieldError";
    this.field = field;
  }
}

/**
 * The UK tax year a date falls in, as the name of its file in app/data.
 * The year turns on 6 April, so 31 March 2026 and 5 April 2026 are both 2025-26.
 */
export function taxYearFileName(date) {
  const year = date.getUTCFullYear();
  const beforeSixthOfApril = date.getUTCMonth() < 3 || (date.getUTCMonth() === 3 && date.getUTCDate() < 6);
  const startYear = beforeSixthOfApril ? year - 1 : year;
  return `se-${startYear}-${startYear + 1}`;
}

function periodCoveredEnd(book) {
  const info = book?.documentInfo;
  if (!info) throw new BookFieldError("documentInfo", "its accounting period is unknown");
  if (!info.periodCoveredStart) {
    throw new BookFieldError("documentInfo.periodCoveredStart", "its accounting period is unknown");
  }
  if (!info.periodCoveredEnd) {
    throw new BookFieldError("documentInfo.periodCoveredEnd", "the tax year to generate for is unknown");
  }
  return new Date(info.periodCoveredEnd);
}

/**
 * Everything the BST writer derives before it touches the template: which tax
 * year's data to load, what the package is called, and which cells to write.
 * Reading it all up front is what stops a book with a missing field producing a
 * half-written workbook.
 */
/**
 * The tax year data a book's own dates name, read through the resource loader.
 * The calculator needs the same file the writer applies, so both take it from
 * here rather than each resolving the year for itself.
 *
 * @param {Object} book - parsed book.toml
 * @param {Object} [options]
 * @param {Object} [options.resources] - resource loader; defaults to reading app/
 * @param {string} [options.taxYearName] - override the tax year the book's dates imply
 * @returns {Promise<Object>} the parsed app/data/<year>.toml
 */
export async function loadTaxDataForBook(book, options = {}) {
  const resources = options.resources || nodeResourceLoader();
  const taxYearName = options.taxYearName || taxYearFileName(periodCoveredEnd(book));
  return parseTOML(await resources.readText(`data/${taxYearName}.toml`));
}

async function resolveBstInputs(book, lines, options) {
  const resources = options.resources || nodeResourceLoader();

  const bookPeriodEnd = periodCoveredEnd(book);
  const taxYearName = options.taxYearName || taxYearFileName(bookPeriodEnd);

  const taxData = options.taxData || (await loadTaxDataForBook(book, { resources, taxYearName }));
  const yearInfo = taxData.tax_year || taxData.financial_year;
  if (!yearInfo) throw new Error(`${taxYearName}.toml declares neither tax_year nor financial_year`);
  const endDate = new Date(yearInfo.end);

  const productMeta = parseTOML(await resources.readText(`${BST_TEMPLATE_DIR}/meta.toml`));
  const sharedMeta = parseTOML(await resources.readText(SHARED_META));
  const { dirName, xlsxFilename } = packageNaming(productMeta, sharedMeta, endDate);

  const scenario = diyaGlToScenario(book, lines, "bst");
  const writes = bstCellWrites(scenario);

  return { resources, taxData, productMeta, dirName, xlsxFilename, writes };
}

/**
 * A BST book as the workbook a spreadsheet app opens.
 *
 * @param {Object} book - parsed book.toml
 * @param {Array} lines - parsed lines.jsonl entries
 * @param {Object} [options]
 * @param {Object} [options.resources] - resource loader; defaults to reading app/
 * @param {string} [options.taxYearName] - override the tax year the book's dates imply
 * @param {Object} [options.taxData] - already-parsed tax data, skipping the load
 * @returns {Promise<{ workbook: Uint8Array, filename: string }>}
 */
export async function saveBstWorkbook(book, lines, options = {}) {
  const inputs = await resolveBstInputs(book, lines, options);
  return { workbook: await writeWorkbook(inputs), filename: inputs.xlsxFilename };
}

async function writeWorkbook({ resources, taxData, productMeta, writes }) {
  const templateBuffer = await resources.readBinary(`${BST_TEMPLATE_DIR}/${productMeta.template.spreadsheet}`);
  const generated = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);
  return applyCellWrites(generated, writes);
}

/**
 * The same workbook wrapped as the package zip the download page serves: the
 * spreadsheet at the zip root, under the package's own name. The shipped
 * package also carries the PDF guide, which needs a PDF renderer and so stays
 * with the CLI.
 *
 * @returns {Promise<{ zip: Uint8Array, filename: string }>}
 */
export async function saveBstPackageZip(book, lines, options = {}) {
  const inputs = await resolveBstInputs(book, lines, options);
  const workbook = await writeWorkbook(inputs);

  const zip = new JSZip();
  zip.file(inputs.xlsxFilename, workbook, { date: new Date(Date.UTC(1980, 0, 1)) });
  const buffer = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return { zip: buffer, filename: `${inputs.dirName}.zip` };
}
