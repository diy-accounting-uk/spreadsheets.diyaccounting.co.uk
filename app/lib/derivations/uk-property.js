// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// uk-property.js — the two UK property answers HMRC's Property Business API
// takes from a sole trader's book. deriveUkPropertyPeriod answers one
// period's income and expenses; deriveUkPropertyAnnual answers the year's
// adjustments and allowances the book can show.
//
// A book names the HMRC field an account feeds with the account's
// diya-gl:ukPropertyField, in HMRC's own dotted names (income.periodAmount,
// expenses.repairsAndMaintenance, allowances.costOfReplacingDomesticItems).
// Lines posted through the sales and purchases journals to a named account
// are summed net of VAT. A field with no posting is omitted, never sent as a
// zero. Elections and facts about the landlord (the property income
// allowance, non-resident landlord, rent a room jointly let) are not in a
// ledger; they are listed under leftToPage.

import { productOf } from "../product-workbook.js";
import { signedAmount } from "../scenario-extractor.js";

export const UK_PROPERTY_ACCOUNT_FIELD = "diya-gl:ukPropertyField";

export const PERIOD_INCOME_FIELDS = ["periodAmount", "premiumsOfLeaseGrant", "reversePremiums", "otherIncome", "taxDeducted"].map(
  (name) => `income.${name}`,
);

export const PERIOD_EXPENSE_FIELDS = [
  "premisesRunningCosts",
  "repairsAndMaintenance",
  "financialCosts",
  "professionalFees",
  "costOfServices",
  "other",
  "residentialFinancialCost",
  "travelCosts",
  "consolidatedExpenses",
].map((name) => `expenses.${name}`);

export const ANNUAL_ADJUSTMENT_FIELDS = [
  "balancingCharge",
  "privateUseAdjustment",
  "businessPremisesRenovationAllowanceBalancingCharges",
].map((name) => `adjustments.${name}`);

export const ANNUAL_ALLOWANCE_FIELDS = [
  "annualInvestmentAllowance",
  "businessPremisesRenovationAllowance",
  "otherCapitalAllowance",
  "costOfReplacingDomesticItems",
  "zeroEmissionsCarAllowance",
].map((name) => `allowances.${name}`);

export const PERIOD_FIELDS = [...PERIOD_INCOME_FIELDS, ...PERIOD_EXPENSE_FIELDS];
export const ANNUAL_FIELDS = [...ANNUAL_ADJUSTMENT_FIELDS, ...ANNUAL_ALLOWANCE_FIELDS];
export const UK_PROPERTY_FIELDS = [...PERIOD_FIELDS, ...ANNUAL_FIELDS];

// What the annual submission asks that no posting can answer.
export const ANNUAL_LEFT_TO_PAGE = [
  {
    field: "allowances.propertyIncomeAllowance",
    reason: "an election between the property income allowance and itemised expenses, made by the landlord.",
  },
  { field: "adjustments.nonResidentLandlord", reason: "a fact about the landlord's residence, not a ledger figure." },
  { field: "adjustments.rentARoom.jointlyLet", reason: "a fact about how the room is let, not a ledger figure." },
];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const TAX_YEAR_LABEL = /^(\d{4})-(\d{2})$/;
const OPENING_BALANCE_PREFIX = "OB-";

function round2(value) {
  return Math.round(value * 100) / 100;
}

function setPath(target, path, value) {
  const parts = path.split(".");
  let node = target;
  for (const part of parts.slice(0, -1)) node = node[part] ??= {};
  node[parts.at(-1)] = value;
}

function requirePropertyBook(book, lines, caller) {
  if (!book || !lines) throw new Error(`${caller} requires a book and its lines`);
  const product = productOf(book);
  if (product === "ltd") {
    throw new Error(`The book is a "ltd" book; UK property income is an individual's, so ${caller} reads a sole trader book`);
  }
}

// Account id -> HMRC field, from the book's own chart.
function accountFields(book) {
  const fields = new Map();
  for (const journal of ["sales", "purchases"]) {
    for (const [id, account] of Object.entries(book.accounts?.[journal] || {})) {
      const field = account[UK_PROPERTY_ACCOUNT_FIELD];
      if (field === undefined) continue;
      if (!UK_PROPERTY_FIELDS.includes(field)) {
        throw new Error(`account ${id} names ${UK_PROPERTY_ACCOUNT_FIELD} "${field}", which is not a UK property field`);
      }
      fields.set(id, field);
    }
  }
  return fields;
}

function netAmount(line) {
  return signedAmount(line) / (1 + (line.taxRate || 0));
}

// The postings inside [start, end] on a mapped account, summed by field.
function figuresBetween(book, lines, fieldsWanted, start, end) {
  const fields = accountFields(book);
  const totals = new Map();
  const contributions = [];
  for (const line of lines) {
    if (line.sourceJournalID !== "sales" && line.sourceJournalID !== "purchases") continue;
    if (String(line.documentReference || "").startsWith(OPENING_BALANCE_PREFIX)) continue;
    const field = fields.get(String(line.accountMainID));
    if (!field || !fieldsWanted.includes(field)) continue;
    if (line.postingDate < start || line.postingDate > end) continue;
    const amount = round2(netAmount(line));
    totals.set(field, (totals.get(field) ?? 0) + amount);
    contributions.push({
      entryNumber: line.entryNumber,
      date: line.postingDate,
      account: String(line.accountMainID),
      field,
      reference: line.documentReference ?? null,
      counterparty: line.detailComment ?? null,
      amount,
    });
  }
  const figures = {};
  for (const field of fieldsWanted) {
    if (totals.has(field)) setPath(figures, field, round2(totals.get(field)));
  }
  return { figures, contributions, present: fieldsWanted.filter((field) => totals.has(field)) };
}

/**
 * One period of HMRC's UK property income and expenses from a sole trader
 * book whose chart names the property accounts. The answer is the period's
 * own figures; a cumulative year's running total is the same call with the
 * period starting on 6 April.
 * @param {Object} book - parsed book.toml
 * @param {Array} lines - parsed lines.jsonl entries
 * @param {{periodStartDate: string, periodEndDate: string}} params - the period, both ends inclusive, as YYYY-MM-DD
 * @returns {Object} { periodDates, income, expenses, fieldSlots, omitted, lines, warnings }
 */
export function deriveUkPropertyPeriod(book, lines, { periodStartDate, periodEndDate } = {}) {
  requirePropertyBook(book, lines, "deriveUkPropertyPeriod");
  if (!ISO_DAY.test(periodStartDate ?? "") || !ISO_DAY.test(periodEndDate ?? "")) {
    throw new Error("periodStartDate and periodEndDate must be YYYY-MM-DD days");
  }
  if (periodStartDate > periodEndDate) throw new Error(`the period starts ${periodStartDate}, after it ends ${periodEndDate}`);

  const { figures, contributions, present } = figuresBetween(book, lines, PERIOD_FIELDS, periodStartDate, periodEndDate);
  const warnings = [];
  const itemised = present.filter((field) => field.startsWith("expenses.") && field !== "expenses.consolidatedExpenses");
  if (present.includes("expenses.consolidatedExpenses") && itemised.length > 0) {
    throw new Error(`the period carries consolidated expenses and itemised expenses (${itemised.join(", ")}); HMRC takes one or the other`);
  }
  if (contributions.length === 0) warnings.push("no posting on a UK property account falls in the period");

  return {
    periodDates: { periodStartDate, periodEndDate },
    income: figures.income ?? {},
    expenses: figures.expenses ?? {},
    fieldSlots: PERIOD_FIELDS,
    omitted: PERIOD_FIELDS.filter((field) => !present.includes(field)),
    lines: contributions,
    warnings,
  };
}

function taxYearBounds(label) {
  const match = TAX_YEAR_LABEL.exec(label ?? "");
  if (!match) throw new Error(`taxYear must look like 2025-26, not "${label}"`);
  const start = Number(match[1]);
  if (String(start + 1).slice(-2) !== match[2]) throw new Error(`taxYear "${label}" does not name two consecutive years`);
  return { start: `${start}-04-06`, end: `${start + 1}-04-05` };
}

// The tax year (6 April to 5 April) a day falls in.
function taxYearLabelOf(isoDay) {
  const [year, month, day] = isoDay.split("-").map(Number);
  const start = month > 4 || (month === 4 && day >= 6) ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

/**
 * The year's adjustments and allowances for HMRC's UK property annual
 * submission, from a sole trader book whose chart names the accounts. The
 * year defaults to the one the book's period end falls in.
 * @param {Object} book - parsed book.toml
 * @param {Array} lines - parsed lines.jsonl entries
 * @param {{taxYear?: string}} [params] - taxYear as 2025-26
 * @returns {Object} { taxYear, adjustments, allowances, fieldSlots, omitted, leftToPage, lines, warnings }
 */
export function deriveUkPropertyAnnual(book, lines, { taxYear } = {}) {
  requirePropertyBook(book, lines, "deriveUkPropertyAnnual");
  const label =
    taxYear ?? (book.documentInfo?.periodCoveredEnd ? taxYearLabelOf(String(book.documentInfo.periodCoveredEnd).slice(0, 10)) : undefined);
  if (!label) throw new Error("the book declares no period end, so taxYear is required");
  const { start, end } = taxYearBounds(label);

  const { figures, contributions, present } = figuresBetween(book, lines, ANNUAL_FIELDS, start, end);
  return {
    taxYear: label,
    adjustments: figures.adjustments ?? {},
    allowances: figures.allowances ?? {},
    fieldSlots: ANNUAL_FIELDS,
    omitted: ANNUAL_FIELDS.filter((field) => !present.includes(field)),
    leftToPage: ANNUAL_LEFT_TO_PAGE,
    lines: contributions,
    warnings: contributions.length === 0 ? ["no posting on a UK property account falls in the tax year"] : [],
  };
}
