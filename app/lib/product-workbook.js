// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// product-workbook.js — a book turned into its product's workbooks.
//
// The same steps the CLI runs to populate a package (app/bin/generate.js),
// with the filesystem behind an injectable resource loader: the default reads
// this repo's app/ directory, a browser supplies one backed by fetch. Nothing
// here recalculates; every workbook carries fullCalcOnLoad="1" so the
// spreadsheet app computes it on open.
//
// The product comes from the book itself, so one save path serves all four:
// a single-file product (Basic Sole Trader, Taxi Driver) writes one workbook,
// a multi-file product (Self Employed, Company) writes the whole set.

import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";

import { generateSpreadsheet, packageNaming, applyYearEndSequence, setFullCalcOnLoad } from "./generator.js";
import { applyCellWrites } from "./spreadsheet-runner.js";
import { diyaGlToScenario } from "./diya-gl-loader.js";
import { nodeResourceLoader } from "./app-resources.js";
import * as bst from "../products/bst.js";
import * as taxi from "../products/taxi.js";
import * as se from "../products/se.js";
import * as ltd from "../products/ltd.js";

const SHARED_META = "templates/meta.toml";
const DOS_EPOCH = new Date(Date.UTC(1980, 0, 1));

const PRODUCT_MODULES = { bst, taxi, se, ltd };

// The book schema's own name for each product, which is not the short name
// the CLI, the template directories and the product map above use.
const PRODUCT_BY_SCHEMA_NAME = { BasicSoleTrader: "bst", TaxiDriver: "taxi", SelfEmployed: "se", Company: "ltd" };

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
 * A product whose package is a set of workbooks, asked for as one workbook.
 */
export class SingleFileOnlyError extends Error {
  constructor(productName) {
    super(`a ${productName} book saves as its package zip, not as one workbook`);
    this.name = "SingleFileOnlyError";
    this.productName = productName;
  }
}

/**
 * The product a book declares, under the short name the product map keys.
 *
 * @param {Object} book - parsed book.toml
 * @returns {"bst"|"taxi"|"se"|"ltd"}
 */
export function productOf(book) {
  const declared = book?.entityInformation?.["diya-gl:product"];
  if (!declared) {
    throw new BookFieldError('entityInformation."diya-gl:product"', "the product to write it as is unknown");
  }
  const product = PRODUCT_BY_SCHEMA_NAME[declared];
  if (!product) {
    const known = Object.keys(PRODUCT_BY_SCHEMA_NAME).join(", ");
    throw new Error(`book declares product "${declared}"; the products a workbook can be written for are ${known}`);
  }
  return product;
}

/**
 * The tax year or financial year a date falls in, as the name of its file in
 * app/data. A self-employment year turns on 6 April, so 31 March 2026 and
 * 5 April 2026 are both se-2025-2026; a company's file is named for the year
 * its accounting period ends in.
 *
 * @param {Date} date - the end of the book's accounting period
 * @param {"se"|"ltd"} [taxRegime]
 * @returns {string}
 */
export function taxYearFileName(date, taxRegime = "se") {
  const year = date.getUTCFullYear();
  if (taxRegime === "ltd") return `ltd-${year}`;
  if (taxRegime !== "se") throw new Error(`no tax data file is named for the "${taxRegime}" regime`);

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
  const { taxRegime } = PRODUCT_MODULES[productOf(book)].PRODUCT;
  const taxYearName = options.taxYearName || taxYearFileName(periodCoveredEnd(book), taxRegime);
  return parseTOML(await resources.readText(`data/${taxYearName}.toml`));
}

/**
 * Everything the writer derives before it touches a template: which product's
 * templates to read, which year's data to apply, what the package is called,
 * and which cells to write. Reading it all up front is what stops a book with
 * a missing field producing a half-written package.
 */
async function resolveInputs(book, lines, options) {
  const resources = options.resources || nodeResourceLoader();

  const product = productOf(book);
  const productMod = PRODUCT_MODULES[product];
  const bookPeriodEnd = periodCoveredEnd(book);
  const templateDir = `templates/${productMod.PRODUCT.dir}`;

  const taxYearName = options.taxYearName || taxYearFileName(bookPeriodEnd, productMod.PRODUCT.taxRegime);
  const taxData = options.taxData || (await loadTaxDataForBook(book, { resources, taxYearName }));
  const yearInfo = taxData.tax_year || taxData.financial_year;
  if (!yearInfo) throw new Error(`${taxYearName}.toml declares neither tax_year nor financial_year`);
  const endDate = new Date(yearInfo.end);

  // A self-employment year always ends on 5 April, on the month tabs the
  // templates already carry. A company chooses its own year end, and the month
  // tabs, the links that name them and the payroll periods all move to match.
  const yearEndMonth = taxData.financial_year ? endDate.getUTCMonth() + 1 : 0;

  const productMeta = parseTOML(await resources.readText(`${templateDir}/meta.toml`));
  const sharedMeta = parseTOML(await resources.readText(SHARED_META));
  const { dirName, xlsxFilename } = packageNaming(productMeta, sharedMeta, endDate);

  const scenario = diyaGlToScenario(book, lines, product);
  const targetStartYear = new Date(yearInfo.start).getUTCFullYear();
  const writes = productMod.cellWrites(scenario, targetStartYear, bookPeriodEnd.getUTCMonth() + 1);

  const templateFiles = productMeta.template.files || [productMeta.template.spreadsheet];

  return {
    resources,
    product,
    templateDir,
    templateFiles,
    multiFile: Boolean(productMod.MULTI_FILE),
    taxData,
    yearInfo,
    endDate,
    yearEndMonth,
    productMeta,
    dirName,
    xlsxFilename,
    writes,
  };
}

// One workbook of a package: the template with the year's rates in it, moved
// to the year end being written for, carrying the book's own figures. A file
// that is not a workbook (the Company package's dividend voucher) is copied.
async function composeFile(inputs, templateFile) {
  const { resources, templateDir, multiFile, taxData, yearInfo, endDate, yearEndMonth, productMeta, writes } = inputs;
  const fileKey = templateFile.replace(".xlsx", "").replace(".docx", "").toLowerCase();
  const sheetsConfig = multiFile ? productMeta.sheets?.[fileKey] : productMeta.sheets;
  const fileWrites = multiFile ? writes[templateFile] : writes;

  let buffer = await resources.readBinary(`${templateDir}/${templateFile}`);
  if (sheetsConfig && Object.keys(sheetsConfig).length > 0) {
    buffer = await generateSpreadsheet(buffer, taxData, sheetsConfig);
  }
  if (!templateFile.endsWith(".xlsx")) return buffer;

  buffer = await applyYearEndSequence(buffer, templateFile, sheetsConfig, yearEndMonth, endDate, yearInfo);
  if (fileWrites) buffer = await applyCellWrites(buffer, fileWrites);
  return setFullCalcOnLoad(buffer);
}

/**
 * A book as the workbooks a spreadsheet app opens: one file for Basic Sole
 * Trader and Taxi Driver, the whole set for Self Employed and Company.
 *
 * @param {Object} book - parsed book.toml
 * @param {Array} lines - parsed lines.jsonl entries
 * @param {Object} [options]
 * @param {Object} [options.resources] - resource loader; defaults to reading app/
 * @param {string} [options.taxYearName] - override the tax year the book's dates imply
 * @param {Object} [options.taxData] - already-parsed tax data, skipping the load
 * @returns {Promise<{ product: string, dirName: string, files: Array<{name: string, bytes: Uint8Array}> }>}
 */
export async function saveWorkbookFiles(book, lines, options = {}) {
  const inputs = await resolveInputs(book, lines, options);

  const files = [];
  for (const templateFile of inputs.templateFiles) {
    const bytes = await composeFile(inputs, templateFile);
    files.push({ name: inputs.multiFile ? templateFile : inputs.xlsxFilename, bytes });
  }

  return { product: inputs.product, dirName: inputs.dirName, files };
}

/**
 * A single-file product's book as the one workbook it writes.
 *
 * @returns {Promise<{ workbook: Uint8Array, filename: string }>}
 */
export async function saveWorkbook(book, lines, options = {}) {
  const inputs = await resolveInputs(book, lines, options);
  if (inputs.multiFile) throw new SingleFileOnlyError(inputs.productMeta.product.name);

  const workbook = await composeFile(inputs, inputs.templateFiles[0]);
  return { workbook, filename: inputs.xlsxFilename };
}

/**
 * The workbooks wrapped as the package zip the download page serves: a single
 * workbook at the zip root under the package's own name, or the whole set in a
 * directory named for the package. The shipped package also carries the PDF
 * guides, which need a PDF renderer and so stay with the CLI.
 *
 * @returns {Promise<{ zip: Uint8Array, filename: string }>}
 */
export async function savePackageZip(book, lines, options = {}) {
  const inputs = await resolveInputs(book, lines, options);

  const zip = new JSZip();
  for (const templateFile of inputs.templateFiles) {
    const bytes = await composeFile(inputs, templateFile);
    const name = inputs.multiFile ? `${inputs.dirName}/${templateFile}` : inputs.xlsxFilename;
    zip.file(name, bytes, { date: DOS_EPOCH });
  }
  // The package directory is an entry of its own, which JSZip dates with the
  // time of the run; the zip is the same bytes every time without that.
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) entry.date = DOS_EPOCH;
  }

  const buffer = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return { zip: buffer, filename: `${inputs.dirName}.zip` };
}
