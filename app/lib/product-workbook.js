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
 * A book that cannot be written into a workbook, naming the field at fault.
 */
export class BookFieldError extends Error {
  constructor(field, message) {
    super(message);
    this.name = "BookFieldError";
    this.field = field;
  }
}

function missingField(field, why) {
  return new BookFieldError(field, `book has no ${field}, so ${why}`);
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
    throw missingField('entityInformation."diya-gl:product"', "the product to write it as is unknown");
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
 * 5 April 2026 are both se-2025-2026. A corporation tax financial year turns
 * on 1 April, and a company's file is named for the calendar year of the
 * 1 April on or before its year end: a period ending 31 March 2026 is FY2025,
 * one ending 30 April 2026 is FY2026. It is the same rule the exporter reads
 * back off a package's Admin sheet (packageTaxDataFile, xlsx-exporter.js).
 *
 * @param {Date} date - the end of the book's accounting period
 * @param {"se"|"ltd"} [taxRegime]
 * @returns {string}
 */
export function taxYearFileName(date, taxRegime = "se") {
  const year = date.getUTCFullYear();
  if (taxRegime === "ltd") return `ltd-${date.getUTCMonth() < 3 ? year - 1 : year}`;
  if (taxRegime !== "se") throw new Error(`no tax data file is named for the "${taxRegime}" regime`);

  const beforeSixthOfApril = date.getUTCMonth() < 3 || (date.getUTCMonth() === 3 && date.getUTCDate() < 6);
  const startYear = beforeSixthOfApril ? year - 1 : year;
  return `se-${startYear}-${startYear + 1}`;
}

function periodCoveredEnd(book) {
  const info = book?.documentInfo;
  if (!info) throw missingField("documentInfo", "its accounting period is unknown");
  if (!info.periodCoveredStart) {
    throw missingField("documentInfo.periodCoveredStart", "its accounting period is unknown");
  }
  if (!info.periodCoveredEnd) {
    throw missingField("documentInfo.periodCoveredEnd", "the tax year to generate for is unknown");
  }
  return new Date(info.periodCoveredEnd);
}

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

// A company's package is twelve month tabs, a payroll calendar of twelve
// months and a year's rates, so a book covering anything else has no package
// to be written into. The refusal comes before the first template read: a
// half-written package is worse than none.
function refuseUnlessTwelveWholeMonths(book) {
  const start = new Date(book.documentInfo.periodCoveredStart);
  const end = new Date(book.documentInfo.periodCoveredEnd);
  const twelfthMonthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 12, 0));
  if (start.getUTCDate() === 1 && end.getTime() === twelfthMonthEnd.getTime()) return;
  throw new BookFieldError(
    "documentInfo.periodCoveredEnd",
    `book covers ${isoDay(start)} to ${isoDay(end)}, which is not the twelve whole months a company's accounts cover`,
  );
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

  // A self-employment year always ends on 5 April, on the month tabs the
  // templates already carry, and the tax file it belongs to declares that
  // date. A company chooses its own year end, so its book's period is the
  // year end: it names the package, sets the one date cell the Admin sheet
  // computes the rest from, moves the month tabs and the links and the
  // payroll periods, and shifts the scenario's dates onto them.
  const yearEndFromBook = productMod.PRODUCT.taxRegime === "ltd";
  if (yearEndFromBook) refuseUnlessTwelveWholeMonths(book);

  const taxYearName = options.taxYearName || taxYearFileName(bookPeriodEnd, productMod.PRODUCT.taxRegime);
  const taxFile = options.taxData || (await loadTaxDataForBook(book, { resources, taxYearName }));
  const declaredYear = taxFile.tax_year || taxFile.financial_year;
  if (!declaredYear) throw new Error(`${taxYearName}.toml declares neither tax_year nor financial_year`);

  // The rates are the financial year's, the year end is this company's, and
  // the generator reads both off the one object.
  const endDate = yearEndFromBook ? bookPeriodEnd : new Date(declaredYear.end);
  const yearInfo = yearEndFromBook ? { ...declaredYear, end: endDate } : declaredYear;
  const taxData = yearEndFromBook ? { ...taxFile, financial_year: yearInfo } : taxFile;
  const yearEndMonth = yearEndFromBook ? endDate.getUTCMonth() + 1 : 0;

  const productMeta = parseTOML(await resources.readText(`${templateDir}/meta.toml`));
  const sharedMeta = parseTOML(await resources.readText(SHARED_META));
  const { dirName, xlsxFilename } = packageNaming(productMeta, sharedMeta, endDate);

  const scenario = diyaGlToScenario(book, lines, product);
  // The tax year the writes are dated into: the year a statutory year opened
  // in, and for a company the year before the one its year end falls in, which
  // is what cellWrites turns into the payroll year the package opens with and
  // what generate.js takes off the package directory's own year-end date.
  const targetStartYear = yearEndFromBook ? endDate.getUTCFullYear() - 1 : new Date(yearInfo.start).getUTCFullYear();
  const writes = productMod.cellWrites(scenario, targetStartYear, yearEndMonth);

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
