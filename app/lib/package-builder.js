// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 DIY Accounting Ltd
//
// package-builder.js — Pure functions for package directory parsing,
// company variant generation, and catalogue TOML output.

// Regex to parse standard package directory names
// e.g. "GB Accounts Basic Sole Trader 2025-04-05 (Apr25) Excel 2007"
export const PACKAGE_RE = /^GB Accounts (.+?) (\d{4}-\d{2}-\d{2}) \((\w+)\) (Excel \d{4})$/;

// Regex to parse Company (Any) directory names
// e.g. "GB Accounts Company 2024-2025 (Any) Excel 2007"
export const ANY_RE = /^GB Accounts Company (\d{4})-(\d{4}) \(Any\) (Excel \d{4})$/;

// Product display names and IDs for the catalogue
export const PRODUCTS = {
  "Basic Sole Trader": {
    id: "BasicSoleTrader",
    description:
      "Simple bookkeeping spreadsheet for sole traders not registered for VAT. Includes profit & loss, self assessment tax, and fixed assets.",
  },
  "Self Employed": {
    id: "SelfEmployed",
    description:
      "Full bookkeeping spreadsheet for self-employed businesses. Includes sales, purchases, VAT returns, bank reconciliation, payslips, and self assessment.",
  },
  "Company": {
    id: "Company",
    description:
      "Complete accounting spreadsheet for limited companies. Includes sales, purchases, VAT, corporation tax, payroll, dividends, and year-end accounts.",
  },
  "Taxi Driver": {
    id: "TaxiDriver",
    description:
      "Bookkeeping spreadsheet designed for taxi drivers. Branded as Cabsmart, includes income tax, VAT, profit & loss, receipts, and expenses tracking.",
  },
  "Payslip 05": {
    id: "Payslip05",
    description: "Payslip generator for up to 5 employees. Calculates PAYE, National Insurance, student loans, and pension contributions.",
  },
  "Payslip 10": {
    id: "Payslip10",
    description: "Payslip generator for up to 10 employees. Calculates PAYE, National Insurance, student loans, and pension contributions.",
  },
};

// Months for Company (Any) generation
export const MONTHS = [
  { month: 4, abbr: "Apr" },
  { month: 5, abbr: "May" },
  { month: 6, abbr: "Jun" },
  { month: 7, abbr: "Jul" },
  { month: 8, abbr: "Aug" },
  { month: 9, abbr: "Sep" },
  { month: 10, abbr: "Oct" },
  { month: 11, abbr: "Nov" },
  { month: 12, abbr: "Dec" },
  { month: 1, abbr: "Jan" },
  { month: 2, abbr: "Feb" },
];

export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function monthEndDate(year, month) {
  if (month === 2 && isLeapYear(year)) return 29;
  const daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return daysInMonth[month];
}

export function parsePackageDir(dirName) {
  const match = dirName.match(PACKAGE_RE);
  if (!match) return null;
  const [, productName, date, shortLabel, format] = match;
  return { productName, date, shortLabel, format };
}

export function parseCompanyAnyDir(dirName) {
  const match = dirName.match(ANY_RE);
  if (!match) return null;
  return { startYear: parseInt(match[1], 10), endYear: parseInt(match[2], 10), format: match[3] };
}

/**
 * Generate the list of Company month-end variants for a given tax year range.
 * Returns metadata only (no I/O).
 * @param {number} startYear - e.g. 2024
 * @param {number} endYear - e.g. 2025
 * @param {string} format - e.g. "Excel 2007"
 * @param {Date} now - current date for cutoff calculation
 * @returns {{ variants: Array<{date, shortLabel, format, zipName}>, skipped: string[] }}
 */
export function generateCompanyVariantNames(startYear, endYear, format, now) {
  const variants = [];
  const skipped = [];
  const firstYearEnd = startYear + 1;
  const secondYearEnd = endYear + 1;
  const currentYM = now.getFullYear() * 12 + (now.getMonth() + 1);

  for (const m of MONTHS) {
    const year = m.month >= 4 ? firstYearEnd : secondYearEnd;

    // Financial year start: month after year-end, one year earlier
    const fyStartMonth = m.month === 12 ? 1 : m.month + 1;
    const fyStartYear = m.month === 12 ? year : year - 1;
    const fyStartYM = fyStartYear * 12 + fyStartMonth;

    if (currentYM < fyStartYM) {
      skipped.push(`${m.abbr}${String(year).slice(-2)}`);
      continue;
    }

    const yr2 = String(year).slice(-2);
    const days = monthEndDate(year, m.month);
    const date = `${year}-${pad2(m.month)}-${pad2(days)}`;
    const shortLabel = `${m.abbr}${yr2}`;
    const zipName = `GB Accounts Company ${date} (${shortLabel}) ${format}`;

    variants.push({ date, shortLabel, format, zipName });
  }

  return { variants, skipped };
}

export function dateToLabel(date) {
  const [y, m] = date.split("-").map(Number);
  const months = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${months[m]} ${y}`;
}

// Stable product order for catalogue output
export const PRODUCT_ORDER = ["Basic Sole Trader", "Self Employed", "Company", "Taxi Driver", "Payslip 05", "Payslip 10"];

/**
 * Generate catalogue.toml content from a list of package records.
 * @param {Array<{product, date, shortLabel, format, filename}>} allPackages
 * @param {string} generatedDate - ISO date string (YYYY-MM-DD)
 * @returns {string} TOML content
 */
export function generateCatalogue(allPackages, generatedDate) {
  // Group by product
  const byProduct = {};
  for (const pkg of allPackages) {
    if (!byProduct[pkg.product]) byProduct[pkg.product] = [];
    byProduct[pkg.product].push(pkg);
  }

  // Sort each product's packages by date descending (newest first)
  for (const product of Object.keys(byProduct)) {
    byProduct[product].sort((a, b) => b.date.localeCompare(a.date));
  }

  const lines = [
    "# catalogue.toml — Auto-generated by app/bin/build-packages.js",
    "# Do not edit manually; regenerated on each deploy from packages/ directory.",
    "",
    `generated = "${generatedDate}"`,
    "",
  ];

  for (const productName of PRODUCT_ORDER) {
    const meta = PRODUCTS[productName];
    if (!meta || !byProduct[productName]) continue;

    lines.push(`[[products]]`);
    lines.push(`id = "${meta.id}"`);
    lines.push(`name = "${productName}"`);
    lines.push(`description = "${meta.description}"`);
    lines.push("");

    for (const pkg of byProduct[productName]) {
      lines.push(`  [[products.periods]]`);
      lines.push(`  date = "${pkg.date}"`);
      lines.push(`  label = "${dateToLabel(pkg.date)}"`);
      lines.push(`  short = "${pkg.shortLabel}"`);
      lines.push(`  format = "${pkg.format}"`);
      lines.push(`  filename = "${pkg.filename}"`);
      lines.push("");
    }
  }

  return lines.join("\n");
}
