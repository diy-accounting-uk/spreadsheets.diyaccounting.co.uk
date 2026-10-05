// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-new-book.js — an empty book for a new business: the product's
// starting chart of accounts, the twelve months to the year end, and that
// year's tax tables. The books pages' New book form and the MCP server's
// new_book tool both build from the charts here.

import { SCHEMA_PRODUCT_NAMES, taxTablesForProduct } from "./xlsx-exporter.js";

// One chart per product. Each gives every profit and loss row the sales and
// purchase journals feed an account to post to, worded as the statement's own
// captions or the example books word them, plus the bank books the package
// carries. Ltd's business entertainment names its Purchases column, AJ,
// because it is the one purchase account the profit and loss row it lands on
// (advertising) does not tell apart, and the corporation tax computation adds
// it back.
export const NEW_BOOK_CHARTS = {
  bst: {
    sales: {
      4000: { accountMainDescription: "Sales" },
    },
    purchases: {
      5000: { accountMainDescription: "Cost of sales" },
      5001: { accountMainDescription: "Direct costs" },
      5101: { accountMainDescription: "Employee costs" },
      5200: { accountMainDescription: "Premises costs" },
      5400: { accountMainDescription: "Repairs and maintenance" },
      5501: { accountMainDescription: "General admin" },
      5601: { accountMainDescription: "Motor expenses" },
      5600: { accountMainDescription: "Travel and subsistence" },
      5500: { accountMainDescription: "Advertising" },
      5800: { accountMainDescription: "Legal and professional fees" },
      5803: { accountMainDescription: "Interest and finance charges" },
      5801: { accountMainDescription: "Bad debts written off" },
      5002: { accountMainDescription: "Other expenses" },
      5900: { accountMainDescription: "Fixed asset purchases" },
    },
  },
  taxi: {
    sales: {
      4000: { accountMainDescription: "Fares income" },
      4001: { accountMainDescription: "Other business income" },
    },
    purchases: {
      5100: { accountMainDescription: "Fuel" },
      5200: { accountMainDescription: "Car hire" },
      5300: { accountMainDescription: "Repairs and maintenance" },
      5400: { accountMainDescription: "Road tax and insurance" },
      5500: { accountMainDescription: "Employee costs" },
      5600: { accountMainDescription: "Premises costs" },
      5700: { accountMainDescription: "General admin" },
      5800: { accountMainDescription: "Advertising" },
      5900: { accountMainDescription: "Legal and professional" },
      6000: { accountMainDescription: "Interest" },
      6100: { accountMainDescription: "Bank charges" },
      6200: { accountMainDescription: "Other expenses" },
      7000: { accountMainDescription: "Fixed assets" },
    },
  },
  se: {
    sales: {
      4000: { accountMainDescription: "Sales Product A" },
      4001: { accountMainDescription: "Sales Product B" },
      4002: { accountMainDescription: "Sales Product C" },
      4003: { accountMainDescription: "Other Income" },
      4004: { accountMainDescription: "Investment Grants received" },
      4005: { accountMainDescription: "Bad Debts written off" },
    },
    purchases: {
      5000: { accountMainDescription: "Purchases after stock adjustment" },
      5001: { accountMainDescription: "Sub contractors" },
      5002: { accountMainDescription: "Other Direct Cost of Sales" },
      5101: { accountMainDescription: "Wages and Salaries" },
      5201: { accountMainDescription: "Premises Rent Rates Power" },
      5400: { accountMainDescription: "Repairs & Maintenance" },
      5501: { accountMainDescription: "General Administrative Expenses" },
      5601: { accountMainDescription: "Motor Expenses" },
      5600: { accountMainDescription: "Travel Hotel & Subsistence" },
      5500: { accountMainDescription: "Advertising & Promotion" },
      5800: { accountMainDescription: "Legal & Professional Fees" },
      5801: { accountMainDescription: "Other Expenses" },
      5900: { accountMainDescription: "Fixed asset purchases" },
    },
    bank: {
      1200: { accountMainDescription: "Current account", accountType: "bank" },
      1220: { accountMainDescription: "Cash account", accountType: "bank" },
    },
  },
  ltd: {
    sales: {
      4000: { accountMainDescription: "Sales Product A" },
      4001: { accountMainDescription: "Sales Product B" },
      4002: { accountMainDescription: "Sales Product C" },
      4003: { accountMainDescription: "Other Direct Income" },
      4004: { accountMainDescription: "Grants Received" },
    },
    purchases: {
      5000: { accountMainDescription: "Materials / Stock" },
      5100: { accountMainDescription: "Directors Wages" },
      5200: { accountMainDescription: "Premises" },
      5400: { accountMainDescription: "Repairs & Maintenance" },
      5500: { accountMainDescription: "Advertising" },
      5502: { "accountMainDescription": "Business entertainment", "diya-gl:column": "AJ" },
      5600: { accountMainDescription: "Travel & Hotel" },
      5700: { accountMainDescription: "Insurance" },
      5800: { accountMainDescription: "Legal & Professional" },
      5900: { accountMainDescription: "Fixed asset purchases" },
    },
    bank: {
      1200: { accountMainDescription: "Current account", accountType: "bank" },
      1210: { accountMainDescription: "Savings account", accountType: "bank" },
      1220: { accountMainDescription: "Cash account", accountType: "bank" },
      1230: { accountMainDescription: "Credit card account", accountType: "bank" },
    },
  },
};

// The products whose package carries a VAT return: a Basic Sole Trader or a
// Taxi Driver book has no VAT cells to register against.
const VAT_PRODUCTS = new Set(["se", "ltd"]);
const NON_VAT_PRODUCT_NAMES = { bst: "Basic Sole Trader", taxi: "Taxi Driver" };

// A Company keeps accruals accounts; the sole trader products start on the
// cash basis the books pages start them on.
const CASH_BASIS_PRODUCTS = new Set(["bst", "taxi", "se"]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The twelve months to a year end: from the day after the same calendar date
 * a year earlier, to the year end itself.
 * @param {string} yearEnd - YYYY-MM-DD
 * @returns {{start: string, end: string}}
 */
export function periodFromYearEnd(yearEnd) {
  if (typeof yearEnd !== "string" || !ISO_DATE.test(yearEnd)) throw new Error(`yearEnd "${yearEnd}" is not a YYYY-MM-DD date`);
  const [year, month, day] = yearEnd.split("-").map(Number);
  const end = new Date(Date.UTC(year, month - 1, day));
  if (end.getUTCMonth() !== month - 1 || end.getUTCDate() !== day) throw new Error(`yearEnd "${yearEnd}" is not a real date`);
  const start = new Date(Date.UTC(year - 1, month - 1, day + 1));
  return { start: start.toISOString().slice(0, 10), end: yearEnd };
}

/**
 * The product's starting chart of accounts, as a fresh copy.
 * @param {string} product - bst, taxi, se or ltd
 * @returns {Object}
 */
export function newBookChart(product) {
  const chart = NEW_BOOK_CHARTS[product];
  if (!chart) throw new Error(`Unknown product "${product}"; a new book is one of ${Object.keys(NEW_BOOK_CHARTS).join(", ")}`);
  return structuredClone(chart);
}

/**
 * An empty book: the product's chart, the twelve months to the year end, the
 * business's name and, given that year's rate data, its tax tables.
 * @param {Object} params
 * @param {string} params.product - bst, taxi, se or ltd
 * @param {string} params.businessName
 * @param {string} params.yearEnd - YYYY-MM-DD
 * @param {boolean} [params.vatRegistered] - Self Employed and Company only
 * @param {Object} [rateData] - the parsed app/data/<year>.toml the year end falls in
 * @returns {Object} the book
 */
export function buildNewBook({ product, businessName, yearEnd, vatRegistered = false }, rateData) {
  const accounts = newBookChart(product);
  if (typeof businessName !== "string" || businessName.trim() === "") throw new Error("A new book needs a businessName");
  if (vatRegistered && !VAT_PRODUCTS.has(product)) {
    throw new Error(`A ${NON_VAT_PRODUCT_NAMES[product]} book carries no VAT return, so it cannot be VAT registered`);
  }
  const period = periodFromYearEnd(yearEnd);
  const entityInformation = {
    "organizationIdentifier": businessName.trim(),
    "diya-gl:product": SCHEMA_PRODUCT_NAMES[product],
    "diya-gl:vatRegistered": Boolean(vatRegistered),
  };
  if (CASH_BASIS_PRODUCTS.has(product)) entityInformation["diya-gl:basisOfAccounting"] = "cash";
  const book = {
    documentInfo: {
      entriesType: "journal",
      language: "en",
      periodCoveredStart: period.start,
      periodCoveredEnd: period.end,
      defaultCurrency: "GBP",
      entriesComment: `New book for ${businessName.trim()}`,
    },
    entityInformation,
    accounts,
  };
  if (rateData) book.tax = taxTablesForProduct(rateData, product);
  return book;
}
