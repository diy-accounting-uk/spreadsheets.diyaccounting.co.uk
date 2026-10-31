// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import {
  BANK_ACCOUNT_FILES,
  BANK_LAYOUTS,
  OPENING_FIXED_ASSET_COLUMNS,
  isLtdOpeningBankLine,
  ltdBankPlacement,
} from "../../lib/ltd-layout.js";
import {
  PAYROLL_WEEKS_PER_MONTH,
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
import { parseDate, registerOfficers } from "../../lib/scenario-loader.js";
import { toExcelSerial } from "../../lib/spreadsheet-runner.js";
import { ACCOUNT_ID_COLUMN } from "../../lib/xlsx-exporter.js";
import {
  BOARD_MINUTE_CELLS,
  CHARGE_REGISTER_COLUMNS,
  CHARGE_REGISTER_ROWS,
  DIRECTORS_INTERESTS_COLUMNS,
  DIRECTORS_INTERESTS_ROWS,
  DIRECTOR_SECRETARY_COLUMNS,
  DIRECTOR_SECRETARY_OFFICER_ROWS,
  FIXED_ASSET_BANDS,
  OPENACCOUNTS_FRANKED_INVESTMENT_INCOME_CELL,
  OPENING_BALANCE_CELLS,
  OPENING_BANK_COLUMNS,
  OPENING_TAX_COLUMNS,
  PAYROLL_FIRST_WEEK_DAYS,
  PAYSLIPS_CALENDAR_FIRST_ROW,
  REGISTER_MEMBER_COLUMNS,
  REGISTER_MEMBER_ROWS,
  SCHEDULE_ASSET_CLASSES,
  SCHEDULE_NEW_ASSET_ROWS,
  SHORT_MONTHS,
  STOCK_FINAL_COUNT_CELL,
  STOCK_MATERIALS_PERCENT_CELL,
  STRADDLING_COLUMNS,
  VAT_RATE_CELL,
} from "./layout.js";

export function getMonthTabNames(yearEndMonth) {
  const tabs = [];
  for (let i = 0; i < 12; i++) {
    tabs.push(SHORT_MONTHS[(yearEndMonth + i) % 12]);
  }
  return tabs;
}

// The calendar year the payroll year opens in, from the accounting period's
// own year end alone -- the same fallback app/lib/calculators/ltd.js's
// payrollYearOf() uses when taxData carries no financial_year: the year
// before the year end's calendar year, unless the year end falls in January
// to March, when the payroll year already opened the April before that year.
export function payrollYearFromAccountingYearEnd(yearEndDate) {
  const targetStartYear = yearEndDate.getUTCFullYear() - 1;
  const yearEndMonth = yearEndDate.getUTCMonth() + 1;
  return yearEndMonth <= 3 ? targetStartYear : targetStartYear + 1;
}

// The row, tax week and day offset from B2 that each payroll month opens on.
export function payrollMonthStarts() {
  const starts = [];
  let weeksBefore = 0;
  for (let month = 1; month <= 12; month++) {
    const daysBefore = weeksBefore === 0 ? 0 : PAYROLL_FIRST_WEEK_DAYS + (weeksBefore - 1) * 7;
    starts.push({ month, row: PAYSLIPS_CALENDAR_FIRST_ROW + daysBefore, daysBefore, week: weeksBefore + 1 });
    weeksBefore += PAYROLL_WEEKS_PER_MONTH[month - 1];
  }
  return starts;
}

// spreadsheet-runner writes a cell by rewriting its XML in place, and when
// the target is an empty self-closing cell that rewrite also swallows every
// cell after it up to the next one that carries a value. On OpenAccounts the
// whole input grid is empty self-closing cells, so a write can drop the ones
// to its right. Ordering the writes left to right, top to bottom means every
// dropped cell is re-created by a later write.
export function inSheetOrder(cells) {
  const position = (ref) => {
    const [, column, row] = /^([A-Z]+)(\d+)$/.exec(ref);
    let columnNumber = 0;
    for (const letter of column) columnNumber = columnNumber * 26 + letter.charCodeAt(0) - 64;
    return [Number(row), columnNumber];
  };
  return Object.fromEntries(
    Object.entries(cells).sort(([a], [b]) => {
      const [rowA, columnA] = position(a);
      const [rowB, columnB] = position(b);
      return rowA - rowB || columnA - columnB;
    }),
  );
}

export function writeOpeningBalance(sheet, openingBalance) {
  for (const key of Object.keys(openingBalance)) {
    if (FIXED_ASSET_BANDS.includes(key)) continue;
    if (!OPENING_BALANCE_CELLS[key] && !OPENING_BANK_COLUMNS[key] && !OPENING_TAX_COLUMNS[key]) {
      throw new Error(`Opening balance "${key}" has no row on the opening balance sheet`);
    }
  }

  for (const [key, cell] of Object.entries(OPENING_BALANCE_CELLS)) {
    if (openingBalance[key] !== undefined) sheet[cell] = openingBalance[key];
  }

  const cost = openingBalance.fixed_asset_cost || {};
  const depreciation = openingBalance.fixed_asset_depreciation || {};
  for (const assetClass of [...Object.keys(cost), ...Object.keys(depreciation)]) {
    if (!OPENING_FIXED_ASSET_COLUMNS[assetClass]) {
      throw new Error(`Opening fixed assets name asset class "${assetClass}", which the opening balance sheet has no column for`);
    }
  }
  let totalCost = 0;
  let totalDepreciation = 0;
  for (const [assetClass, columns] of Object.entries(OPENING_FIXED_ASSET_COLUMNS)) {
    if (cost[assetClass] !== undefined) {
      sheet[`${columns.cost}13`] = cost[assetClass];
      totalCost += cost[assetClass];
    }
    if (depreciation[assetClass] !== undefined) {
      sheet[`${columns.depreciation}13`] = depreciation[assetClass];
      totalDepreciation += depreciation[assetClass];
    }
  }
  if (totalCost !== 0 || totalDepreciation !== 0) sheet.E13 = totalCost - totalDepreciation;

  let bankTotal = 0;
  let bankPosted = false;
  for (const [key, column] of Object.entries(OPENING_BANK_COLUMNS)) {
    if (openingBalance[key] === undefined) continue;
    sheet[`${column}18`] = openingBalance[key];
    bankTotal += openingBalance[key];
    bankPosted = true;
  }
  if (bankPosted) sheet.E18 = bankTotal;

  let taxTotal = 0;
  let taxPosted = false;
  for (const [key, column] of Object.entries(OPENING_TAX_COLUMNS)) {
    if (openingBalance[key] === undefined) continue;
    sheet[`${column}26`] = openingBalance[key];
    taxTotal += openingBalance[key];
    taxPosted = true;
  }
  if (taxPosted) sheet.E26 = taxTotal;
}

export function cellWrites(scenario, targetStartYear, yearEndMonth) {
  const salesWrites = {};
  const purchasesWrites = {};

  // Default to March year-end if not specified
  const yem = yearEndMonth || 3;

  // Dates belong to the accounting period their own scenario covers, and get
  // shifted onto the package's own period, so the twelve months land on the
  // twelve month tabs in order and in the years the package's accounts are
  // drawn up for. A scenario that does not name its period start is in the
  // April-March frame its apr..mar month keys describe.
  const rate = vatRateFor(scenario);

  const targetStartMonth = yem % 12; // month after year-end (0-indexed)
  const monthOffset = periodShiftMonths(scenario, targetStartYear, yem);

  const shiftDate = (d) => shiftMonths(d, monthOffset);

  // The payroll year the package's Payslips calendar opens on. A January to
  // March year end belongs to the financial year that opened the April
  // before it; every other year end belongs to the one that opened this
  // April, which is the same rule that picks the package's tax data.
  const payrollStart = targetStartYear ? payrollYearStart(yem <= 3 ? targetStartYear : targetStartYear + 1) : null;
  const payrollOpened = payrollRecordOpened(scenario.payroll, parseDate);

  // The twelve tabs are the twelve months, whatever the year end, so a shifted
  // date's month names its tab.
  const getTabForDate = (shifted) => SHORT_MONTHS[shifted.getUTCMonth()];

  // Column A holds the entry date and nothing else on the row starts with an
  // A, so the rows already written are the A-keys on the sheet. Matching the
  // whole reference rather than its first letter keeps a write further right
  // (AK, say) out of the count.
  const isDateColumnKey = (key) => /^A\d+$/.test(key);

  function processJournal(entries, writes, nameField, codeDefault, writeExtraColumns) {
    for (const transactions of Object.values(entries)) {
      for (const tx of transactions) {
        const d = parseDate(tx.date);
        const shifted = shiftDate(d);
        const tabName = getTabForDate(shifted);

        if (!writes[tabName]) writes[tabName] = {};
        const sheet = writes[tabName];

        const nextRow = Object.keys(sheet).filter(isDateColumnKey).length + 5;
        sheet[`A${nextRow}`] = toExcelSerial(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
        if (tx[nameField]) sheet[`B${nextRow}`] = tx[nameField];
        if (tx.reference) sheet[`C${nextRow}`] = tx.reference;
        if (tx.description) sheet[`D${nextRow}`] = tx.description;
        sheet[`E${nextRow}`] = tx.code || codeDefault;
        sheet[`F${nextRow}`] = tx.amount;
        if (tx.account) sheet[`${ACCOUNT_ID_COLUMN}${nextRow}`] = tx.account;
        if (writeExtraColumns) writeExtraColumns(sheet, nextRow, tx);
      }
    }
  }

  // A contractor customer withholds tax from this company's own invoice.
  // Column V is the sales journal's CIS column ("Sub contractors only / CIS
  // Tax Deducted", verified against the template: V1 = SUM(V5:V300)).
  // TrialBalance reads V1 twice: row 20 takes it off trade debtors
  // ([3]<Month>!$F$1-[3]<Month>!$V$1) and row 32 gives it back against the
  // CIS creditor ([3]<Month>!$V$1), so the deduction moves from the
  // customer's ledger to HMRC's without either side of the books moving.
  if (scenario.sales) {
    processJournal(scenario.sales, salesWrites, "customer", "a", (sheet, row, tx) => {
      if (tx.cis_deduction) sheet[`V${row}`] = tx.cis_deduction;
    });
  }

  // A purchase from a CIS sub-contractor carries the tax the company withheld
  // from it and pays over to HMRC. Column AK is the journal's CIS
  // certificates column ("Tax Paid", verified against the template: AK1 =
  // SUM(AK5:AK300), the header row reading "Contractors / CIS Certificates").
  // TrialBalance reads AK1 twice: row 32 takes it as the CIS creditor
  // (-[2]<Month>!$AK$1) and row 28 gives it back off trade creditors
  // (-[2]<Month>!$F$1+[2]<Month>!$AK$1), so the withheld tax moves from the
  // sub-contractor's ledger to HMRC's without either side of the books
  // moving.
  if (scenario.purchases) {
    processJournal(scenario.purchases, purchasesWrites, "supplier", "g", (sheet, row, tx) => {
      if (tx.cis_deduction) sheet[`AK${row}`] = tx.cis_deduction;
    });
  }

  // A business that is not registered for VAT turns the rate off on the first
  // month's Sales tab, and the rest of the book follows that cell.
  if (rate !== VAT_RATE) {
    const firstTab = getMonthTabNames(yem)[0];
    writeVatRateCell(salesWrites, firstTab, VAT_RATE_CELL, rate);
  }

  // Business Details (in Financialaccounts.xlsx hub, OpenAccounts sheet).
  // Column E holds the company's own details, the registered office address
  // sits in J3:J6 with the postcode in N6, and the CT603 tax reference in O3.
  const hubWrites = {};
  if (scenario.business || scenario.metadata) {
    if (!hubWrites.OpenAccounts) hubWrites.OpenAccounts = {};
    const bd = hubWrites.OpenAccounts;
    const biz = scenario.business || {};
    bd.E2 = biz.name || scenario.metadata?.name || "";
    if (biz.company_number) bd.E3 = biz.company_number;
    if (biz.phone) bd.E4 = biz.phone;
    if (biz.description) bd.E8 = biz.description;
    if (biz.address) bd.J3 = biz.address;
    if (biz.town) bd.J4 = biz.town;
    if (biz.postcode) bd.N6 = biz.postcode;
    if (biz.utr) bd.O3 = biz.utr;
    // The exempt distributions received, which the corporation tax
    // computation adds to taxable profits before it tests the marginal relief
    // limits. Written even when it is none, for the same reason Admin P14 is.
    bd[OPENACCOUNTS_FRANKED_INVESTMENT_INCOME_CELL] = biz.franked_investment_income ?? 0;

    const directors = (scenario.employees || []).filter((e) => e.isDirector);
    if (directors[0]?.name) bd.E5 = directors[0].name;
    if (directors[1]?.name) bd.E6 = directors[1].name;

    // The number of companies associated with this one, which divides both
    // marginal relief limits. Written even when it is none: a blank cell and a
    // stated zero mean the same to the sheet's arithmetic, but only the stated
    // zero comes back when the package is read, and the JS engine states it
    // either way. Leaving it blank makes the two halves of the roundtrip
    // disagree about a cell they agree on the value of.
    if (!hubWrites.Admin) hubWrites.Admin = {};
    hubWrites.Admin.P14 = biz.associated_companies ?? 0;
  }

  // Opening balance sheet (OpenAccounts)
  if (scenario.opening_balance) {
    if (!hubWrites.OpenAccounts) hubWrites.OpenAccounts = {};
    writeOpeningBalance(hubWrites.OpenAccounts, scenario.opening_balance);
  }
  if (hubWrites.OpenAccounts) hubWrites.OpenAccounts = inSheetOrder(hubWrites.OpenAccounts);

  // Companysecretary.xlsx: the charges register, the share register and the
  // board minute. Each member row carries the nominal value
  // of a share the scenario states for it.
  const companysecretaryWrites = {};
  if (scenario.charges) {
    companysecretaryWrites["Charges&Debentures"] = {};
    const register = companysecretaryWrites["Charges&Debentures"];
    scenario.charges.forEach((charge, index) => {
      const row = CHARGE_REGISTER_ROWS[index];
      if (row === undefined) return;
      const date = parseDate(charge.date);
      register[`${CHARGE_REGISTER_COLUMNS.date}${row}`] = toExcelSerial(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
      register[`${CHARGE_REGISTER_COLUMNS.asset}${row}`] = charge.asset;
      register[`${CHARGE_REGISTER_COLUMNS.valuation}${row}`] = charge.valuation;
      register[`${CHARGE_REGISTER_COLUMNS.holder}${row}`] = charge.holder;
      register[`${CHARGE_REGISTER_COLUMNS.terms}${row}`] = charge.terms;
      const confirmed = parseDate(charge.board_meeting);
      register[`${CHARGE_REGISTER_COLUMNS.boardMeeting}${row}`] = toExcelSerial(
        confirmed.getUTCFullYear(),
        confirmed.getUTCMonth() + 1,
        confirmed.getUTCDate(),
      );
    });
  }
  if (scenario.members) {
    companysecretaryWrites.RegisterofMembers = {};
    const register = companysecretaryWrites.RegisterofMembers;
    scenario.members.forEach((member, index) => {
      const row = REGISTER_MEMBER_ROWS[index];
      if (row === undefined) return;
      register[`${REGISTER_MEMBER_COLUMNS.name}${row}`] = member.name;
      register[`${REGISTER_MEMBER_COLUMNS.nominalValue}${row}`] = member.nominal_value;
      register[`${REGISTER_MEMBER_COLUMNS.shares}${row}`] = member.shares;
      if (member.acquired) {
        const acquired = parseDate(member.acquired);
        register[`${REGISTER_MEMBER_COLUMNS.acquired}${row}`] = toExcelSerial(
          acquired.getUTCFullYear(),
          acquired.getUTCMonth() + 1,
          acquired.getUTCDate(),
        );
      }
    });
  }

  // Register of directors and secretary, and directors' interests: every
  // officer the book declares, in the order it declares them. A missing
  // entry here is a Companies House problem, not an arithmetic one, so this
  // only ever writes what the scenario actually names.
  const directors = registerOfficers(scenario);
  if (directors.length > 0) {
    const biz = scenario.business || {};
    const officerAddress = [biz.address, biz.town, biz.postcode].filter(Boolean).join(", ") || undefined;

    companysecretaryWrites["Directors&Secretary"] = {};
    const officers = companysecretaryWrites["Directors&Secretary"];
    directors.forEach((director, index) => {
      const row = DIRECTOR_SECRETARY_OFFICER_ROWS[index];
      if (row === undefined) return;
      officers[`${DIRECTOR_SECRETARY_COLUMNS.name}${row}`] = director.name;
      if (officerAddress) officers[`${DIRECTOR_SECRETARY_COLUMNS.address}${row}`] = officerAddress;
      if (director.appointed) {
        const appointed = parseDate(director.appointed);
        officers[`${DIRECTOR_SECRETARY_COLUMNS.appointed}${row}`] = toExcelSerial(
          appointed.getUTCFullYear(),
          appointed.getUTCMonth() + 1,
          appointed.getUTCDate(),
        );
      }
      // The capacity the officer was appointed in, over whichever
      // placeholder the row it lands on happens to carry.
      officers[`${DIRECTOR_SECRETARY_COLUMNS.capacity}${row}`] = director.role || "Director";
    });

    companysecretaryWrites.DirectorsInterests = {};
    const interests = companysecretaryWrites.DirectorsInterests;
    directors.forEach((director, index) => {
      const row = DIRECTORS_INTERESTS_ROWS[index];
      if (row === undefined) return;
      interests[`${DIRECTORS_INTERESTS_COLUMNS.name}${row}`] = director.name;
      if (officerAddress) interests[`${DIRECTORS_INTERESTS_COLUMNS.address}${row}`] = officerAddress;
      const holding = (scenario.members || []).find((member) => member.name === director.name);
      if (holding?.acquired) {
        const acquired = parseDate(holding.acquired);
        interests[`${DIRECTORS_INTERESTS_COLUMNS.registered}${row}`] = toExcelSerial(
          acquired.getUTCFullYear(),
          acquired.getUTCMonth() + 1,
          acquired.getUTCDate(),
        );
      }
    });
  }

  // The dividend the board declared, on the minute the directors' report and
  // the trial balance both read. The meeting sits inside the accounting
  // period, so its date shifts with the rest of the book.
  if (scenario.dividend) {
    const minuted = shiftDate(parseDate(scenario.dividend.board_meeting));
    companysecretaryWrites.Boardmeeting = {
      [BOARD_MINUTE_CELLS.date]: toExcelSerial(minuted.getUTCFullYear(), minuted.getUTCMonth() + 1, minuted.getUTCDate()),
      [BOARD_MINUTE_CELLS.dividendDeclared]: scenario.dividend.declared,
    };
  }

  // Opening/closing debtors (Sales.xlsx)
  if (scenario.opening_debtors) {
    if (!salesWrites.OpeningDebtors) salesWrites.OpeningDebtors = {};
    let row = 5;
    for (const d of scenario.opening_debtors) {
      salesWrites.OpeningDebtors[`B${row}`] = d.customer;
      if (d.invoice) salesWrites.OpeningDebtors[`C${row}`] = d.invoice;
      salesWrites.OpeningDebtors[`H${row}`] = d.amount;
      row++;
    }
  }
  if (scenario.closing_debtors) {
    if (!salesWrites.ClosingDebtors) salesWrites.ClosingDebtors = {};
    let row = 5;
    for (const d of scenario.closing_debtors) {
      salesWrites.ClosingDebtors[`B${row}`] = d.customer;
      if (d.invoice) salesWrites.ClosingDebtors[`C${row}`] = d.invoice;
      salesWrites.ClosingDebtors[`H${row}`] = d.amount;
      row++;
    }
  }

  // Opening/closing creditors (Purchases.xlsx)
  if (scenario.opening_creditors) {
    if (!purchasesWrites.OpeningCreditors) purchasesWrites.OpeningCreditors = {};
    let row = 5;
    for (const c of scenario.opening_creditors) {
      purchasesWrites.OpeningCreditors[`B${row}`] = c.supplier;
      if (c.invoice) purchasesWrites.OpeningCreditors[`C${row}`] = c.invoice;
      purchasesWrites.OpeningCreditors[`H${row}`] = c.amount;
      row++;
    }
  }
  if (scenario.closing_creditors) {
    if (!purchasesWrites.ClosingCreditors) purchasesWrites.ClosingCreditors = {};
    let row = 5;
    for (const c of scenario.closing_creditors) {
      purchasesWrites.ClosingCreditors[`B${row}`] = c.supplier;
      if (c.invoice) purchasesWrites.ClosingCreditors[`C${row}`] = c.invoice;
      purchasesWrites.ClosingCreditors[`H${row}`] = c.amount;
      row++;
    }
  }

  // Stock (Financialaccounts.xlsx Stock sheet). The opening figure reaches the
  // sheet from the opening balance sheet (D6 and AB6 both read
  // OpenAccounts!E15), so the only entry a year needs is the physical stock
  // count. The sheet takes that in the ACTUAL STOCK VALUE column against the
  // month end it was counted at; the difference from the calculated value
  // becomes the stock loss adjustment in column Z, which is what the trial
  // balance reads as the year's stock movement. Column B holds the month-end
  // dates, so writing the count there moves no stock at all.
  //
  // The calculated side needs one more entry. Column F ("Direct Material
  // BOUGHT") reads the month's materials purchases only while at least one
  // of the stock percentages H4, N4 or T4 is set, and column L values the
  // materials sold as that percentage of the month's net sales. With all
  // three left at zero the sheet buys and sells nothing and the calculated
  // stock never leaves the opening figure.
  if (scenario.stock && scenario.stock.closing !== undefined) {
    if (!hubWrites.Stock) hubWrites.Stock = {};
    if (scenario.stock.materials_percent !== undefined) hubWrites.Stock[STOCK_MATERIALS_PERCENT_CELL] = scenario.stock.materials_percent;
    hubWrites.Stock[STOCK_FINAL_COUNT_CELL] = scenario.stock.closing;
  }

  // Payslips.xlsx employee details (same layout as SE: 5 blocks at 26-row intervals)
  const payslipsWrites = {};
  if (scenario.employees) {
    payslipsWrites.Employee = writePayslipsEmployee(scenario, { payrollStart, payrollOpened, shiftDate });
  }

  // Payslips.xlsx monthly payroll data, on the month tab's own monthly block.
  if (scenario.payroll) {
    for (const entries of Object.values(scenario.payroll)) {
      if (entries.length === 0) continue;
      // The tab follows the pay date, the same rule the other journals use, so
      // the date the tab shows is always the date the tab was chosen from.
      const paidOn = shiftDate(parseDate(entries[0].date));
      const tabName = getTabForDate(paidOn);
      const blockRow = monthlyPayrollBlockRow((SHORT_MONTHS.indexOf(tabName) - targetStartMonth + 12) % 12);

      if (!payslipsWrites[tabName]) payslipsWrites[tabName] = {};
      const sheet = payslipsWrites[tabName];
      sheet[`M${blockRow + 1}`] = toExcelSerial(paidOn.getUTCFullYear(), paidOn.getUTCMonth() + 1, paidOn.getUTCDate());
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
        // into T1, which WagesInterface!H reads. Verified against the
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

  // Fixedassets.xlsx Schedule — assets owned at the year start, assets
  // bought during the year, and disposals.
  const fixedAssetsWrites = {};
  const existingAssetRowsUsed = [];

  if (scenario.opening_fixed_assets) {
    fixedAssetsWrites.Schedule = {};
    const fa = fixedAssetsWrites.Schedule;
    const nextIndex = {};
    for (const asset of scenario.opening_fixed_assets) {
      const layout = SCHEDULE_ASSET_CLASSES[asset.category];
      if (!layout) {
        throw new Error(`Opening fixed assets name asset class "${asset.category}", which the Schedule has no block for`);
      }
      const index = nextIndex[asset.category] || 0;
      const row = layout.existingRows[index];
      if (row === undefined) {
        throw new Error(`More opening ${asset.category} assets than the Schedule's ${layout.existingRows.length} rows for that class`);
      }
      nextIndex[asset.category] = index + 1;
      if (asset.description) fa[`C${row}`] = asset.description;
      fa[`E${row}`] = asset.cost;
      if (asset.acc_dep) fa[`F${row}`] = asset.acc_dep;
      // Column O is the written down TAX value brought forward, the figure
      // the capital allowance columns work from. The schedule computes a
      // disposal's balancing allowance as that value less the sale proceeds,
      // so an asset sold in the year without one leaves the whole capital
      // allowance block, and every figure downstream of it, in error.
      if (asset.tax_wdv) fa[`O${row}`] = asset.tax_wdv;
      existingAssetRowsUsed.push(row);
    }
  }

  // Assets bought during the year are the "fa"-coded purchases. The same
  // amounts also reach the trial balance through Purchases.xlsx's own fa
  // analysis column, so the Schedule and the ledger have to agree — that is
  // what FAreconciliation compares.
  const assetPurchases = [];
  if (scenario.purchases) {
    for (const transactions of Object.values(scenario.purchases)) {
      for (const tx of transactions) if (tx.code === "fa") assetPurchases.push(tx);
    }
  }
  const newAssetRowsUsed = [];
  if (assetPurchases.length > 0) {
    if (!fixedAssetsWrites.Schedule) fixedAssetsWrites.Schedule = {};
    const fa = fixedAssetsWrites.Schedule;
    if (assetPurchases.length > SCHEDULE_NEW_ASSET_ROWS.length) {
      throw new Error(`${assetPurchases.length} "fa" purchases exceed the ${SCHEDULE_NEW_ASSET_ROWS.length} Schedule new-asset rows`);
    }
    assetPurchases.forEach((tx, i) => {
      const row = SCHEDULE_NEW_ASSET_ROWS[i];
      const d = shiftDate(parseDate(tx.date));
      fa[`B${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      if (tx.supplier) fa[`C${row}`] = tx.supplier;
      fa[`E${row}`] = netOfVat(tx.amount, rate);
      newAssetRowsUsed.push(row);
    });
  }

  // Disposals are the "fs"-coded sales. Each pairs with an asset already on
  // the Schedule, in declaration order, so the sheet's disposal formulas
  // resolve the right asset's cost and accumulated depreciation. Assets
  // brought forward come first; a scenario that lists none still has this
  // year's purchases to dispose of.
  const assetDisposals = [];
  if (scenario.sales) {
    for (const transactions of Object.values(scenario.sales)) {
      for (const tx of transactions) if (tx.code === "fs") assetDisposals.push(tx);
    }
  }
  if (assetDisposals.length > 0) {
    if (!fixedAssetsWrites.Schedule) fixedAssetsWrites.Schedule = {};
    const fa = fixedAssetsWrites.Schedule;
    const disposalRows = [...existingAssetRowsUsed, ...newAssetRowsUsed];
    if (assetDisposals.length > disposalRows.length) {
      throw new Error(`${assetDisposals.length} "fs" disposals but only ${disposalRows.length} Schedule asset rows to attach them to`);
    }
    assetDisposals.forEach((tx, i) => {
      const row = disposalRows[i];
      const d = shiftDate(parseDate(tx.date));
      fa[`U${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      fa[`V${row}`] = netOfVat(tx.amount, rate);
    });
  }

  // Hire purchase agreements (Fixedassets.xlsx HPfinance sheet). Only two
  // rows are available for scenario agreements before the sheet's own
  // layout runs out: row 8 (the "New" block's working master, whose
  // monthly-payment formula was never broken) and row 10 (the first row
  // the #REF! repair fixes). B=agreement date, C=finance company,
  // D=reference, E=amount financed, F=admin charges, G=total interest,
  // H=term in months, L=supplier. Written left to right per row, matching
  // the Schedule writer above.
  const HP_AGREEMENT_ROWS = [8, 10];
  const hpFinanceWrites = {};
  if (scenario.hp_agreements) {
    const hp = hpFinanceWrites;
    if (scenario.hp_agreements.length > HP_AGREEMENT_ROWS.length) {
      throw new Error(
        `cellWrites: ${scenario.hp_agreements.length} hp_agreements but only ${HP_AGREEMENT_ROWS.length} HPfinance rows available`,
      );
    }
    scenario.hp_agreements.forEach((agreement, i) => {
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
    if (Object.keys(hpFinanceWrites).length > 0) fixedAssetsWrites.HPfinance = hpFinanceWrites;
  }

  // Bank entries — one workbook per bank account, receipts and payments on
  // opposite sides of each month tab.
  //
  // The period's first day, in the same shifted frame as every "d" below:
  // the earliest of the scenario's own bank dates, shifted the same way "d"
  // is. An opening balance is the one bank line dated it, and the workbook
  // takes that as the account's A1 figure rather than as a statement line;
  // read a day out, the opening reads as a transfer and every transfer as an
  // opening.
  const bankDates = Object.values(scenario.bank || {}).flatMap((transactions) => transactions.map((tx) => shiftDate(parseDate(tx.date))));
  const periodStart = bankDates.length > 0 ? bankDates.reduce((earliest, date) => (date < earliest ? date : earliest)) : null;
  const bankFileWrites = {};
  if (scenario.bank) {
    const receiptRows = {};
    const paymentRows = {};

    for (const transactions of Object.values(scenario.bank)) {
      for (const tx of transactions) {
        const d = shiftDate(parseDate(tx.date));
        const tabName = getTabForDate(d);
        const acct = tx.account || "1200";
        const fileName = BANK_ACCOUNT_FILES[acct];
        if (!fileName) throw new Error(`Bank entry dated ${tx.date} names unknown account ${acct}`);
        if (!bankFileWrites[fileName]) bankFileWrites[fileName] = {};
        if (!bankFileWrites[fileName][tabName]) bankFileWrites[fileName][tabName] = {};
        const sheet = bankFileWrites[fileName][tabName];

        // BC on a bank entry marks the account's opening balance, which the
        // workbook takes in A1 rather than as a statement line -- but only
        // on the period's first day; a "BC" line any other day is an
        // ordinary transfer to or from the Cash account, analysed like any
        // other code below.
        if (isLtdOpeningBankLine(tx.code, d, periodStart)) {
          sheet.A1 = tx.amount;
          continue;
        }

        if (tx.direction !== "in" && tx.direction !== "out") {
          throw new Error(`Bank entry dated ${tx.date} (${tx.code} ${tx.amount}) has no direction`);
        }
        const layout = BANK_LAYOUTS[fileName];
        const placement = ltdBankPlacement(fileName, tx.direction === "in", tx.code, tx.amount);
        if (!placement.analysed) {
          throw new Error(`${fileName} analyses no ${tx.direction === "in" ? "receipt" : "payment"} under code ${tx.code}`);
        }
        const isReceipt = placement.receipt;
        const block = isReceipt ? layout.receipt : layout.payment;

        const rowKey = `${fileName}:${tabName}`;
        const rows = isReceipt ? receiptRows : paymentRows;
        if (!rows[rowKey]) rows[rowKey] = 6;
        const row = rows[rowKey]++;
        sheet[`${block.date}${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        if (tx.source) sheet[`${block.source}${row}`] = tx.source;
        if (tx.reference) sheet[`${block.reference}${row}`] = tx.reference;
        if (tx.description) sheet[`${block.comment}${row}`] = tx.description;
        sheet[`${block.code}${row}`] = tx.code;
        sheet[`${block.amount}${row}`] = placement.amount;
      }
    }
  }

  // Straddling VAT periods (Vatreturns.xlsx). A business registered for VAT on
  // a cycle that does not line up with its accounting year still has to return
  // the periods either side of it, and the workbook keeps a sales and a
  // purchases entry sheet for each. Nothing on these sheets reaches
  // Financialaccounts -- Vatreturns links Sales, Purchases and the hub, never
  // the other way -- so an entry here moves the VAT return and leaves the
  // trial balance alone.
  //
  // The purchases sheets carry a completeness warning in B2 that compares the
  // net total against expense analysis columns O:AK. Those columns exist on
  // the twelve month tabs but not on these sheets, so the warning fires for
  // any entry at all. Nothing reads it, so it is left unasserted.
  const vatReturnWrites = {};
  const straddlingOptions = { workbook: "Vatreturns.xlsx", shiftDate };
  if (scenario.vat_straddling_sales)
    writeStraddlingPeriod(vatReturnWrites, scenario.vat_straddling_sales, "S", "customer", STRADDLING_COLUMNS, straddlingOptions);
  if (scenario.vat_straddling_purchases)
    writeStraddlingPeriod(vatReturnWrites, scenario.vat_straddling_purchases, "P", "supplier", STRADDLING_COLUMNS, straddlingOptions);

  const salesinvoiceWrites = writeSalesinvoice(scenario, rate);

  const result = {
    "Sales.xlsx": salesWrites,
    "Purchases.xlsx": purchasesWrites,
  };
  if (Object.keys(vatReturnWrites).length > 0) result["Vatreturns.xlsx"] = vatReturnWrites;
  for (const [fileName, writes] of Object.entries(bankFileWrites)) {
    if (Object.keys(writes).length > 0) result[fileName] = writes;
  }
  if (Object.keys(hubWrites).length > 0) result["Financialaccounts.xlsx"] = hubWrites;
  if (Object.keys(payslipsWrites).length > 0) result["Payslips.xlsx"] = payslipsWrites;
  if (Object.keys(fixedAssetsWrites).length > 0) result["Fixedassets.xlsx"] = fixedAssetsWrites;
  if (Object.keys(companysecretaryWrites).length > 0) result["Companysecretary.xlsx"] = companysecretaryWrites;
  if (Object.keys(salesinvoiceWrites).length > 0) result["Salesinvoice.xlsx"] = salesinvoiceWrites;
  return result;
}
