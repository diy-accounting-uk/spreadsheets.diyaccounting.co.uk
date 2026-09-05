#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// extract-scenarios.js — Write every reconciliation fixture, and the diya-gl
// subset behind it, from the master books under examples/.
//
// Usage:
//   node app/bin/extract-scenarios.js
//
// One master a business, one subset a product the business is kept on. A
// fixture states no figure of its own: the transactions come from the
// master's journals, the ledgers and registers from its book, and every
// [expected] figure is worked out here from the two.
//
// Reads:  examples/precision-code-ltd/{book.toml,lines.jsonl}
//         examples/brickwork-pro/{book.toml,lines.jsonl}
//         examples/sp-sixty-driving/{book.toml,lines.jsonl}
//         examples/kestrel-executive-cars/{book.toml,lines.jsonl}
//         examples/basic-taxi-driver/{book.toml,lines.jsonl}
//         examples/autumn-start-cabs/{book.toml,lines.jsonl}
//
// Writes: a book.toml and lines.jsonl subset directory under each master,
//         and the twelve fixtures under app/test/fixtures/.

import { parse as parseTOML } from "smol-toml";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { canonicalBookToml, canonicalLinesJsonl } from "../lib/diya-gl-canonical.js";
import {
  buildClosingDebtors,
  HP_AGREEMENT_FIELD,
  CIS_DEDUCTION_FIELD,
  LTD_PURCHASE_CODE_MAP,
  BST_PURCHASE_CODE_MAP,
  SE_PURCHASE_CODE_MAP,
  TAXI_PURCHASE_CODE_MAP,
  TAXI_BST_PURCHASE_CODE_MAP,
  assertPurchaseCodesCoverChart,
  filterBst,
  bstStaffWagesAsPurchases,
  filterAdvanced,
  filterFull,
  buildGrouped,
  buildPayroll,
  seDrawingsFromDividends,
  withoutDirectorPayroll,
  monthlySalesTotals,
  takingsOnlySales,
  fixedAssetAdditions,
  buildOpeningBalance,
  toV2OpeningBalances,
  formatScenarioToml,
  buildSubsetBook,
  bstAccountFilter,
  seAccountFilter,
  fullAccountFilter,
  getMonthKey,
  taxiExpectedFigures,
  totalsByCode,
  bstExpectedFigures,
  computeNetSales,
  computeSpreadsheetNetSales,
  splitStraddlingLines,
  deriveStraddlingEntries,
} from "../lib/scenario-extractor.js";
import { totalBusinessMiles, calculateMileageAllowance, HMRC_CAR_MILEAGE_RATES } from "../lib/tax/mileage.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const FIXTURES_DIR = join(ROOT, "app", "test", "fixtures");

// ============================================================================
// Masters in, fixtures out
// ============================================================================

function readMaster(name) {
  const dir = join(ROOT, "examples", name);
  const book = parseTOML(readFileSync(join(dir, "book.toml"), "utf-8"));
  const lines = readFileSync(join(dir, "lines.jsonl"), "utf-8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
  return { dir, book, lines };
}

// One product's slice of a master, written where the master keeps it. The
// canonical writer owns the field order and the money formatting, so a
// subset and an export of the same book are text-identical.
const extracted = [];

function writeSubset(masterDir, subsetName, book, subsetSpec, lines) {
  const dir = join(masterDir, subsetName);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "book.toml"), canonicalBookToml(buildSubsetBook(book, { subsetName, ...subsetSpec })));
  writeFileSync(join(dir, "lines.jsonl"), canonicalLinesJsonl(lines));
  return { dataLines: lines.length };
}

function writeFixture(name, toml) {
  writeFileSync(join(FIXTURES_DIR, `${name}.toml`), toml);
  const rows = (table) => (toml.match(new RegExp(`^\\[\\[${table}[.\\]]`, "gm")) || []).length;
  extracted.push({ name, sales: rows("sales"), purchases: rows("purchases"), bank: rows("bank"), payroll: rows("payroll") });
}

// The [business] block every product's Admin sheet takes, from the book's
// own entity information.
function businessBlock(entity, extra = {}) {
  const business = { name: entity.organizationIdentifier, description: extra.description || entity.organizationDescription };
  if (extra.company_number) business.company_number = extra.company_number;
  if (entity.organizationAddressLine) business.address = entity.organizationAddressLine;
  if (entity.organizationTown) business.town = entity.organizationTown;
  if (entity.organizationPostcode) business.postcode = entity.organizationPostcode;
  if (extra.omitContact !== true) {
    if (entity.organizationTelephone) business.phone = entity.organizationTelephone;
    if (entity.taxRegistrationNumber) business.utr = entity.taxRegistrationNumber;
  }
  if (extra.vat_number) business.vat_number = extra.vat_number;
  if (extra.nino) business.nino = extra.nino;
  return business;
}

// The debtor and creditor ledgers the master book publishes. Each listing
// names its counterparty and the invoice still open, timed opening or
// closing, and every scenario takes the same two ledgers -- one business, one
// year end.
function ledgerListing(entries, nameField, timing) {
  return (entries || [])
    .filter((entry) => entry.timing === timing)
    .map((entry) => ({ [nameField]: entry.counterparty, invoice: entry.invoice, amount: entry.amount }));
}

const dateOnly = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value);

const VAT_ON = (gross, rate) => Math.round(((gross * rate) / (1 + rate)) * 100) / 100;

// ============================================================================
// Precision Code Ltd — an IT consultancy kept as a company, a self employed
// trader and a basic sole trader
// ============================================================================

const { dir: PRECISION_DIR, book, lines: precisionLines } = readMaster("precision-code-ltd");

// The straddling lines carry diya-gl:vatPeriodEnd, dated before the book
// opens or after it closes; every function below that builds the accounting
// year's own figures has to see only the year's own lines.
const { yearLines: allLines, straddlingLines } = splitStraddlingLines(precisionLines);

// The one dividend the master book declares for the year. book.dividends is
// an array (a book could in principle declare more than one), but this
// scenario only ever has the single board resolution.
const masterDividend = book.dividends[0];

const precisionEntity = book.entityInformation;
const precisionAddress = {
  organizationAddressLine: precisionEntity.organizationAddressLine,
  organizationTown: precisionEntity.organizationTown,
  organizationPostcode: precisionEntity.organizationPostcode,
  organizationTelephone: precisionEntity.organizationTelephone,
};

// The name the company's book reads under when the same year is kept as a
// sole trader's. The trade itself doesn't change between the company and its
// sole-trader telling of the same year, so the description carries over from
// the master entity rather than a second, separately worded copy of it.
const PRECISION_SOLE_TRADER = {
  organizationIdentifier: "Precision Code Trading",
};

function precisionSubsetEntity(product, { vatRegistered }) {
  const entity = {
    ...PRECISION_SOLE_TRADER,
    "organizationDescription": precisionEntity.organizationDescription,
    ...precisionAddress,
    "taxRegistrationNumber": precisionEntity.taxRegistrationNumber,
    "taxAuthorityIdentifier": "HMRC",
    "diya-gl:product": product,
    "diya-gl:vatRegistered": vatRegistered,
    "diya-gl:basisOfAccounting": "cash",
  };
  if (vatRegistered) entity["diya-gl:vatNumber"] = precisionEntity["diya-gl:vatNumber"];
  return entity;
}

// ============================================================================
// Precision Code ledgers, registers and agreements
// ============================================================================

// The Basic Sole Trader package has one cell a side for what was owed when
// the year opened -- the "Owed start year" figures at C3 and F3 on its
// Debtors & Creditors sheet -- and no room anywhere for the names behind
// them. Its book states the two totals on openingBalances, which is where
// both the writer and the export read them.
function bstOpeningBalances(openingDebtorEntries, openingCreditorEntries) {
  const total = (entries) => Math.round(entries.reduce((sum, entry) => sum + entry.amount, 0) * 100) / 100;
  return { tradeDebtors: total(openingDebtorEntries), tradeCreditors: total(openingCreditorEntries) };
}

function bstOpeningBalanceBlock(openingBalances) {
  return { opening_balance: { trade_debtors: openingBalances.tradeDebtors, trade_creditors: openingBalances.tradeCreditors } };
}

const openingDebtors = ledgerListing(book.debtors, "customer", "opening");
const publishedClosingDebtors = ledgerListing(book.debtors, "customer", "closing");
const openingCreditors = ledgerListing(book.creditors, "supplier", "opening");
const closingCreditors = ledgerListing(book.creditors, "supplier", "closing");

// What the bank journal leaves unsettled has to be the ledger the book
// publishes. Working it out from the invoices raised and the money banked
// keeps the two tied together, so master data that moves one without the
// other stops the extract.
const closingDebtors = buildClosingDebtors(allLines, openingDebtors);
const asDebtorKey = (debtor) => `${debtor.invoice} ${debtor.customer} ${debtor.amount}`;
const workedOut = closingDebtors.map(asDebtorKey).sort().join(", ");
const published = publishedClosingDebtors.map(asDebtorKey).sort().join(", ");
if (workedOut !== published) {
  throw new Error(`The bank journal leaves ${workedOut} owing, against a published closing debtor ledger of ${published}`);
}

// Sales and purchases in the VAT periods either side of the accounting year,
// derived from the master's own straddling lines (sales/purchases lines
// carrying diya-gl:vatPeriodEnd). The VAT workbook keeps a pair of entry
// sheets per straddling period and the figures reach the VAT return without
// ever touching the books, so these are the only transactions in the fixture
// that move a VAT box and leave the trial balance where it was.
const { periodCoveredStart, periodCoveredEnd } = book.documentInfo;
const straddlingSales = deriveStraddlingEntries(straddlingLines, "sales", "customer", periodCoveredStart, periodCoveredEnd);
const straddlingPurchases = deriveStraddlingEntries(straddlingLines, "purchases", "supplier", periodCoveredStart, periodCoveredEnd);

// The hire purchase agreements the master book declares, in the scenario's
// own field names. Each one finances one purchase; the HPfinance sheet works
// the monthly payment and the capital and interest split out for itself.
const hpAgreements = book.hpAgreements.map((agreement) => ({
  date: dateOnly(agreement.startDate),
  finance_company: agreement.financeCompany,
  reference: agreement.agreementID,
  amount_financed: agreement.amountFinanced,
  admin_charges: agreement.adminCharges,
  total_interest: agreement.totalInterest,
  months: agreement.termMonths,
  supplier: agreement.supplier,
}));

// The fixed assets the book holds at the opening balance sheet date, on the
// Schedule's own terms. tax_wdv is the written down value the capital
// allowances working brings forward, which is not the accounting
// depreciation and is the register's own figure.
const OPENING_ASSET_CATEGORIES = { motorVehicles: "motor", computerTechnology: "computer", landBuildings: "land" };

const openingFixedAssets = book.fixedAssets.map((asset) => {
  const opening = {
    category: OPENING_ASSET_CATEGORIES[asset.class],
    description: asset.description,
    cost: asset.cost,
    acc_dep: asset.accumulatedDepreciation,
  };
  if (asset.taxWrittenDownValue !== undefined) opening.tax_wdv = asset.taxWrittenDownValue;
  return opening;
});

// SE's Schedule has no land block (se.js EXISTING_ASSET_ROWS only carries
// motor and computer), the same restriction filterAdvanced already applies
// to the rest of the opening journal (only accounts 0030/0040 pass). Ltd's
// Schedule and OpenAccounts both take land, so the full set stands there.
const seOpeningFixedAssets = openingFixedAssets.filter((asset) => asset.category !== "land");

// The charges registered over the company's assets, from the book's own
// register. Each one secures a creditor falling due after more than one year.
const chargesRegister = book.charges.map((charge) => ({
  date: dateOnly(charge.chargeDate),
  asset: charge.description,
  valuation: charge.valuation,
  holder: charge.holder,
  terms: charge.terms,
  board_meeting: dateOnly(charge.boardMeetingDate),
}));

// ============================================================================
// Extract BST (basic)
// ============================================================================

const bstLines = filterBst(bstStaffWagesAsPurchases(allLines));
const bstGrouped = buildGrouped(bstLines, BST_PURCHASE_CODE_MAP, {
  carriesCisDeductions: false,
  carriesSourceFields: true,
  carriesMileage: "claims",
});
const bstFigures = bstExpectedFigures(bstLines, book.stock);
const bstEntity = precisionSubsetEntity("BasicSoleTrader", { vatRegistered: false });

// Purchases coded f capitalise out of the profit and loss account. The Fixed
// Assets schedule is where they earn their capital allowance, so the same
// purchases are registered there. A schedule short of the journal strands the
// spend in neither statement.
const bstFixedAssetAdditions = fixedAssetAdditions(bstLines, BST_PURCHASE_CODE_MAP, "f");
const bstOpeningLedger = bstOpeningBalances(openingDebtors, openingCreditors);

const bstToml = formatScenarioToml(
  {
    name: "Precision Code - basic sole trader",
    description: "BST-scoped extract from Precision Code Ltd master data. Sales + purchases, 14 BST expense codes, no VAT/bank/payroll.",
    product: "bst",
    tax_regime: "se",
    vat_registered: false,
    business: businessBlock(bstEntity),
  },
  bstGrouped,
  {
    ...bstFigures,
    ...bstOpeningBalanceBlock(bstOpeningLedger),
    // In-year additions go in the "Bought AFTER" block on the Fixed Assets
    // schedule. 100% Annual Investment Allowance applies, so the full cost is
    // claimed in the year.
    fixed_asset_additions: bstFixedAssetAdditions,
  },
);

const bstV2 = {
  stock: { openingValue: 10000, closingValue: 6000 },
  openingBalances: bstOpeningLedger,
  // The named ledgers the trade actually kept. The Basic Sole Trader sheets
  // have no counterparty column to hold them, so the round trip declares them
  // structurally absent rather than dropping them out of the book and leaving
  // the absence unmeasured.
  debtors: book.debtors,
  creditors: book.creditors,
  fixedAssets: bstFixedAssetAdditions.map((asset, index) => ({
    assetID: `BST-FA-${index + 1}`,
    description: asset.description,
    cost: asset.cost,
    acquiredDate: asset.date,
  })),
};

writeFixture("bst-scenario-basic", bstToml);
const bstDiya = writeSubset(
  PRECISION_DIR,
  "bst",
  book,
  {
    entity: bstEntity,
    taxSections: ["incomeTax", "nationalInsurance", "capitalAllowances", "mileage"],
    accountFilter: bstAccountFilter,
    tables: bstV2,
  },
  bstLines,
);

// ============================================================================
// Extract SE (advanced)
// ============================================================================

const advLines = seDrawingsFromDividends(filterAdvanced(allLines));
const advSalesLines = advLines.filter((l) => l.sourceJournalID === "sales");
const SE_TURNOVER_ACCOUNTS = new Set(["4000", "4001", "4002", "4003"]);
const advTurnoverLines = advSalesLines.filter((l) => SE_TURNOVER_ACCOUNTS.has(l.accountMainID));
const advTotalSales = computeSpreadsheetNetSales(advTurnoverLines);
const advGrouped = buildGrouped(advLines, SE_PURCHASE_CODE_MAP, { carriesSourceFields: true, carriesMileage: "claims" });
advGrouped.payroll = buildPayroll(advLines, { carriesSourceFields: true, employees: book.employees });
const advPurchLines = advLines.filter((l) => l.sourceJournalID === "purchases");
const advByCode = {};
advPurchLines.forEach((l) => {
  const c = SE_PURCHASE_CODE_MAP[l.accountMainID];
  if (c) advByCode[c] = (advByCode[c] || 0) + l.amount;
});
// A mileage-log line buys nothing: the Purchases sheet prices the year's
// business miles itself and files the claim under Motor Expenses with no VAT
// on it, so the motoring total leaves the line's own amount out and takes the
// claim instead. Trusting the amount the master states would tie the figure
// to whichever package that line was priced for.
const advBusinessMiles = totalBusinessMiles(advPurchLines);
const advCashMotor = advPurchLines
  .filter((l) => !(l.measurableUnitOfMeasure === "miles" && typeof l.measurableQuantity === "number"))
  .filter((l) => SE_PURCHASE_CODE_MAP[l.accountMainID] === "v")
  .reduce((sum, l) => sum + l.amount, 0);
const advToml = formatScenarioToml(
  {
    name: "Precision Code - advanced self employed",
    description: "SE-scoped extract from Precision Code Ltd master data. Sales + purchases + bank + payroll, with VAT.",
    product: "se",
    tax_regime: "se",
    vat_registered: true,
    business: {
      name: "Precision Code Trading",
      description: "IT consultancy and software development",
      address: "123 High Street",
      town: "Manchester",
      postcode: "M1 1AA",
      phone: "0161 555 0100",
      utr: "1234567890",
      vat_number: "123456789",
      nino: "AB123456C",
    },
    employees: book.employees || [],
  },
  advGrouped,
  {
    total_sales: advTotalSales,
    total_mileage: advBusinessMiles,
    total_motor_net: Math.round(advCashMotor / 1.2 + calculateMileageAllowance(advBusinessMiles, HMRC_CAR_MILEAGE_RATES)),
    total_legal_net: Math.round((advByCode.l || 0) / 1.2),
    opening_stock: 10000,
    closing_stock: 6000,
    opening_fixed_assets: seOpeningFixedAssets,
    opening_debtors: openingDebtors,
    closing_debtors: closingDebtors,
    opening_creditors: openingCreditors,
    closing_creditors: closingCreditors,
    vat_straddling_sales: straddlingSales,
    vat_straddling_purchases: straddlingPurchases,
    hp_agreements: hpAgreements,
  },
);

const advV2 = {
  stock: { openingValue: 10000, closingValue: 6000 },
  debtors: book.debtors,
  creditors: book.creditors,
  // Same restriction as seOpeningFixedAssets above: SE's Schedule has no
  // land block, so a land & buildings asset the master book holds is a Ltd
  // fact, not one this subset can carry.
  fixedAssets: book.fixedAssets.filter((asset) => asset.class !== "landBuildings"),
  hpAgreements: book.hpAgreements,
};

writeFixture("se-scenario-advanced", advToml);
const advDiya = writeSubset(
  PRECISION_DIR,
  "advanced",
  book,
  {
    entity: precisionSubsetEntity("SelfEmployed", { vatRegistered: true }),
    taxSections: ["incomeTax", "nationalInsurance", "vat", "capitalAllowances", "mileage"],
    accountFilter: seAccountFilter,
    employees: book.employees,
    tables: advV2,
  },
  advLines,
);

// ============================================================================
// Extract Ltd (full)
// ============================================================================

const fullLines = filterFull(allLines);
const fullSalesLines = fullLines.filter((l) => l.sourceJournalID === "sales");
const LTD_TURNOVER_ACCOUNTS = new Set(["4000", "4001", "4002", "4003", "4004"]);
const fullTurnoverLines = fullSalesLines.filter((l) => LTD_TURNOVER_ACCOUNTS.has(l.accountMainID));
const fullTotalSales = computeSpreadsheetNetSales(fullTurnoverLines);
const fullGrouped = buildGrouped(fullLines, LTD_PURCHASE_CODE_MAP, { carriesSourceFields: true });
fullGrouped.payroll = buildPayroll(fullLines, { carriesSourceFields: true, employees: book.employees });
const fullPurchLines = fullLines.filter((l) => l.sourceJournalID === "purchases");
const fullByCode = {};
fullPurchLines.forEach((l) => {
  const c = LTD_PURCHASE_CODE_MAP[l.accountMainID];
  if (c) fullByCode[c] = (fullByCode[c] || 0) + l.amount;
});
// The share register and the board minute, both from the master book. The
// register is the directors who hold shares; the minute is the dividend they
// declared for the year. Each is tied back to the ledger it has to agree
// with, so master data that moves without the other moving stops the extract
// rather than publishing a book that does not add up.
const NOMINAL_SHARE_VALUE = 1;
const fullMembers = book.members.map((member) => ({ name: member.name, shares: member.shares, acquired: dateOnly(member.acquiredDate) }));
const fullOpeningBalance = buildOpeningBalance(fullLines);
const fullSharesIssued = fullMembers.reduce((total, m) => total + m.shares, 0);
if (fullSharesIssued * NOMINAL_SHARE_VALUE !== fullOpeningBalance.share_capital) {
  throw new Error(
    `Register of members holds ${fullSharesIssued} shares at ${NOMINAL_SHARE_VALUE} each, ` +
      `against share capital of ${fullOpeningBalance.share_capital} on the opening balance sheet`,
  );
}

const fullDividendsPaid = fullLines
  .filter((l) => l["diya-gl:bankCode"] === "DV")
  .reduce((total, l) => total + (l.debitCreditCode === "C" ? l.amount : -l.amount), 0);
if (masterDividend.amount !== fullDividendsPaid) {
  throw new Error(`The board minuted a dividend of ${masterDividend.amount}, against ${fullDividendsPaid} paid out of the bank`);
}

// Each hire purchase agreement pays for one purchase, at the purchase's cost
// net of VAT -- the VAT is the buyer's to settle, not the finance company's.
// The purchase reaches the books as an ordinary trade creditor and the
// year-end journal then moves the amount financed onto creditors falling due
// after more than one year. HPfinance!E2 totals the amounts financed and the
// trial balance reads it on both rows, so an agreement whose purchase is
// missing leaves the asset off the schedule and the reclassification with
// nothing to move.
const hpFinanced = hpAgreements.reduce((total, agreement) => total + agreement.amount_financed, 0);
const hpPurchasedNet = fullPurchLines
  .filter((l) => l[HP_AGREEMENT_FIELD])
  .reduce((total, l) => total + l.amount / (1 + (l.taxRate || 0)), 0);
if (hpFinanced !== hpPurchasedNet) {
  throw new Error(`Hire purchase agreements finance ${hpFinanced}, against ${hpPurchasedNet} of purchases net of VAT bought under them`);
}

const fullToml = formatScenarioToml(
  {
    name: "Precision Code Ltd - full",
    description: "Full Ltd-scoped extract from Precision Code Ltd master data. All journals, all accounts.",
    product: "ltd",
    tax_regime: "ltd",
    vat_registered: true,
    business: {
      name: "Precision Code Ltd",
      description: "IT consultancy and software development",
      company_number: "12345678",
      address: "123 High Street",
      town: "Manchester",
      postcode: "M1 1AA",
      phone: "0161 555 0100",
      utr: "1234567890",
      vat_number: "123456789",
    },
    employees: book.employees || [],
    members: fullMembers,
  },
  fullGrouped,
  {
    total_sales: fullTotalSales,
    total_premises_net: Math.round((fullByCode.r || 0) / 1.2),
    total_legal_net: Math.round((fullByCode.l || 0) / 1.2),
    opening_balance: fullOpeningBalance,
    opening_stock: 10000,
    closing_stock: 6000,
    // Three per cent of the consultancy's net sales is direct materials.
    // Without it the Stock sheet's bought and sold columns stay switched off
    // and the calculated stock never leaves the opening figure.
    stock_materials_percent: 0.03,
    charges: chargesRegister,
    dividend: {
      board_meeting: masterDividend.boardMeetingDate.toISOString().slice(0, 10),
      declared: masterDividend.amount,
    },
    opening_fixed_assets: openingFixedAssets,
    opening_debtors: openingDebtors,
    closing_debtors: closingDebtors,
    opening_creditors: openingCreditors,
    closing_creditors: closingCreditors,
    vat_straddling_sales: straddlingSales,
    vat_straddling_purchases: straddlingPurchases,
    hp_agreements: hpAgreements,
  },
);

const fullV2 = {
  openingBalances: toV2OpeningBalances(fullOpeningBalance),
  stock: { openingValue: 10000, closingValue: 6000, materialsPercent: 0.03 },
  debtors: book.debtors,
  creditors: book.creditors,
  fixedAssets: book.fixedAssets,
  hpAgreements: book.hpAgreements,
  dividends: book.dividends,
  members: book.members,
  charges: book.charges,
};

writeFixture("ltd-scenario-full", fullToml);
const fullDiya = writeSubset(
  PRECISION_DIR,
  "full",
  book,
  {
    entity: precisionEntity,
    taxSections: ["corporationTax", "capitalAllowances", "vat", "nationalInsurance", "dividends", "mileage", "incomeTax"],
    accountFilter: fullAccountFilter,
    directors: book.directors,
    employees: book.employees,
    tables: fullV2,
  },
  fullLines,
);

// ============================================================================
// BrickWork Pro — a builder kept as a company, a self employed trader and a
// basic sole trader, each in two sizes: the trade the master books, and the
// registered twin trading half as much again
// ============================================================================

const { dir: BRICKWORK_DIR, book: brickBook, lines: brickMasterLines } = readMaster("brickwork-pro");

for (const [name, map] of [
  ["LTD_PURCHASE_CODE_MAP", LTD_PURCHASE_CODE_MAP],
  ["SE_PURCHASE_CODE_MAP", SE_PURCHASE_CODE_MAP],
  ["BST_PURCHASE_CODE_MAP", BST_PURCHASE_CODE_MAP],
]) {
  assertPurchaseCodesCoverChart(brickBook, map, name);
}

const brickEntity = brickBook.entityInformation;
const brickAddress = {
  organizationAddressLine: brickEntity.organizationAddressLine,
  organizationTown: brickEntity.organizationTown,
  organizationPostcode: brickEntity.organizationPostcode,
  organizationTelephone: brickEntity.organizationTelephone,
};

// The payslip identifiers the two employees carry. A diya-gl book's employee
// table has no field for a National Insurance number, so the Payslips
// workbook takes them from here.
const BRICKWORK_NI_NUMBERS = { EMP001: "AB123456C", EMP002: "CD654321A" };

function brickworkEmployees(employees) {
  return employees.map((employee) => ({ ...employee, niNumber: BRICKWORK_NI_NUMBERS[employee.employeeID] }));
}

// ---------------------------------------------------------------------------
// The registered twin
// ---------------------------------------------------------------------------

// The same firm trading half as much again, which is what puts it over the
// registration threshold, with VAT at 20% on top of every trade amount. The
// van is the same vehicle at the same net cost, so it carries the VAT and not
// the change in size. Money banked against a scaled invoice scales with it;
// wages, PAYE and corporation tax do not.
const TWIN_TRADE_SCALE = 1.5;
const TWIN_VAT_RATE = 0.2;
const TWIN_VAT_NUMBER = "376543219";
const TWIN_SCALED_OPENING_ACCOUNTS = new Set(["1300", "2100"]);
const TWIN_VAT_ACCOUNT = "2200";
const TWIN_RETAINED_EARNINGS_ACCOUNT = "3100";

// What the twin owes HMRC at the year start, and the three quarterly
// settlements that fall inside the year. The fourth quarter is still owed at
// the year end, which is what leaves the VAT return with a closing balance to
// carry.
const TWIN_OPENING_VAT_DUE = { date: "2025-04-07", amount: 1000 };
const TWIN_VAT_SETTLEMENTS = [
  { date: "2025-08-07", amount: 1900 },
  { date: "2025-11-07", amount: 1900 },
  { date: "2026-02-07", amount: 1900 },
];

const round2 = (value) => Math.round(value * 100) / 100;

function twinBankLine(date, amount, comment, reference) {
  return {
    "sourceJournalID": "bank",
    "postingDate": date,
    "accountMainID": "1200",
    amount,
    "detailComment": "HMRC",
    "lineItemComment": comment,
    "documentType": "bank-statement",
    "documentReference": reference,
    "taxCode": "OS",
    "taxRate": 0,
    "diya-gl:bankCode": "RV",
    "debitCreditCode": "C",
    "diya-gl:bankAccountID": "1200",
  };
}

// What a month's invoices come to on one journal. A supplier payment settles
// the purchases month less the tax withheld from the sub-contractors among
// them, and a customer receipt settles the sales month less the tax a
// contractor customer withheld from this business.
function invoicedByMonth(lines, journal) {
  const invoiced = {};
  for (const line of lines) {
    if (line.sourceJournalID !== journal) continue;
    const month = line.postingDate.slice(0, 7);
    invoiced[month] = round2((invoiced[month] || 0) + line.amount);
  }
  return invoiced;
}

// The month's tax under the Construction Industry Scheme on one journal. On
// purchases that is what the company withheld from its own sub-contractors
// and owes over to HMRC; on sales it is the other side of the scheme, the tax
// a contractor customer withheld from this business, which is never part of
// what the business remits.
function cisByMonth(lines, journal) {
  const deducted = {};
  for (const line of lines) {
    if (line.sourceJournalID !== journal) continue;
    if (!line[CIS_DEDUCTION_FIELD]) continue;
    const month = line.postingDate.slice(0, 7);
    deducted[month] = round2((deducted[month] || 0) + line[CIS_DEDUCTION_FIELD]);
  }
  return deducted;
}

function monthsBefore(month, count) {
  const [year, index] = month.split("-").map(Number);
  const shifted = index - count;
  return `${year + Math.floor((shifted - 1) / 12)}-${String(((((shifted - 1) % 12) + 12) % 12) + 1).padStart(2, "0")}`;
}

function registeredTwin(lines, book) {
  const twinTrade = lines.map((line) => {
    if (line.sourceJournalID !== "sales" && line.sourceJournalID !== "purchases") return line;
    // A capital purchase buys the same asset either way, so only the VAT is
    // added to it. The tax withheld from a sub-contractor is worked out on
    // the amount net of VAT, so it follows the trade and not the invoice.
    const scale = line["diya-gl:assetID"] ? 1 : TWIN_TRADE_SCALE;
    const traded = { ...line, amount: round2(line.amount * scale * (1 + TWIN_VAT_RATE)), taxCode: "S", taxRate: TWIN_VAT_RATE };
    if (line[CIS_DEDUCTION_FIELD]) traded[CIS_DEDUCTION_FIELD] = round2(line[CIS_DEDUCTION_FIELD] * TWIN_TRADE_SCALE);
    return traded;
  });

  const invoiced = invoicedByMonth(twinTrade, "purchases");
  const withheld = cisByMonth(twinTrade, "purchases");
  const sold = invoicedByMonth(twinTrade, "sales");
  const suffered = cisByMonth(twinTrade, "sales");
  const openingMonth = dateOnly(book.documentInfo.periodCoveredStart).slice(0, 7);

  const scaled = twinTrade.map((line) => {
    if (line.sourceJournalID === "bank" && line["diya-gl:bankCode"] === "DR") {
      // The receipt in the year's first month settles the debtors brought
      // forward, which scale with the ledger. Every later one settles the
      // month before it, net of the tax a contractor customer withheld from
      // those invoices -- worked out on the amount before VAT, so it does not
      // scale with the invoice the way the trade does.
      const month = line.postingDate.slice(0, 7);
      if (month === openingMonth) return { ...line, amount: round2(line.amount * TWIN_TRADE_SCALE * (1 + TWIN_VAT_RATE)) };
      const settles = monthsBefore(month, 1);
      return { ...line, amount: round2((sold[settles] || 0) - (suffered[settles] || 0)) };
    }
    if (line.sourceJournalID === "bank" && line["diya-gl:bankCode"] === "CR") {
      // The payment in the year's first month settles the creditors brought
      // forward, which scale with the ledger. Every later one settles the
      // month before it, net of the tax withheld from the sub-contractors
      // among those invoices.
      const month = line.postingDate.slice(0, 7);
      if (month === openingMonth) return { ...line, amount: round2(line.amount * TWIN_TRADE_SCALE * (1 + TWIN_VAT_RATE)) };
      const settles = monthsBefore(month, 1);
      return { ...line, amount: round2((invoiced[settles] || 0) - (withheld[settles] || 0)) };
    }
    if (line.sourceJournalID === "bank" && line["diya-gl:bankCode"] === "RC") {
      return { ...line, amount: withheld[monthsBefore(line.postingDate.slice(0, 7), 2)] || 0 };
    }
    if (line.sourceJournalID === "journal" && TWIN_SCALED_OPENING_ACCOUNTS.has(line.accountMainID)) {
      return { ...line, amount: round2(line.amount * TWIN_TRADE_SCALE * (1 + TWIN_VAT_RATE)) };
    }
    return line;
  });

  const openingJournal = scaled.filter((line) => line.sourceJournalID === "journal");
  const vatBroughtForward = {
    ...openingJournal[0],
    accountMainID: TWIN_VAT_ACCOUNT,
    amount: TWIN_OPENING_VAT_DUE.amount,
    lineItemComment: "VAT outstanding at the year start",
    debitCreditCode: "C",
    lineNumber: openingJournal.length + 1,
  };
  const withVatDue = [...openingJournal, vatBroughtForward];
  const sideTotal = (side) =>
    withVatDue
      .filter((line) => line.debitCreditCode === side && line.accountMainID !== TWIN_RETAINED_EARNINGS_ACCOUNT)
      .reduce((total, line) => total + line.amount, 0);
  const retainedEarnings = round2(sideTotal("D") - sideTotal("C"));

  const twinLines = scaled.map((line) => {
    if (line.sourceJournalID === "journal" && line.accountMainID === TWIN_RETAINED_EARNINGS_ACCOUNT) {
      return { ...line, amount: retainedEarnings };
    }
    return line;
  });

  const settlements = [TWIN_OPENING_VAT_DUE, ...TWIN_VAT_SETTLEMENTS].map((settlement, index) =>
    twinBankLine(
      settlement.date,
      settlement.amount,
      index === 0 ? "VAT outstanding at the year start" : "Quarterly VAT payment",
      `BNK-RV-${String(index + 1).padStart(3, "0")}`,
    ),
  );

  return [...twinLines, vatBroughtForward, ...settlements].sort((a, b) =>
    a.postingDate < b.postingDate ? -1 : a.postingDate > b.postingDate ? 1 : 0,
  );
}

// ---------------------------------------------------------------------------
// The sole trader adaptation
// ---------------------------------------------------------------------------

// A sole trader is not his own employee and pays no corporation tax, so the
// director's payslip becomes monthly drawings and the corporation tax
// payment leaves the bank statement. The Self Employed package analyses every
// HMRC payment under one code, so the company's VAT and Construction Industry
// Scheme payments join its PAYE payments there.
const SOLE_TRADER_OPENING_BANK = 15000;
const SOLE_TRADER_MONTHLY_DRAWINGS = 1200;
const SOLE_TRADER_DRAWINGS_DAY = 25;
const SOLE_TRADER_NINO = "EF112233B";

// The next entry numbers in the master's own scheme, one past the highest it
// hands out. A line the adaptation invents still has to be addressable: an
// edit and a fix-it helper both name the line they change by its entry
// number, so a line without one can never be changed or removed.
function nextEntryNumbers(lines, count) {
  let highest = 0;
  for (const line of lines) {
    const digits = String(line.entryNumber || "").match(/^TXN-(\d+)$/);
    if (digits) highest = Math.max(highest, Number(digits[1]));
  }
  return Array.from({ length: count }, (unused, index) => `TXN-${String(highest + 1 + index).padStart(4, "0")}`);
}

function soleTraderAdaptation(lines, book) {
  const staffOnly = withoutDirectorPayroll(lines, book);
  const netWagesByMonth = {};
  for (const line of staffOnly.filter((l) => l.sourceJournalID === "payroll")) {
    const month = line.postingDate.slice(0, 7);
    netWagesByMonth[month] = round2((netWagesByMonth[month] || 0) + line["diya-gl:netPay"]);
  }

  const adapted = [];
  for (const line of staffOnly) {
    if (line.sourceJournalID === "journal") continue;
    if (line.sourceJournalID !== "bank") {
      adapted.push(line);
      continue;
    }
    const code = line["diya-gl:bankCode"];
    if (code === "RT") continue;
    if (code === "BC") {
      adapted.push({ ...line, amount: SOLE_TRADER_OPENING_BANK, lineItemComment: "Bank account opening balance" });
      continue;
    }
    if (code === "RV" || code === "RC") {
      adapted.push({ ...line, "diya-gl:bankCode": "RP" });
      continue;
    }
    if (code === "W") {
      adapted.push({ ...line, amount: netWagesByMonth[line.postingDate.slice(0, 7)] });
      continue;
    }
    adapted.push(line);
  }

  const drawingsMonths = Object.keys(netWagesByMonth).sort();
  const drawingsEntryNumbers = nextEntryNumbers(adapted, drawingsMonths.length);
  const drawings = drawingsMonths.map((month, index) => ({
    "entryNumber": drawingsEntryNumbers[index],
    "sourceJournalID": "bank",
    "postingDate": `${month}-${SOLE_TRADER_DRAWINGS_DAY}`,
    "accountMainID": "1200",
    "amount": SOLE_TRADER_MONTHLY_DRAWINGS,
    "detailComment": "Proprietor",
    "lineItemComment": "Drawings",
    "documentType": "bank-statement",
    "documentReference": `BNK-DL-${String(index + 1).padStart(3, "0")}`,
    "taxCode": "OS",
    "taxRate": 0,
    "diya-gl:bankCode": "DL",
    "debitCreditCode": "C",
    "diya-gl:bankAccountID": "1200",
  }));

  return [...adapted, ...drawings].sort((a, b) => (a.postingDate < b.postingDate ? -1 : a.postingDate > b.postingDate ? 1 : 0));
}

// ---------------------------------------------------------------------------
// The five fixtures
// ---------------------------------------------------------------------------

const BRICKWORK_TWIN_NOTE =
  "The trade scales 1.5 times against the non-VAT twin of this scenario, but both buy the same van at the same £12,000 net cost, " +
  "so the £14,400 here is that same asset with VAT on it and net purchases across the pair do not scale by 1.5.";
const BRICKWORK_PLAIN_NOTE =
  "The VAT twin of this scenario scales the trade 1.5 times but buys the same van at the same £12,000 net cost, " +
  "so net purchases across the pair do not scale by 1.5.";
const BRICKWORK_ALLOWANCE_NOTE = "The Employment Allowance covers the employer's National Insurance, so that line is nil.";

function brickworkLedgers(vatRegistered) {
  const scale = vatRegistered ? TWIN_TRADE_SCALE * (1 + TWIN_VAT_RATE) : 1;
  const scaled = (entries, nameField, timing) =>
    ledgerListing(entries, nameField, timing).map((entry) => ({ ...entry, amount: round2(entry.amount * scale) }));
  return {
    opening_debtors: scaled(brickBook.debtors, "customer", "opening"),
    closing_debtors: scaled(brickBook.debtors, "customer", "closing"),
    opening_creditors: scaled(brickBook.creditors, "supplier", "opening"),
    closing_creditors: scaled(brickBook.creditors, "supplier", "closing"),
  };
}

function brickworkLedgerTables(vatRegistered) {
  const scale = vatRegistered ? TWIN_TRADE_SCALE * (1 + TWIN_VAT_RATE) : 1;
  const scaled = (entries) => entries.map((entry) => ({ ...entry, amount: round2(entry.amount * scale) }));
  return { debtors: scaled(brickBook.debtors), creditors: scaled(brickBook.creditors) };
}

function brickworkEntity(product, { vatRegistered, soleTrader }) {
  const entity = {
    "organizationIdentifier": soleTrader ? "BrickWork Pro Trading" : brickEntity.organizationIdentifier,
    "organizationDescription": brickEntity.organizationDescription,
    ...brickAddress,
    "taxRegistrationNumber": brickEntity.taxRegistrationNumber,
    "taxAuthorityIdentifier": "HMRC",
    "diya-gl:product": product,
    "diya-gl:vatRegistered": vatRegistered,
    "diya-gl:basisOfAccounting": soleTrader ? "cash" : "accrual",
  };
  if (soleTrader) entity["diya-gl:nino"] = SOLE_TRADER_NINO;
  else entity["diya-gl:companyNumber"] = brickEntity["diya-gl:companyNumber"];
  if (vatRegistered) entity["diya-gl:vatNumber"] = TWIN_VAT_NUMBER;
  entity["diya-gl:cisRegistered"] = brickEntity["diya-gl:cisRegistered"];
  return entity;
}

// --- Basic Sole Trader, the trade the master books ---------------------------

const brickBstLines = filterBst(bstStaffWagesAsPurchases(withoutDirectorPayroll(brickMasterLines, brickBook)));
const brickBstFigures = bstExpectedFigures(brickBstLines, brickBook.stock);
const brickBstAdditions = fixedAssetAdditions(brickBstLines, BST_PURCHASE_CODE_MAP, "f");
const brickBstEntity = brickworkEntity("BasicSoleTrader", { vatRegistered: false, soleTrader: true });
const brickBstLedgers = brickworkLedgers(false);
const brickBstOpeningLedger = bstOpeningBalances(brickBstLedgers.opening_debtors, brickBstLedgers.opening_creditors);

const brickBstToml = formatScenarioToml(
  {
    name: "BrickWork Pro BST",
    description:
      "Construction sole trader under the VAT registration threshold, on the Basic Sole Trader package. Sub-contract labour is bought in as a direct cost, the labourer's wage is an employee cost, and there is no bank journal. " +
      BRICKWORK_PLAIN_NOTE,
    product: "bst",
    tax_regime: "se",
    vat_registered: false,
    business: businessBlock(brickBstEntity),
  },
  buildGrouped(brickBstLines, BST_PURCHASE_CODE_MAP, {
    carriesCisDeductions: false,
    carriesPaymentLabels: true,
    carriesSourceFields: true,
    carriesMileage: "claims",
  }),
  {
    ...brickBstFigures,
    ...bstOpeningBalanceBlock(brickBstOpeningLedger),
    fixed_asset_additions: brickBstAdditions,
  },
);

writeFixture("bst-brickwork-pro-nonvat", brickBstToml);
const brickBstDiya = writeSubset(
  BRICKWORK_DIR,
  "bst-nonvat",
  brickBook,
  {
    entity: brickBstEntity,
    taxSections: ["incomeTax", "nationalInsurance", "capitalAllowances", "mileage"],
    accountFilter: bstAccountFilter,
    tables: {
      stock: brickBook.stock,
      openingBalances: brickBstOpeningLedger,
      ...brickworkLedgerTables(false),
      fixedAssets: brickBook.fixedAssets,
    },
  },
  brickBstLines,
);

// --- Self Employed, both sizes ----------------------------------------------

function writeBrickworkSe(vatRegistered) {
  const masterLines = vatRegistered ? registeredTwin(brickMasterLines, brickBook) : brickMasterLines;
  const lines = filterAdvanced(soleTraderAdaptation(masterLines, brickBook));
  const salesLines = lines.filter((line) => line.sourceJournalID === "sales");
  const byCode = totalsByCode(lines, SE_PURCHASE_CODE_MAP);
  const vatDivisor = 1 + (vatRegistered ? TWIN_VAT_RATE : 0);
  const grouped = buildGrouped(lines, SE_PURCHASE_CODE_MAP, { carriesSourceFields: true, carriesMileage: "claims" });
  grouped.payroll = buildPayroll(lines, { carriesSourceFields: true, employees: brickBook.employees });
  const entity = brickworkEntity("SelfEmployed", { vatRegistered, soleTrader: true });
  const employees = brickworkEmployees(brickBook.employees.filter((employee) => !employee.isDirector));

  const expected = {
    total_sales: computeNetSales(salesLines),
    ...brickworkLedgers(vatRegistered),
    opening_stock: brickBook.stock.openingValue,
    closing_stock: brickBook.stock.closingValue,
  };
  if (byCode.v) expected.total_motor_net = Math.round(byCode.v / vatDivisor);
  if (byCode.l) expected.total_legal_net = Math.round(byCode.l / vatDivisor);

  const toml = formatScenarioToml(
    {
      name: `BrickWork Pro SE ${vatRegistered ? "VAT" : "non-VAT"}`,
      description:
        "Construction sole trader, CIS sub-contractors, one labourer on the payroll. " +
        (vatRegistered
          ? `Turnover is over the VAT registration threshold, which is why the business is registered. Journal amounts include VAT at 20%. ${BRICKWORK_TWIN_NOTE}`
          : `Turnover is under the VAT registration threshold. Journal amounts carry no VAT. ${BRICKWORK_PLAIN_NOTE}`) +
        ` ${BRICKWORK_ALLOWANCE_NOTE}`,
      product: "se",
      tax_regime: "se",
      vat_registered: vatRegistered,
      business: businessBlock(entity, { vat_number: entity["diya-gl:vatNumber"], nino: SOLE_TRADER_NINO }),
      employees,
    },
    grouped,
    expected,
  );

  writeFixture(`se-brickwork-pro-${vatRegistered ? "vat" : "nonvat"}`, toml);
  return writeSubset(
    BRICKWORK_DIR,
    `se-${vatRegistered ? "vat" : "nonvat"}`,
    brickBook,
    {
      entity,
      taxSections: ["incomeTax", "nationalInsurance", "vat", "capitalAllowances", "mileage"],
      accountFilter: seAccountFilter,
      employees,
      tables: {
        stock: brickBook.stock,
        ...brickworkLedgerTables(vatRegistered),
        fixedAssets: brickBook.fixedAssets,
      },
    },
    lines,
  );
}

const brickSeNonVatDiya = writeBrickworkSe(false);
const brickSeVatDiya = writeBrickworkSe(true);

// --- Company, both sizes ----------------------------------------------------

function writeBrickworkLtd(vatRegistered) {
  const lines = filterFull(vatRegistered ? registeredTwin(brickMasterLines, brickBook) : brickMasterLines);
  const salesLines = lines.filter((line) => line.sourceJournalID === "sales");
  const purchaseLines = lines.filter((line) => line.sourceJournalID === "purchases");
  const byCode = totalsByCode(lines, LTD_PURCHASE_CODE_MAP);
  const vatRate = vatRegistered ? TWIN_VAT_RATE : 0;
  const vatDivisor = 1 + vatRate;
  const grouped = buildGrouped(lines, LTD_PURCHASE_CODE_MAP, { carriesSourceFields: true });
  grouped.payroll = buildPayroll(lines, { carriesSourceFields: true, employees: brickBook.employees });
  const openingBalance = buildOpeningBalance(lines);
  const entity = brickworkEntity("Company", { vatRegistered, soleTrader: false });
  const employees = brickworkEmployees(brickBook.employees);
  const members = brickBook.members.map((member) => ({
    name: member.name,
    shares: member.shares,
    acquired: dateOnly(member.acquiredDate),
  }));

  const sharesIssued = members.reduce((total, member) => total + member.shares, 0);
  if (sharesIssued !== openingBalance.share_capital) {
    throw new Error(
      `Register of members holds ${sharesIssued} shares at 1 each, against share capital of ${openingBalance.share_capital} on the opening balance sheet`,
    );
  }

  const expected = {
    total_sales: computeNetSales(salesLines),
    opening_balance: openingBalance,
    ...brickworkLedgers(vatRegistered),
    opening_stock: brickBook.stock.openingValue,
    closing_stock: brickBook.stock.closingValue,
    // Nothing in this book's VAT periods falls outside the accounting year,
    // so the return's boxes are the year's own journals and nothing else.
    vat_output_total: Math.round(salesLines.reduce((total, line) => total + VAT_ON(line.amount, line.taxRate || 0), 0)),
    vat_input_total: Math.round(purchaseLines.reduce((total, line) => total + VAT_ON(line.amount, line.taxRate || 0), 0)),
  };
  if (byCode.r) expected.total_premises_net = Math.round(byCode.r / vatDivisor);
  if (byCode.l) expected.total_legal_net = Math.round(byCode.l / vatDivisor);

  const toml = formatScenarioToml(
    {
      name: `BrickWork Pro Ltd ${vatRegistered ? "VAT" : "non-VAT"}`,
      description:
        "Construction company, CIS sub-contractors, a director and one labourer on the payroll. " +
        (vatRegistered
          ? `Turnover is over the VAT registration threshold, which is why the business is registered. Journal amounts include VAT at 20%. ${BRICKWORK_TWIN_NOTE}`
          : `Turnover is under the VAT registration threshold. Journal amounts carry no VAT. ${BRICKWORK_PLAIN_NOTE}`) +
        ` ${BRICKWORK_ALLOWANCE_NOTE}`,
      product: "ltd",
      tax_regime: "ltd",
      vat_registered: vatRegistered,
      business: businessBlock(entity, { company_number: entity["diya-gl:companyNumber"], vat_number: entity["diya-gl:vatNumber"] }),
      employees,
      members,
    },
    grouped,
    expected,
  );

  writeFixture(`ltd-brickwork-pro-${vatRegistered ? "vat" : "nonvat"}`, toml);
  return writeSubset(
    BRICKWORK_DIR,
    `ltd-${vatRegistered ? "vat" : "nonvat"}`,
    brickBook,
    {
      entity,
      taxSections: ["corporationTax", "capitalAllowances", "vat", "nationalInsurance", "mileage", "incomeTax"],
      accountFilter: fullAccountFilter,
      directors: brickBook.directors,
      employees,
      tables: {
        openingBalances: toV2OpeningBalances(openingBalance),
        stock: brickBook.stock,
        ...brickworkLedgerTables(vatRegistered),
        fixedAssets: brickBook.fixedAssets,
        members: brickBook.members,
      },
    },
    lines,
  );
}

const brickLtdNonVatDiya = writeBrickworkLtd(false);
const brickLtdVatDiya = writeBrickworkLtd(true);

// ============================================================================
// The Taxi Driver books — SP Sixty Driving, Kestrel Executive Cars and the
// basic owner-driver
// ============================================================================

const TAXI_TAX_SECTIONS = ["incomeTax", "nationalInsurance", "capitalAllowances", "mileage"];

// A taxi book is all takings and running costs, so the whole master reaches
// the fixture. The Sales sheet takes the day's gross takings against a
// pre-filled date, and a purchase coded to the capital column is registered
// on the Fixed Assets schedule as well, which is where it earns its
// allowance.
function writeTaxiScenario(master, { fixtureName, subsetName, name, description }) {
  const { dir, book, lines } = master;
  assertPurchaseCodesCoverChart(book, TAXI_PURCHASE_CODE_MAP, "TAXI_PURCHASE_CODE_MAP");

  const grouped = takingsOnlySales(
    buildGrouped(lines, TAXI_PURCHASE_CODE_MAP, { carriesCisDeductions: false, carriesSourceFields: true, carriesMileage: "all" }),
  );
  const additions = fixedAssetAdditions(lines, TAXI_PURCHASE_CODE_MAP, "f");
  const entity = book.entityInformation;

  const toml = formatScenarioToml(
    {
      name,
      description,
      product: "taxi",
      tax_regime: "se",
      vat_registered: entity["diya-gl:vatRegistered"],
      business: businessBlock(entity),
    },
    grouped,
    {
      ...taxiExpectedFigures(lines, book.documentInfo.periodCoveredStart),
      fixed_asset_additions: additions,
    },
  );

  writeFixture(fixtureName, toml);
  return writeSubset(
    dir,
    subsetName,
    book,
    { entity, taxSections: TAXI_TAX_SECTIONS, accountFilter: fullAccountFilter, tables: { fixedAssets: book.fixedAssets } },
    lines,
  );
}

const spSixty = readMaster("sp-sixty-driving");
const kestrel = readMaster("kestrel-executive-cars");
const basicTaxi = readMaster("basic-taxi-driver");
const autumnStart = readMaster("autumn-start-cabs");

const spSixtyTaxiDiya = writeTaxiScenario(spSixty, {
  fixtureName: "taxi-scenario-sp-sixty",
  subsetName: "taxi",
  name: "SP Sixty Driving",
  description: "Private hire driver with varying daily fares, fuel, insurance, repairs, admin, licence, accountant, dashcam, and signage",
});

const kestrelDiya = writeTaxiScenario(kestrel, {
  fixtureName: "taxi-scenario-kestrel",
  subsetName: "taxi",
  name: "Kestrel Executive Cars",
  description:
    "Executive chauffeur operator banking weekly settlements, with employed drivers, a leased yard and a profit into the additional rate band",
});

const basicTaxiDiya = writeTaxiScenario(basicTaxi, {
  fixtureName: "taxi-scenario-basic",
  subsetName: "taxi",
  name: "Basic taxi driver",
  description:
    "Owner-driver taxi with steady daily fares, fuel, road tax and insurance, and a vehicle purchase. Owns the vehicle, so no car hire or rental.",
});

const autumnStartDiya = writeTaxiScenario(autumnStart, {
  fixtureName: "taxi-scenario-autumn-start",
  subsetName: "taxi",
  name: "Autumn Start Cabs",
  description: "Owner-driver who started trading in October, so the year's takings and costs sit in the last six month tabs",
});

// ---------------------------------------------------------------------------
// SP Sixty Driving on the Basic Sole Trader package
// ---------------------------------------------------------------------------

// The Basic Sole Trader sales sheet keeps one row a line, which a year of
// daily fares does not fit, so the takings reach it as the monthly banking
// the driver actually pays in. The purchase columns are the sole trader's
// fourteen, not the taxi trade's, so the same accounts read under a chart of
// their own.
assertPurchaseCodesCoverChart(spSixty.book, TAXI_BST_PURCHASE_CODE_MAP, "TAXI_BST_PURCHASE_CODE_MAP");

const spSixtyBstGrouped = buildGrouped(spSixty.lines, TAXI_BST_PURCHASE_CODE_MAP, {
  carriesCisDeductions: false,
  carriesPaymentLabels: true,
  carriesSourceFields: true,
  carriesMileage: "claims",
});
const spSixtySalesLines = spSixty.lines.filter((line) => line.sourceJournalID === "sales");
spSixtyBstGrouped.sales = {};
for (const banking of monthlySalesTotals(spSixtySalesLines)) {
  const month = getMonthKey(banking.date);
  spSixtyBstGrouped.sales[month] = [
    { date: banking.date, customer: spSixtySalesLines[0].detailComment, payment: "Bank", amount: banking.amount },
  ];
}

const spSixtyBstEntity = { ...spSixty.book.entityInformation, "diya-gl:product": "BasicSoleTrader" };
const spSixtyBstAdditions = fixedAssetAdditions(spSixty.lines, TAXI_BST_PURCHASE_CODE_MAP, "f");

const spSixtyBstToml = formatScenarioToml(
  {
    name: "SP Sixty Driving BST",
    description: "Private hire driver adapted for BST package. Motoring as actual costs, bar the March month claimed on mileage.",
    product: "bst",
    tax_regime: "se",
    vat_registered: false,
    business: businessBlock(spSixtyBstEntity),
  },
  spSixtyBstGrouped,
  {
    ...bstExpectedFigures(spSixty.lines, spSixty.book.stock, TAXI_BST_PURCHASE_CODE_MAP),
    fixed_asset_additions: spSixtyBstAdditions,
  },
);

writeFixture("bst-sp-sixty", spSixtyBstToml);
const spSixtyBstDiya = writeSubset(
  spSixty.dir,
  "bst",
  spSixty.book,
  {
    entity: spSixtyBstEntity,
    taxSections: TAXI_TAX_SECTIONS,
    accountFilter: fullAccountFilter,
    tables: { fixedAssets: spSixty.book.fixedAssets },
  },
  spSixty.lines,
);

// ============================================================================
// Summary
// ============================================================================

const subsetLines = [
  ["precision-code-ltd/bst", bstDiya],
  ["precision-code-ltd/advanced", advDiya],
  ["precision-code-ltd/full", fullDiya],
  ["brickwork-pro/bst-nonvat", brickBstDiya],
  ["brickwork-pro/se-nonvat", brickSeNonVatDiya],
  ["brickwork-pro/se-vat", brickSeVatDiya],
  ["brickwork-pro/ltd-nonvat", brickLtdNonVatDiya],
  ["brickwork-pro/ltd-vat", brickLtdVatDiya],
  ["sp-sixty-driving/bst", spSixtyBstDiya],
  ["sp-sixty-driving/taxi", spSixtyTaxiDiya],
  ["kestrel-executive-cars/taxi", kestrelDiya],
  ["basic-taxi-driver/taxi", basicTaxiDiya],
  ["autumn-start-cabs/taxi", autumnStartDiya],
];

console.log(`Extracted ${extracted.length} fixtures and ${subsetLines.length} diya-gl subsets`);
console.log("");
for (const fixture of extracted) {
  const journals = [
    `${fixture.sales} sales`,
    `${fixture.purchases} purchases`,
    fixture.bank ? `${fixture.bank} bank` : null,
    fixture.payroll ? `${fixture.payroll} payroll` : null,
  ].filter(Boolean);
  console.log(`  ${fixture.name.padEnd(30)} ${journals.join(", ")}`);
}
console.log("");
for (const [subset, counts] of subsetLines) {
  console.log(`  ${subset.padEnd(30)} ${counts.dataLines} lines`);
}
