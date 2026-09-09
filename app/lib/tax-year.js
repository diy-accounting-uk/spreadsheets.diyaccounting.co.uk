// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// tax-year.js — which app/data/<year>.toml file a date falls in. Shared by
// the package writer (product-workbook.js, which needs the file to apply)
// and the book loader (diya-gl-loader.js, which needs the file to fall back
// to when no --years override names one), so the two never resolve the
// same date to different years.

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
