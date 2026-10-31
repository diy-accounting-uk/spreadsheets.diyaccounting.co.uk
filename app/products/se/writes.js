// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import {
  PAYSLIP_PRINT_CELLS,
  PAYSLIP_PRINT_PERIOD,
  PAYSLIP_PRINT_SHEET,
  monthlyPayrollBlockRow,
  payrollRecordOpened,
  payrollYearStart,
} from "../../lib/payslips-layout.js";
import { periodShiftMonths, shiftMonths } from "../../lib/period-shift.js";
import { writePayslipsEmployee } from "../../lib/product-sheets/payslips.js";
import { writeSalesinvoice } from "../../lib/product-sheets/salesinvoice.js";
import { writeStraddlingPeriod, writeVatRateCell } from "../../lib/product-sheets/vat-chain.js";
import { VAT_RATE, netOfVat, vatRateFor } from "../../lib/product-sheets/vat-rate.js";
import { MONTH_SHEETS, parseDate } from "../../lib/scenario-loader.js";
import { toExcelSerial } from "../../lib/spreadsheet-runner.js";
import { taxYearFileName } from "../../lib/tax-year.js";
import { ACCOUNT_ID_COLUMN } from "../../lib/xlsx-exporter.js";
import {
  ACCOUNTING_PERIOD_END_CELL,
  ACCOUNTING_PERIOD_START_CELL,
  ANNUAL_ADJUSTMENT_CELLS,
  ANNUAL_ALLOWANCE_CELLS,
  BANK_ACCOUNT_FILES,
  BANK_LAYOUTS,
  BASIS_PERIOD_CELLS,
  BUSINESS_DESCRIPTION_CELL,
  DISALLOWABLE_PERCENT_CELLS,
  EXISTING_ASSET_ROWS,
  GOODS_FOR_OWN_USE_CELL,
  HP_AGREEMENT_ROWS,
  MONTH_KEYS,
  NEW_PLANT_ROWS,
  PRIVATE_USE_COLUMN,
  SBA_CLAIM_COLUMNS,
  SBA_CLAIM_ROWS,
  SBA_ENHANCED_MARKER,
  SE_YEAR_END_MONTH,
  SINGLE_ASSET_POOL_MARKER,
  SINGLE_ASSET_POOL_MARKER_COLUMN,
  SPECIAL_RATE_POOL_MARKER,
  SPECIAL_RATE_POOL_MARKER_COLUMN,
  STOCK_CLOSING_COUNT_CELL,
  STOCK_OPENING_COUNT_CELL,
  STRADDLING_PURCHASES_COLUMNS,
  STRADDLING_SALES_COLUMNS,
  VAT_RATE_CELL,
} from "./layout.js";

// A Company book splits its HMRC payments four ways: PAYE under "RP", VAT
// under "RV", CIS under "RC" and corporation tax under "RT". Both Self
// Employed workbooks carry a single "HMRC Payments" column instead
// (Bank.xlsx AA, Cash.xlsx W), analysed under "RP", so a payment coded for
// any of the other three lands in that one column. Receipts keep their own
// letters -- Bank.xlsx has an "HMRC Refunded" column under "RV".
export const SE_HMRC_PAYMENT_CODE = "RP";

export const COMPANY_TAX_PAYMENT_CODES = new Set(["RV", "RC", "RT"]);

export function paymentCodeFor(code) {
  return COMPANY_TAX_PAYMENT_CODES.has(code) ? SE_HMRC_PAYMENT_CODE : code;
}

// One entry the writer left out of the package, named the way a check names
// its offender: what it was, when, under which code, for how much, and why
// none of the nine workbooks had a cell to hold it.
export function skipped(kind, entry, why) {
  return { kind: kind, date: entry.date, code: entry.code, amount: entry.amount, why: why };
}

// Every cell the writer puts in the package, and everything it left out, in
// one pass. targetStartYear is the year the package's tax year opens in,
// which for a 5 April year end is the year before the one its directory
// names.
export function composeWrites(scenario, targetStartYear) {
  const skips = [];
  const rate = vatRateFor(scenario);
  const salesWrites = {};
  const purchasesWrites = {};
  const bankWrites = {};
  const cashWrites = {};

  const monthOffset = targetStartYear ? periodShiftMonths(scenario, targetStartYear, SE_YEAR_END_MONTH) : 0;
  const shiftDate = (d) => shiftMonths(d, monthOffset);

  if (scenario.sales) {
    for (const [monthKey, transactions] of Object.entries(scenario.sales)) {
      const sheetName = MONTH_SHEETS[monthKey];
      if (!salesWrites[sheetName]) salesWrites[sheetName] = {};
      const sheet = salesWrites[sheetName];

      let row = 5;
      for (const tx of transactions) {
        const d = shiftDate(parseDate(tx.date));
        sheet[`A${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        if (tx.customer) sheet[`B${row}`] = tx.customer;
        if (tx.reference) sheet[`C${row}`] = tx.reference;
        // Column D is the day's sales mileage (SalesApr!D1 = SUM(D5:D300)).
        // PurchasesApr!C2 pools it into the running mileage total alongside
        // that sheet's own D-column entries (=0+D1+[1]Apr!$D$1), and G2
        // bands the total at the Admin mileage rates and files the claim
        // under Motor Expenses (F2="v"). Unlike a Purchases mileage-log row,
        // a sales day's miles sit beside a real sale, so the amount is
        // written as well -- this is not an either/or the way a bought
        // purchase and a mileage claim are. E is "Sales Description", a free
        // column the sheet keeps beside it, for the same field the purchases
        // sheet already carries at its own E.
        if (tx.mileage) sheet[`D${row}`] = tx.mileage;
        if (tx.description) sheet[`E${row}`] = tx.description;
        sheet[`F${row}`] = tx.code || "a";
        sheet[`G${row}`] = tx.amount;
        // W is the sheet's "Sub contractors only / CIS Tax Deducted" column,
        // where a sub-contractor records the tax its contractor customer
        // withheld from this invoice. W1 totals the month and X1 runs the
        // year to date, which is what Income Tax!E12 and SE Full!D231 read.
        // The column sits outside the month's own analysis check total (A1 =
        // G1 - H1 - SUM(P1:V1)), so recording it leaves that check nil.
        if (tx.cis_deduction) sheet[`W${row}`] = tx.cis_deduction;
        if (tx.account) sheet[`${ACCOUNT_ID_COLUMN}${row}`] = tx.account;
        row++;
      }
    }
  }

  if (scenario.purchases) {
    for (const [monthKey, transactions] of Object.entries(scenario.purchases)) {
      const sheetName = MONTH_SHEETS[monthKey];
      if (!purchasesWrites[sheetName]) purchasesWrites[sheetName] = {};
      const sheet = purchasesWrites[sheetName];

      let row = 5;
      for (const tx of transactions) {
        const d = shiftDate(parseDate(tx.date));
        sheet[`A${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        if (tx.supplier) sheet[`B${row}`] = tx.supplier;
        if (tx.reference) sheet[`C${row}`] = tx.reference;
        // A mileage-log entry buys nothing: its whole expense is the claim the
        // approved rates make of the miles, and the sheet makes that claim
        // itself. Column D takes them (PurchasesApr!D1 = SUM(D5:D300), pooled
        // with the Sales sheet's own mileage total into the running total at
        // C2, banded at the Admin rates in G2 and filed under Motor Expenses
        // through W2 = IF(F2="v",I2," ")), so writing the amount in column G
        // as well would charge the same journey twice.
        if (tx.mileage) sheet[`D${row}`] = tx.mileage;
        if (tx.description) sheet[`E${row}`] = tx.description;
        sheet[`F${row}`] = tx.code;
        if (!tx.mileage) sheet[`G${row}`] = tx.amount;
        // AD is the sheet's "CIS Certificates / Tax Paid" column, where a
        // contractor records the tax it withheld from a subcontractor's
        // invoice. It sits outside the month's own analysis check total, so
        // recording it leaves the row's expense analysis where it was.
        // Written after G and before the account column, because a write can
        // only run left to right (see the Schedule writer below).
        if (tx.cis_deduction) sheet[`AD${row}`] = tx.cis_deduction;
        if (tx.account) sheet[`${ACCOUNT_ID_COLUMN}${row}`] = tx.account;
        row++;
      }
    }
  }

  // A business that is not registered for VAT turns the rate off on April's
  // Sales tab, and the rest of the book follows that cell.
  if (rate !== VAT_RATE) {
    const firstTab = MONTH_SHEETS.apr;
    writeVatRateCell(salesWrites, firstTab, VAT_RATE_CELL, rate);
  }

  // Bank and Cash entries — routed to a workbook by account, then to the
  // receipt or payment block by the entry's own explicit direction (a code
  // letter alone cannot say which side a line belongs on -- see
  // BANK_LAYOUTS above).
  if (scenario.bank) {
    // Track receipt row and payment row per month per file
    const receiptRows = {};
    const paymentRows = {};

    for (const [monthKey, transactions] of Object.entries(scenario.bank)) {
      const sheetName = MONTH_SHEETS[monthKey];

      for (const tx of transactions) {
        const acct = tx.account || "1200";
        const fileName = BANK_ACCOUNT_FILES[acct];
        if (!fileName) {
          skips.push(skipped("bank", tx, `no workbook in the package keeps account "${acct}"`));
          continue;
        }
        const targetWrites = fileName === "Cash.xlsx" ? cashWrites : bankWrites;
        if (!targetWrites[sheetName]) targetWrites[sheetName] = {};
        const sheet = targetWrites[sheetName];

        if (tx.code === "BC") {
          // Opening balance goes in A1, not a receipt row.
          sheet.A1 = tx.amount;
          continue;
        }

        if (tx.direction !== "in" && tx.direction !== "out") {
          skips.push(skipped("bank", tx, "the entry is neither a receipt nor a payment"));
          continue;
        }
        const layout = BANK_LAYOUTS[fileName];
        const isReceipt = tx.direction === "in";
        const block = isReceipt ? layout.receipt : layout.payment;
        const analysedCodes = isReceipt ? layout.receiptCodes : layout.paymentCodes;
        const code = isReceipt ? tx.code : paymentCodeFor(tx.code);
        if (!analysedCodes.has(code)) {
          skips.push(skipped("bank", tx, `${fileName} analyses no ${isReceipt ? "receipt" : "payment"} under this code`));
          continue;
        }

        const rowKey = `${fileName}:${sheetName}`;
        const rows = isReceipt ? receiptRows : paymentRows;
        if (!rows[rowKey]) rows[rowKey] = 6;
        const row = rows[rowKey]++;
        const d = shiftDate(parseDate(tx.date));
        const serial = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        sheet[`${block.date}${row}`] = serial;
        if (tx.source) sheet[`${block.source}${row}`] = tx.source;
        if (tx.reference) sheet[`${block.reference}${row}`] = tx.reference;
        if (tx.description) sheet[`${block.comment}${row}`] = tx.description;
        sheet[`${block.code}${row}`] = code;
        sheet[`${block.amount}${row}`] = tx.amount;
      }
    }
  }

  // Opening/closing debtors — column G is "Sales Value including Vat", the
  // only column the sheet's own G1 total (SUM(G5:G300)) reads. Column D
  // carries no header and no formula anywhere in the workbook.
  if (scenario.opening_debtors) {
    if (!salesWrites.OpeningDebtors) salesWrites.OpeningDebtors = {};
    let row = 5;
    for (const d of scenario.opening_debtors) {
      salesWrites.OpeningDebtors[`B${row}`] = d.customer;
      salesWrites.OpeningDebtors[`C${row}`] = d.invoice;
      salesWrites.OpeningDebtors[`G${row}`] = d.amount;
      row++;
    }
  }

  if (scenario.closing_debtors) {
    if (!salesWrites.ClosingDebtors) salesWrites.ClosingDebtors = {};
    let row = 5;
    for (const d of scenario.closing_debtors) {
      salesWrites.ClosingDebtors[`B${row}`] = d.customer;
      salesWrites.ClosingDebtors[`C${row}`] = d.invoice;
      salesWrites.ClosingDebtors[`G${row}`] = d.amount;
      row++;
    }
  }

  // Opening/closing creditors — column G is "Total Purchase Value incl Vat",
  // the column the sheet's own G1 total (SUM(G5:G300)) reads.
  if (scenario.opening_creditors) {
    if (!purchasesWrites.OpeningCreditors) purchasesWrites.OpeningCreditors = {};
    let row = 5;
    for (const c of scenario.opening_creditors) {
      purchasesWrites.OpeningCreditors[`B${row}`] = c.supplier;
      purchasesWrites.OpeningCreditors[`C${row}`] = c.invoice;
      purchasesWrites.OpeningCreditors[`G${row}`] = c.amount;
      row++;
    }
  }

  if (scenario.closing_creditors) {
    if (!purchasesWrites.ClosingCreditors) purchasesWrites.ClosingCreditors = {};
    let row = 5;
    for (const c of scenario.closing_creditors) {
      purchasesWrites.ClosingCreditors[`B${row}`] = c.supplier;
      purchasesWrites.ClosingCreditors[`C${row}`] = c.invoice;
      purchasesWrites.ClosingCreditors[`G${row}`] = c.amount;
      row++;
    }
  }

  // Business Details (in Financialaccounts.xlsx hub)
  const hubWrites = {};

  // Stock (StockControl). The sheet takes a physical count against each month
  // end, row 6 for the year's opening through row 30 for its close, and the
  // P&L's materials line takes each month's count off the month before it
  // (C14 = Apr purchases + AB6 - AB8, D14 = May purchases + AB8 - AB10, ...).
  // The twelve months therefore telescope to AB6 - AB30 whatever is entered
  // between them, so the two ends of the year are the whole of the year's
  // stock movement. Without them the movement never reaches cost of sales.
  if (scenario.stock) {
    hubWrites.StockControl = {};
    if (scenario.stock.opening !== undefined) hubWrites.StockControl[STOCK_OPENING_COUNT_CELL] = scenario.stock.opening;
    if (scenario.stock.closing !== undefined) hubWrites.StockControl[STOCK_CLOSING_COUNT_CELL] = scenario.stock.closing;
  }
  // VitalTax's disallowable percentages: a book setting per category, not a
  // transaction, so nothing here moves the trial balance.
  if (scenario.disallowable) {
    hubWrites.VitalTax = {};
    for (const [key, cell] of Object.entries(DISALLOWABLE_PERCENT_CELLS)) {
      if (scenario.disallowable[key] !== undefined) hubWrites.VitalTax[cell] = scenario.disallowable[key];
    }
  }
  if (scenario.business || scenario.metadata) {
    hubWrites["Business Details"] = {};
    const bd = hubWrites["Business Details"];
    const biz = scenario.business || {};
    bd.C5 = biz.name || scenario.metadata?.name || "";
    // The SA103F front page runs label then entry down column C: C16 heads
    // "Description of business" and C17:J17 is the merged box under it, in
    // the same entry style C5 carries.
    if (biz.description) bd[BUSINESS_DESCRIPTION_CELL] = biz.description;
  }
  // The annual SA103F figures the trader states rather than the books
  // compute. Each lands on the box the return prints for it; the sheet's own
  // totals (boxes 57, 61, 63 and 77) carry it from there.
  const ownUse = scenario.annual_adjustments?.goodsAndServicesOwnUse;
  if (ownUse !== undefined) {
    hubWrites["Business Details"] = hubWrites["Business Details"] || {};
    hubWrites["Business Details"][GOODS_FOR_OWN_USE_CELL] = ownUse;
  }
  for (const [figures, cells] of [
    [scenario.annual_allowances, ANNUAL_ALLOWANCE_CELLS],
    [scenario.annual_adjustments, ANNUAL_ADJUSTMENT_CELLS],
  ]) {
    for (const [field, cell] of Object.entries(cells)) {
      if (figures?.[field] === undefined) continue;
      hubWrites["SE Full"] = hubWrites["SE Full"] || {};
      hubWrites["SE Full"][cell] = figures[field];
    }
  }
  // The basis period record (boxes 68, 69 and 73.3): stated figures, each
  // on its own Business Details cell.
  if (scenario.basis_period) {
    hubWrites["Business Details"] = hubWrites["Business Details"] || {};
    for (const [field, cell] of Object.entries(BASIS_PERIOD_CELLS)) {
      if (scenario.basis_period[field] === undefined) continue;
      hubWrites["Business Details"][cell] = scenario.basis_period[field];
    }
  }
  // Boxes 8 and 9: the book's own accounting period, moved forward by whole
  // years only -- the gap between the package's own start year and the
  // year the book's period would open in on its own, never the month-level
  // shift that moves postings onto the package's April-March tab grid.
  if (targetStartYear && scenario.period_covered_start && scenario.period_covered_end) {
    const periodEnd = parseDate(scenario.period_covered_end);
    const naturalStartYear = parseInt(taxYearFileName(periodEnd, "se").split("-")[1], 10);
    const yearShift = targetStartYear - naturalStartYear;
    const shiftYears = (d) => shiftMonths(d, yearShift * 12);
    const periodStart = shiftYears(parseDate(scenario.period_covered_start));
    const periodEndShifted = shiftYears(periodEnd);
    hubWrites["Business Details"] = hubWrites["Business Details"] || {};
    hubWrites["Business Details"][ACCOUNTING_PERIOD_START_CELL] = toExcelSerial(
      periodStart.getUTCFullYear(),
      periodStart.getUTCMonth() + 1,
      periodStart.getUTCDate(),
    );
    hubWrites["Business Details"][ACCOUNTING_PERIOD_END_CELL] = toExcelSerial(
      periodEndShifted.getUTCFullYear(),
      periodEndShifted.getUTCMonth() + 1,
      periodEndShifted.getUTCDate(),
    );
  }

  // Payslips.xlsx employee details
  const payslipsWrites = {};
  if (scenario.employees) {
    const payrollStart = targetStartYear ? payrollYearStart(targetStartYear) : null;
    const payrollOpened = payrollRecordOpened(scenario.payroll, parseDate);
    payslipsWrites.Employee = writePayslipsEmployee(scenario, { payrollStart, payrollOpened, shiftDate });
  }

  // Payslips.xlsx monthly payroll data, on the month tab's own monthly block.
  if (scenario.payroll) {
    for (const [monthKey, entries] of Object.entries(scenario.payroll)) {
      const sheetName = MONTH_SHEETS[monthKey];
      if (!sheetName) continue;
      if (!payslipsWrites[sheetName]) payslipsWrites[sheetName] = {};
      const sheet = payslipsWrites[sheetName];
      const blockRow = monthlyPayrollBlockRow(MONTH_KEYS.indexOf(monthKey));
      // Write wages paid date from first entry
      if (entries.length > 0) {
        const d = shiftDate(parseDate(entries[0].date));
        sheet[`M${blockRow + 1}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      }
      for (let i = 0; i < Math.min(entries.length, 5); i++) {
        const row = blockRow + 3 + i;
        const e = entries[i];
        if (e.name) sheet[`F${row}`] = e.name;
        // Column D is the block's own "Tax Code" column, headed in D3 and
        // read by no formula, so the code the employee is taxed under
        // reaches the payslip it belongs on.
        if (e.taxCode) sheet[`D${row}`] = e.taxCode;
        sheet[`M${row}`] = e.grossPay;
        sheet[`N${row}`] = e.incomeTax;
        sheet[`O${row}`] = e.employeeNI;
        sheet[`R${row}`] = e.netPay;
        // Column S is a blank spacer in the template (self-closing, no
        // formula, never summed) -- the payslip's own reference goes there,
        // since nothing else on the row reads it; column T is the real
        // employer-NI data entry cell -- the block's own total row sums it
        // into T1, which Wagesinterface!H reads. Verified against the
        // template.
        if (e.reference) sheet[`S${row}`] = e.reference;
        sheet[`T${row}`] = e.employerNI;
        if (e.accountMainID) sheet[`${ACCOUNT_ID_COLUMN}${row}`] = e.accountMainID;
      }
    }
    payslipsWrites[PAYSLIP_PRINT_SHEET] = {
      [PAYSLIP_PRINT_CELLS.frequency]: "M",
      [PAYSLIP_PRINT_CELLS.period]: PAYSLIP_PRINT_PERIOD,
    };
  }

  const fixedAssetsWrites = {};
  const existingAssetRowsUsed = { motor: [], computer: [] };

  if (scenario.opening_fixed_assets) {
    fixedAssetsWrites.Schedule = {};
    const fa = fixedAssetsWrites.Schedule;
    const nextRow = { motor: 0, computer: 0 };
    for (const asset of scenario.opening_fixed_assets) {
      const rows = EXISTING_ASSET_ROWS[asset.category];
      const assetEntry = { code: asset.category, amount: asset.cost };
      if (!rows) {
        skips.push(skipped("openingFixedAsset", assetEntry, "the Schedule carries no block for this asset category"));
        continue;
      }
      const row = rows[nextRow[asset.category]++];
      if (row === undefined) {
        const why = `the Schedule's ${asset.category} block holds ${rows.length} assets brought forward`;
        skips.push(skipped("openingFixedAsset", assetEntry, why));
        continue;
      }
      // Written left-to-right (C, E, F, M, O, AB, AD). setCellValue/setCellString
      // in spreadsheet-runner.js replaces a matched cell together with every
      // self-closing sibling up to the row's next already-closed cell -- an
      // earlier write onto a later (rightward) column silently deletes any
      // not-yet-written cell in between, template formula cells included.
      // Once a cell has been written it is properly closed, so writing
      // strictly left-to-right, ending on the row's rightmost written
      // column, is the only order that survives every scenario the SE
      // template's row layout throws at it.
      if (asset.description) fa[`C${row}`] = asset.description;
      fa[`E${row}`] = asset.cost;
      if (asset.acc_dep) fa[`F${row}`] = asset.acc_dep;
      // The private use share reads on the car rows alone; the loader has
      // already refused it on any other class.
      if (asset.private_use !== undefined && asset.category === "motor") fa[`${PRIVATE_USE_COLUMN}${row}`] = asset.private_use;
      // Column O is the written down TAX value brought forward, the figure
      // the capital allowance columns work from. The schedule computes a
      // disposal's balancing allowance as that value less the sale proceeds,
      // so an asset sold in the year without one leaves the whole capital
      // allowance block, and every figure downstream of it, in error.
      if (asset.tax_wdv) fa[`O${row}`] = asset.tax_wdv;
      if (asset.pool === "special") fa[`${SPECIAL_RATE_POOL_MARKER_COLUMN}${row}`] = SPECIAL_RATE_POOL_MARKER;
      if (asset.single_asset_pool) fa[`${SINGLE_ASSET_POOL_MARKER_COLUMN}${row}`] = SINGLE_ASSET_POOL_MARKER;
      existingAssetRowsUsed[asset.category].push(row);
    }
  }

  // New fixed asset purchases (Purchases.xlsx code "fa") all land on the
  // New Plant & Machinery rows. FAreconciliation only checks the aggregate
  // New-asset total against Purchases.xlsx's cumulative fa total, not which
  // category holds it, so any category is a faithful, provable tie-out
  // target without inventing an asset-class taxonomy the scenario data
  // doesn't carry.
  const faPurchases = [];
  if (scenario.purchases) {
    for (const transactions of Object.values(scenario.purchases)) {
      for (const tx of transactions) if (tx.code === "fa") faPurchases.push(tx);
    }
  }
  if (faPurchases.length > 0) {
    if (!fixedAssetsWrites.Schedule) fixedAssetsWrites.Schedule = {};
    const fa = fixedAssetsWrites.Schedule;
    for (const tx of faPurchases.slice(NEW_PLANT_ROWS.length)) {
      skips.push(skipped("assetPurchase", tx, `the Schedule holds ${NEW_PLANT_ROWS.length} assets bought during the year`));
    }
    faPurchases.slice(0, NEW_PLANT_ROWS.length).forEach((tx, i) => {
      const row = NEW_PLANT_ROWS[i];
      const d = shiftDate(parseDate(tx.date));
      // Left-to-right column order (B, then C, then E) -- see the opening
      // asset writer above for why the order matters.
      fa[`B${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      if (tx.supplier) fa[`C${row}`] = tx.supplier;
      fa[`E${row}`] = netOfVat(tx.amount, rate);
    });
  }

  // Fixed asset disposals (Sales.xlsx code "fs") pair with the existing
  // asset row they disposed of, in declaration order -- the sale value
  // (net of VAT) lands on the same row as the asset's original cost so the
  // Schedule's own disposal formulas (cost and depreciation at disposal)
  // resolve against the right asset.
  const fsDisposals = [];
  if (scenario.sales) {
    for (const transactions of Object.values(scenario.sales)) {
      for (const tx of transactions) if (tx.code === "fs") fsDisposals.push(tx);
    }
  }
  if (fsDisposals.length > 0) {
    if (!fixedAssetsWrites.Schedule) fixedAssetsWrites.Schedule = {};
    const fa = fixedAssetsWrites.Schedule;
    const disposalRows = [...existingAssetRowsUsed.motor, ...existingAssetRowsUsed.computer];
    for (const tx of fsDisposals.slice(disposalRows.length)) {
      const why = `${disposalRows.length} asset(s) brought forward have a row for a disposal to be written on`;
      skips.push(skipped("assetDisposal", tx, why));
    }
    fsDisposals.slice(0, disposalRows.length).forEach((tx, i) => {
      const row = disposalRows[i];
      const d = shiftDate(parseDate(tx.date));
      fa[`U${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      fa[`V${row}`] = netOfVat(tx.amount, rate);
    });
  }

  // Structures and Buildings Allowance claims (SA103F boxes 53 and 53.1).
  if (scenario.sba_claims) {
    if (!fixedAssetsWrites.Schedule) fixedAssetsWrites.Schedule = {};
    const fa = fixedAssetsWrites.Schedule;
    for (const claim of scenario.sba_claims.slice(SBA_CLAIM_ROWS.length)) {
      skips.push(
        skipped(
          "structuresBuildingsAllowanceClaim",
          { date: claim.qualifyingDate, code: claim.enhanced ? "enhanced" : "standard", amount: claim.qualifyingAmountExpenditure },
          `the Schedule holds ${SBA_CLAIM_ROWS.length} Structures and Buildings Allowance claims`,
        ),
      );
    }
    scenario.sba_claims.slice(0, SBA_CLAIM_ROWS.length).forEach((claim, i) => {
      const row = SBA_CLAIM_ROWS[i];
      const qualifyingDate = shiftDate(parseDate(claim.qualifyingDate));
      // Left to right: B, C, D, E, F, G, I -- see the opening asset writer
      // above for why the order matters. H and J are the sheet's formulas.
      fa[`${SBA_CLAIM_COLUMNS.qualifyingDate}${row}`] = toExcelSerial(
        qualifyingDate.getUTCFullYear(),
        qualifyingDate.getUTCMonth() + 1,
        qualifyingDate.getUTCDate(),
      );
      if (claim.building?.name) fa[`${SBA_CLAIM_COLUMNS.name}${row}`] = claim.building.name;
      if (claim.building?.number) fa[`${SBA_CLAIM_COLUMNS.number}${row}`] = claim.building.number;
      fa[`${SBA_CLAIM_COLUMNS.qualifyingAmountExpenditure}${row}`] = claim.qualifyingAmountExpenditure;
      fa[`${SBA_CLAIM_COLUMNS.postcode}${row}`] = claim.building.postcode;
      if (claim.enhanced) fa[`${SBA_CLAIM_COLUMNS.enhanced}${row}`] = SBA_ENHANCED_MARKER;
      if (claim.ceasedDate) {
        const ceasedDate = shiftDate(parseDate(claim.ceasedDate));
        fa[`${SBA_CLAIM_COLUMNS.ceasedDate}${row}`] = toExcelSerial(
          ceasedDate.getUTCFullYear(),
          ceasedDate.getUTCMonth() + 1,
          ceasedDate.getUTCDate(),
        );
      }
    });
  }

  if (scenario.hp_agreements) {
    if (!fixedAssetsWrites.HPfinance) fixedAssetsWrites.HPfinance = {};
    const hp = fixedAssetsWrites.HPfinance;
    for (const agreement of scenario.hp_agreements.slice(HP_AGREEMENT_ROWS.length)) {
      const entry = { date: agreement.date, code: agreement.reference, amount: agreement.amount_financed };
      skips.push(skipped("hpAgreement", entry, `the HPfinance sheet carries ${HP_AGREEMENT_ROWS.length} rows for agreements`));
    }
    scenario.hp_agreements.slice(0, HP_AGREEMENT_ROWS.length).forEach((agreement, i) => {
      const row = HP_AGREEMENT_ROWS[i];
      const d = shiftDate(parseDate(agreement.date));
      hp[`B${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      hp[`C${row}`] = agreement.finance_company;
      hp[`D${row}`] = agreement.reference;
      hp[`E${row}`] = agreement.amount_financed;
      hp[`F${row}`] = agreement.admin_charges;
      hp[`G${row}`] = agreement.total_interest;
      hp[`H${row}`] = agreement.months;
      hp[`L${row}`] = agreement.supplier;
    });
  }

  // Straddling VAT periods (Vat.xlsx). A business registered for VAT on a
  // cycle that does not line up with its accounting year still has to return
  // the periods either side of it, and the workbook keeps a sales and a
  // purchases entry sheet for each. Nothing on these sheets reaches
  // Financialaccounts -- Vat.xlsx reads the hub and the two journals, never
  // the other way -- so an entry here moves the VAT return and leaves the
  // books alone.
  //
  // The purchases sheets carry a completeness warning in B2 that compares the
  // net total against expense analysis columns P:AL. Those columns exist on
  // the twelve month tabs but not on these sheets, so the warning fires for
  // any entry at all. Nothing reads it, so it is left unasserted.
  const vatReturnWrites = {};
  const straddlingOptions = { workbook: "Vat.xlsx", shiftDate };
  if (scenario.vat_straddling_sales)
    writeStraddlingPeriod(vatReturnWrites, scenario.vat_straddling_sales, "S", "customer", STRADDLING_SALES_COLUMNS, straddlingOptions);
  if (scenario.vat_straddling_purchases)
    writeStraddlingPeriod(
      vatReturnWrites,
      scenario.vat_straddling_purchases,
      "P",
      "supplier",
      STRADDLING_PURCHASES_COLUMNS,
      straddlingOptions,
    );

  const salesinvoiceWrites = writeSalesinvoice(scenario, rate);

  const result = {
    "Sales.xlsx": salesWrites,
    "Purchases.xlsx": purchasesWrites,
  };
  if (Object.keys(vatReturnWrites).length > 0) result["Vat.xlsx"] = vatReturnWrites;
  if (Object.keys(bankWrites).length > 0) result["Bank.xlsx"] = bankWrites;
  if (Object.keys(cashWrites).length > 0) result["Cash.xlsx"] = cashWrites;
  if (Object.keys(hubWrites).length > 0) result["Financialaccounts.xlsx"] = hubWrites;
  if (Object.keys(payslipsWrites).length > 0) result["Payslips.xlsx"] = payslipsWrites;
  if (Object.keys(fixedAssetsWrites).length > 0) result["Fixedassets.xlsx"] = fixedAssetsWrites;
  if (Object.keys(salesinvoiceWrites).length > 0) result["Salesinvoice.xlsx"] = salesinvoiceWrites;
  return { writes: result, skips: skips };
}

/**
 * The cells the package's workbooks carry, keyed file, then sheet, then cell.
 *
 * @param {Object} scenario - the scenario diyaGlToScenario builds from a book
 * @param {number} [targetStartYear] - the year the package's tax year opens in
 * @returns {Object}
 */
export function cellWrites(scenario, targetStartYear) {
  return composeWrites(scenario, targetStartYear).writes;
}

/**
 * What a save would leave out of the package: an entry none of the nine
 * workbooks has a cell for. A save never stops half way through, so each of
 * these is dropped and named here. The book checks report the same
 * conditions before a save is offered, so this is the second net, not the
 * first.
 *
 * @param {Object} scenario - the scenario diyaGlToScenario builds from a book
 * @returns {Array<{kind: string, date: string, code: string, amount: number, why: string}>}
 */
export function writerSkips(scenario) {
  return composeWrites(scenario).skips;
}
