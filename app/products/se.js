// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// se.js — Self Employed product definition.
// Multi-file package: 9 xlsx files with cross-file external links.
// Owns column mappings, cell references, compliance checks.
// Calls shared tools from app/lib/.

import { fmt } from "../lib/product-sheets/format.js";
import { vatRateFor } from "../lib/product-sheets/vat-rate.js";

import {
  SALESINVOICE_VAT_REG_CELL,
  SALESINVOICE_TELEPHONE_CELL,
  SALESINVOICE_SAMPLE_PRODUCT_CODE,
  SALESINVOICE_SAMPLE_PRODUCT_ROW,
  SALESINVOICE_SAMPLE_CARRIAGE_CHARGE,
  SALESINVOICE_PRODUCT_DETAILS_COLUMNS,
  SALESINVOICE_INVOICE_DATABASE_COLUMNS,
} from "../lib/product-sheets/salesinvoice.js";

export { STRADDLING_PERIOD_ROWS } from "../lib/product-sheets/vat-chain.js";
export {
  fmt,
  vatRateFor,
  SALESINVOICE_VAT_REG_CELL,
  SALESINVOICE_TELEPHONE_CELL,
  SALESINVOICE_SAMPLE_PRODUCT_CODE,
  SALESINVOICE_SAMPLE_PRODUCT_ROW,
  SALESINVOICE_SAMPLE_CARRIAGE_CHARGE,
  SALESINVOICE_PRODUCT_DETAILS_COLUMNS,
  SALESINVOICE_INVOICE_DATABASE_COLUMNS,
};

export {
  BANK_ACCOUNT_FILES,
  BANK_LAYOUTS,
  STRADDLING_SALES_COLUMNS,
  STRADDLING_PURCHASES_COLUMNS,
  BUSINESS_DESCRIPTION_CELL,
  STOCK_OPENING_COUNT_CELL,
  STOCK_CLOSING_COUNT_CELL,
  DISALLOWABLE_PERCENT_CELLS,
  ANNUAL_ALLOWANCE_CELLS,
  ANNUAL_ADJUSTMENT_CELLS,
  GOODS_FOR_OWN_USE_CELL,
  BASIS_PERIOD_CELLS,
  ACCOUNTING_PERIOD_START_CELL,
  ACCOUNTING_PERIOD_END_CELL,
  EXISTING_ASSET_ROWS,
  NEW_PLANT_ROWS,
  SPECIAL_RATE_POOL_MARKER_COLUMN,
  SPECIAL_RATE_POOL_MARKER,
  SINGLE_ASSET_POOL_MARKER_COLUMN,
  SINGLE_ASSET_POOL_MARKER,
  PRIVATE_USE_COLUMN,
  SBA_CLAIM_ROWS,
  SBA_CLAIM_COLUMNS,
  SBA_ENHANCED_MARKER,
  HP_AGREEMENT_ROWS,
  SE_YEAR_END_MONTH,
} from "./se/layout.js";
export { TAX_SHEET, FORECAST_SHEET, CELL_MAP, HEADLINES } from "./se/cell-map.js";

export { cellWrites, writerSkips } from "./se/writes.js";

export { multiFileOptions, standardReads } from "./se/reads.js";

export { reportSections, unitFor, cellLabels, profitBridge, categoryNetting } from "./se/report.js";

export { checkCompliance } from "./se/checks/index.js";

export const PRODUCT = {
  id: "se",
  dir: "se",
  name: "Self Employed",
  taxRegime: "se",
  prefix: "GB Accounts Self Employed",
};

// SE is a multi-file package. Sales and Purchases are separate xlsx files.
export const MULTI_FILE = true;
