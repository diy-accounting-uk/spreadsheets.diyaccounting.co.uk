// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// ── Scenario cell writes ───────────────────────────────────────────────────
// Ltd Sales: E=code letter, F=gross amount
// Ltd Purchases: E=code letter, F=gross amount

// Month tab names for a given year-end month (1=Jan, 12=Dec)
// e.g. yearEndMonth=3 (Mar): ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"]
// e.g. yearEndMonth=6 (Jun): ["Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun"]
export const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// TrialBalance's own closing-balance echo of each bank workbook (verified
// against the template: EJ22 = Current, EJ23 = Savings, EJ24 = Credit Card,
// EJ25 = Cash). PubBalSht!E12 "Cash at bank and in hand" reads these four
// cells plus EJ26 ("Intra Cash & Bank Transfers"), not the bank workbooks
// directly.
export const TRIAL_BALANCE_BANK_ECHO_CELLS = {
  "Currentaccount.xlsx": "EJ22",
  "Savingaccount.xlsx": "EJ23",
  "Creditcardaccount.xlsx": "EJ24",
  "Cashaccount.xlsx": "EJ25",
};

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
export const PAYROLL_FIRST_WEEK_DAYS = 5;

export const PAYSLIPS_CALENDAR_FIRST_ROW = 2;

export const PAYSLIPS_CALENDAR_ANCHOR_CELL = "B2";

// ── Charges & Debentures register (Companysecretary.xlsx) ──────────────────
// Row 1 is the header, one charge per row after it: A the date of the
// transaction, B the assets charged, C the directors' valuation of those
// assets at the date of charging, D the holder, E the terms and F the date
// of the board meeting that confirmed it. The sheet carries no formulas at
// all, so every cell is an entry.
export const CHARGE_REGISTER_ROWS = [2, 3, 4, 5, 6];

export const CHARGE_REGISTER_COLUMNS = { date: "A", asset: "B", valuation: "C", holder: "D", terms: "E", boardMeeting: "F" };

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
export const REGISTER_MEMBER_ROWS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

export const REGISTER_MEMBER_COLUMNS = { name: "A", acquired: "C", nominalValue: "F", shares: "G" };

export const BOARD_MINUTE_CELLS = { date: "F2", dividendDeclared: "E4" };

// ── Register of directors and directors' interests (Companysecretary.xlsx) ─
// Directors&Secretary carries one officer a row from row 2: A the full name,
// B the address, C the date of appointment, D the capacity, E the board
// meeting that confirmed it, F the date of resignation (verified against the
// XML row 1 headings). Rows 2 and 3 ship the template's own "Director" and
// "Company Secretary" placeholders in D, with "Incorporation registration"
// already in E2/E3; an officer writes its own capacity over whichever row it
// lands on, so the register reads in the order the book declares its
// officers rather than in the order the placeholders suggest.
//
// DirectorsInterests runs one row an officer from row 2, the template's own
// single placeholder row (D2/E2 pre-filled "None"). Column C is the date the
// officer's own shareholding was registered -- the same "acquired" date
// their row carries on RegisterofMembers, when they hold shares at all.
export const DIRECTOR_SECRETARY_COLUMNS = { name: "A", address: "B", appointed: "C", capacity: "D" };

export const DIRECTOR_SECRETARY_OFFICER_ROWS = [2, 3, 4, 5, 6, 7, 8];

export const DIRECTORS_INTERESTS_ROWS = [2, 3, 4, 5, 6];

export const DIRECTORS_INTERESTS_COLUMNS = { name: "A", address: "B", registered: "C" };

// ── Stock sheet layout ─────────────────────────────────────────────────────
// The Stock sheet runs a row per month end from row 8 to row 30 in steps of
// two, under an opening row 6 fed from the opening balance sheet. Column D
// carries the calculated value, column AB the physical count, and column Z
// the difference between them, which the trial balance reads as the month's
// stock movement. Row 30 is the last month of the year.

export const STOCK_FINAL_CALCULATED_CELL = "D30";

export const STOCK_FINAL_COUNT_CELL = "AB30";

export const STOCK_FINAL_ADJUSTMENT_CELL = "Z30";

// The share of a product's net sales value that is direct materials. The
// sheet repeats H4 down its own product A column and reads the same cell for
// every month, and the materials-bought column stays switched off while H4,
// N4 and T4 are all zero.
export const STOCK_MATERIALS_PERCENT_CELL = "H4";

// The number of companies associated with this one, entered beside the
// corporation tax rates it divides. The only Admin cell cellWrites() fills;
// the rates beside it come from the tax data, not the book.
export const ADMIN_ASSOCIATED_COMPANIES_CELL = "P14";

// ── OpenAccounts layout ────────────────────────────────────────────────────
// Row 13 takes fixed assets as original cost (G:K) and accumulated
// depreciation (M:Q), one column per asset class, with net book value in E13.
// Row 18 splits the bank balances across G:J and totals them in E18, and
// row 26 splits the tax and social security creditors across G:I into E26.
// Everything else is a single figure in column E. The sheet's own audit
// checks (B13, B18, B26) compare each total against its parts, and E37
// checks the whole opening balance sheet balances.
//
// Column Q beside the directors' names carries the two corporation tax
// figures the journals cannot produce: Q5 the loss brought forward from the
// previous year, and Q6 the exempt distributions the company received, which
// the computation adds to taxable profits to reach augmented profits.

export const OPENACCOUNTS_FRANKED_INVESTMENT_INCOME_CELL = "Q6";

export const OPENING_BANK_COLUMNS = {
  current_account: "G",
  savings_account: "H",
  credit_card: "I",
  cash: "J",
};

export const OPENING_TAX_COLUMNS = {
  paye_due: "G",
  vat_due: "H",
  cis_due: "I",
};

export const OPENING_BALANCE_CELLS = {
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

export const FIXED_ASSET_BANDS = ["fixed_asset_cost", "fixed_asset_depreciation"];

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
export const SCHEDULE_ASSET_CLASSES = {
  land: { existingRows: [8, 9, 10], existingTotalRow: 11, newTotalRow: 64, noteColumn: "B", rateCell: "H7" },
  plant: { existingRows: [14, 15, 16, 17, 18, 19, 20, 21], existingTotalRow: 22, newTotalRow: 75, noteColumn: "C", rateCell: "H13" },
  fixtures: { existingRows: [25, 26, 27, 28, 29], existingTotalRow: 30, newTotalRow: 83, noteColumn: "D", rateCell: "H24" },
  computer: { existingRows: [33, 34, 35, 36, 37, 38, 39, 40], existingTotalRow: 41, newTotalRow: 94, noteColumn: "E", rateCell: "H32" },
  motor: { existingRows: [50, 51, 52, 53, 54], existingTotalRow: 55, newTotalRow: 108, noteColumn: "F", rateCell: "H43" },
};

// The Schedule's writing-down allowance rate (R4, applied to every asset
// class's tax written-down value) reads Admin!G6, which the generator sets
// from this same figure. There is no separate rate or cap for motor
// vehicles -- the pre-2009 expensive-car restriction that used to route
// motor assets through Admin!E11/G11 has been removed from the template.
export const SCHEDULE_EXISTING_WRITING_DOWN_PERCENT = (taxData) => taxData.capital_allowances.writing_down_allowance_main;

// Assets bought in the year all land on the New Plant & Machinery rows. A
// scenario purchase carries a code letter and an amount, not an asset class,
// so any single block is as faithful as another; the note's per-class rows
// and its total both stay anchored to what was posted to Purchases.xlsx.
export const SCHEDULE_NEW_ASSET_ROWS = [67, 68, 69, 70, 71, 72, 73, 74];

export const SCHEDULE_NEW_ASSET_CLASS = "plant";

// Cell G2 of a Sales.xlsx month tab holds the rate the whole book charges.
// The first month reads Admin!M19, each later month reads the month before
// it, and every Purchases month reads its own Sales month. Entering 0 there
// is what the Company guide tells a business that is not registered for VAT
// to do, and it is the only lever that turns VAT off end to end.
export const VAT_RATE_CELL = "G2";

// Column each straddling entry sheet takes its data in. The sheets compute
// VAT and net from the gross figure in the amount column.
export const STRADDLING_COLUMNS = { date: "A", name: "B", invoice: "C", description: "D", amount: "F" };
