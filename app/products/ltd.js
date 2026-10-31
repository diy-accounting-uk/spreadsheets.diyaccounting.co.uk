// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// ltd.js — Limited Company product definition (all year-end months).
// Multi-file package: 15 xlsx files with cross-file external links.
// The shipped corporation tax working sheet charges the whole chargeable
// profit at the small profits rate, with no main rate and no marginal relief.
// Year-end month is determined by the tax data file (financial_year.end).

import { fmt } from "../lib/product-sheets/format.js";
import { vatRateFor } from "../lib/product-sheets/vat-rate.js";

import {
  SALESINVOICE_VAT_REG_CELL,
  SALESINVOICE_TELEPHONE_CELL,
  SALESINVOICE_SAMPLE_PRODUCT_ROW,
  SALESINVOICE_PRODUCT_DETAILS_COLUMNS,
  SALESINVOICE_INVOICE_DATABASE_COLUMNS,
} from "../lib/product-sheets/salesinvoice.js";

export { STRADDLING_PERIOD_ROWS } from "../lib/product-sheets/vat-chain.js";
export {
  fmt,
  vatRateFor,
  SALESINVOICE_VAT_REG_CELL,
  SALESINVOICE_TELEPHONE_CELL,
  SALESINVOICE_SAMPLE_PRODUCT_ROW,
  SALESINVOICE_PRODUCT_DETAILS_COLUMNS,
  SALESINVOICE_INVOICE_DATABASE_COLUMNS,
};

export {
  CHARGE_REGISTER_ROWS,
  CHARGE_REGISTER_COLUMNS,
  REGISTER_MEMBER_ROWS,
  REGISTER_MEMBER_COLUMNS,
  BOARD_MINUTE_CELLS,
  DIRECTOR_SECRETARY_COLUMNS,
  DIRECTOR_SECRETARY_OFFICER_ROWS,
  DIRECTORS_INTERESTS_ROWS,
  DIRECTORS_INTERESTS_COLUMNS,
  STOCK_FINAL_COUNT_CELL,
  STOCK_MATERIALS_PERCENT_CELL,
  ADMIN_ASSOCIATED_COMPANIES_CELL,
  OPENACCOUNTS_FRANKED_INVESTMENT_INCOME_CELL,
  OPENING_BANK_COLUMNS,
  OPENING_TAX_COLUMNS,
  OPENING_BALANCE_CELLS,
  SCHEDULE_ASSET_CLASSES,
  SCHEDULE_NEW_ASSET_ROWS,
  STRADDLING_COLUMNS,
} from "./ltd/layout.js";
export { TAX_SHEET, CELL_MAP, HEADLINES } from "./ltd/cell-map.js";

export { cellWrites } from "./ltd/writes.js";

export { standardReads, multiFileOptions } from "./ltd/reads.js";

export { reportSections, unitFor, cellLabels, profitBridge, categoryNetting } from "./ltd/report.js";

export { checkCompliance } from "./ltd/checks/index.js";
export const PRODUCT = {
  id: "ltd",
  dir: "ltd",
  name: "Company",
  taxRegime: "ltd",
  prefix: "GB Accounts Company",
};

export const MULTI_FILE = true;

// ── Compliance checks ──────────────────────────────────────────────────────
