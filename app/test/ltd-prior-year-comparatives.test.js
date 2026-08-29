// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// Proves the Financialaccounts prior year column both ways. The
// "PREVIOUS YEAR PROFIT & LOSS ACCOUNT" block on OpenAccounts (rows 43 to 85)
// is typed in by the reader, apart from E48 ("Less Closing Stock"), which the
// template fills for them: last year closed on whatever this year opened
// with. A book with nothing in the block has to publish an empty prior year
// column; a book with comparatives has to publish them, closing stock
// included.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { runSpreadsheet, hasLibreOffice } from "../lib/spreadsheet-runner.js";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const HUB = resolve(__dirname, "..", "templates", "ltd", "Financialaccounts.xlsx");

const OPENING_STOCK_CELL = "E15";
const PRIOR_YEAR_CELLS = { turnover: "E43", openingStock: "E46", purchases: "E47", closingStock: "E48" };
const PUBLISHED_PRIOR_YEAR = { turnover: "B9", closingStock: "A14", stockMovement: "B14", costOfSales: "B16", grossProfit: "B18" };

const OPENING_STOCK = 10000;

// The hub reads its siblings over external links whose caches ship at zero.
// Nothing in the prior year column comes from those links, so recalculating
// this one workbook on its own settles every cell under test.
async function publishedPriorYear(openAccountsWrites) {
  const reads = {
    OpenAccounts: Object.values(PRIOR_YEAR_CELLS),
    "PubP&L": Object.values(PUBLISHED_PRIOR_YEAR),
  };
  return runSpreadsheet(readFileSync(HUB), { OpenAccounts: openAccountsWrites }, reads);
}

describeCalc(
  "Limited Company: the published prior year column",
  () => {
    let noComparatives;
    let withComparatives;

    beforeAll(async () => {
      noComparatives = await publishedPriorYear({ [OPENING_STOCK_CELL]: OPENING_STOCK });
      withComparatives = await publishedPriorYear({
        [OPENING_STOCK_CELL]: OPENING_STOCK,
        [PRIOR_YEAR_CELLS.turnover]: 200000,
        [PRIOR_YEAR_CELLS.openingStock]: 4000,
        [PRIOR_YEAR_CELLS.purchases]: 60000,
      });
    }, 300000);

    it("publishes nothing for a year the reader entered no comparatives for", () => {
      expect(noComparatives.OpenAccounts[PRIOR_YEAR_CELLS.closingStock]).toBe(0);
      expect(noComparatives["PubP&L"][PUBLISHED_PRIOR_YEAR.turnover]).toBe(0);
      expect(noComparatives["PubP&L"][PUBLISHED_PRIOR_YEAR.stockMovement]).toBe(0);
      expect(noComparatives["PubP&L"][PUBLISHED_PRIOR_YEAR.costOfSales]).toBe(0);
      expect(noComparatives["PubP&L"][PUBLISHED_PRIOR_YEAR.grossProfit]).toBe(0);
    });

    it("closes last year on this year's opening stock once comparatives are entered", () => {
      expect(withComparatives.OpenAccounts[PRIOR_YEAR_CELLS.closingStock]).toBe(OPENING_STOCK);
      expect(withComparatives["PubP&L"][PUBLISHED_PRIOR_YEAR.closingStock]).toBe(OPENING_STOCK);
    });

    it("publishes the comparatives the reader entered", () => {
      const publishedPL = withComparatives["PubP&L"];
      expect(publishedPL[PUBLISHED_PRIOR_YEAR.turnover]).toBe(200000);
      // Opening stock plus purchases less the closing stock carried into
      // this year: 4,000 + 60,000 - 10,000.
      expect(publishedPL[PUBLISHED_PRIOR_YEAR.stockMovement]).toBe(54000);
      expect(publishedPL[PUBLISHED_PRIOR_YEAR.costOfSales]).toBe(54000);
      expect(publishedPL[PUBLISHED_PRIOR_YEAR.grossProfit]).toBe(146000);
    });
  },
  300000,
);
