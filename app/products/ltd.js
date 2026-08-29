// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// ltd.js — Limited Company product definition (all year-end months).
// Multi-file package: 15 xlsx files with cross-file external links.
// The shipped corporation tax working sheet charges the whole chargeable
// profit at the small profits rate, with no main rate and no marginal relief.
// Year-end month is determined by the tax data file (financial_year.end).

import { toExcelSerial } from "../lib/spreadsheet-runner.js";
import { parseDate, MONTH_SHEETS } from "../lib/scenario-loader.js";
import { calculateCorporationTax } from "../lib/tax/corporation-tax.js";
import {
  buildCategoryNetting,
  buildProfitBridge,
  categoryNettingCheckName,
  PROFIT_BRIDGE_CHECK,
  vatCycleRows,
  vatReturnCoverage,
} from "../lib/report-generator.js";

export const PRODUCT = {
  id: "ltd",
  dir: "ltd",
  name: "Company",
  taxRegime: "ltd",
  prefix: "GB Accounts Company",
};

export const MULTI_FILE = true;

// ── Scenario cell writes ───────────────────────────────────────────────────
// Ltd Sales: E=code letter, F=gross amount
// Ltd Purchases: E=code letter, F=gross amount

// Month tab names for a given year-end month (1=Jan, 12=Dec)
// e.g. yearEndMonth=3 (Mar): ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"]
// e.g. yearEndMonth=6 (Jun): ["Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun"]
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getMonthTabNames(yearEndMonth) {
  const tabs = [];
  for (let i = 0; i < 12; i++) {
    tabs.push(SHORT_MONTHS[(yearEndMonth + i) % 12]);
  }
  return tabs;
}

const BANK_ACCOUNT_FILES = {
  1200: "Currentaccount.xlsx",
  1210: "Savingaccount.xlsx",
  1220: "Cashaccount.xlsx",
  1230: "Creditcardaccount.xlsx",
};

// TrialBalance's own closing-balance echo of each bank workbook (verified
// against the template: EJ22 = Current, EJ23 = Savings, EJ24 = Credit Card,
// EJ25 = Cash). PubBalSht!E12 "Cash at bank and in hand" reads these four
// cells plus EJ26 ("Intra Cash & Bank Transfers"), not the bank workbooks
// directly.
const TRIAL_BALANCE_BANK_ECHO_CELLS = {
  "Currentaccount.xlsx": "EJ22",
  "Savingaccount.xlsx": "EJ23",
  "Creditcardaccount.xlsx": "EJ24",
  "Cashaccount.xlsx": "EJ25",
};

// Transfer code letter each bank workbook stands for. A workbook analyses
// transfers under the other three letters; it never transfers to itself.
const BANK_TRANSFER_CODES = {
  "Currentaccount.xlsx": "BB",
  "Savingaccount.xlsx": "BS",
  "Cashaccount.xlsx": "BC",
  "Creditcardaccount.xlsx": "BD",
};

// Column layout of the receipts and payments blocks in each bank workbook's
// month tabs, and the code letters each block has an analysis column for.
// Cashaccount analyses fewer receipt codes than the three statement books,
// which shifts its payments block four columns to the left.
function bankLayout(fileName) {
  const transfers = Object.values(BANK_TRANSFER_CODES).filter((c) => c !== BANK_TRANSFER_CODES[fileName]);
  if (fileName === "Cashaccount.xlsx") {
    return {
      receipt: { date: "A", source: "B", code: "E", amount: "F" },
      payment: { date: "P", source: "Q", code: "T", amount: "U" },
      receiptCodes: [...transfers, "DR", "K", "LDR", "LCR", "DL"],
      paymentCodes: [...transfers, "CR", "W", "B", "J", "LDR", "LCR", "RP", "RV", "RC", "RT", "DV", "DL"],
    };
  }
  return {
    receipt: { date: "A", source: "B", code: "E", amount: "F" },
    payment: { date: "S", source: "T", code: "W", amount: "X" },
    receiptCodes: [...transfers, "DR", "K", "LDR", "LCR", "RV", "RC", "DL", "X"],
    paymentCodes: [...transfers, "CR", "W", "B", "J", "LDR", "LCR", "RP", "RV", "RC", "RT", "DV", "DL", "X"],
  };
}

const BANK_LAYOUTS = Object.fromEntries(Object.values(BANK_ACCOUNT_FILES).map((f) => [f, bankLayout(f)]));

// ── Payslips.xlsx Admin: the payroll calendar ──────────────────────────────
// B2 carries the tax year's first day and every date under it is the row
// above plus one, so the whole calendar hangs off that one cell. Column C is
// the tax week, D the payroll month, F the week within that month, and A
// names the month by rotating B2's own month (A = TEXT(DATE(YEAR(B$2),
// MONTH(B$2)+(D-1), 1), "Mmm")).
//
// The calendar the columns follow is the tax calendar: week 1 is the five
// days from 6 April, every week after it is seven days, and the payroll
// months take four, four and five weeks a quarter with a sixth week on the
// last. That fixes the row each month opens on, and the week and date it
// opens with, from B2 alone.
const PAYROLL_WEEKS_PER_MONTH = [4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 6];
const PAYROLL_FIRST_WEEK_DAYS = 5;
const PAYSLIPS_CALENDAR_FIRST_ROW = 2;
const PAYSLIPS_CALENDAR_ANCHOR_CELL = "B2";

// The row, tax week and day offset from B2 that each payroll month opens on.
function payrollMonthStarts() {
  const starts = [];
  let weeksBefore = 0;
  for (let month = 1; month <= 12; month++) {
    const daysBefore = weeksBefore === 0 ? 0 : PAYROLL_FIRST_WEEK_DAYS + (weeksBefore - 1) * 7;
    starts.push({ month, row: PAYSLIPS_CALENDAR_FIRST_ROW + daysBefore, daysBefore, week: weeksBefore + 1 });
    weeksBefore += PAYROLL_WEEKS_PER_MONTH[month - 1];
  }
  return starts;
}

// ── Charges & Debentures register (Companysecretary.xlsx) ──────────────────
// Row 1 is the header, one charge per row after it: A the date of the
// transaction, B the assets charged, C the directors' valuation of those
// assets at the date of charging, D the holder, E the terms and F the date
// of the board meeting that confirmed it. The sheet carries no formulas at
// all, so every cell is an entry.
const CHARGE_REGISTER_ROWS = [2, 3, 4, 5, 6];
const CHARGE_REGISTER_COLUMNS = { date: "A", asset: "B", valuation: "C", holder: "D", terms: "E", boardMeeting: "F" };

// ── Register of members and the board minute (Companysecretary.xlsx) ───────
// The register runs one member a row from row 3: A the full name, C the date
// the shares were acquired, F the nominal value of each share and G the
// number held. F1 echoes F3, G1 sums G3:G19, and the directors' report quotes
// A3/G3 and A4/G4 a line each across the cross-file link.
//
// The board minute is a single resolution: F2 the date the meeting was held
// and E4 the dividend it declared. The trial balance reads E4 twice -- into
// the dividends creditor (EH31, negated) and into the profit distribution
// (EH48) -- so one declaration both charges the year's profit and raises the
// creditor the bank's DV payments settle.
const REGISTER_MEMBER_ROWS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
const REGISTER_MEMBER_COLUMNS = { name: "A", acquired: "C", nominalValue: "F", shares: "G" };
const SHARE_NOMINAL_VALUE = 1;
const BOARD_MINUTE_CELLS = { date: "F2", dividendDeclared: "E4" };

// ── Stock sheet layout ─────────────────────────────────────────────────────
// The Stock sheet runs a row per month end from row 8 to row 30 in steps of
// two, under an opening row 6 fed from the opening balance sheet. Column D
// carries the calculated value, column AB the physical count, and column Z
// the difference between them, which the trial balance reads as the month's
// stock movement. Row 30 is the last month of the year.

const STOCK_FINAL_CALCULATED_CELL = "D30";
const STOCK_FINAL_COUNT_CELL = "AB30";
const STOCK_FINAL_ADJUSTMENT_CELL = "Z30";

// The share of a product's net sales value that is direct materials. The
// sheet repeats H4 down its own product A column and reads the same cell for
// every month, and the materials-bought column stays switched off while H4,
// N4 and T4 are all zero.
const STOCK_MATERIALS_PERCENT_CELL = "H4";

// ── OpenAccounts layout ────────────────────────────────────────────────────
// Row 13 takes fixed assets as original cost (G:K) and accumulated
// depreciation (M:Q), one column per asset class, with net book value in E13.
// Row 18 splits the bank balances across G:J and totals them in E18, and
// row 26 splits the tax and social security creditors across G:I into E26.
// Everything else is a single figure in column E. The sheet's own audit
// checks (B13, B18, B26) compare each total against its parts, and E37
// checks the whole opening balance sheet balances.

const OPENING_FIXED_ASSET_COLUMNS = {
  land_buildings: { cost: "G", depreciation: "M" },
  plant_machinery: { cost: "H", depreciation: "N" },
  fixtures_fittings: { cost: "I", depreciation: "O" },
  computer_technology: { cost: "J", depreciation: "P" },
  motor_vehicles: { cost: "K", depreciation: "Q" },
};

const OPENING_BANK_COLUMNS = {
  current_account: "G",
  savings_account: "H",
  credit_card: "I",
  cash: "J",
};

const OPENING_TAX_COLUMNS = {
  paye_due: "G",
  vat_due: "H",
  cis_due: "I",
};

const OPENING_BALANCE_CELLS = {
  stock: "E15",
  trade_debtors: "E16",
  trade_creditors: "E20",
  net_wages_due: "E21",
  wage_deductions_due: "E22",
  dividends_due: "E23",
  corporation_tax: "E24",
  long_term_debtors: "E28",
  directors_loan: "E30",
  long_term_creditors: "E31",
  share_capital: "E33",
  retained_earnings: "E34",
  capital_reserves: "E35",
};

const FIXED_ASSET_BANDS = ["fixed_asset_cost", "fixed_asset_depreciation"];

// ── Fixedassets.xlsx Schedule layout ───────────────────────────────────────
// Two blocks per asset class: assets already owned at the year start, and
// assets bought during the year. Each block ends in a totals row, and the
// published note (PubNotes) reads those totals class by class. Verified
// against the template.
//
// Row layout: C = asset description, D = purchase reference, E = original
// cost, F = accumulated depreciation brought forward. A new asset also takes
// B = date purchased. A disposal is recorded on the row of the asset it
// disposes of: U = date sold, V = sale value net of VAT, and the sheet's own
// W/X formulas then pull that asset's cost and accumulated depreciation out.
//
// Motor vehicles have two sub-blocks, cars then vans and lorries; both roll
// into the same class total. Scenario motor assets go to the vans rows,
// which is what the fixture's van is, and which is the sub-block carrying
// the van capital-allowance formulas.
const SCHEDULE_ASSET_CLASSES = {
  land: { existingRows: [8, 9, 10], existingTotalRow: 11, newTotalRow: 64, noteColumn: "B", rateCell: "H7" },
  plant: { existingRows: [14, 15, 16, 17, 18, 19, 20, 21], existingTotalRow: 22, newTotalRow: 75, noteColumn: "C", rateCell: "H13" },
  fixtures: { existingRows: [25, 26, 27, 28, 29], existingTotalRow: 30, newTotalRow: 83, noteColumn: "D", rateCell: "H24" },
  computer: { existingRows: [33, 34, 35, 36, 37, 38, 39, 40], existingTotalRow: 41, newTotalRow: 94, noteColumn: "E", rateCell: "H32" },
  motor: { existingRows: [50, 51, 52, 53, 54], existingTotalRow: 55, newTotalRow: 108, noteColumn: "F", rateCell: "H43" },
};

// Assets bought in the year all land on the New Plant & Machinery rows. A
// scenario purchase carries a code letter and an amount, not an asset class,
// so any single block is as faithful as another; the note's per-class rows
// and its total both stay anchored to what was posted to Purchases.xlsx.
const SCHEDULE_NEW_ASSET_ROWS = [67, 68, 69, 70, 71, 72, 73, 74];
const SCHEDULE_NEW_ASSET_CLASS = "plant";

// The Sales, Purchases and Fixedassets analysis columns all hold figures net
// of VAT. Matches [vat].standard_rate in app/data/ltd-*.toml (Admin M19).
const VAT_RATE = 0.2;

// Cell G2 of a Sales.xlsx month tab holds the rate the whole book charges.
// The first month reads Admin!M19, each later month reads the month before
// it, and every Purchases month reads its own Sales month. Entering 0 there
// is what the Company guide tells a business that is not registered for VAT
// to do, and it is the only lever that turns VAT off end to end.
const VAT_RATE_CELL = "G2";

// A scenario says whether the business is registered in its own metadata.
// Anything that does not say is registered, which is what every fixture
// written before the flag existed means.
export function vatRateFor(scenario) {
  return scenario?.metadata?.vat_registered === false ? 0 : VAT_RATE;
}

function netOfVat(gross, rate = VAT_RATE) {
  return Math.round((gross / (1 + rate)) * 100) / 100;
}

// ── Vatreturns.xlsx Vatinterface layout ────────────────────────────────────
// One row per VAT period, in date order. Rows 6-17 are the twelve accounting
// months in period order (row 6 is always the period's first month, whatever
// the year end -- the generator rewrites the month-tab references to match).
// Rows 4 and 5 are the two VAT periods before the accounting year, rows 18
// and 19 the two after it; each is fed by its own S/P entry sheet rather than
// by a month tab. Column B is the period end date every VATQtr sheet looks up
// on, C the payment due date, D/F the period's sales net and output VAT, H/J
// its purchases net and input VAT, and E/G/I/K the rolling three-row sums the
// VAT boxes read. M carries the flat-rate flag box 6 switches on.
const VATINTERFACE_ROWS = { first: 4, last: 19, firstMonth: 6 };

// Straddling VAT period name to the Vatinterface row it feeds, and to the
// pair of entry sheets it is entered on (S<period> and P<period>).
const STRADDLING_PERIOD_ROWS = { "02Y1": 4, "03Y1": 5, "04Y2": 18, "05Y2": 19 };

// Column each straddling entry sheet takes its data in. The sheets compute
// VAT and net from the gross figure in the amount column.
const STRADDLING_COLUMNS = { date: "A", name: "B", invoice: "C", description: "D", amount: "F" };

// spreadsheet-runner writes a cell by rewriting its XML in place, and when
// the target is an empty self-closing cell that rewrite also swallows every
// cell after it up to the next one that carries a value. On OpenAccounts the
// whole input grid is empty self-closing cells, so a write can drop the ones
// to its right. Ordering the writes left to right, top to bottom means every
// dropped cell is re-created by a later write.
function inSheetOrder(cells) {
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

function writeOpeningBalance(sheet, openingBalance) {
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

// Move a date forward by whole months. A day the shifted month does not have
// clamps to that month's end, so each of the period's twelve months lands on
// its own tab: a 31st shifted into a 30-day month stays in that month rather
// than rolling into the next one and doubling up with the month after it.
function shiftMonths(d, monthOffset) {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + monthOffset;
  const lastDayOfShiftedMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(d.getUTCDate(), lastDayOfShiftedMonth)));
}

export function cellWrites(scenario, targetStartYear, yearEndMonth) {
  const salesWrites = {};
  const purchasesWrites = {};

  // Default to March year-end if not specified
  const yem = yearEndMonth || 3;

  // Dates belong to the accounting period their own scenario covers, and get
  // shifted by the whole-month gap between that period and the target's, so
  // the twelve months land on the twelve month tabs in order. A scenario
  // already in the target's period has a zero gap and is written as it stands,
  // which is what makes exporting a package and generating from the export
  // reproduce the same cells. A scenario that does not name its period start
  // is in the April-March frame its apr..mar month keys describe.
  const rate = vatRateFor(scenario);

  const sourceStartMonth = (scenario.period_start_month || 4) - 1;
  const targetStartMonth = yem % 12; // month after year-end (0-indexed)
  const monthOffset = (targetStartMonth - sourceStartMonth + 12) % 12;

  const shiftDate = (d) => shiftMonths(d, monthOffset);

  // The twelve tabs are the twelve months, whatever the year end, so a shifted
  // date's month names its tab.
  const getTabForDate = (shifted) => SHORT_MONTHS[shifted.getUTCMonth()];

  function processJournal(entries, writes, nameField, codeDefault) {
    for (const transactions of Object.values(entries)) {
      for (const tx of transactions) {
        const d = parseDate(tx.date);
        const shifted = shiftDate(d);
        const tabName = getTabForDate(shifted);

        if (!writes[tabName]) writes[tabName] = {};
        const sheet = writes[tabName];

        const nextRow = Object.keys(sheet).filter((k) => k.startsWith("A")).length + 5;
        sheet[`A${nextRow}`] = toExcelSerial(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
        if (tx[nameField]) sheet[`B${nextRow}`] = tx[nameField];
        sheet[`E${nextRow}`] = tx.code || codeDefault;
        sheet[`F${nextRow}`] = tx.amount;
      }
    }
  }

  if (scenario.sales) {
    processJournal(scenario.sales, salesWrites, "customer", "a");
  }

  if (scenario.purchases) {
    processJournal(scenario.purchases, purchasesWrites, "supplier", "g");
  }

  // A business that is not registered for VAT turns the rate off on the first
  // month's Sales tab, and the rest of the book follows that cell.
  if (rate !== VAT_RATE) {
    const firstTab = getMonthTabNames(yem)[0];
    if (!salesWrites[firstTab]) salesWrites[firstTab] = {};
    salesWrites[firstTab][VAT_RATE_CELL] = rate * 100;
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

    const directors = (scenario.employees || []).filter((e) => e.isDirector);
    if (directors[0]?.name) bd.E5 = directors[0].name;
    if (directors[1]?.name) bd.E6 = directors[1].name;
  }

  // Opening balance sheet (OpenAccounts)
  if (scenario.opening_balance) {
    if (!hubWrites.OpenAccounts) hubWrites.OpenAccounts = {};
    writeOpeningBalance(hubWrites.OpenAccounts, scenario.opening_balance);
  }
  if (hubWrites.OpenAccounts) hubWrites.OpenAccounts = inSheetOrder(hubWrites.OpenAccounts);

  // Companysecretary.xlsx: the charges register, the share register and the
  // board minute. Ordinary shares are issued at their £1 nominal value,
  // matching the template's own "Fully paid Ordinary Shares" placeholder row.
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
      register[`${REGISTER_MEMBER_COLUMNS.nominalValue}${row}`] = SHARE_NOMINAL_VALUE;
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
    const EMP_BASE_ROWS = [13, 39, 65, 91, 117];
    payslipsWrites.Employee = {};
    const emp = payslipsWrites.Employee;
    const biz = scenario.business || {};
    if (biz.name) emp.D5 = biz.name;
    if (biz.address) emp.D6 = biz.address;
    if (biz.town) emp.D7 = biz.town;
    if (biz.postcode) emp.D9 = biz.postcode;

    for (let i = 0; i < Math.min(scenario.employees.length, 5); i++) {
      const e = scenario.employees[i];
      const base = EMP_BASE_ROWS[i];
      if (e.name) {
        const parts = e.name.split(" ");
        emp[`D${base + 2}`] = parts.slice(-1)[0];
        emp[`D${base + 3}`] = parts.slice(0, -1).join(" ");
      }
      if (e.niNumber) emp[`M${base + 2}`] = e.niNumber;
      emp[`D${base + 15}`] = e.payFrequency === "weekly" ? "W" : "M";
      if (e.employeeID) emp[`D${base + 16}`] = e.employeeID;
      emp[`D${base + 17}`] = e.isDirector ? "D" : e.niCategory || "A";
    }
  }

  // Payslips.xlsx monthly payroll data — rows 51-55 in each monthly tab
  if (scenario.payroll) {
    for (const entries of Object.values(scenario.payroll)) {
      if (entries.length === 0) continue;
      // The tab follows the pay date, the same rule the other journals use, so
      // the date the tab shows is always the date the tab was chosen from.
      const paidOn = shiftDate(parseDate(entries[0].date));
      const tabName = getTabForDate(paidOn);

      if (!payslipsWrites[tabName]) payslipsWrites[tabName] = {};
      const sheet = payslipsWrites[tabName];
      sheet.M49 = toExcelSerial(paidOn.getUTCFullYear(), paidOn.getUTCMonth() + 1, paidOn.getUTCDate());
      for (let i = 0; i < Math.min(entries.length, 5); i++) {
        const row = 51 + i;
        const e = entries[i];
        if (e.name) sheet[`F${row}`] = e.name;
        sheet[`M${row}`] = e.grossPay;
        sheet[`N${row}`] = e.incomeTax;
        sheet[`O${row}`] = e.employeeNI;
        sheet[`R${row}`] = e.netPay;
        // Column S is a blank spacer in the template (self-closing, no
        // formula, never summed); column T is the real employer-NI data
        // entry cell -- its own row56 SUM(T51:T55) feeds T1, which
        // WagesInterface!H reads. Verified against the template.
        sheet[`T${row}`] = e.employerNI;
      }
    }
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
        // workbook takes in A1 rather than as a statement line.
        if (tx.code === "BC") {
          sheet.A1 = tx.amount;
          continue;
        }

        if (tx.direction !== "in" && tx.direction !== "out") {
          throw new Error(`Bank entry dated ${tx.date} (${tx.code} ${tx.amount}) has no direction`);
        }
        const layout = BANK_LAYOUTS[fileName];
        const isReceipt = tx.direction === "in";
        const block = isReceipt ? layout.receipt : layout.payment;
        const analysedCodes = isReceipt ? layout.receiptCodes : layout.paymentCodes;
        if (!analysedCodes.includes(tx.code)) {
          throw new Error(`${fileName} analyses no ${isReceipt ? "receipt" : "payment"} under code ${tx.code}`);
        }

        const rowKey = `${fileName}:${tabName}`;
        const rows = isReceipt ? receiptRows : paymentRows;
        if (!rows[rowKey]) rows[rowKey] = 6;
        const row = rows[rowKey]++;
        sheet[`${block.date}${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        if (tx.source) sheet[`${block.source}${row}`] = tx.source;
        sheet[`${block.code}${row}`] = tx.code;
        sheet[`${block.amount}${row}`] = tx.amount;
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
  function writeStraddlingPeriod(entries, sheetPrefix, nameField) {
    for (const entry of entries) {
      const row = STRADDLING_PERIOD_ROWS[entry.period];
      if (!row) {
        throw new Error(`Straddling VAT entry names period "${entry.period}", which Vatreturns.xlsx has no sheet for`);
      }
      const sheetName = `${sheetPrefix}${entry.period}`;
      if (!vatReturnWrites[sheetName]) vatReturnWrites[sheetName] = {};
      const sheet = vatReturnWrites[sheetName];
      const col = STRADDLING_COLUMNS;
      const entryRow = Object.keys(sheet).filter((k) => k.startsWith(col.amount)).length + 5;
      const d = shiftDate(parseDate(entry.date));
      sheet[`${col.date}${entryRow}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      if (entry[nameField]) sheet[`${col.name}${entryRow}`] = entry[nameField];
      if (entry.invoice) sheet[`${col.invoice}${entryRow}`] = entry.invoice;
      if (entry.description) sheet[`${col.description}${entryRow}`] = entry.description;
      sheet[`${col.amount}${entryRow}`] = entry.amount;
    }
  }
  if (scenario.vat_straddling_sales) writeStraddlingPeriod(scenario.vat_straddling_sales, "S", "customer");
  if (scenario.vat_straddling_purchases) writeStraddlingPeriod(scenario.vat_straddling_purchases, "P", "supplier");

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
  return result;
}

// ── Standard reads for reconciliation ──────────────────────────────────────
// Reads from Financialaccounts.xlsx after cross-file recalculation.
// MnthP&L column B = annual totals (SUM of monthly C:N).
// CorporationTax column K = CT calculation.

export const TAX_SHEET = "CorporationTax";

// prettier-ignore
export const CELL_MAP = [
  // ── Business Details (OpenAccounts sheet) ──
  ["OpenAccounts", "E2",  "Company Name (including Limited)",  "entityInformation.organizationIdentifier",  "Business Details", 0],
  ["OpenAccounts", "E3",  "Company registration number",       "diya-gl:companyNumber",                     "Business Details", 0],
  ["OpenAccounts", "E4",  "Telephone number",                  "gl-bus:organizationTelephone",              "Business Details", 0],
  ["OpenAccounts", "E5",  "First Director's Name",             "diya-gl:directorName",                      "Business Details", 0],
  ["OpenAccounts", "E8",  "Principal activity",                "gl-bus:organizationDescription",            "Business Details", 0],
  ["OpenAccounts", "J3",  "Registered Office Address",         "gl-bus:organizationAddress",                "Business Details", 0],
  ["OpenAccounts", "J4",  "Registered Office Town",            "gl-bus:organizationAddress",                "Business Details", 0],
  ["OpenAccounts", "N6",  "Postcode",                          "gl-bus:organizationAddress",                "Business Details", 0],
  ["OpenAccounts", "O3",  "Tax Reference per CT603 Notice",    "gl-taf:taxRegistrationNumber",              "Business Details", 0],
  // ── Opening Balance Sheet (OpenAccounts sheet) ──
  ["OpenAccounts", "E13", "Tangible assets (net book value)",  "gl-cor:amount (opening.fixedAssets)",  "Opening Balance Sheet", 1],
  ["OpenAccounts", "E15", "Stock at cost",                     "accounts.assets.1100 (opening)",       "Opening Balance Sheet", 1],
  ["OpenAccounts", "E16", "Trade Debtors",                     "accounts.assets.1300 (opening)",       "Opening Balance Sheet", 1],
  ["OpenAccounts", "E18", "Cash and Bank Balances",            "gl-cor:amount (opening.bank)",         "Opening Balance Sheet", 1],
  ["OpenAccounts", "E20", "Trade Creditors",                   "accounts.liabilities.2100 (opening)",  "Opening Balance Sheet", 1],
  ["OpenAccounts", "E24", "Corporation Tax",                   "accounts.liabilities.2300 (opening)",  "Opening Balance Sheet", 1],
  ["OpenAccounts", "E26", "Taxation and Social Security",      "gl-cor:amount (opening.taxAndSocial)", "Opening Balance Sheet", 1],
  ["OpenAccounts", "E30", "Directors Loan Account",            "accounts.liabilities.2500 (opening)",  "Opening Balance Sheet", 1],
  ["OpenAccounts", "E33", "Called up share capital",           "accounts.capital.3000 (opening)",      "Opening Balance Sheet", 1],
  ["OpenAccounts", "E34", "Retained Profit and Loss account",  "accounts.capital.3100 (opening)",      "Opening Balance Sheet", 1],
  ["OpenAccounts", "E37", "**Accuracy Check**",                "gl-cor:amount (openingBalanceCheck)",  "Opening Balance Sheet", 0],
  // ── Management P&L (MnthP&L) ──
  ["MnthP&L", "B4",  "Product A sales (code a)",  "accounts.sales.4000",            "Profit & Loss Account", 1],
  ["MnthP&L", "B5",  "Product B sales (code b)",  "accounts.sales.4001",            "Profit & Loss Account", 1],
  ["MnthP&L", "B6",  "Product C sales (code c)",  "accounts.sales.4002",            "Profit & Loss Account", 1],
  ["MnthP&L", "B7",  "Other Direct Income (code d)", "accounts.sales.4003",         "Profit & Loss Account", 1],
  ["MnthP&L", "B8",  "Grants Received (code g)",  "accounts.sales.4004",            "Profit & Loss Account", 1],
  ["MnthP&L", "B9",  "**Sales Turnover**",        "gl-cor:amount (salesTurnover)",  "Profit & Loss Account", 0],
  ["MnthP&L", "B11", "Materials / Stock (code s)", "accounts.purchases.5000",        "Profit & Loss Account", 1],
  ["MnthP&L", "B12", "Sub-Contractors (code c)",   "accounts.purchases.5001",        "Profit & Loss Account", 1],
  ["MnthP&L", "B13", "Other Direct Costs (code o)","accounts.purchases.5002",        "Profit & Loss Account", 1],
  ["MnthP&L", "B14", "Cost of Sales",              "gl-cor:amount (costOfSales)",    "Profit & Loss Account", 0],
  ["MnthP&L", "B16", "**Gross Profit**",           "gl-cor:amount (grossProfit)",    "Profit & Loss Account", 0],
  // B18-B40: Actual mapping from TrialBalance D64-D89 → MnthP&L C18-C40
  ["MnthP&L", "B18", "PAYE Wages + Non-PAYE Employee", "dpl:WagesAndSalaries (combined)", "Profit & Loss Account", 1],
  ["MnthP&L", "B19", "Directors Non-PAYE (code d)",  "accounts.purchases.5100",        "Profit & Loss Account", 1],
  ["MnthP&L", "B20", "Employers National Insurance", "dpl:SocialSecurityCosts",        "Profit & Loss Account", 1],
  ["MnthP&L", "B21", "Premises (code r)",            "accounts.purchases.5200",        "Profit & Loss Account", 1],
  ["MnthP&L", "B22", "Light, Heat, Power (code p)",  "accounts.purchases.5201",        "Profit & Loss Account", 1],
  ["MnthP&L", "B23", "Distribution (code t)",        "accounts.purchases.5300",        "Profit & Loss Account", 1],
  ["MnthP&L", "B24", "Equipment Hire (code q)",      "accounts.purchases.5301",        "Profit & Loss Account", 1],
  ["MnthP&L", "B25", "Repairs & Maintenance (code m)","accounts.purchases.5400",       "Profit & Loss Account", 1],
  ["MnthP&L", "B26", "Consumables (code u)",         "accounts.purchases.5401",        "Profit & Loss Account", 1],
  ["MnthP&L", "B27", "Advertising (code a)",         "accounts.purchases.5500",        "Profit & Loss Account", 1],
  ["MnthP&L", "B28", "Telephone, Postage & Stationery (code g)", "accounts.purchases.5501", "Profit & Loss Account", 1],
  ["MnthP&L", "B29", "Travel & Hotel (code h)",      "accounts.purchases.5600",        "Profit & Loss Account", 1],
  ["MnthP&L", "B30", "Motor Vehicle (code v)",       "accounts.purchases.5601",        "Profit & Loss Account", 1],
  ["MnthP&L", "B31", "Insurance (code n)",           "accounts.purchases.5700",        "Profit & Loss Account", 1],
  ["MnthP&L", "B32", "Leasing (code f)",             "accounts.purchases.5701",        "Profit & Loss Account", 1],
  ["MnthP&L", "B33", "Legal & Professional (code l)","accounts.purchases.5800",        "Profit & Loss Account", 1],
  ["MnthP&L", "B34", "Bad Debts (from Sales)",       "accounts.sales.4005",            "Profit & Loss Account", 1],
  ["MnthP&L", "B35", "Bank Interest Paid",           "accounts.purchases.5701",        "Profit & Loss Account", 1],
  ["MnthP&L", "B36", "Bank Charges",                 "accounts.purchases.5702",        "Profit & Loss Account", 1],
  ["MnthP&L", "B37", "Charitable Donations (code y)","accounts.purchases.5801",        "Profit & Loss Account", 1],
  ["MnthP&L", "B38", "Goodwill written off (code z)","accounts.purchases.5802",        "Profit & Loss Account", 1],
  ["MnthP&L", "B39", "Loss on disposal of assets",   "gl-cor:amount (lossOnDisposal)", "Profit & Loss Account", 1],
  ["MnthP&L", "B40", "Depreciation",                 "gl-cor:amount (depreciation)",   "Profit & Loss Account", 1],
  ["MnthP&L", "B41", "Total Admin Expenses",       "gl-cor:amount (totalAdmin)",     "Profit & Loss Account", 0],
  ["MnthP&L", "B43", "**Operating Profit**",       "gl-cor:amount (operatingProfit)","Profit & Loss Account", 0],
  ["MnthP&L", "B44", "Interest Received",          "gl-cor:amount (interestReceived)","Profit & Loss Account", 1],
  ["MnthP&L", "B45", "**Profit Before Tax**",      "gl-cor:amount (profitBeforeTax)","Profit & Loss Account", 0],
  // ── Corporation Tax working sheet ──
  [TAX_SHEET, "K5",  "Operating Profit",            "gl-cor:amount (ct600.box145)",  "Corporation Tax working sheet", 0],
  [TAX_SHEET, "I7",  "Add back: Goodwill",          "gl-cor:amount (ct600.addBackGoodwill)", "Corporation Tax working sheet", 1],
  [TAX_SHEET, "I8",  "Add back: Depreciation",      "gl-cor:amount (ct600.addBackDepreciation)", "Corporation Tax working sheet", 1],
  [TAX_SHEET, "K10", "Add back: total",             "gl-cor:amount (ct600.addBack)", "Corporation Tax working sheet", 1],
  [TAX_SHEET, "K12", "Operational profit chargeable","gl-cor:amount (ct600.adjustedProfit)", "Corporation Tax working sheet", 0],
  [TAX_SHEET, "K20", "Less: Capital Allowances",    "tax.capitalAllowances (ct600)",  "Corporation Tax working sheet", 1],
  [TAX_SHEET, "K22", "Profit after capital allowances","gl-cor:amount (ct600.afterAllowances)", "Corporation Tax working sheet", 0],
  [TAX_SHEET, "K24", "Add: gross bank interest",    "gl-cor:amount (ct600.interest)", "Corporation Tax working sheet", 1],
  [TAX_SHEET, "K26", "Less: losses brought forward","gl-cor:amount (ct600.lossesBf)", "Corporation Tax working sheet", 1],
  [TAX_SHEET, "K28", "**Profit Chargeable to CT**", "gl-cor:amount (ct600.box315)",  "Corporation Tax working sheet", 0],
  [TAX_SHEET, "K35", "**Corporation Tax**",         "gl-cor:taxAmount (ct600.box430)","Corporation Tax working sheet", 0],
  [TAX_SHEET, "K39", "Tax Outstanding",             "gl-cor:taxAmount (ct600.box515)","Corporation Tax working sheet", 0],
  // ── The CT600's own tax boxes, so the report states what the form files
  // as well as what the working sheet charges. Boxes 43 to 46 are the first
  // financial year the accounting period falls in and boxes 53 to 56 the
  // second, which stays blank when the period lies in one. Boxes 46 and 56
  // are the tax before relief, box 64 the relief and box 65 the tax the
  // company bears. ──
  ["CT600", "C126",  "Box 43: financial year",      "gl-cor:period (ct600.box43)",     "CT600 as filed", 1],
  ["CT600", "N126",  "Box 44: amount of profit",    "gl-cor:amount (ct600.box44)",     "CT600 as filed", 1],
  ["CT600", "AA126", "Box 45: rate of tax",         "gl-cor:rate (ct600.box45)",       "CT600 as filed", 1],
  ["CT600", "AJ126", "Box 46: tax",                 "gl-cor:taxAmount (ct600.box46)",  "CT600 as filed", 1],
  ["CT600", "C128",  "Box 53: financial year",      "gl-cor:period (ct600.box53)",     "CT600 as filed", 1],
  ["CT600", "N128",  "Box 54: amount of profit",    "gl-cor:amount (ct600.box54)",     "CT600 as filed", 1],
  ["CT600", "AA128", "Box 55: rate of tax",         "gl-cor:rate (ct600.box55)",       "CT600 as filed", 1],
  ["CT600", "AJ128", "Box 56: tax",                 "gl-cor:taxAmount (ct600.box56)",  "CT600 as filed", 1],
  ["CT600", "AJ131", "**Box 63: corporation tax**", "gl-cor:taxAmount (ct600.box63)",  "CT600 as filed", 0],
  ["CT600", "Y133",  "Box 64: marginal rate relief","gl-cor:taxAmount (ct600.box64)",  "CT600 as filed", 1],
  ["CT600", "Y135",  "**Box 65: corporation tax net of marginal rate relief**", "gl-cor:taxAmount (ct600.box65)", "CT600 as filed", 0],
  // ── Published P&L (column B is last year, column F this year) ──
  ["PubP&L", "F7",  "Sales Turnover",              "gl-cor:amount (pubPL.salesTurnover)","Published P&L", 1],
  ["PubP&L", "F8",  "Investment Grants",           "gl-cor:amount (pubPL.grants)",    "Published P&L", 1],
  ["PubP&L", "F9",  "**Total Sales Turnover**",    "gl-cor:amount (pubPL.totalTurnover)","Published P&L", 0],
  ["PubP&L", "F16", "Cost of Sales",               "gl-cor:amount (pubPL.cos)",       "Published P&L", 1],
  ["PubP&L", "F18", "**Gross Profit**",            "gl-cor:amount (pubPL.gross)",     "Published P&L", 0],
  ["PubP&L", "F44", "Administrative Expenses",     "gl-cor:amount (pubPL.admin)",     "Published P&L", 1],
  ["PubP&L", "F46", "**Operating Profit**",        "gl-cor:amount (pubPL.operating)", "Published P&L", 0],
  ["PubP&L", "F49", "**Profit Before Tax**",       "gl-cor:amount (pubPL.pbt)",       "Published P&L", 0],
  ["PubP&L", "F50", "Corporation tax",             "gl-cor:taxAmount (pubPL.tax)",    "Published P&L", 1],
  ["PubP&L", "F51", "**Profit after Tax**",        "gl-cor:amount (pubPL.pat)",       "Published P&L", 0],
  ["PubP&L", "F52", "Dividends",                   "gl-cor:amount (pubPL.dividends)", "Published P&L", 1],
  ["PubP&L", "F54", "**Retained Profit for the year**", "gl-cor:amount (pubPL.retained)", "Published P&L", 0],
  // ── Published Balance Sheet (columns A/B are last year, E/F this year) ──
  ["PubBalSht", "F6",  "Fixed Assets (NBV)",       "gl-cor:amount (pubBS.fixedAssets)",  "Published Balance Sheet", 0],
  ["PubBalSht", "E10", "Stock at cost",            "accounts.assets.1100 (pubBS)",       "Published Balance Sheet", 1],
  ["PubBalSht", "E11", "Trade Debtors",            "accounts.assets.1300 (pubBS)",       "Published Balance Sheet", 1],
  ["PubBalSht", "E12", "Cash at bank and in hand", "gl-cor:amount (pubBS.bankCash)",     "Published Balance Sheet", 1],
  ["PubBalSht", "E13", "Current Assets",           "gl-cor:amount (pubBS.currentAssets)","Published Balance Sheet", 0],
  ["PubBalSht", "E16", "Trade Creditors",          "accounts.liabilities.2100 (pubBS)",  "Published Balance Sheet", 1],
  ["PubBalSht", "E17", "Corporation Tax",          "accounts.liabilities.2300 (pubBS)",  "Published Balance Sheet", 1],
  ["PubBalSht", "E18", "Taxation and Social Security", "gl-cor:amount (pubBS.taxAndSocial)", "Published Balance Sheet", 1],
  ["PubBalSht", "E20", "Current Liabilities",      "gl-cor:amount (pubBS.creditors)",    "Published Balance Sheet", 1],
  ["PubBalSht", "F22", "**Net Current Assets**",   "gl-cor:amount (pubBS.netCurrent)",   "Published Balance Sheet", 0],
  ["PubBalSht", "F26", "**Total Assets less CL**", "gl-cor:amount (pubBS.totalAssetsLessCL)","Published Balance Sheet", 0],
  ["PubBalSht", "E29", "Directors Loan",           "accounts.liabilities.2500 (pubBS)",  "Published Balance Sheet", 1],
  ["PubBalSht", "E30", "Creditors due after more than one year", "accounts.liabilities.2600 (pubBS)", "Published Balance Sheet", 1],
  ["PubBalSht", "F31", "Other Creditors",          "gl-cor:amount (pubBS.otherCred)",    "Published Balance Sheet", 1],
  ["PubBalSht", "F33", "**Net Assets**",           "gl-cor:amount (pubBS.netAssets)",    "Published Balance Sheet", 0],
  ["PubBalSht", "F36", "Called up share capital",  "accounts.capital.3000 (pubBS)",      "Published Balance Sheet", 1],
  ["PubBalSht", "F39", "**Shareholders' Funds**",  "gl-cor:amount (pubBS.equity)",       "Published Balance Sheet", 0],
  // ── Fixed asset note (PubNotes) — column G is the all-classes total ──
  ["PubNotes", "G8",  "Original cost brought forward", "gl-cor:amount (note1.costBf)",     "Fixed Asset Note", 1],
  ["PubNotes", "G9",  "Additions",                     "gl-cor:amount (note1.additions)",  "Fixed Asset Note", 1],
  ["PubNotes", "G10", "Disposals",                     "gl-cor:amount (note1.disposals)",  "Fixed Asset Note", 1],
  ["PubNotes", "G11", "**Original cost carried forward**", "gl-cor:amount (note1.costCf)", "Fixed Asset Note", 0],
  ["PubNotes", "G14", "Depreciation brought forward",  "gl-cor:amount (note1.depBf)",      "Fixed Asset Note", 1],
  ["PubNotes", "G15", "Charge for the year",           "gl-cor:amount (note1.charge)",     "Fixed Asset Note", 1],
  ["PubNotes", "G16", "On disposals",                  "gl-cor:amount (note1.depDisposals)","Fixed Asset Note", 1],
  ["PubNotes", "G17", "**Depreciation carried forward**", "gl-cor:amount (note1.depCf)",   "Fixed Asset Note", 0],
  ["PubNotes", "G20", "**Net book value**",            "gl-cor:amount (note1.nbv)",        "Fixed Asset Note", 0],
  ["PubNotes", "D35", "Directors emoluments",          "gl-cor:amount (note2.emoluments)", "Fixed Asset Note", 1],
  ["PubNotes", "D41", "Corporation tax for the year",  "gl-cor:taxAmount (note4.ct)",      "Fixed Asset Note", 1],
  // ── Directors' report (Report) — the filed narrative's own figures. Every
  // one is a formula reading somewhere else in the book, so the section
  // states what the report tells Companies House beside what the accounts
  // carry. ──
  ["Report", "E87", "Sales turnover in the year",   "gl-cor:amount (report.turnover)",       "Directors' Report", 1],
  ["Report", "H87", "Sales turnover last year",     "gl-cor:amount (report.priorTurnover)",  "Directors' Report", 1],
  ["Report", "D89", "Trading margin",               "gl-cor:percentage (report.margin)",     "Directors' Report", 1],
  ["Report", "I89", "Trading margin last year",     "gl-cor:percentage (report.priorMargin)","Directors' Report", 1],
  ["Report", "D94", "Dividend declared",            "gl-cor:amount (report.dividend)",       "Directors' Report", 1],
  ["Report", "I95", "Ordinary shares issued",       "gl-cor:quantity (report.sharesIssued)", "Directors' Report", 1],
  // ── Stock ──
  ["Stock", "D6",  "Opening Stock",              "accounts.assets.1100 (opening)",      "Stock", 0],
  ["Stock", STOCK_FINAL_COUNT_CELL,      "Closing Stock (physical count)", "accounts.assets.1100 (closing)",           "Stock", 0],
  ["Stock", STOCK_FINAL_CALCULATED_CELL, "Closing Stock (calculated)",     "accounts.assets.1100 (calculated)",        "Stock", 1],
  ["Stock", STOCK_FINAL_ADJUSTMENT_CELL, "Stock loss adjustment",          "accounts.assets.1100 (lossAdjustment)",    "Stock", 1],
  // ── Trial Balance ──
  // Column D is the opening column, fed cell by cell from OpenAccounts.
  // Column EJ is the final balance: opening plus every in-year movement.
  ["TrialBalance", "D6",  "Opening: Fixed Asset Land & Property",      "accounts.assets (opening cost)",     "Trial Balance", 1],
  ["TrialBalance", "D7",  "Opening: Fixed Asset Plant & Machinery",    "accounts.assets.0010 (opening cost)","Trial Balance", 1],
  ["TrialBalance", "D8",  "Opening: Fixed Asset Fixtures & Fittings",  "accounts.assets.0020 (opening cost)","Trial Balance", 1],
  ["TrialBalance", "D9",  "Opening: Fixed Asset Computers",            "accounts.assets.0030 (opening cost)","Trial Balance", 1],
  ["TrialBalance", "D10", "Opening: Fixed Asset Motor Vehicles",       "accounts.assets.0040 (opening cost)","Trial Balance", 1],
  ["TrialBalance", "D11", "Opening: Acc Depreciation Land & Property", "accounts.assets (opening dep)",      "Trial Balance", 1],
  ["TrialBalance", "D12", "Opening: Acc Depreciation Plant & Machinery","accounts.assets.0010 (opening dep)","Trial Balance", 1],
  ["TrialBalance", "D13", "Opening: Acc Depreciation Fixtures",        "accounts.assets.0020 (opening dep)", "Trial Balance", 1],
  ["TrialBalance", "D14", "Opening: Acc Depreciation Computers",       "accounts.assets.0030 (opening dep)", "Trial Balance", 1],
  ["TrialBalance", "D15", "Opening: Acc Depreciation Motor Vehicles",  "accounts.assets.0040 (opening dep)", "Trial Balance", 1],
  ["TrialBalance", "D19", "Opening: Stock",                            "accounts.assets.1100 (opening)",     "Trial Balance", 1],
  ["TrialBalance", "D20", "Opening: Trade Debtors",                    "accounts.assets.1300 (opening)",     "Trial Balance", 1],
  ["TrialBalance", "D22", "Opening: Bank Current Account",             "accounts.assets.1200 (opening)",     "Trial Balance", 1],
  ["TrialBalance", "D23", "Opening: Bank Savings Account",             "accounts.assets.1210 (opening)",     "Trial Balance", 1],
  ["TrialBalance", "D24", "Opening: Credit Card Account",              "accounts.assets.1230 (opening)",     "Trial Balance", 1],
  ["TrialBalance", "D25", "Opening: Cash Account",                     "accounts.assets.1220 (opening)",     "Trial Balance", 1],
  ["TrialBalance", "D28", "Opening: Trade Creditors",                  "accounts.liabilities.2100 (opening)","Trial Balance", 1],
  ["TrialBalance", "D31", "Opening: Dividends Creditor",               "accounts.capital.3200 (opening)",    "Trial Balance", 1],
  ["TrialBalance", "D33", "Opening: Creditor HMRC Vat",                "accounts.liabilities.2200 (opening)","Trial Balance", 1],
  ["TrialBalance", "D35", "Opening: Creditor HMRC Corporation Tax",    "accounts.liabilities.2300 (opening)","Trial Balance", 1],
  ["TrialBalance", "D39", "Opening: Directors Loan Account",           "accounts.liabilities.2500 (opening)","Trial Balance", 1],
  ["TrialBalance", "D40", "Opening: Creditor Long Term",               "accounts.liabilities.2600 (opening)","Trial Balance", 1],
  ["TrialBalance", "D42", "Opening: Share Capital",                    "accounts.capital.3000 (opening)",    "Trial Balance", 1],
  ["TrialBalance", "D43", "Opening: Revenue Reserve P&L Account",      "accounts.capital.3100 (opening)",    "Trial Balance", 1],
  ["TrialBalance", "D91", "**Opening Balances Audit Check**",          "gl-cor:amount (openingColumnCheck)", "Trial Balance", 0],
  ["TrialBalance", "EJ22", "Final: Bank Current Account",              "accounts.assets.1200 (final)",       "Trial Balance", 1],
  ["TrialBalance", "EJ23", "Final: Bank Savings Account",              "accounts.assets.1210 (final)",       "Trial Balance", 1],
  ["TrialBalance", "EJ24", "Final: Credit Card Account",               "accounts.assets.1230 (final)",       "Trial Balance", 1],
  ["TrialBalance", "EJ25", "Final: Cash Account",                      "accounts.assets.1220 (final)",       "Trial Balance", 1],
  ["TrialBalance", "EJ26", "Final: Intra Cash & Bank Transfers",       "gl-cor:amount (intraTransfers)",     "Trial Balance", 1],
  ["TrialBalance", "EJ31","Final: Dividends Creditor",                 "accounts.capital.3200 (final)",      "Trial Balance", 1],
  ["TrialBalance", "EJ39","Final: Directors Loan Account",             "accounts.liabilities.2500 (final)",  "Trial Balance", 1],
  ["TrialBalance", "EJ40","Final: Creditor Long Term",                 "accounts.liabilities.2600 (final)",  "Trial Balance", 1],
  ["TrialBalance", "EJ48","Final: Dividends declared",                 "gl-cor:amount (dividendsDeclared)",  "Trial Balance", 1],
  ["TrialBalance", "EJ91", "**Audit Accuracy Check**", "gl-cor:amount (trialBalanceCheck)", "Trial Balance", 0],
];

// Month tab order (matching the scenario key order) and the MnthP&L column
// each month occupies — verified against the template (C = month 1 .. N =
// month 12).
const MONTH_COLS = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];

// MnthP&L rows fed by a single Sales.xlsx or Purchases.xlsx analysis column
// with nothing else mixed in, keyed by the scenario transaction code letter
// (verified against the per-month TrialBalance formulas each row reads).
// Materials (row 11) also carries the stock adjustment, wages (rows 18-20)
// also carry WagesInterface payroll, and the bank and fixed asset rows come
// from elsewhere entirely, so none of those tie 1:1 to a month's code total.
const SALES_MONTHLY_TIE_ROWS = { a: 4, b: 5, c: 6, d: 7, g: 8 };
// Sales code "o" ("Other") feeds the bad debts row negated — a template
// quirk, verified against the formula chain (MnthP&L C34 = TrialBalance!O81,
// TrialBalance row 81 = -[3]Apr!$T$1).
const SALES_BAD_DEBT_ROW = 34;
const PURCHASES_MONTHLY_TIE_ROWS = {
  c: 12,
  o: 13,
  r: 21,
  p: 22,
  t: 23,
  q: 24,
  m: 25,
  u: 26,
  a: 27,
  g: 28,
  h: 29,
  v: 30,
  n: 31,
  f: 32,
  l: 33,
  y: 37,
  z: 38,
};

// The management P&L's own caption for each tied row, taken from column A of
// the template. The netting table names a category the way the statement it
// feeds names it, so a reader can follow the letter to the line.
const PL_ROW_CAPTIONS = {
  4: "Sales Product A",
  5: "Sales Product B",
  6: "Sales Product C",
  7: "Other Income",
  8: "Investment Grants received",
  12: "Sub contractors",
  13: "Other Direct Cost of Sales",
  18: "Wages and Salaries",
  21: "Premises Rent & Rates",
  22: "Premises Light & Heating",
  23: "Distribution Transport Costs",
  24: "Equipment Tools & Plant Hire",
  25: "Repairs & Maintenance",
  26: "Consumable Materials",
  27: "Advertising & Promotion",
  28: "Telephone Postage & Stationery",
  29: "Travel & Hotel Expenses",
  30: "Motor Vehicle Expenses",
  31: "Insurance Costs",
  32: "Leasing Charges",
  33: "Legal & Professional Fees",
  34: "Bad Debts written off",
  37: "Charitable Donations",
  38: "Goodwill written off",
};

// Admin cells the generator injects from the tax-year TOML, and the TOML
// path each one carries. Whole-number percentages where the sheet holds a
// percentage, fractions where it holds a fraction.
const ADMIN_TAX_DATA_CELLS = [
  ["P6", "corporation tax small profits rate", (t) => Math.round(t.corporation_tax.small_profits_rate * 100)],
  ["P7", "corporation tax small profits rate (second year)", (t) => Math.round(t.corporation_tax.small_profits_rate * 100)],
  ["P8", "corporation tax main rate", (t) => Math.round(t.corporation_tax.main_rate * 100)],
  ["P9", "marginal relief fraction", (t) => t.corporation_tax.marginal_relief_fraction],
  ["P12", "marginal relief lower limit", (t) => t.corporation_tax.small_profits_limit],
  ["P13", "marginal relief upper limit", (t) => t.corporation_tax.main_rate_limit],
  ["G5", "annual investment allowance", (t) => Math.round(t.capital_allowances.annual_investment_allowance * 100)],
  ["G7", "annual investment allowance (new assets)", (t) => Math.round(t.capital_allowances.annual_investment_allowance * 100)],
  ["G6", "writing down allowance", (t) => Math.round(t.capital_allowances.writing_down_allowance_main * 100)],
  ["G8", "writing down allowance (new assets)", (t) => Math.round(t.capital_allowances.writing_down_allowance_main * 100)],
  ["E11", "motor vehicle cost threshold", (t) => t.capital_allowances.motor_vehicle_cost_threshold],
  ["G11", "motor vehicle allowance restriction", (t) => t.capital_allowances.motor_vehicle_restriction],
  ["G15", "depreciation rate, land and property", (t) => t.depreciation.land_and_property],
  ["G16", "depreciation rate, plant and machinery", (t) => t.depreciation.plant_and_machinery],
  ["G17", "depreciation rate, fixtures and fittings", (t) => t.depreciation.fixtures_and_fittings],
  ["G18", "depreciation rate, computer equipment", (t) => t.depreciation.computer_equipment],
  ["G19", "depreciation rate, motor vehicles", (t) => t.depreciation.motor_vehicles],
  ["N16", "mileage higher rate limit", (t) => t.mileage.higher_rate_limit],
  ["O16", "mileage higher rate pence", (t) => t.mileage.higher_rate_pence],
  ["N17", "mileage lower rate start", (t) => t.mileage.lower_rate_start],
  ["O17", "mileage lower rate pence", (t) => t.mileage.lower_rate_pence],
  ["M19", "standard VAT rate", (t) => Math.round(t.vat.standard_rate * 100)],
  ["M21", "standard VAT rate (second period)", (t) => Math.round(t.vat.standard_rate * 100)],
];

// Depreciation rates the published note quotes, and the Admin cell each one
// should agree with.
const NOTE_RATE_CELLS = [
  ["B27", "G15", "land and property"],
  ["B28", "G16", "plant and machinery"],
  ["B29", "G17", "fixtures and fittings"],
  ["B30", "G18", "computer equipment"],
  ["B31", "G19", "motor vehicles"],
];

// MnthP&L row 9 is the month's sales turnover, the sum of the five product
// rows above it.
const MONTHLY_TURNOVER_ROW = 9;

// Row 1 of a Sales.xlsx month tab totals each analysis column: H1 the whole
// month net of VAT, T1 the bad debts written off and U1 the fixed asset
// sales. Turnover is what is left.
const SALES_MONTH_TOTAL_CELLS = { net: "H1", badDebts: "T1", assetSales: "U1" };

// Row 1 of a Purchases.xlsx month tab: H1 the whole month net of VAT, and
// the four columns whose P&L rows carry something else as well — materials
// (O1, which the stock adjustment also feeds), directors and employee wages
// (R1 and S1, which the payroll summary also feeds) and fixed asset
// purchases (AI1, which reaches the balance sheet rather than the P&L).
const PURCHASES_MONTH_TOTAL_CELLS = { net: "H1", materials: "O1", directorsWages: "R1", employeeWages: "S1", assetPurchases: "AI1" };

// The twelve month tabs a recalculated book actually carries, in accounting
// period order, taken from the period start date on its own Admin sheet.
function fiscalMonthTabs(results) {
  return results.Admin && typeof results.Admin.B9 === "number" ? monthTabsFromPeriodStart(results.Admin.B9) : getMonthTabNames(3);
}

// Month tab names in accounting-period order, taken from the period start
// date the Admin sheet carries, so a leaf workbook's month totals line up
// with the P&L's month columns whatever the year end.
function monthTabsFromPeriodStart(startSerial) {
  const firstMonth = dateFromSerial(startSerial).getUTCMonth();
  return Array.from({ length: 12 }, (_, i) => SHORT_MONTHS[(firstMonth + i) % 12]);
}

// The date an Excel serial stands for.
function dateFromSerial(serial) {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 24 * 60 * 60 * 1000);
}

// The expenses claim form's twelve month tabs, in the order the workbook
// chains them from the first.
const EXPENSES_FORM_MONTHS = Array.from({ length: 12 }, (_, i) => `Month ${String(i + 1).padStart(2, "0")}`);

// CT600 boxes the template populates by formula, and where each reads from.
const CT600_CELLS = [
  "B33",
  "M33",
  "W137",
  "AK66",
  "Z70",
  "Z72",
  "AJ74",
  "AJ76",
  "AJ92",
  "AJ110",
  "AJ126",
  "AJ128",
  "AJ131",
  "AJ145",
  "AJ154",
  "AJ159",
  "AJ163",
  "AJ166",
  "AA126",
];

export function standardReads() {
  const reads = {};
  const add = (sheet, cell) => {
    if (!reads[sheet]) reads[sheet] = [];
    if (!reads[sheet].includes(cell)) reads[sheet].push(cell);
  };

  for (const [sheet, cell] of CELL_MAP) add(sheet, cell);

  // Every month column of the rows that tie to a Sales or Purchases month
  // total, plus the fixed asset rows the note anchors.
  const monthlyRows = [
    ...new Set([
      ...Object.values(SALES_MONTHLY_TIE_ROWS),
      SALES_BAD_DEBT_ROW,
      ...Object.values(PURCHASES_MONTHLY_TIE_ROWS),
      MONTHLY_TURNOVER_ROW,
      39,
      40,
    ]),
  ];
  for (const row of monthlyRows) {
    // Column B is the row's own SUM(C:N), the annual figure the netting
    // table compares a journal category against.
    for (const col of ["B", ...MONTH_COLS]) add("MnthP&L", `${col}${row}`);
  }

  // Fixed asset note, class column by class column.
  for (const { noteColumn } of Object.values(SCHEDULE_ASSET_CLASSES)) {
    for (const row of [8, 9, 10, 11, 14, 15, 16, 17, 20]) add("PubNotes", `${noteColumn}${row}`);
  }
  for (const [noteCell] of NOTE_RATE_CELLS) add("PubNotes", noteCell);
  add("PubNotes", "A11");

  // Corporation tax working sheet: the allowance lines, and the two dated
  // tax rows whose day counts, profit shares, rates and tax the charge for
  // the year is built from.
  for (const cell of [
    "E5",
    "H5",
    "I15",
    "I16",
    "I17",
    "I18",
    "A33",
    "A34",
    "A35",
    "E33",
    "E34",
    "F33",
    "F34",
    "G33",
    "G34",
    "J33",
    "J34",
    "L33",
    "L34",
    "I33",
    "I34",
    "K37",
  ])
    add(TAX_SHEET, cell);

  for (const cell of CT600_CELLS) add("CT600", cell);

  for (const [cell] of ADMIN_TAX_DATA_CELLS) add("Admin", cell);
  add("Admin", "F21");
  add("Admin", "B9");
  add("Admin", "B32");
  // The two dated corporation tax rate rows the working sheet copies.
  for (const cell of ["K6", "L6", "N6", "K7", "L7", "N7"]) add("Admin", cell);
  add("PubP&L", "D3");
  add("PubBalSht", "D2");

  // The directors' report quotes the year end, both years' turnover and
  // margin, the dividend the board minuted and the share register. F22 is
  // the only date it takes from the balance sheet rather than the P&L.
  for (const cell of ["F22", "E87", "H87", "D89", "I89", "D94", "I95", "A97", "F97", "A98", "F98"]) add("Report", cell);

  // The published P&L's prior-year column (B) and its own period end date,
  // which the report quotes alongside this year's figures. B14 is the prior
  // year's stock movement, the line OpenAccounts!E48 feeds.
  add("PubP&L", "B9");
  add("PubP&L", "B14");
  add("PubP&L", "B18");
  add("PubP&L", "B54");
  add("PubP&L", "E5");

  // The prior year block's own closing stock line, the one cell in it the
  // template fills with a formula rather than leaving for the reader.
  add("OpenAccounts", "E48");

  // Directors wages, which the emoluments note reads.
  add("TrialBalance", "EJ66");

  // PAYE/NI creditor -- row 34's first-month movement column. Column L
  // holds the fiscal year's first month regardless of year-end (verified
  // against the template: L34 = -(WagesInterface!D4+E4+H4)-(...director
  // row, always 0...)+(...statutory pay, always 0...)). The row's later
  // months also net HMRC bank payments (RP-coded), which is the bank
  // workstream's territory, not payroll's -- this one movement column
  // isolates the payroll-only contribution.
  add("TrialBalance", "L34");

  // WagesInterface -- one row per month (rows 4-15, Apr-Mar template order,
  // remapped to fiscalTabs the same as every other monthly read here).
  // C=gross pay, D=PAYE income tax, E=employee NI, H=employer NI (verified
  // against the template: C4=[9]Apr!$M$1-C17, D4=$N$1-D17, E4=$O$1-E17,
  // H4=$T$1-H17, where the C17/D17/etc subtraction is a second, director-
  // only block that cellWrites() never populates and so always reads 0).
  for (let row = 4; row <= 15; row++) {
    for (const col of ["C", "D", "E", "H"]) add("WagesInterface", `${col}${row}`);
  }

  return reads;
}

// Leaf-file reads for the VAT chain: each month tab's VAT (G1) and gross
// total (H1) from Sales.xlsx and Purchases.xlsx, plus every VATQtr box from
// Vatreturns.xlsx. Vatreturns links Sales, Purchases and Financialaccounts,
// so it recalculates after the hub.
export function multiFileOptions(yearEndMonth) {
  const tabNames = getMonthTabNames(yearEndMonth || 3);
  const salesMonthReads = {};
  const purchasesMonthReads = {};
  for (const tab of tabNames) {
    salesMonthReads[tab] = ["G1", VAT_RATE_CELL, ...Object.values(SALES_MONTH_TOTAL_CELLS)];
    purchasesMonthReads[tab] = ["G1", VAT_RATE_CELL, ...Object.values(PURCHASES_MONTH_TOTAL_CELLS)];
  }
  const vatQtrReads = {};
  for (let q = 1; q <= 5; q++) {
    vatQtrReads[`VATQtr${q}`] = ["G5", "G7", "G9", "G13", "G15", "G17", "G21", "G23"];
  }

  // The interface rows themselves, so a break in the VAT chain names the
  // period and the side it happened on instead of only showing up as a wrong
  // quarter total.
  const vatinterfaceCells = [];
  for (let row = VATINTERFACE_ROWS.first; row <= VATINTERFACE_ROWS.last; row++) {
    for (const col of ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "M"]) vatinterfaceCells.push(`${col}${row}`);
  }
  vatQtrReads.Vatinterface = vatinterfaceCells;

  // Fixedassets Schedule: row 1 holds the whole-schedule totals, rows 57 and
  // 110 the existing and new sub-totals, and each class's own totals row the
  // figures the published note quotes. Column B on a class totals row is the
  // sheet's own comparison against the opening balance sheet. Q/R carry the
  // annual investment and writing down allowances, Y/Z the balancing
  // allowance and charge a disposal throws off.
  const scheduleReads = ["E1", "F1", "G1", "I1", "J1", "K1", "Q1", "R1", "V1", "W1", "X1", "Y1", "Z1", "E57", "E110"];
  for (const layout of Object.values(SCHEDULE_ASSET_CLASSES)) {
    for (const totalRow of [layout.existingTotalRow, layout.newTotalRow]) {
      for (const col of ["E", "F", "I", "W", "X"]) scheduleReads.push(`${col}${totalRow}`);
    }
    scheduleReads.push(`B${layout.existingTotalRow}`);
    scheduleReads.push(layout.rateCell);
  }

  // Each bank workbook's own reconciliation block on the final month tab:
  // A1 opening balance carried through the year, A2 closing balance.
  const bankReads = {};
  for (const fileName of Object.values(BANK_ACCOUNT_FILES)) {
    bankReads[fileName] = { [tabNames[11]]: ["A1", "A2"] };
  }

  // Payslips!Payment -- one row per month (rows 4-15, same template order as
  // WagesInterface). D = NI due (employer + employee), E = income tax due,
  // I = total amount payable (verified against the template).
  const paymentCells = [];
  for (let row = 4; row <= 15; row++) for (const col of ["D", "E", "I"]) paymentCells.push(`${col}${row}`);

  return {
    postHubRecalc: ["Vatreturns.xlsx"],
    additionalReads: {
      "Sales.xlsx": salesMonthReads,
      "Purchases.xlsx": purchasesMonthReads,
      "Vatreturns.xlsx": vatQtrReads,
      "Fixedassets.xlsx": {
        Schedule: [...new Set(scheduleReads)],
        FAreconciliation: ["E11", "K11"],
        // E2 is the long-term-creditors total for the "New Hire Purchase
        // Agreements" block (SUM(E8:E26)); I/J/K on rows 8 and 10 are the
        // two scenario agreements' own monthly payment, capital and
        // interest split.
        HPfinance: ["E2", "I8", "J8", "K8", "I10", "J10", "K10"],
      },
      "Payslips.xlsx": {
        Payment: paymentCells,
        Admin: [
          ...new Set([
            PAYSLIPS_CALENDAR_ANCHOR_CELL,
            ...payrollMonthStarts().flatMap(({ row }) => ["A", "B", "C", "D", "F"].map((col) => `${col}${row}`)),
          ]),
        ],
      },
      "Companysecretary.xlsx": {
        // One member a row: A the name, G the holding. F1 is the sheet's own
        // nominal-value formula (=F3) and G1 its shares-issued total
        // (=SUM(G3:G19)). The directors' report prints the first two members
        // a line each.
        "RegisterofMembers": [
          "F1",
          "G1",
          ...REGISTER_MEMBER_ROWS.flatMap((row) => [`${REGISTER_MEMBER_COLUMNS.name}${row}`, `${REGISTER_MEMBER_COLUMNS.shares}${row}`]),
        ],
        // F2 is the date the board met and E4 the dividend it declared. The
        // directors' report and the trial balance both read E4 across the
        // cross-file link.
        "Boardmeeting": ["F2", "E4"],
        // A registered charge and the directors' valuation of the asset
        // charged, which the balance sheet has to carry as a creditor
        // falling due after more than one year.
        "Charges&Debentures": CHARGE_REGISTER_ROWS.map((row) => `C${row}`),
      },
      // The expenses claim form's mileage rate. Month 01 holds the literal
      // the generator writes and the other eleven chain from it, so reading
      // all twelve proves the write and the chain that carries it.
      "expensesform.xlsx": Object.fromEntries(EXPENSES_FORM_MONTHS.map((sheet) => [sheet, ["C30"]])),
      ...bankReads,
    },
  };
}

export function reportSections(results) {
  const sectionMap = new Map();
  for (const [sheet, cell, label, , section, indent] of CELL_MAP) {
    if (!sectionMap.has(section)) sectionMap.set(section, []);
    const val = results[sheet]?.[cell];
    sectionMap.get(section).push({ label, value: fmt(val), indent });
  }
  const sections = [...sectionMap.entries()].map(([title, rows]) => ({ title, rows }));
  const vat = vatSection(results);
  if (vat) sections.push(vat);
  return sections;
}

// The VAT the books actually charged, taken from the month tabs and from the
// return itself. Every other statement in this report is stated net, so a
// registered company and an unregistered one carrying the same trade read
// identically without it.
function vatSection(results) {
  const months = fiscalMonthTabs(results)
    .map((tab) => [results[`Sales.xlsx!${tab}`], results[`Purchases.xlsx!${tab}`]])
    .filter(([sales, purchases]) => sales || purchases);
  if (months.length === 0) return null;

  const num = (v) => (typeof v === "number" ? v : 0);
  const sum = (side, cell) => months.reduce((total, pair) => total + num(pair[side]?.[cell]), 0);
  const salesVat = sum(0, "G1");
  const salesNet = sum(0, SALES_MONTH_TOTAL_CELLS.net);
  const purchasesVat = sum(1, "G1");
  const purchasesNet = sum(1, PURCHASES_MONTH_TOTAL_CELLS.net);

  const rows = [
    { label: "Sales invoiced including VAT", value: fmt(salesNet + salesVat), indent: 1 },
    { label: "VAT charged on sales", value: fmt(salesVat), indent: 1 },
    { label: "Sales net of VAT", value: fmt(salesNet), indent: 1 },
    { label: "Purchases invoiced including VAT", value: fmt(purchasesNet + purchasesVat), indent: 1 },
    { label: "VAT reclaimed on purchases", value: fmt(purchasesVat), indent: 1 },
    { label: "Purchases net of VAT", value: fmt(purchasesNet), indent: 1 },
    { label: "**VAT due for the year**", value: fmt(salesVat - purchasesVat), indent: 0 },
  ];
  // The package ships five return forms: four quarters from the VAT start
  // month and one more, for a business whose quarter stagger does not line up
  // with those four. Printing four left the fifth out of the report
  // altogether. Each form carries the period it was filled in for, and the
  // cycle rows above the boxes say which months each one reaches.
  const forms = [];
  const quarterRows = [];
  for (let q = 1; q <= 5; q++) {
    const boxes = results[`Vatreturns.xlsx!VATQtr${q}`];
    if (!boxes) continue;
    const end = num(boxes.G5);
    forms.push({ name: `Q${q}`, end: vatinterfaceRowEnding(results, end) });
    const period = periodEnding(end);
    quarterRows.push({ label: `Q${q}${period} box 1: VAT due on sales`, value: fmt(num(boxes.G9)), indent: 1 });
    quarterRows.push({ label: `Q${q}${period} box 4: VAT reclaimed on purchases`, value: fmt(num(boxes.G15)), indent: 1 });
    quarterRows.push({ label: `Q${q}${period} box 5: net VAT due`, value: fmt(num(boxes.G17)), indent: 1 });
  }
  if (quarterRows.length > 0) {
    rows.push(...vatCycleRows(vatinterfacePeriods(results), forms));
    rows.push({ label: "**The return forms as the package fills them in**", value: "" });
    rows.push(...quarterRows);
  }
  return { title: "VAT Returns", rows };
}

// The VAT periods the interface carries, one per row, with the VAT on each
// side and whether the period is one of the twelve accounting months.
function vatinterfacePeriods(results) {
  const vatinterface = results["Vatreturns.xlsx!Vatinterface"];
  if (!vatinterface) return [];
  const num = (v) => (typeof v === "number" ? v : 0);
  const periods = [];
  for (let row = VATINTERFACE_ROWS.first; row <= VATINTERFACE_ROWS.last; row++) {
    const end = num(vatinterface[`B${row}`]);
    if (!end) continue;
    periods.push({
      row,
      endLabel: formatSerialDate(end),
      outputVat: num(vatinterface[`F${row}`]),
      inputVat: num(vatinterface[`J${row}`]),
      inAccountingYear: row >= VATINTERFACE_ROWS.firstMonth && row < VATINTERFACE_ROWS.firstMonth + 12,
    });
  }
  return periods;
}

// The interface row a return form's own period end date lands on, or null
// when the form names a date the interface does not carry.
function vatinterfaceRowEnding(results, end) {
  const vatinterface = results["Vatreturns.xlsx!Vatinterface"];
  if (!vatinterface || !end) return null;
  for (let row = VATINTERFACE_ROWS.first; row <= VATINTERFACE_ROWS.last; row++) {
    if (Math.round(typeof vatinterface[`B${row}`] === "number" ? vatinterface[`B${row}`] : 0) === Math.round(end)) return row;
  }
  return null;
}

function formatSerialDate(serial) {
  return dateFromSerial(serial).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
}

// The " (period ending d Month yyyy)" a VAT return line carries, or nothing
// at all when the form has no date on it.
function periodEnding(serial) {
  return serial ? ` (period ending ${formatSerialDate(serial)})` : "";
}

// The asset workbook's totals rows carry no caption of their own, so the
// appendix printed them as bare letters and a reader had to guess which
// column was cost, which was depreciation and which was the disposals.
// Every label here is the column's formula read back from the template.
const FIXED_ASSET_CELL_LABELS = {
  "Fixedassets.xlsx!Schedule": {
    E1: "Total cost of every asset on the schedule, assets sold in the year included",
    F1: "Total accumulated depreciation brought forward",
    G1: "Total net book value brought forward (cost less depreciation brought forward)",
    I1: "Total depreciation charged for the year",
    J1: "Total accumulated depreciation carried forward (brought forward plus the charge)",
    K1: "Total net book value carried forward, disposals removed",
    Q1: "Total annual investment allowance claimed",
    R1: "Total writing down allowance claimed",
    V1: "Sale proceeds of the assets sold in the year, net of VAT",
    W1: "Cost of the assets sold in the year",
    X1: "Accumulated depreciation on the assets sold in the year",
    Y1: "Balancing allowance on the disposals",
    Z1: "Balancing charge on the disposals",
    E57: "Cost of the assets owned at the start of the year",
    E110: "Cost of the assets bought during the year",
  },
  "Fixedassets.xlsx!FAreconciliation": {
    E11: "Additions the schedule lists, net of VAT",
    K11: "Disposal proceeds the schedule lists, net of VAT",
  },
};

export function cellLabels() {
  const labels = {};
  for (const [sheet, cell, diyLabel, glMapping] of CELL_MAP) {
    const key = `${sheet}!${cell}`;
    labels[key] = { diyLabel, glMapping };
  }
  for (const [sheet, cells] of Object.entries(FIXED_ASSET_CELL_LABELS)) {
    for (const [cell, diyLabel] of Object.entries(cells)) labels[`${sheet}!${cell}`] = { diyLabel, glMapping: "" };
  }
  return labels;
}

function fmt(v) {
  if (v === null || v === undefined || v === "" || v === " ") return "—";
  // A nil that arrived by negation carries a sign bit and prints as "-0",
  // which reads as a defect in a statement.
  if (typeof v === "number") return (v === 0 ? 0 : v).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return String(v);
}

// ── Accounting profit to tax profit bridge ─────────────────────────────────

// The working sheet starts at operating profit, so the management accounts'
// bank interest comes out and goes back in: the accounts carry it net of the
// tax deducted at source and the computation charges the gross figure. The
// two interest lines below differ by exactly that tax, which the working
// sheet then credits against the charge (CorporationTax!K37). Depreciation
// and goodwill written off are not deductible and are added back; capital
// allowances stand in for the depreciation.
export function profitBridge(results) {
  const pl = results["MnthP&L"];
  const ct = results[TAX_SHEET];
  if (!pl || !ct) return null;

  const num = (v) => (typeof v === "number" ? v : 0);
  const rows = [
    { label: "Profit before tax per the management profit and loss account", cell: "MnthP&L!B45", value: num(pl.B45) },
    { label: "Less bank interest received, net of tax deducted at source", cell: "MnthP&L!B44", value: -num(pl.B44) },
    { label: "Add back goodwill written off", cell: "CorporationTax!I7", value: num(ct.I7) },
    { label: "Add back depreciation charged in the year", cell: "CorporationTax!I8", value: num(ct.I8) },
    { label: "Less capital allowances", cell: "CorporationTax!K20", value: -num(ct.K20) },
    { label: "Add gross bank interest received", cell: "CorporationTax!K24", value: num(ct.K24) },
    { label: "Less losses brought forward", cell: "CorporationTax!K26", value: -num(ct.K26) },
  ];

  return buildProfitBridge(rows, `${TAX_SHEET}!K28`, num(ct.K28));
}

// ── Journal category VAT netting ───────────────────────────────────────────

// A journal row takes its own VAT off its own gross and rounds nothing
// (template: H = G * rate / (100 + rate), I = G - H), and the analysis
// columns the statements read sum those row figures. Netting an annual
// total instead leaves pennies behind, so the netting table sums per entry
// the same way the sheet does.
function sheetNetOfVat(gross, rate) {
  return gross - (gross * rate) / (1 + rate);
}

// Journal totals by code letter: gross as entered, net the way the journal
// rows net it, and net the way the asset schedule holds it -- the writer
// puts a cost rounded to the penny on a schedule row, so a category that
// lands there is compared against the rounded figure.
function journalTotalsByCode(journal, rate, defaultCode) {
  const gross = {};
  const net = {};
  const scheduleNet = {};
  for (const transactions of Object.values(journal || {})) {
    for (const tx of transactions) {
      const code = tx.code || defaultCode;
      gross[code] = (gross[code] || 0) + tx.amount;
      net[code] = (net[code] || 0) + sheetNetOfVat(tx.amount, rate);
      scheduleNet[code] = (scheduleNet[code] || 0) + netOfVat(tx.amount, rate);
    }
  }
  return { gross, net, scheduleNet };
}

// One row per journal category that crosses into another statement, so the
// gross-to-net step is stated where it happens rather than only in total.
export function categoryNetting(results, scenario) {
  // With no journal there is nothing to net: every row would compare a nil
  // against whatever the sheet holds and read as a category that lost its
  // whole value on the way.
  if (!scenario?.sales && !scenario?.purchases) return null;
  const pl = results["MnthP&L"];
  const fr = results["Fixedassets.xlsx!FAreconciliation"];
  if (!pl && !fr) return null;

  const rate = vatRateFor(scenario);
  const num = (v) => (typeof v === "number" ? v : 0);
  // The same code defaults the writer applies, so an entry that names no code
  // is measured against the line the sheet actually books it on.
  const sales = journalTotalsByCode(scenario.sales, rate, "a");
  const purchases = journalTotalsByCode(scenario.purchases, rate, "g");
  const rows = [];

  const plRow = (journal, side, code, row, sign = 1) => {
    if (!pl) return;
    rows.push({
      code: `${journal} ${code}`,
      label: PL_ROW_CAPTIONS[row],
      gross: side.gross[code] || 0,
      net: side.net[code] || 0,
      cell: sign < 0 ? `MnthP&L!B${row} negated` : `MnthP&L!B${row}`,
      downstream: sign * num(pl[`B${row}`]),
    });
  };

  for (const [code, row] of Object.entries(SALES_MONTHLY_TIE_ROWS)) plRow("sales", sales, code, row);
  plRow("sales", sales, "o", SALES_BAD_DEBT_ROW, -1);
  for (const [code, row] of Object.entries(PURCHASES_MONTHLY_TIE_ROWS)) plRow("purchases", purchases, code, row);

  // Casual workers are purchased under their own code and land on the wages
  // line together with the payroll's gross pay, so the payroll comes off the
  // line before the two sides are comparable.
  if (pl && scenario.payroll) {
    let payrollGross = 0;
    for (const entries of Object.values(scenario.payroll)) {
      for (const entry of entries) payrollGross += entry.grossPay || 0;
    }
    rows.push({
      code: "purchases w",
      label: "Wages and Salaries, less the payroll's own gross pay",
      gross: purchases.gross.w || 0,
      net: purchases.net.w || 0,
      cell: "MnthP&L!B18 less the payroll gross pay",
      downstream: num(pl.B18) - payrollGross,
    });
  }

  if (fr) {
    rows.push({
      code: "purchases fa",
      label: "Capitalised fixed asset spend",
      gross: purchases.gross.fa || 0,
      net: purchases.scheduleNet.fa || 0,
      cell: "Fixedassets.xlsx!FAreconciliation!E11",
      downstream: num(fr.E11),
    });
    rows.push({
      code: "sales fs",
      label: "Fixed asset disposal proceeds",
      gross: sales.gross.fs || 0,
      net: sales.scheduleNet.fs || 0,
      cell: "Fixedassets.xlsx!FAreconciliation!K11",
      downstream: num(fr.K11),
    });
  }

  return buildCategoryNetting(rate, rows);
}

// ── Compliance checks ──────────────────────────────────────────────────────

// packageYearEnd is the YYYY-MM-DD the package's own directory name carries.
// The reconciler passes it so the year-end seed can be measured against the
// package it was generated for rather than against another cell of the same
// run.
export function checkCompliance(results, expected, taxData, calculateExpectedTax, packageYearEnd) {
  const checks = [];

  function check(name, actual, expectedVal, tolerance = 1) {
    const pass = Math.abs(actual - expectedVal) <= tolerance;
    checks.push({ name, actual, expected: expectedVal, pass, diff: actual - expectedVal });
  }

  // Some of the workbook's own verdicts are wording, not arithmetic: the
  // cell either names what it found or tells the reader to go and fix
  // something. The report shows both sides as text and the diff column stays
  // empty.
  function checkText(name, actual, accepts, expectedDescription) {
    checks.push({ name, actual, expected: expectedDescription, pass: accepts(actual), diff: "" });
  }

  // A template cell that resolves to blank reads back as the string the
  // formula puts there (" "), so every arithmetic read goes through this.
  const num = (v) => (typeof v === "number" ? v : 0);

  // The same cell read as wording. An unwritten cell reads back as null and a
  // formula's blank as " ", and both mean the sheet names nobody.
  const text = (v) => (v === null || v === undefined ? "" : String(v).trim());

  const rate = vatRateFor(expected);

  const pl = results["MnthP&L"];
  if (expected.total_sales !== undefined) check("Total Sales", pl.B9, expected.total_sales);
  if (expected.gross_profit !== undefined) check("Gross Profit", pl.B16, expected.gross_profit);
  if (expected.net_profit !== undefined) check("Net Profit", pl.B45, expected.net_profit);

  // Trial balance audit accuracy check -- the workbook's own whole-book
  // self-check. EJ91 sums every account's year-end closing balance across
  // the full chart (balance sheet items, income, cost of sales, expenses),
  // so any posting that does not balance shows up here even when nothing
  // else in this file reads that account.
  check("Trial Balance: audit accuracy (EJ91)", results.TrialBalance.EJ91, 0);

  // Opening balances. A balance sheet that never posts is still balanced, so
  // EJ91 alone cannot tell an unposted opening from a posted one. These
  // checks tie each opening figure to the trial balance row it feeds.
  if (expected.opening_balance) {
    const ob = expected.opening_balance;
    const oa = results.OpenAccounts;
    const tb = results.TrialBalance;
    const cost = ob.fixed_asset_cost || {};
    const depreciation = ob.fixed_asset_depreciation || {};
    const sum = (o) => Object.values(o).reduce((s, v) => s + v, 0);

    check("Opening balance sheet: accuracy check (E37)", oa.E37 || 0, 0);
    check("Trial Balance: opening balances audit check (D91)", tb.D91 || 0, 0);

    check("Trial Balance opening: fixed asset cost", (tb.D6 || 0) + (tb.D7 || 0) + (tb.D8 || 0) + (tb.D9 || 0) + (tb.D10 || 0), sum(cost));
    check(
      "Trial Balance opening: accumulated depreciation",
      (tb.D11 || 0) + (tb.D12 || 0) + (tb.D13 || 0) + (tb.D14 || 0) + (tb.D15 || 0),
      -sum(depreciation),
    );
    check("Trial Balance opening: stock", tb.D19 || 0, ob.stock || 0);
    check("Trial Balance opening: trade debtors", tb.D20 || 0, ob.trade_debtors || 0);
    check("Trial Balance opening: bank current account", tb.D22 || 0, ob.current_account || 0);
    check("Trial Balance opening: bank savings account", tb.D23 || 0, ob.savings_account || 0);
    check("Trial Balance opening: credit card account", tb.D24 || 0, ob.credit_card || 0);
    check("Trial Balance opening: cash account", tb.D25 || 0, ob.cash || 0);
    check("Trial Balance opening: trade creditors", tb.D28 || 0, -(ob.trade_creditors || 0));
    check("Trial Balance opening: HMRC VAT creditor", tb.D33 || 0, -(ob.vat_due || 0));
    check("Trial Balance opening: HMRC corporation tax creditor", tb.D35 || 0, -(ob.corporation_tax || 0));
    check("Trial Balance opening: directors loan", tb.D39 || 0, -(ob.directors_loan || 0));
    check("Trial Balance opening: creditors due after more than one year", tb.D40 || 0, -(ob.long_term_creditors || 0));
    check("Trial Balance opening: share capital", tb.D42 || 0, -(ob.share_capital || 0));
    check("Trial Balance opening: revenue reserve", tb.D43 || 0, -(ob.retained_earnings || 0));

    // The directors loan is the one opening balance the year also moves, so
    // its final balance proves the opening survived into the closing column
    // rather than being overwritten by the in-year postings.
    if (expected.bank) {
      let loanMovement = 0;
      for (const transactions of Object.values(expected.bank)) {
        for (const tx of transactions) {
          if (tx.code !== "DL") continue;
          loanMovement += tx.direction === "out" ? tx.amount : -tx.amount;
        }
      }
      check("Trial Balance: directors loan final = opening + movement", tb.EJ39 || 0, (tb.D39 || 0) + loanMovement);
    }
  }

  // P&L internal consistency (6a)
  check("P&L: Gross = Turnover - CoS", pl.B16, pl.B9 - (pl.B14 || 0));
  check("P&L: Operating = Gross - Admin", pl.B43, pl.B16 - (pl.B41 || 0));
  check("P&L: PBT = Operating + Interest", pl.B45, (pl.B43 || 0) + (pl.B44 || 0));

  // Total expenses cross-check (6b)
  const ltdAdminSum = [
    pl.B18,
    pl.B19,
    pl.B20,
    pl.B21,
    pl.B22,
    pl.B23,
    pl.B24,
    pl.B25,
    pl.B26,
    pl.B27,
    pl.B28,
    pl.B29,
    pl.B30,
    pl.B31,
    pl.B32,
    pl.B33,
    pl.B34,
    pl.B35,
    pl.B36,
    pl.B37,
    pl.B38,
    pl.B39,
    pl.B40,
  ].reduce((s, v) => s + (v || 0), 0);
  check("P&L: Admin lines sum = Total", pl.B41, ltdAdminSum);

  // Expense line totals (6f) — Ltd P&L keeps purchases at gross (same as SE)
  if (expected.total_premises_net) check("Premises", pl.B21 || 0, expected.total_premises_net);
  if (expected.total_legal_net) check("Legal & Professional", pl.B33 || 0, expected.total_legal_net);

  // Stock and debtors on the published balance sheet. Both are derived: stock
  // comes from the physical count against the calculated value, debtors from
  // opening debtors plus everything invoiced less everything banked as a
  // customer receipt. A balance sheet stays balanced whichever figure those
  // chains land on, so anchoring the published lines to the scenario's own
  // closing figures is the only way a stale opening balance or a year of
  // uncollected sales shows up.
  const stock = results.Stock;
  const pubBS = results.PubBalSht;
  const openingStock = expected.stock?.opening ?? expected.opening_stock;
  const closingStock = expected.stock?.closing ?? expected.closing_stock;
  if (openingStock !== undefined && stock) {
    check("Stock: opening carried in from the opening balance sheet", stock.D6 || 0, openingStock);
  }
  if (closingStock !== undefined && stock) {
    check("Stock: physical count at the year end", stock[STOCK_FINAL_COUNT_CELL] || 0, closingStock);
    check(
      "Stock: loss adjustment = count - calculated",
      stock[STOCK_FINAL_ADJUSTMENT_CELL] || 0,
      (stock[STOCK_FINAL_COUNT_CELL] || 0) - (stock[STOCK_FINAL_CALCULATED_CELL] || 0),
    );
    if (pubBS) check("Published balance sheet: stock = year-end stock", pubBS.E10 || 0, closingStock);

    // What the sheet works the year-end stock out to be, before anyone counts
    // it: the opening figure, plus the materials bought in the year, less the
    // materials its stock percentage reckons went out inside the product
    // sales. Both sides come from the scenario, so a month of materials that
    // never reached the sheet, or a percentage that never reached H4, shows
    // up here instead of being absorbed into the count adjustment.
    const materialsPercent = expected.stock?.materials_percent;
    if (materialsPercent !== undefined) {
      const bought = journalTotalsByCode(expected.purchases, rate, "g").net.s || 0;
      const sold = materialsPercent * (journalTotalsByCode(expected.sales, rate, "a").net.a || 0);
      check(
        "Stock: calculated stock = opening + materials bought - materials sold",
        num(stock[STOCK_FINAL_CALCULATED_CELL]),
        num(stock.D6) + bought - sold,
      );
    }
  }
  if (expected.closing_debtors && pubBS) {
    const total = expected.closing_debtors.reduce((s, d) => s + d.amount, 0);
    check("Published balance sheet: trade debtors = closing debtors", pubBS.E11 || 0, total);
  }

  // VAT chain: Sales/Purchases month VAT totals must flow through the
  // Vatinterface external links into the VATQtr boxes. The month totals are
  // read straight from the leaf workbooks, so a broken link chain shows up
  // as a quarter-sum mismatch here rather than as consistent zeros.
  const salesMonthKeys = Object.keys(results).filter((k) => k.startsWith("Sales.xlsx!"));
  const purchasesMonthKeys = Object.keys(results).filter((k) => k.startsWith("Purchases.xlsx!"));
  const vatQtr = (n) => results[`Vatreturns.xlsx!VATQtr${n}`];
  if (salesMonthKeys.length === 12 && purchasesMonthKeys.length === 12 && vatQtr(1)) {
    const annualOutputVat = salesMonthKeys.reduce((s, k) => s + (results[k].G1 || 0), 0);
    const annualInputVat = purchasesMonthKeys.reduce((s, k) => s + (results[k].G1 || 0), 0);
    const sumBox = (cell) => [1, 2, 3, 4].reduce((s, n) => s + (vatQtr(n)?.[cell] || 0), 0);

    check("VAT: Q1-Q4 box 1 = Sales VAT", sumBox("G9"), annualOutputVat);
    check("VAT: Q1-Q4 box 4 = Purchases VAT", sumBox("G15"), annualInputVat);
    for (const n of [1, 2, 3, 4]) {
      const q = vatQtr(n);
      if (q) check(`VAT Q${n}: box 5 = box 3 - box 4`, q.G17 || 0, (q.G13 || 0) - (q.G15 || 0));
    }
    if (expected.vat_output_total !== undefined) check("VAT: annual output VAT", annualOutputVat, expected.vat_output_total);
    if (expected.vat_input_total !== undefined) check("VAT: annual input VAT", annualInputVat, expected.vat_input_total);

    // Both sides of the year against the journals that fed them, split at the
    // rate the scenario's registration status puts in the book. A business
    // that is not registered has to land on nil here, and it lands there
    // because the rate cell is zero, not because the journals are empty.
    const journalVat = (journal) => {
      let total = 0;
      for (const transactions of Object.values(journal || {})) {
        for (const tx of transactions) total += tx.amount - netOfVat(tx.amount, rate);
      }
      return total;
    };
    if (expected.sales) check("VAT: annual output VAT = the sales journal at the book's rate", annualOutputVat, journalVat(expected.sales));
    if (expected.purchases) {
      check("VAT: annual input VAT = the purchase journal at the book's rate", annualInputVat, journalVat(expected.purchases));
    }
  }

  // The rate cell itself, month by month on both journals. A non-registered
  // scenario writes 0 into the first Sales month and nothing else; every
  // other month has to arrive at the same rate down the template's own chain
  // of references, so a month that broke away from it shows up here.
  fiscalMonthTabs(results).forEach((tab) => {
    for (const journal of ["Sales.xlsx", "Purchases.xlsx"]) {
      const month = results[`${journal}!${tab}`];
      if (month) check(`${journal} ${tab}: VAT rate charged (${VAT_RATE_CELL})`, num(month[VAT_RATE_CELL]), rate * 100, 0);
    }
  });

  // ── Vatinterface: where in the VAT chain a break happened ────────────────
  //
  // The quarter totals above catch a break; these say where it is. Each
  // interface row is compared against the leaf workbook or the straddling
  // entry sheet that feeds it, each quarter column against the three period
  // rows it sums, and each VAT box against the interface row its LOOKUP lands
  // on. A month link that stops carrying fails on that month and side alone.
  const vatinterface = results["Vatreturns.xlsx!Vatinterface"];
  if (vatinterface) {
    fiscalMonthTabs(results).forEach((tab, i) => {
      const row = VATINTERFACE_ROWS.firstMonth + i;
      const salesMonth = results[`Sales.xlsx!${tab}`];
      const purchasesMonth = results[`Purchases.xlsx!${tab}`];
      if (salesMonth) {
        check(
          `Vatinterface D${row}: ${tab} sales net = Sales.xlsx ${tab}`,
          num(vatinterface[`D${row}`]),
          num(salesMonth[SALES_MONTH_TOTAL_CELLS.net]),
        );
        check(`Vatinterface F${row}: ${tab} output VAT = Sales.xlsx ${tab}`, num(vatinterface[`F${row}`]), num(salesMonth.G1));
      }
      if (purchasesMonth) {
        check(
          `Vatinterface H${row}: ${tab} purchases net = Purchases.xlsx ${tab}`,
          num(vatinterface[`H${row}`]),
          num(purchasesMonth[PURCHASES_MONTH_TOTAL_CELLS.net]),
        );
        check(`Vatinterface J${row}: ${tab} input VAT = Purchases.xlsx ${tab}`, num(vatinterface[`J${row}`]), num(purchasesMonth.G1));
      }
    });

    // The straddling periods, anchored in the entries the scenario put on
    // their own sheets. The sheets compute VAT from the gross figure at the
    // standard rate, so the expectation splits the same gross the same way.
    const straddlingGross = (entries) => {
      const byPeriod = {};
      for (const entry of entries || []) byPeriod[entry.period] = (byPeriod[entry.period] || 0) + entry.amount;
      return byPeriod;
    };
    const straddlingSales = straddlingGross(expected.vat_straddling_sales);
    const straddlingPurchases = straddlingGross(expected.vat_straddling_purchases);
    if (expected.vat_straddling_sales || expected.vat_straddling_purchases) {
      for (const [period, row] of Object.entries(STRADDLING_PERIOD_ROWS)) {
        const salesGross = straddlingSales[period] || 0;
        const purchasesGross = straddlingPurchases[period] || 0;
        check(
          `Vatinterface D${row}: ${period} sales net = the straddling sales entered for that period`,
          num(vatinterface[`D${row}`]),
          netOfVat(salesGross, rate),
        );
        check(
          `Vatinterface F${row}: ${period} output VAT = the straddling sales entered for that period`,
          num(vatinterface[`F${row}`]),
          salesGross - netOfVat(salesGross, rate),
        );
        check(
          `Vatinterface H${row}: ${period} purchases net = the straddling purchases entered for that period`,
          num(vatinterface[`H${row}`]),
          netOfVat(purchasesGross, rate),
        );
        check(
          `Vatinterface J${row}: ${period} input VAT = the straddling purchases entered for that period`,
          num(vatinterface[`J${row}`]),
          purchasesGross - netOfVat(purchasesGross, rate),
        );
      }
    }

    // Each VAT box against the interface row its own quarter-end date selects,
    // and that row's quarter columns against the three period rows they sum.
    const quarterColumns = [
      ["E", "D", "sales net"],
      ["G", "F", "output VAT"],
      ["I", "H", "purchases net"],
      ["K", "J", "input VAT"],
    ];
    for (let q = 1; q <= 5; q++) {
      const qtr = vatQtr(q);
      if (!qtr || typeof qtr.G5 !== "number") continue;
      let row = null;
      for (let r = VATINTERFACE_ROWS.first; r <= VATINTERFACE_ROWS.last; r++) {
        if (Math.round(num(vatinterface[`B${r}`])) === Math.round(qtr.G5)) row = r;
      }
      check(`VAT Q${q}: quarter end date is one of the Vatinterface periods`, row === null ? 0 : 1, 1, 0);
      if (row === null) continue;

      if (row - 2 >= VATINTERFACE_ROWS.first) {
        for (const [total, period, label] of quarterColumns) {
          check(
            `Vatinterface ${total}${row}: quarter ${label} = its three period rows`,
            num(vatinterface[`${total}${row}`]),
            num(vatinterface[`${period}${row - 2}`]) + num(vatinterface[`${period}${row - 1}`]) + num(vatinterface[`${period}${row}`]),
          );
        }
      }

      check(`VAT Q${q}: box 1 (G9) = Vatinterface quarter VAT due (G${row})`, num(qtr.G9), num(vatinterface[`G${row}`]));
      check(`VAT Q${q}: box 4 (G15) = Vatinterface quarter VAT reclaimed (K${row})`, num(qtr.G15), num(vatinterface[`K${row}`]));
      check(`VAT Q${q}: box 7 (G23) = Vatinterface quarter purchases net (I${row})`, num(qtr.G23), num(vatinterface[`I${row}`]));
      // Box 6 is sales net of VAT, or sales including VAT when the flat rate
      // scheme flag in column M is set.
      const flatRate = num(vatinterface[`M${row}`]) > 0;
      check(
        `VAT Q${q}: box 6 (G21) = Vatinterface quarter sales ${flatRate ? "including" : "net of"} VAT`,
        num(qtr.G21),
        num(vatinterface[`E${row}`]) + (flatRate ? num(vatinterface[`G${row}`]) : 0),
      );
      check(
        `VAT Q${q}: payment due date (G7) = Vatinterface final date for payment (C${row})`,
        num(qtr.G7),
        num(vatinterface[`C${row}`]),
        0,
      );
    }

    // ── The five return forms as one cycle ────────────────────────────────
    //
    // Each form's own date decides which three interface rows it declares, so
    // the five together are checked as a cycle: distinct periods, Q1 to Q4 a
    // quarter apart and covering the twelve accounting months once each, and
    // the spare fifth on the last period the interface carries.
    const periods = vatinterfacePeriods(results);
    const returnForms = [];
    for (let q = 1; q <= 5; q++) {
      const qtr = vatQtr(q);
      if (qtr && typeof qtr.G5 === "number") returnForms.push({ name: `Q${q}`, end: vatinterfaceRowEnding(results, qtr.G5) });
    }
    const coverage = vatReturnCoverage(periods, returnForms);
    if (coverage.placed.length === 5) {
      const [q1, q2, q3, q4, q5] = coverage.placed;
      check("VAT: the five returns end on five different periods", new Set(coverage.placed.map((form) => form.row)).size, 5, 0);
      for (const [earlier, later] of [
        [q1, q2],
        [q2, q3],
        [q3, q4],
      ]) {
        check(`VAT: ${later.name} ends a quarter after ${earlier.name}`, later.row - earlier.row, 3, 0);
      }
      const quarterlyRows = new Set([q1, q2, q3, q4].flatMap((form) => form.covers));
      check(
        "VAT: Q1-Q4 cover every month of the accounting year",
        periods.filter((period) => period.inAccountingYear && quarterlyRows.has(period.row)).length,
        periods.filter((period) => period.inAccountingYear).length,
        0,
      );
      check("VAT: Q5 ends on the last period the Vatinterface carries", q5.row, VATINTERFACE_ROWS.last, 0);

      // Five consecutive quarters need fifteen periods and the interface can
      // total fourteen, so the spare cannot start where the fourth return
      // ends. The period they share is the workbook's own limit, reported
      // with the output VAT that would go in twice, and a run is not stopped
      // for it.
      checks.push({
        name: "VAT: periods more than one of the five returns declares",
        actual: coverage.shared.length,
        expected: 0,
        pass: coverage.shared.length === 0,
        diff: coverage.shared.length,
        severity: "warning",
      });
      checks.push({
        name: "VAT: output VAT declared on more than one of the five returns",
        actual: coverage.shared.reduce((total, period) => total + period.outputVat, 0),
        expected: 0,
        pass: coverage.shared.length === 0,
        diff: coverage.shared.reduce((total, period) => total + period.outputVat, 0),
        severity: "warning",
      });
    }
  }

  // ── Fixed assets: the published note against the asset schedule ──────────
  //
  // PubNotes reads the Schedule class by class across a cross-file external
  // link, so reading both sides and comparing them proves the link carried
  // the right figures. Every row is anchored in the Schedule's own totals,
  // never in another cell of the note, so consistent zeros cannot pass.
  const schedule = results["Fixedassets.xlsx!Schedule"];
  const notes = results.PubNotes;
  if (schedule) {
    // Closing NBV identity within the Schedule itself: cost less disposals,
    // less depreciation carried forward less depreciation on the disposals.
    check(
      "Fixed assets: closing NBV = cost less disposals, less depreciation carried forward less depreciation on disposals",
      num(schedule.K1),
      num(schedule.E1) - num(schedule.W1) - (num(schedule.J1) - num(schedule.X1)),
    );
  }
  if (schedule && notes) {
    for (const [className, layout] of Object.entries(SCHEDULE_ASSET_CLASSES)) {
      const col = layout.noteColumn;
      const existing = layout.existingTotalRow;
      const added = layout.newTotalRow;
      const noteRow = (row) => num(notes[`${col}${row}`]);
      const both = (scheduleCol) => num(schedule[`${scheduleCol}${existing}`]) + num(schedule[`${scheduleCol}${added}`]);

      check(`Fixed asset note (${className}): cost brought forward = Schedule`, noteRow(8), num(schedule[`E${existing}`]));
      check(`Fixed asset note (${className}): additions = Schedule`, noteRow(9), num(schedule[`E${added}`]));
      check(`Fixed asset note (${className}): disposals at cost = Schedule`, noteRow(10), both("W"));
      check(`Fixed asset note (${className}): cost carried forward`, noteRow(11), noteRow(8) + noteRow(9) - noteRow(10));
      check(`Fixed asset note (${className}): depreciation brought forward = Schedule`, noteRow(14), num(schedule[`F${existing}`]));
      check(`Fixed asset note (${className}): charge for the year = Schedule`, noteRow(15), both("I"));
      check(`Fixed asset note (${className}): depreciation on disposals = Schedule`, noteRow(16), both("X"));
      check(`Fixed asset note (${className}): depreciation carried forward`, noteRow(17), noteRow(14) + noteRow(15) - noteRow(16));
      check(`Fixed asset note (${className}): net book value = cost less depreciation`, noteRow(20), noteRow(11) - noteRow(17));
    }

    check("Fixed asset note: total cost brought forward = Schedule existing assets", num(notes.G8), num(schedule.E57));
    check("Fixed asset note: total additions = Schedule new assets", num(notes.G9), num(schedule.E110));
    check("Fixed asset note: total charge for the year = Schedule", num(notes.G15), num(schedule.I1));
    check("Fixed asset note: total disposals at cost = Schedule", num(notes.G10), num(schedule.W1));
    check("Fixed asset note: total depreciation on disposals = Schedule", num(notes.G16), num(schedule.X1));
    check(
      "Fixed asset note: total net book value = the asset class columns",
      num(notes.G20),
      Object.values(SCHEDULE_ASSET_CLASSES).reduce((s, l) => s + num(notes[`${l.noteColumn}20`]), 0),
    );

    // The Schedule's own per-class comparison against the opening balance
    // sheet. Column B on each class totals row reads OpenAccounts across a
    // leaf-to-hub external link and reports either the class name or a
    // warning to go back and check the opening figures. It is the only place
    // the fixed asset schedule and the opening balance sheet meet, so a
    // class entered on one and not the other shows up here and nowhere else.
    for (const [className, layout] of Object.entries(SCHEDULE_ASSET_CLASSES)) {
      const verdict = schedule[`B${layout.existingTotalRow}`];
      checkText(
        `Fixed asset schedule (${className}): opening cost and depreciation agree with the opening balance sheet`,
        typeof verdict === "string" ? verdict : "",
        (text) => text.startsWith("Existing "),
        "an Existing ... heading",
      );
    }
  }

  // The balance sheet's fixed asset line is built from the trial balance,
  // which takes the cost movements from Purchases and Sales and the
  // depreciation from the Schedule. It can only equal the note's net book
  // value when the Schedule and the two ledgers agree.
  const pubBalSht = results.PubBalSht;
  if (pubBalSht && notes) {
    check("Published balance sheet: fixed assets = fixed asset note net book value", num(pubBalSht.F6), num(notes.G20));
  }

  // The share register carries no opening/closing split of its own -- it is
  // the company's live share register as of the accounts date -- so it ties
  // to the closing balance sheet figure. F1 is the sheet's own nominal-value
  // formula (=F3) and G1 its own shares-issued total (=SUM(G3:G19)).
  const register = results["Companysecretary.xlsx!RegisterofMembers"];
  if (register && pubBalSht) {
    check(
      "RegisterofMembers: nominal value x shares issued = PubBalSht share capital",
      (register.F1 || 0) * (register.G1 || 0),
      num(pubBalSht.F36),
    );
  }

  // ── The directors' report against the statements it quotes ───────────────
  //
  // The report is the narrative that goes out with the accounts, and every
  // figure on it is a formula reading somewhere else in the book (verified
  // against the template: F22 = PubBalSht!D2, E87 = 'PubP&L'!F9, H87 =
  // 'PubP&L'!B9, D89 and I89 the two years' gross margins, D94 =
  // [8]Boardmeeting!$E$4, I95 = [8]RegisterofMembers!$G$1 and F97/F98 its
  // $G$3/$G$4, where [8] is Companysecretary.xlsx). Nothing else in the book
  // reads these cells, so a report quoting figures the accounts do not carry
  // shows up here and nowhere else.
  const report = results.Report;
  const publishedPL = results["PubP&L"];
  if (report && publishedPL) {
    check("Directors' report: sales turnover = published P&L turnover", num(report.E87), num(publishedPL.F9), 0.01);
    check("Directors' report: last year's turnover = published P&L prior year column", num(report.H87), num(publishedPL.B9), 0.01);

    // Both margin cells carry the same rule: a year with turnover publishes
    // gross profit over turnover, a year without publishes a blank. The
    // fixture has no prior year, so this year's margin is a number and last
    // year's is the blank the formula puts there.
    const marginCheck = (name, cell, turnover, grossProfit) => {
      if (turnover > 0) check(name, num(cell), grossProfit / turnover, 0.000001);
      else
        checkText(
          name,
          typeof cell === "string" ? cell : String(cell ?? ""),
          (text) => text.trim() === "",
          "blank, there being no turnover to divide by",
        );
    };
    marginCheck(
      "Directors' report: trading margin = published gross profit over turnover",
      report.D89,
      num(publishedPL.F9),
      num(publishedPL.F18),
    );
    marginCheck(
      "Directors' report: last year's trading margin = published prior year gross profit over turnover",
      report.I89,
      num(publishedPL.B9),
      num(publishedPL.B18),
    );

    // The published P&L reaches turnover from the trial balance's closing
    // column and the management P&L from its month columns, so tying the two
    // is what anchors everything the report quotes to the scenario's own
    // sales.
    check("Published P&L: turnover = management P&L turnover", num(publishedPL.F9), num(pl.B9), 0.01);

    // The prior year column is the "PREVIOUS YEAR PROFIT & LOSS ACCOUNT"
    // block on OpenAccounts, rows 43 to 85, which the reader types in. E48
    // ("Less Closing Stock") is the one cell the template fills for them: it
    // echoes E15, this year's opening stock, because last year closed on
    // whatever this year opened with. It only does so once something else in
    // the block is entered -- otherwise a first-year book publishes a
    // negative cost of sales the size of its opening stock and the same
    // figure again as last year's profit.
    const openAccounts = results.OpenAccounts;
    if (openAccounts && expected.stock?.opening !== undefined) {
      check("Published P&L: prior year closing stock while no comparatives are entered", num(openAccounts.E48), 0, 0);
      check("Published P&L: prior year stock movement while no comparatives are entered", num(publishedPL.B14), 0, 0);
      check("Published P&L: prior year retained profit while no comparatives are entered", num(publishedPL.B54), 0, 0);
    }
  }
  if (report && pubBalSht) {
    check("Directors' report: year end = published balance sheet date", num(report.F22), num(pubBalSht.D2), 0);
  }
  if (report && register) {
    check("Directors' report: ordinary shares issued = register of members total", num(report.I95), num(register.G1), 0);
    check("Directors' report: first member's holding = register of members", num(report.F97), num(register.G3), 0);
    check("Directors' report: second member's holding = register of members", num(report.F98), num(register.G4), 0);
  }

  // ── The share register against the members the scenario carries ──────────
  //
  // The report prints a shareholder a line, the name from
  // [8]RegisterofMembers!$A$n and the holding from $G$n. Both ends go against
  // the scenario's own members, so a register nobody filled in and a report
  // naming nobody each fail on their own.
  if (register && expected.members) {
    expected.members.slice(0, REGISTER_MEMBER_ROWS.length).forEach((member, index) => {
      const row = REGISTER_MEMBER_ROWS[index];
      checkText(
        `Register of members: row ${row} names ${member.name}`,
        text(register[`${REGISTER_MEMBER_COLUMNS.name}${row}`]),
        (name) => name === member.name,
        member.name,
      );
      check(
        `Register of members: row ${row} holds ${member.name}'s shares`,
        num(register[`${REGISTER_MEMBER_COLUMNS.shares}${row}`]),
        member.shares,
        0,
      );
    });
  }
  if (report && expected.members) {
    // The report prints two shareholder lines whatever the register holds, so
    // a company with one member has to publish a blank second line rather
    // than a stale name. Both are measured against the scenario's own
    // members, the same side the register is measured against.
    const printsMember = (name, printed, member) =>
      checkText(name, text(printed), (line) => line === (member?.name || ""), member ? member.name : "blank, there being no second member");
    printsMember("Directors' report: first shareholder named", report.A97, expected.members[0]);
    printsMember("Directors' report: second shareholder named", report.A98, expected.members[1]);
  }

  // ── The dividend cycle, minute to balance sheet ──────────────────────────
  //
  // One board resolution drives the whole cycle. Boardmeeting!E4 carries the
  // dividend declared; the trial balance reads it into the profit
  // distribution (EH48) and, negated, into the dividends creditor (EH31);
  // the published P&L appropriates it at F52 (= EJ48) and the directors'
  // report quotes it at D94. The bank's DV payments come off the creditor
  // month by month, so the creditor closes at opening plus declared less
  // paid -- nil for a year that pays what it declares.
  const boardMeeting = results["Companysecretary.xlsx!Boardmeeting"];
  if (report && boardMeeting) {
    check("Directors' report: dividend declared = the board minute", num(report.D94), num(boardMeeting.E4), 0);
  }
  if (boardMeeting && expected.dividend) {
    check("Board minute: dividend declared = the scenario's declaration", num(boardMeeting.E4), expected.dividend.declared, 0);

    // The minute's own date, on the period frame the book carries. A
    // scenario's dates shift by the gap between its own accounting period
    // and the package's, so the year end on the Admin sheet is what says how
    // far this book moved the meeting.
    const yearEndMonth = dateFromSerial(num(results.Admin.F21)).getUTCMonth() + 1;
    const monthOffset = ((yearEndMonth % 12) - ((expected.period_start_month || 4) - 1) + 12) % 12;
    const minuted = shiftMonths(parseDate(expected.dividend.board_meeting), monthOffset);
    check(
      "Board minute: meeting date = the scenario's board meeting",
      num(boardMeeting.F2),
      toExcelSerial(minuted.getUTCFullYear(), minuted.getUTCMonth() + 1, minuted.getUTCDate()),
      0,
    );
  }
  if (publishedPL && expected.dividend) {
    check("Published P&L: dividends appropriated = the dividend the board declared", num(publishedPL.F52), expected.dividend.declared);
  }
  if (expected.dividend && expected.bank) {
    let dividendsPaid = 0;
    for (const transactions of Object.values(expected.bank)) {
      for (const tx of transactions) {
        if (tx.code !== "DV") continue;
        dividendsPaid += tx.direction === "out" ? tx.amount : -tx.amount;
      }
    }
    // The trial balance carries a creditor as a negative balance, so the
    // amount still owed to the members is the row negated.
    const openingOwed = expected.opening_balance?.dividends_due || 0;
    check(
      "Trial Balance: dividends creditor = opening plus declared less paid",
      -num(results.TrialBalance.EJ31),
      openingOwed + expected.dividend.declared - dividendsPaid,
    );
  }

  // ── The register of charges against the balance sheet ────────────────────
  //
  // A charge registered over the company's assets secures a debt, and a debt
  // secured on an asset is a creditor falling due after more than one year.
  // PubBalSht E30 reads -TrialBalance!EJ40, the only long-term creditor line
  // in the book. The register's own valuation column is the ceiling: the
  // directors valued the charged assets at the date of charging, and a
  // creditor secured on them cannot exceed that valuation.
  //
  // The same TrialBalance row also carries -[1]HPfinance!$E$2 (verified
  // against the template): the hire purchase agreements' amounts financed
  // reach this line too, alongside -HPfinance!$E$2's opposite-signed twin on
  // the Trade Creditors row. A hire purchase agreement is itself secured on
  // the asset it finances, so it belongs in the same ceiling as the
  // registered charge, not against it -- the total long-term creditor
  // figure has to cover both.
  const hp = results["Fixedassets.xlsx!HPfinance"];
  const charges = results["Companysecretary.xlsx!Charges&Debentures"];
  if (charges && pubBalSht) {
    const chargedValue = CHARGE_REGISTER_ROWS.reduce((sum, row) => sum + num(charges[`${CHARGE_REGISTER_COLUMNS.valuation}${row}`]), 0);
    const longTermCreditors = num(pubBalSht.E30);
    const hpAmountFinanced = num(hp?.E2);

    // The creditor itself, against the scenario's own opening balance,
    // whatever the year drew down or repaid on it (bank code LCR), and the
    // hire purchase agreements' amounts financed. Without this the coverage
    // check below could be satisfied by a balance sheet that carries any
    // secured debt at all rather than this one.
    if (expected.opening_balance?.long_term_creditors !== undefined) {
      let drawnDown = 0;
      for (const transactions of Object.values(expected.bank || {})) {
        for (const tx of transactions) {
          if (tx.code !== "LCR") continue;
          drawnDown += tx.direction === "in" ? tx.amount : -tx.amount;
        }
      }
      check(
        "Published balance sheet: creditors due after more than one year = the secured loan plus hire purchase agreements",
        longTermCreditors,
        expected.opening_balance.long_term_creditors + drawnDown + hpAmountFinanced,
      );
    }

    if (chargedValue > 0) {
      checks.push({
        name: "Charges register: the balance sheet carries a creditor falling due after more than one year",
        actual: longTermCreditors,
        expected: `more than 0 and no more than the ${chargedValue + hpAmountFinanced} the directors valued the charged assets and the hire purchase agreements finance`,
        pass: longTermCreditors > 0 && longTermCreditors <= chargedValue + hpAmountFinanced,
        diff: "",
      });
    }
  }

  // The Schedule's new-asset and disposal totals against what the scenario
  // posted to Purchases.xlsx and Sales.xlsx, net of VAT — the same
  // comparison FAreconciliation is built to make, made here because the
  // sheet's own cross-file cells (E13/K13) are #REF! in the template.
  const faReconciliation = results["Fixedassets.xlsx!FAreconciliation"];
  if (faReconciliation && expected.purchases) {
    let assetGross = 0;
    for (const transactions of Object.values(expected.purchases)) {
      for (const tx of transactions) if (tx.code === "fa") assetGross += tx.amount;
    }
    check("Fixed assets: Schedule additions = fixed asset purchases net of VAT", num(faReconciliation.E11), netOfVat(assetGross, rate));
  }
  if (faReconciliation && expected.sales) {
    let disposalGross = 0;
    for (const transactions of Object.values(expected.sales)) {
      for (const tx of transactions) if (tx.code === "fs") disposalGross += tx.amount;
    }
    check(
      "Fixed assets: Schedule disposal proceeds = fixed asset sales net of VAT",
      num(faReconciliation.K11),
      netOfVat(disposalGross, rate),
    );
  }

  // The P&L depreciation and disposal lines carry the Schedule's annual
  // figures across the same link, one twelfth per month.
  if (schedule) {
    check("P&L: depreciation = fixed asset note charge for the year", num(pl.B40), num(notes?.G15));
    check(
      "P&L: loss on disposal = Schedule cost less depreciation less proceeds",
      num(pl.B39),
      num(schedule.W1) - num(schedule.X1) - num(schedule.V1),
    );
  }

  // ── HP finance agreements (Fixedassets.xlsx HPfinance sheet) ────────────
  // Each check is anchored in the agreement's own fixture fields, not in
  // another cell of the same sheet, so a schedule that is merely
  // self-consistent cannot pass.
  if (hp && expected.hp_agreements) {
    const [agreement1, agreement2] = expected.hp_agreements;
    if (agreement1) {
      check(
        "HP: first agreement monthly payment = the amount financed with charges over its term",
        num(hp.I8),
        (agreement1.amount_financed + agreement1.admin_charges + agreement1.total_interest) / agreement1.months,
      );
      check("HP: first agreement capital and interest split sums to the monthly payment", num(hp.J8) + num(hp.K8), num(hp.I8));
    }
    if (agreement2) {
      check(
        "HP: second agreement monthly payment computes",
        num(hp.I10),
        (agreement2.amount_financed + agreement2.admin_charges + agreement2.total_interest) / agreement2.months,
      );
      check("HP: second agreement capital and interest split sums to the monthly payment", num(hp.J10) + num(hp.K10), num(hp.I10));
    }
    check(
      "HP: long term creditors = the agreements' amounts financed",
      num(hp.E2),
      expected.hp_agreements.reduce((s, a) => s + a.amount_financed, 0),
    );
  }

  // The year's HP interest and admin charges reaching the P&L's own "Bank
  // Charges" line (MnthP&L!B36), through the "B" bank-payment code every
  // other direct bank charge on that line already uses. Computed from the
  // scenario's own bank transactions, not from the P&L cell it is compared
  // to, so a broken cross-file link shows up here rather than passing by
  // construction.
  if (pl && expected.bank) {
    let bankChargesTotal = 0;
    for (const transactions of Object.values(expected.bank)) {
      for (const tx of transactions) {
        if (tx.code !== "B") continue;
        bankChargesTotal += tx.direction === "out" ? tx.amount : -tx.amount;
      }
    }
    check("P&L: HP interest and charges reach the Bank Charges line (B36)", num(pl.B36), bankChargesTotal);
  }

  // ── Bank: each workbook's closing balance against the scenario's own cash
  // movements for that account. The expectation is computed from the
  // direction-tagged entries, not read back from a second formula, so a
  // receipt posted as a payment, a dropped month or an opening balance that
  // never carried forward shows up here.
  if (expected.bank) {
    const movements = {};
    for (const fileName of Object.values(BANK_ACCOUNT_FILES)) {
      movements[fileName] = { opening: 0, receipts: 0, payments: 0 };
    }
    for (const transactions of Object.values(expected.bank)) {
      for (const tx of transactions) {
        const fileName = BANK_ACCOUNT_FILES[tx.account || "1200"];
        if (!fileName) continue;
        const movement = movements[fileName];
        if (tx.code === "BC") movement.opening += tx.amount;
        else if (tx.direction === "in") movement.receipts += tx.amount;
        else if (tx.direction === "out") movement.payments += tx.amount;
      }
    }
    for (const [fileName, movement] of Object.entries(movements)) {
      const closingKey = Object.keys(results).find((k) => k.startsWith(`${fileName}!`));
      if (!closingKey) continue;
      check(
        `${fileName}: closing balance = opening + receipts - payments`,
        num(results[closingKey].A2),
        movement.opening + movement.receipts - movement.payments,
      );
    }

    // TrialBalance echoes each bank workbook's closing balance across the
    // cross-file link (verified against the template: TrialBalance!EJ<n> =
    // -[<link>]<lastMonth>!$F$1-... cascaded from the workbook's own A2).
    // Tie each echo to the same scenario-derived movement the per-workbook
    // check above already computed, so a break in the OpenAccounts ->
    // TrialBalance link is caught at its own link rather than only showing
    // up downstream on the published balance sheet.
    if (results.TrialBalance) {
      const tb = results.TrialBalance;
      for (const [fileName, movement] of Object.entries(movements)) {
        const echoCell = TRIAL_BALANCE_BANK_ECHO_CELLS[fileName];
        check(
          `Trial Balance: ${fileName} closing balance echo (${echoCell})`,
          num(tb[echoCell]),
          movement.opening + movement.receipts - movement.payments,
        );
      }

      // PubBalSht!E12 "Cash at bank and in hand" reproduces the sheet's own
      // aggregation formula exactly (verified against the template: E12 =
      // IF(SUM(EJ22:EJ24)>0, SUM(EJ22:EJ24)+EJ25+EJ26, EJ25)). The three
      // statement-book accounts (Current, Savings, Credit Card) are summed
      // first, then Cash and the Intra Cash & Bank Transfers row are added
      // on top -- the credit card balance is summed straight in alongside
      // the other three, not netted off as a creditor. EJ26 nets out any
      // receipt or payment analysed under another account's transfer code,
      // so a transfer between the company's own bank accounts never moves
      // the combined total, whether or not both legs were entered.
      const sumFirstThree = num(tb.EJ22) + num(tb.EJ23) + num(tb.EJ24);
      const expectedE12 = sumFirstThree > 0 ? sumFirstThree + num(tb.EJ25) + num(tb.EJ26) : num(tb.EJ25);
      check("Published balance sheet: cash at bank = Trial Balance bank account aggregate", num(pubBalSht?.E12), expectedE12);
    }
  }

  // ── Monthly P&L against the monthly Sales and Purchases totals ───────────
  //
  // Each month column reads one Sales.xlsx or Purchases.xlsx analysis column
  // through the trial balance. Both sides are net of VAT: the P&L holds the
  // workbook's own net figure, and the expectation converts the scenario's
  // gross amounts at the same rate the templates apply, summing the month
  // first and dividing once. Catches a month landing in the wrong column or
  // dropping out altogether.
  // The writer shifts every transaction date onto the package's month tabs, so
  // the expectation buckets by the shifted date the same way, or every month
  // reads as landing in the wrong column on a non-March year-end.
  const fiscalTabs =
    results.Admin && typeof results.Admin.B9 === "number" ? monthTabsFromPeriodStart(results.Admin.B9) : getMonthTabNames(3);
  const shiftedMonthlyBuckets = (journal) => {
    const targetStartMonth = SHORT_MONTHS.indexOf(fiscalTabs[0]);
    const monthOffset = (targetStartMonth - ((expected.period_start_month || 4) - 1) + 12) % 12;
    const buckets = Object.fromEntries(fiscalTabs.map((tab) => [tab, {}]));
    for (const txs of Object.values(journal)) {
      for (const tx of txs) {
        const shifted = shiftMonths(parseDate(tx.date), monthOffset);
        const bucket = buckets[SHORT_MONTHS[shifted.getUTCMonth()]];
        bucket[tx.code] = (bucket[tx.code] || 0) + tx.amount;
      }
    }
    return buckets;
  };
  if (expected.sales) {
    const buckets = shiftedMonthlyBuckets(expected.sales);
    fiscalTabs.forEach((tab, i) => {
      const col = MONTH_COLS[i];
      for (const [code, row] of Object.entries(SALES_MONTHLY_TIE_ROWS)) {
        check(`P&L ${tab} ${col}${row} = Sales.xlsx "${code}" net`, num(pl[`${col}${row}`]), netOfVat(buckets[tab][code] || 0, rate));
      }
      check(
        `P&L ${tab} ${col}${SALES_BAD_DEBT_ROW} = negated Sales.xlsx "o" net`,
        num(pl[`${col}${SALES_BAD_DEBT_ROW}`]),
        -netOfVat(buckets[tab].o || 0, rate),
      );
    });
  }
  if (expected.purchases) {
    const buckets = shiftedMonthlyBuckets(expected.purchases);
    fiscalTabs.forEach((tab, i) => {
      const col = MONTH_COLS[i];
      for (const [code, row] of Object.entries(PURCHASES_MONTHLY_TIE_ROWS)) {
        check(`P&L ${tab} ${col}${row} = Purchases.xlsx "${code}" net`, num(pl[`${col}${row}`]), netOfVat(buckets[tab][code] || 0, rate));
      }
    });
  }

  // The same month columns against the leaf workbooks' own row 1 totals.
  // The checks above prove the scenario landed where it was meant to; these
  // prove the cross-file links carried each month's total into the right
  // column of the P&L, without going through the fixture at all.
  if (results.Admin && typeof results.Admin.B9 === "number") {
    monthTabsFromPeriodStart(results.Admin.B9).forEach((tab, i) => {
      const col = MONTH_COLS[i];
      const salesMonth = results[`Sales.xlsx!${tab}`];
      if (salesMonth) {
        check(
          `P&L ${tab} turnover = Sales.xlsx ${tab} net less bad debts and asset sales`,
          num(pl[`${col}${MONTHLY_TURNOVER_ROW}`]),
          num(salesMonth[SALES_MONTH_TOTAL_CELLS.net]) -
            num(salesMonth[SALES_MONTH_TOTAL_CELLS.badDebts]) -
            num(salesMonth[SALES_MONTH_TOTAL_CELLS.assetSales]),
        );
      }
      const purchasesMonth = results[`Purchases.xlsx!${tab}`];
      if (purchasesMonth) {
        const tiedRows = Object.values(PURCHASES_MONTHLY_TIE_ROWS).reduce((sum, row) => sum + num(pl[`${col}${row}`]), 0);
        check(
          `P&L ${tab} expense lines = Purchases.xlsx ${tab} net less materials, wages and asset purchases`,
          tiedRows,
          num(purchasesMonth[PURCHASES_MONTH_TOTAL_CELLS.net]) -
            num(purchasesMonth[PURCHASES_MONTH_TOTAL_CELLS.materials]) -
            num(purchasesMonth[PURCHASES_MONTH_TOTAL_CELLS.directorsWages]) -
            num(purchasesMonth[PURCHASES_MONTH_TOTAL_CELLS.employeeWages]) -
            num(purchasesMonth[PURCHASES_MONTH_TOTAL_CELLS.assetPurchases]),
        );
      }
    });
  }

  // ── Payroll: WagesInterface monthly ties, the P&L wages route, the
  // PAYE/NI creditor, and Payslips!Payment (item 4) ──
  //
  // WagesInterface rows 4-15 hold one month each (Apr-Mar template order,
  // remapped to fiscalTabs the same as everything else here), split across
  // two row blocks per month: rows 4-15 read the block-5 payslip rows the
  // scenario writer fills (C4=[9]Apr!$M$1-C17 etc), and rows 17-28 read a
  // second, director-only block (M2 in the month tab) that cellWrites never
  // populates -- verified against the template, and confirmed against the
  // recalculated file that the row 17-28 side stays 0. So rows 4-15 alone
  // carry the whole month's payroll, directors included.
  // ── Payslips!Admin: the payroll calendar every payslip dates from ────────
  //
  // The calendar is written into the package and nothing reads it back, so a
  // wrong week or a month that opens on the wrong day would reach a user's
  // payslips unnoticed. Each payroll month's opening row is compared with the
  // tax calendar, anchored on the one date the whole sheet cascades from.
  const payslipsAdmin = results["Payslips.xlsx!Admin"];
  if (payslipsAdmin) {
    const yearStart = num(payslipsAdmin[PAYSLIPS_CALENDAR_ANCHOR_CELL]);
    const yearStartDate = new Date(Date.UTC(1899, 11, 30) + Math.round(yearStart) * 24 * 60 * 60 * 1000);
    checkText(
      "Payslips calendar: the payroll year opens on 6 April",
      yearStart ? formatSerialDate(yearStart) : "",
      (text) => text.startsWith("6 April"),
      "6 April",
    );

    const starts = payrollMonthStarts();
    for (const { month, row, daysBefore, week } of starts) {
      const monthName = SHORT_MONTHS[(yearStartDate.getUTCMonth() + month - 1) % 12];
      check(
        `Payslips calendar: payroll month ${month} opens on the first day of tax week ${week}`,
        num(payslipsAdmin[`B${row}`]),
        yearStart + daysBefore,
        0,
      );
      check(`Payslips calendar: payroll month ${month} opens tax week ${week}`, num(payslipsAdmin[`C${row}`]), week, 0);
      checkText(
        `Payslips calendar: payroll month ${month} is named for the month it opens`,
        String(payslipsAdmin[`A${row}`] ?? ""),
        (text) => text === monthName,
        monthName,
      );
    }
    check(
      "Payslips calendar: the payroll months are numbered one to twelve in order",
      starts.reduce((sum, { month, row }) => sum + Math.abs(num(payslipsAdmin[`D${row}`]) - month), 0),
      0,
      0,
    );
    check(
      "Payslips calendar: every payroll month opens on its own first week",
      starts.reduce((sum, { row }) => sum + num(payslipsAdmin[`F${row}`]), 0),
      starts.length,
      0,
    );
  }

  if (expected.payroll) {
    // Same date-shift math cellWrites() uses to place each scenario month's
    // payroll on a Payslips.xlsx tab: monthKey's calendar month (e.g. "apr"
    // = 3) shifts by the offset from April to this package's first fiscal
    // month, landing on the same tab fiscalTabs already names by index.
    const targetStartMonth = SHORT_MONTHS.indexOf(fiscalTabs[0]);
    const monthOffset = (targetStartMonth - ((expected.period_start_month || 4) - 1) + 12) % 12;
    const payrollByTab = Object.fromEntries(fiscalTabs.map((tab) => [tab, []]));
    for (const [monthKey, entries] of Object.entries(expected.payroll)) {
      const sourceMonth = SHORT_MONTHS.findIndex((m) => m.toLowerCase() === monthKey);
      if (sourceMonth === -1) continue;
      const tab = SHORT_MONTHS[(sourceMonth + monthOffset) % 12];
      payrollByTab[tab].push(...entries);
    }

    let totalGross = 0;
    let totalEmployerNI = 0;
    fiscalTabs.forEach((tab, i) => {
      const entries = payrollByTab[tab] || [];
      const sums = entries.reduce(
        (s, e) => ({
          grossPay: s.grossPay + (e.grossPay || 0),
          incomeTax: s.incomeTax + (e.incomeTax || 0),
          employeeNI: s.employeeNI + (e.employeeNI || 0),
          employerNI: s.employerNI + (e.employerNI || 0),
        }),
        { grossPay: 0, incomeTax: 0, employeeNI: 0, employerNI: 0 },
      );
      totalGross += sums.grossPay;
      totalEmployerNI += sums.employerNI;

      const row = 4 + i;
      const wi = results.WagesInterface || {};
      check(`WagesInterface ${tab} C${row} gross pay`, num(wi[`C${row}`]), sums.grossPay);
      check(`WagesInterface ${tab} D${row} income tax`, num(wi[`D${row}`]), sums.incomeTax);
      check(`WagesInterface ${tab} E${row} employee NI`, num(wi[`E${row}`]), sums.employeeNI);
      check(`WagesInterface ${tab} H${row} employer NI`, num(wi[`H${row}`]), sums.employerNI);

      // Payslips!Payment: same row layout as WagesInterface (verified
      // against the template). D = NI due (employer + employee), E = income
      // tax due, I = total amount payable = D + E (F/G/H -- statutory pay
      // recovered, NIC compensation, student loan -- stay 0 in this
      // fixture).
      const payment = results["Payslips.xlsx!Payment"] || {};
      const niDue = sums.employerNI + sums.employeeNI;
      check(`Payslips!Payment ${tab} D${row} NI due`, num(payment[`D${row}`]), niDue);
      check(`Payslips!Payment ${tab} E${row} income tax due`, num(payment[`E${row}`]), sums.incomeTax);
      check(`Payslips!Payment ${tab} I${row} total amount payable`, num(payment[`I${row}`]), niDue + sums.incomeTax);
    });

    // P&L route: MnthP&L B18 (PAYE Wages + Non-PAYE Employee) reads
    // TrialBalance!O64+O65, where row 64 is WagesInterface!C-I summed across
    // the year (I -- statutory pay -- is always 0 here) and row 65 is
    // Purchases.xlsx's own "w"-coded net total, which this fixture does
    // carry a casual-worker entry for. B20 (Employers NI) reads
    // TrialBalance!O67 = WagesInterface!H summed across the year. Verified
    // against the template formula chain.
    let wCodePurchasesNet = 0;
    if (expected.purchases) {
      for (const transactions of Object.values(expected.purchases)) {
        for (const tx of transactions) if (tx.code === "w") wCodePurchasesNet += netOfVat(tx.amount, rate);
      }
    }
    check(
      "MnthP&L: PAYE Wages + Non-PAYE Employee (B18) = payroll gross pay + Purchases w-coded net",
      num(pl.B18),
      totalGross + wCodePurchasesNet,
    );
    check("MnthP&L: Employers National Insurance (B20) = payroll employer NI", num(pl.B20), totalEmployerNI);

    // PAYE/NI creditor: TrialBalance row 34's first-fiscal-month movement
    // column (verified against the template: column position L, always the
    // year's first month regardless of year-end) moves by
    // -(WagesInterface!D+E+H) that month -- income tax, employee NI and
    // employer NI due to HMRC. Later months' movement also nets HMRC bank
    // payments (RP-coded), which belongs to the bank workstream, so this
    // localises to the payroll-only first month rather than the year-end
    // balance.
    if (results.TrialBalance && fiscalTabs.length > 0) {
      const firstMonthEntries = payrollByTab[fiscalTabs[0]] || [];
      const firstMonthTax = firstMonthEntries.reduce((s, e) => s + (e.incomeTax || 0) + (e.employeeNI || 0) + (e.employerNI || 0), 0);
      check(
        "Trial Balance: PAYE/NI creditor first-month movement (L34) = that month's payroll tax due",
        num(results.TrialBalance.L34),
        -firstMonthTax,
      );
    }
  }

  // ── Admin: the rates the generator injected, read back ───────────────────
  //
  // Every downstream figure is arithmetically consistent with whatever rate
  // sits here, so a wrong rate is invisible everywhere else. These compare
  // the sheet against the tax-year TOML the package was generated from.
  const admin = results.Admin;
  if (admin && taxData) {
    for (const [cell, label, fromTaxData] of ADMIN_TAX_DATA_CELLS) {
      check(`Admin ${cell}: ${label}`, num(admin[cell]), fromTaxData(taxData), 0.0001);
    }

    // F21 is the year-end seed every other date in the package cascades
    // from. Its own anchor row and the three published documents that quote
    // the year end all have to land on it. The seed itself is measured
    // against the year end the package was generated for, so a book dated to
    // the wrong year end fails here rather than reading consistent with
    // itself.
    if (packageYearEnd) {
      const [year, month, day] = packageYearEnd.split("-").map(Number);
      check("Admin: year-end seed = the package's own year end", num(admin.F21), toExcelSerial(year, month, day), 0);
    }
    check("Admin: year-end seed drives the accounting period anchor", num(admin.B32), num(admin.F21), 0);
    check("Published P&L: year end = Admin year-end seed", num(results["PubP&L"]?.D3), num(admin.F21), 0);
    check("Published balance sheet: date = Admin year-end seed", num(pubBalSht?.D2), num(admin.F21), 0);
    check("Fixed asset note: year end = Admin year-end seed", num(notes?.A11), num(admin.F21), 0);
    check("Admin: accounting period is twelve months", num(admin.F21) - num(admin.B9) + 1, 365, 1);

    // The Admin rate table's two dated rows are the financial years the
    // accounting period falls in, not the period and the year after it.
    // Everything the corporation tax working sheet and the CT600 say about
    // the period is a copy of these four dates.
    check("Admin: first financial year row starts at the accounting period start", num(admin.L6), num(admin.B9), 0);
    check("Admin: second financial year row starts the day the first one ends", num(admin.L7), num(admin.N6) + 1, 0);
    check("Admin: second financial year row ends at the year end", num(admin.N7), num(admin.F21), 0);
    if (results[TAX_SHEET]) {
      check("CT: working sheet heading starts at the accounting period start", num(results[TAX_SHEET].E5), num(admin.B9), 0);
      check("CT: working sheet heading ends at the year end", num(results[TAX_SHEET].H5), num(admin.F21), 0);
      check("CT: the two tax rows span the accounting period", num(results[TAX_SHEET].A35), num(admin.F21) - num(admin.B9) + 1, 0);
    }
    if (results.CT600) {
      check("CT600: return period starts at the accounting period start", num(results.CT600.B33), num(admin.B9), 0);
      check("CT600: return period ends at the year end", num(results.CT600.M33), num(admin.F21), 0);
    }

    // The expenses claim form carries the same mileage rate the Admin sheet
    // holds. It has no link back to the accounts, so the generator writes
    // the first month and the other eleven read it off that one.
    for (const sheet of EXPENSES_FORM_MONTHS) {
      const form = results[`expensesform.xlsx!${sheet}`];
      if (form) check(`Expenses form ${sheet}: mileage rate = tax data`, num(form.C30), taxData.mileage.higher_rate_pence, 0.0001);
    }

    // The note publishes the depreciation rates from the Schedule, which
    // must agree with the rates injected into Admin.
    if (notes) {
      for (const [noteCell, adminCell, label] of NOTE_RATE_CELLS) {
        check(`Fixed asset note: depreciation rate, ${label}`, num(notes[noteCell]), num(admin[adminCell]), 0.0001);
      }
    }
  }

  // ── The filed documents against the working sheets they derive from ──────
  const corporationTax = results[TAX_SHEET];
  const pubPL = results["PubP&L"];
  if (corporationTax && pubPL) {
    // The published P&L and the management P&L reach operating profit down
    // different formula paths, one from the trial balance's closing column
    // and one from its month-by-month columns.
    check("Published P&L: operating profit = management P&L operating profit", num(pubPL.F46), num(pl.B43));
    check("CT: operating profit = published P&L operating profit", num(corporationTax.K5), num(pubPL.F46));
    check("CT: depreciation add-back = P&L depreciation", num(corporationTax.I8), num(pl.B40));
    check("CT: goodwill add-back = P&L goodwill written off", num(corporationTax.I7), num(pl.B38));
    check("CT: add-backs = depreciation + goodwill", num(corporationTax.K10), num(corporationTax.I7) + num(corporationTax.I8));
    check("CT: profit plus add-backs", num(corporationTax.K12), num(corporationTax.K5) + num(corporationTax.K10));
    // Each allowance line against the schedule column it claims from. The
    // notes behind these lines address Schedule rows one by one, so they
    // only carry figures when every one of those rows reaches the tax
    // computation, and each line is anchored in the schedule rather than in
    // its own total.
    if (schedule) {
      check("CT: annual investment allowance = Schedule annual investment allowance", num(corporationTax.I15), num(schedule.Q1));
      check(
        "CT: writing down allowances = Schedule writing down allowances",
        num(corporationTax.I16) + num(corporationTax.I17),
        num(schedule.R1),
      );
      check(
        "CT: balancing allowance on disposals = Schedule balancing allowance less balancing charge",
        num(corporationTax.I18),
        num(schedule.Y1) - num(schedule.Z1),
      );
    }
    check(
      "CT: capital allowances = the allowance lines",
      num(corporationTax.K20),
      num(corporationTax.I15) + num(corporationTax.I16) + num(corporationTax.I17) + num(corporationTax.I18),
    );
    check("CT: profit after capital allowances", num(corporationTax.K22), num(corporationTax.K12) - num(corporationTax.K20));
    check(
      "CT: chargeable profit = profit after allowances + interest - losses brought forward",
      num(corporationTax.K28),
      num(corporationTax.K22) + num(corporationTax.K24) - num(corporationTax.K26),
    );
    // The whole distance between the profit the accounts report and the
    // profit charged to tax, in one line. This is what a comparison of
    // "chargeable against operating" was reaching for; that one was written
    // with a tolerance as wide as the chargeable profit itself, and it is not
    // true at all of a year whose capital allowances beat its add-backs.
    check(
      "CT: chargeable profit = operating profit + add-backs - capital allowances + interest - losses",
      num(corporationTax.K28),
      num(corporationTax.K5) + num(corporationTax.K10) - num(corporationTax.K20) + num(corporationTax.K24) - num(corporationTax.K26),
    );
  }

  const ct600 = results.CT600;
  if (ct600 && corporationTax && pubPL) {
    // The return has no box for a trading loss. Box 155 carries the working
    // sheet's profit after capital allowances while that is a profit and
    // leaves the cell blank when it is a loss, and the chargeable-profits box
    // follows it down (verified against the template: Z70 =
    // IF(CorporationTax!K22>0,...," "), AJ92 = IF(AJ74>0,...,0)). Comparing
    // against the floor the form applies is what makes a year whose capital
    // allowances beat the profit readable; a box carrying the wrong positive
    // figure, or carrying anything at all against a loss, still fails.
    const onTheForm = (working) => (working > 0 ? working : 0);
    check("CT600: turnover = published P&L turnover", num(ct600.AK66), num(pubPL.F9));
    check("CT600: trading profits = CT profit after capital allowances", num(ct600.Z70), onTheForm(num(corporationTax.K22)));
    check("CT600: losses brought forward = CT losses brought forward", num(ct600.Z72), num(corporationTax.K26));
    check("CT600: net trading profits = trading profits - losses brought forward", num(ct600.AJ74), num(ct600.Z70) - num(ct600.Z72));
    check("CT600: interest received = CT interest received", num(ct600.AJ76), num(corporationTax.K24));
    check("CT600: profits before deductions = trading profits + interest", num(ct600.AJ92), num(ct600.AJ74) + num(ct600.AJ76));
    check("CT600: profits chargeable = CT chargeable profit", num(ct600.AJ110), onTheForm(num(corporationTax.K28)));
    // The form sets out two financial year rows, boxes 43 to 46 and boxes 53
    // to 56, one for each financial year the accounting period falls in.
    // Boxes 46 and 56 carry the tax at the rate before relief, so box 63,
    // which the form calls the total of the two, is the gross charge and
    // box 65 is what the company bears once box 64's relief comes off.
    check("CT600: financial year = first tax row financial year", num(ct600.C126), num(corporationTax.E33), 0);
    check("CT600: amount of profit = first tax row profit", num(ct600.N126), num(corporationTax.F33));
    check("CT600: tax rate = first tax row rate", num(ct600.AA126), num(corporationTax.G33), 0);
    check("CT600: corporation tax = first tax row gross tax", num(ct600.AJ126), num(corporationTax.J33));
    check("CT600: second financial year tax = second tax row gross tax", num(ct600.AJ128), num(corporationTax.J34));
    if (num(corporationTax.A34) > 0) {
      check("CT600: second financial year = second tax row financial year", num(ct600.C128), num(corporationTax.E34), 0);
      check("CT600: second financial year profit = second tax row profit", num(ct600.N128), num(corporationTax.F34));
      check("CT600: second financial year rate = second tax row rate", num(ct600.AA128), num(corporationTax.G34), 0);
    }
    check("CT600: tax payable = tax chargeable", num(ct600.AJ131), num(ct600.AJ126) + num(ct600.AJ128));
    check("CT600: marginal rate relief = the working sheet's relief", num(ct600.Y133), num(corporationTax.L33) + num(corporationTax.L34));
    check("CT600: tax net of marginal relief = the working sheet's charge", num(ct600.Y135), num(corporationTax.K35));
    check("CT600: corporation tax chargeable = tax net of marginal relief", num(ct600.AJ145), num(ct600.Y135));
    if (num(ct600.AJ110) > 0) {
      check(
        "CT600: underlying rate of corporation tax = the tax it bears over the profits chargeable",
        num(ct600.W137),
        (num(ct600.Y135) * 100) / num(ct600.AJ110),
        0.01,
      );
    }
    check("CT600: tax outstanding", num(ct600.AJ166), num(ct600.AJ159) - num(ct600.AJ163));
  }

  if (notes && corporationTax) {
    check("Fixed asset note: corporation tax for the year = CT charge", num(notes.D41), num(corporationTax.K35));
  }
  if (notes && results.TrialBalance) {
    check("Fixed asset note: directors emoluments = trial balance directors wages", num(notes.D35), num(results.TrialBalance.EJ66));
  }

  if (taxData) {
    const ct = results[TAX_SHEET];
    const profit = ct.K28 || 0;
    if (profit > 0) {
      // How the working sheet builds the charge. Rows 33 and 34 are the one
      // or two UK financial years the accounting period falls in: row 33
      // runs from Admin L6 to N6, the 31 March inside the period, and row 34
      // from the day after that to the year end. A period wholly inside one
      // financial year leaves row 34 empty. A35 is the two together, each
      // row takes its share of the chargeable profit (F33 =
      // IF(K28>0,K28*A33/A35,0)) and charges it at its own rate.
      const days = num(ct.A35);
      check("CT: the two tax rows together span the days the charge is spread over", num(ct.A33) + num(ct.A34), days);
      if (days > 0) {
        check("CT: first tax row profit = chargeable profit by its share of those days", num(ct.F33), (profit * num(ct.A33)) / days);
        check("CT: second tax row profit = chargeable profit by its share of those days", num(ct.F34), (profit * num(ct.A34)) / days);
      }
      check("CT: first tax row gross tax = its profit at its rate", num(ct.J33), (num(ct.F33) * num(ct.G33)) / 100);
      check("CT: second tax row gross tax = its profit at its rate", num(ct.J34), (num(ct.F34) * num(ct.G34)) / 100);
      check("CT: first tax row tax = its gross tax less its marginal relief", num(ct.I33), num(ct.J33) - num(ct.L33));
      check("CT: second tax row tax = its gross tax less its marginal relief", num(ct.I34), num(ct.J34) - num(ct.L34));
      check("CT: charge for the year = the two tax rows", num(ct.K35), num(ct.I33) + num(ct.I34));

      // Each row's share of the profit is charged at the small profits rate
      // up to its share of the lower limit and at the main rate above it,
      // with marginal relief tapering the gap up to the upper limit. Both
      // limits are shared out over the period the same way the profit is.
      const admin = results.Admin;
      if (admin && days > 0) {
        const lowerLimit = (rowDays) => (num(admin.P12) * rowDays) / days;
        const upperLimit = (rowDays) => (num(admin.P13) * rowDays) / days;
        const reliefFor = (rowProfit, rowDays) =>
          rowProfit > lowerLimit(rowDays) && rowProfit < upperLimit(rowDays) ? (upperLimit(rowDays) - rowProfit) * num(admin.P9) : 0;
        const rateFor = (rowProfit, rowDays, smallProfitsRate) => (rowProfit <= lowerLimit(rowDays) ? smallProfitsRate : num(admin.P8));

        check(
          "CT: first tax row rate = the rate its share of the profit falls in",
          num(ct.G33),
          rateFor(num(ct.F33), num(ct.A33), num(admin.P6)),
          0,
        );
        check(
          "CT: second tax row rate = the rate its share of the profit falls in",
          num(ct.G34),
          rateFor(num(ct.F34), num(ct.A34), num(admin.P7)),
          0,
        );
        check(
          "CT: first tax row marginal relief = its share of the profit against its share of the limits",
          num(ct.L33),
          reliefFor(num(ct.F33), num(ct.A33)),
        );
        check(
          "CT: second tax row marginal relief = its share of the profit against its share of the limits",
          num(ct.L34),
          reliefFor(num(ct.F34), num(ct.A34)),
        );

        // One tax-year TOML feeds both rows, so a period straddling a rate
        // change would need two. Every financial year in the data set from
        // 2020 on carries the same rates as the one after it.
        check("CT: both financial year rows carry the same small profits rate", num(admin.P6), num(admin.P7), 0);
      }

      // Tax outstanding is the charge less any income tax already deducted
      // at source from bank interest received.
      check("CT: Tax outstanding = CT less tax deducted at source", num(ct.K39), num(ct.K35) - num(ct.K37));

      // The charge the period's profit actually bears, against the statutory
      // computation worked independently of the sheet.
      const statutory = calculateCorporationTax(profit, taxData.corporation_tax).corporationTax;
      check("CT: charge for the year = the statutory computation with marginal relief", num(ct.K35), statutory, 1);
    }
  }

  // The whole distance from the accounting profit to the profit tax is
  // charged on, adjustment by adjustment, with nothing left over.
  const bridge = profitBridge(results);
  if (bridge) check(PROFIT_BRIDGE_CHECK, bridge.residue, 0, 0.01);

  // Every journal category the report nets, one residue at a time. The
  // monthly ties above prove each month landed in the right column; these
  // prove the year's gross figure reaches the statement with the VAT taken
  // off and nothing else lost on the way.
  const netting = categoryNetting(results, expected);
  for (const row of netting?.rows || []) check(categoryNettingCheckName(row), row.residue, 0, 0.01);

  return checks;
}
