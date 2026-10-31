// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { MONTH_SHEETS } from "../../lib/scenario-loader.js";

// ── Scenario cell writes ───────────────────────────────────────────────────
// SE writes to separate xlsx files: Sales.xlsx and Purchases.xlsx.
// Sheet names are "Apr", "May", etc. (not "SalesApr", "PurchasesApr").
//
// Sales.xlsx columns: A=date, B=customer, F=code letter, G=gross amount
//   Code letters: a=Product A, b=Product B, c=Product C, d=Other Income, g=Grants, o=Other
//   H=VAT (auto-calc), I=net (auto-calc), P-V=analysis by code (auto-calc)
//
// Purchases.xlsx columns: A=date, B=supplier, F=code letter, G=gross amount
//   Code letters: s=purchases, c=sub-contractors, o=other direct, w=wages,
//   p=premises, m=repairs, g=general admin, v=motor, h=HP/lease,
//   a=advertising, l=legal, y=other expenses, fa=fixed assets

// Bank/cash entries route to one of two leaf files by account ID.
export const BANK_ACCOUNT_FILES = { 1200: "Bank.xlsx", 1220: "Cash.xlsx" };

// Column layout of the receipts and payments blocks in each workbook's month
// tabs, and the code letters each block has an analysis column for --
// verified against the templates. Bank.xlsx row 5: receipts E/F feed G:M
// under BC/DR/CR/K/RV/DL/X; payments S/T feed U:AC under BC/CR/DR/W/B/J/
// RP/DL/X. Cash.xlsx row 5: receipts E/F feed G:J under BB/DR/CR/DL;
// payments P/Q feed R:X under BB/CR/DR/W/J/RP/DL. A code means opposite
// things on the two sides (CR is a creditor refund received but a
// creditor payment made), so direction cannot be inferred from the code
// alone -- every entry names its own direction. Cash.xlsx has no "X"
// analysis column at all; its own transfer code is "BB".
// reference and comment are two columns both workbooks keep beside the
// receipt or payment block that the writer never used to fill. reference is
// the invoice number column -- Bank.xlsx's receipts carry a "Sales Invoice"
// column at C and its payments an "Enter Purchase Invoice No." column at Q;
// Cash.xlsx keeps the same pair at C and N. comment is the column beside it
// -- Bank.xlsx's D ("Deposit Bank Reference") and R ("Cheque number Direct
// Debit"), Cash.xlsx's D ("Deposit Cash Reference") and O ("Optional cash
// payment reference") -- which the sheet keeps for the payer's own reference
// rather than a description, but is a real, otherwise-empty cell all the
// same, so a line's own free-text comment goes there.
export const BANK_LAYOUTS = {
  "Bank.xlsx": {
    receipt: { date: "A", source: "B", reference: "C", comment: "D", code: "E", amount: "F" },
    payment: { date: "O", source: "P", reference: "Q", comment: "R", code: "S", amount: "T" },
    receiptCodes: new Set(["BC", "DR", "CR", "K", "RV", "DL", "X"]),
    paymentCodes: new Set(["BC", "CR", "DR", "W", "B", "J", "RP", "DL", "X"]),
  },
  "Cash.xlsx": {
    receipt: { date: "A", source: "B", reference: "C", comment: "D", code: "E", amount: "F" },
    payment: { date: "L", source: "M", reference: "N", comment: "O", code: "P", amount: "Q" },
    receiptCodes: new Set(["BB", "DR", "CR", "DL"]),
    paymentCodes: new Set(["BB", "CR", "DR", "W", "J", "RP", "DL"]),
  },
};

// Cell H2 of a Sales.xlsx month tab holds the rate the whole book charges.
// April carries the figure, each later month reads the month before it, and
// every Purchases month reads its own Sales month. Entering 0 there is what
// the Self Employed guide tells a business that is not registered for VAT to
// do, and it is the only lever that turns VAT off end to end.
export const VAT_RATE_CELL = "H2";

export const SE_VAT_LAYOUT = {
  workbook: "Vat.xlsx",
  monthTabs: () => Object.values(MONTH_SHEETS),
  salesNetCell: "I1",
  salesVatCell: "H1",
  purchasesNetCell: "I1",
  purchasesVatCell: "H1",
};

// The straddling entry sheets take the same fields as the month tabs but in
// their own columns, and the sales and purchases sheets do not agree on them.
// Both compute VAT and net from the gross figure in the amount column.
export const STRADDLING_SALES_COLUMNS = { date: "A", name: "B", invoice: "C", amount: "E" };

export const STRADDLING_PURCHASES_COLUMNS = { date: "A", name: "B", invoice: "C", description: "E", amount: "G" };

// The StockControl physical-count cells for the two ends of the accounting
// year -- row 6 is the opening count and row 30 the count at the year end.
// The SA103F front page's "Description of business" box, the merged
// C17:J17 entry cell under the label in C16.
export const BUSINESS_DESCRIPTION_CELL = "C17";

export const STOCK_OPENING_COUNT_CELL = "AB6";

export const STOCK_CLOSING_COUNT_CELL = "AB30";

// VitalTax column I, rows 36 to 50: the customer's own percentage of each
// expense category that is private use or otherwise disallowable, the input
// behind SE Full's boxes 32 to 45. Verified against the template -- row 44
// (business entertainment) and row 49 (depreciation) take no percentage, so
// they carry no key here. See PLAN_SE_TEMPLATE_GAPS.md section 3.1.
export const DISALLOWABLE_PERCENT_CELLS = {
  costOfGoods: "I36",
  paymentsToSubcontractors: "I37",
  wagesAndStaffCosts: "I38",
  carVanTravelExpenses: "I39",
  premisesRunningCosts: "I40",
  maintenanceCosts: "I41",
  adminCosts: "I42",
  advertisingCosts: "I43",
  interestOnBankOtherLoans: "I45",
  financeCharges: "I46",
  irrecoverableDebts: "I47",
  professionalFees: "I48",
  otherExpenses: "I50",
};

// The SA103F boxes the trader states by hand, keyed by HMRC's own API field
// names. Verified against the template: SE Full!O154 (box 57) reads
// D139+D144+D147+D150+D152+D156+D160+O139+O144+O149, so every allowance cell
// here is a term of the total; O169 (box 63) reads O154+D179; O194 (box 73)
// and D219 (box 77) each floor the working sheet's one figure,
// O174-O179+N(D197)+D210+N(O190), at nil from its own side. Box 54's caption
// at N136 is "Electric charge-point allowance" (L136 = 54); box 55's cell
// O144 is the small pools formula, so the enhanced-allowance figure has no
// input cell of its own. Boxes 53 and 53.1 (D156, D160) are not stated here:
// the Schedule's SBA block computes them from scenario.sba_claims, so they
// carry no entry in this table.
export const ANNUAL_ALLOWANCE_CELLS = {
  zeroEmissionsGoodsVehicleAllowance: "D150",
  zeroEmissionsCarAllowance: "D152",
  electricChargePointAllowance: "O139",
};

export const ANNUAL_ADJUSTMENT_CELLS = {
  includedNonTaxableProfits: "D179",
  accountingAdjustment: "D210",
};

// Business Details!O50, the "ENTER: Value of goods and services for your own
// use" cell (label at N48), read by SE Full!D169 and SE Short!D94.
export const GOODS_FOR_OWN_USE_CELL = "O50";

// The basis period record behind SA103F boxes 68, 69 and 73.3, on
// Business Details rows 57 to 75 (verified against the template): D59 box 69
// (overlap profit brought forward), O59 the 2023-24 transition profit not
// yet treated as arising, O69 the additional amount elected this year
// (para 73(1)), D74 the following period's profit (only read when box 9 is
// outside 31 March to 5 April). The sheet computes D64, O64, D69 and O74
// itself; no book field carries them.
export const BASIS_PERIOD_CELLS = {
  overlapProfitBroughtForward: "D59",
  transitionProfitBroughtForward: "O59",
  transitionProfitAccelerationAmount: "O69",
  followingPeriodProfit: "D74",
};

// Business Details boxes 8 and 9 (verified against the template: N27 merged
// N27:Q27, N32 merged N32:Q32, N32 today the formula =Admin!B17), the
// accounting period the trader's own books cover -- the sheet has nowhere
// else to read it from, since every posting date is written onto the
// package's own April-March tab grid regardless of the book's true dates.
export const ACCOUNTING_PERIOD_START_CELL = "N27";

export const ACCOUNTING_PERIOD_END_CELL = "N32";

// Fixedassets.xlsx Schedule sheet -- verified against the template:
//   Existing assets (bought before the year start): rows 8-10 land,
//   14-18 plant, 22-26 fixtures, 30-34 computers, 38-54 motor. Each row:
//   C=asset description, D=purchase reference, E=original cost,
//   F=accumulated depreciation brought forward.
//   New assets (bought during the year): rows 61-63 land, 67-71 plant,
//   75-79 fixtures, 83-87 computers, 91-107 motor. Same C/D/E layout;
//   B=date purchased, U=date sold, V=sale value (net of VAT) for an
//   in-year disposal recorded on the same row as the asset it disposes of.
// Row 1 carries the sheet's own column totals (E1=total cost,
// F1=total acc dep b/f, G1=total WDV b/f, I1=total depreciation charge,
// J1=total acc dep c/f, K1=total WDV c/f, Q1/R1/S1=capital allowance
// totals, V1/W1/X1/Y1/Z1=disposal totals) -- these feed both the P&L
// depreciation/disposal lines and the SA103S capital allowance boxes via
// cross-file external links, and FAreconciliation (a second sheet in the
// same workbook) independently sums the New-asset rows and compares the
// total against Purchases.xlsx's and Sales.xlsx's own fa/fs-coded column
// totals -- the workbook's own note-vs-schedule tie-out.
export const EXISTING_ASSET_ROWS = { motor: [38, 39, 40, 41, 42], computer: [30, 31, 32, 33, 34] };

export const NEW_PLANT_ROWS = [67, 68, 69, 70, 71];

// Column AB on an asset row: "S" puts the row's tax written-down value in
// the special rate pool, so its writing down allowance lands in column AC
// at Admin!G6 instead of column R at Admin!G5. Verified against the template:
// R38 = IF(AND(O38>0,AB38<>"S"),O38*R$4*(1-M38)," "), AC38 the same with
// AB38="S" and AC$4, S38 = IF(O38>0,O38-N(R38)-N(AC38)," "), AC1 = AC57+AC110.
export const SPECIAL_RATE_POOL_MARKER_COLUMN = "AB";

export const SPECIAL_RATE_POOL_MARKER = "S";

// Column AD on an asset row: "P" keeps the row's tax written-down value in a
// single asset pool. R, AC and S stay as they are; AE and AF repeat the
// row's writing down allowance by rate and AG its written-down value, so the
// small pools test on SE Full!O144 can leave the marked rows out. Column M
// on the car rows (38 to 48, 91 to 101) is the private use share the R, AC,
// Y and Z formulas multiply by (1-M). Verified against the template:
// AE38 = IF(AND(AD38="P",AB38<>"S"),N(R38)," "), AF38 the same with AB38="S"
// and N(AC38), AG38 = IF(AD38="P",N(S38)," "), AE1 = AE57+AE110.
export const SINGLE_ASSET_POOL_MARKER_COLUMN = "AD";

export const SINGLE_ASSET_POOL_MARKER = "P";

export const PRIVATE_USE_COLUMN = "M";

// Structures and Buildings Allowance claims, Fixedassets.xlsx Schedule rows
// 115 to 119, below the register (SA103F boxes 53 and 53.1). Written left
// to right: B the date first in qualifying use, C the building name, D its
// number, E the qualifying expenditure, F the postcode, G "F" for a Freeport
// or Investment Zone tax site, I the date qualifying use ceased. H (the
// year's rate), J (days claimed) and K (the year's allowance) are the
// sheet's own formulas. Verified against the template: H115 =
// IF(E115>0,IF(G115="F",[1]Admin!$G$10,[1]Admin!$G$9)," "), K120 =
// SUMIF(G115:G119,"<>F",K115:K119) (box 53), K121 the same with "F"
// (box 53.1).
export const SBA_CLAIM_ROWS = [115, 116, 117, 118, 119];

export const SBA_CLAIM_COLUMNS = {
  qualifyingDate: "B",
  name: "C",
  number: "D",
  qualifyingAmountExpenditure: "E",
  postcode: "F",
  enhanced: "G",
  ceasedDate: "I",
};

export const SBA_ENHANCED_MARKER = "F";

// Hire purchase agreements (Fixedassets.xlsx HPfinance sheet). Only two
// rows are available for scenario agreements before the sheet's own
// layout runs out: row 8 (the "New" block's working master, whose
// monthly-payment formula was never broken) and row 10 (the first row
// the #REF! repair fixes). B=agreement date, C=finance company,
// D=reference, E=amount financed, F=admin charges, G=total interest,
// H=term in months, L=supplier. Written left to right per row, matching
// the Schedule writer below.
export const HP_AGREEMENT_ROWS = [8, 10];

// A self-employment year always opens 6 April and closes 5 April, the same
// month-tab shape a Company keeps for a March year end -- so a scenario's
// dates shift onto the package's period by whole years only, and the month a
// date falls in, and the tab it lands on, never move. The calculator lands
// its own wages-paid dates through the same constant.
export const SE_YEAR_END_MONTH = 3;

// Month tab order (matches MONTH_SHEETS/scenario key order) and the P&L
// column each occupies -- verified against the template (C=Apr .. N=Mar).
export const MONTH_KEYS = ["apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "jan", "feb", "mar"];
