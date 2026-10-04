// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// book-queries.js — read-only questions over a diya-gl book: which lines
// match a filter and what they add up to, the chart of accounts with the
// report rows each account feeds, the book's own profile, and the book
// checks with the entryNumbers behind each verdict. Pure functions over
// (book, lines) and the documents the engine already builds, so the MCP
// server and any other caller read the same answers.

import { isStraddlingLine } from "./scenario-extractor.js";

function isoDate(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

// A TOML date parses to a Date; JSON would print it with a midnight time the
// book never stated, so a date-only value goes out as YYYY-MM-DD.
function plainValue(value) {
  if (value instanceof Date) {
    const iso = value.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
  }
  if (Array.isArray(value)) return value.map(plainValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, plainValue(inner)]));
  }
  return value;
}

function asSet(filter) {
  if (filter === undefined || filter === null || filter === "") return null;
  return new Set((Array.isArray(filter) ? filter : [filter]).map(String));
}

/**
 * A line's amount in pence with the sign a total wants: a credit note
 * reverses its sale or purchase, and a credit on the bank or the journal
 * (debitCreditCode "C", money out of a bank account) is negative.
 *
 * A credit note on the bad debts account (4005) or the fixed asset sale
 * account (4006) is negative here too. Both templates book a written-off
 * debt as a negative sale: the Basic Sole Trader sales tabs have one gross
 * column feeding turnover, and the Limited Company sales tabs' "Bad Debts
 * written off" column T reaches the P&L negated (TrialBalance row 81 =
 * -Sales!T1, MnthP&L B34), so only a negative entry raises the expense. A
 * customer's total therefore falls by the debt written off against them.
 * @param {Object} line
 * @returns {number}
 */
export function signedPence(line) {
  const reverses = (line.sourceJournalID === "sales" || line.sourceJournalID === "purchases") && line.documentType === "credit-note";
  const pence = Math.round((Number(line.amount) || 0) * 100);
  return reverses || line.debitCreditCode === "C" ? -pence : pence;
}

const GROUP_KEYS = {
  detailComment: (line) => line.detailComment ?? "",
  accountMainID: (line) => String(line.accountMainID ?? ""),
  month: (line) => isoDate(line.postingDate).slice(0, 7),
};

/** The fields `lines` can group by. */
export const LINE_GROUPINGS = Object.keys(GROUP_KEYS);

function accountNames(book) {
  const names = {};
  for (const accounts of Object.values(book?.accounts || {})) {
    for (const [id, account] of Object.entries(accounts || {})) names[id] = account?.accountMainDescription;
  }
  return names;
}

const byLargest = (a, b) => Math.abs(b.totalPence) - Math.abs(a.totalPence) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/**
 * The lines matching every filter given, their count and signed total in
 * pence, and either the lines themselves or their groups.
 *
 * Grouped by detailComment or accountMainID, groups come largest total
 * first; by month, in date order. Ungrouped with `top`, lines come largest
 * amount first; ungrouped without it, in book order.
 * @param {Object} book
 * @param {Array} lines
 * @param {Object} [filters]
 * @param {string|string[]} [filters.journal] - sourceJournalID
 * @param {string|string[]} [filters.accountMainID]
 * @param {string} [filters.from] - YYYY-MM-DD, inclusive
 * @param {string} [filters.to] - YYYY-MM-DD, inclusive
 * @param {string} [filters.text] - case-insensitive, in detailComment or lineItemComment
 * @param {string} [filters.documentReference] - case-insensitive, in documentReference
 * @param {string} [filters.groupBy] - one of LINE_GROUPINGS
 * @param {number} [filters.top] - at most this many groups (or lines)
 * @returns {Object}
 */
export function queryLines(book, lines, filters = {}) {
  const { journal, accountMainID, from, to, text, documentReference, groupBy, top } = filters;
  if (groupBy !== undefined && !GROUP_KEYS[groupBy]) {
    throw new Error(`groupBy must be one of ${LINE_GROUPINGS.join(", ")}, got "${groupBy}"`);
  }
  if (top !== undefined && (!Number.isInteger(top) || top < 1)) throw new Error(`top must be a whole number above zero, got "${top}"`);
  const journals = asSet(journal);
  const accounts = asSet(accountMainID);
  const needle = text ? String(text).toLowerCase() : null;
  const reference = documentReference ? String(documentReference).toLowerCase() : null;

  const matched = lines.filter((line) => {
    if (journals && !journals.has(String(line.sourceJournalID))) return false;
    if (accounts && !accounts.has(String(line.accountMainID))) return false;
    const date = isoDate(line.postingDate);
    if (from && date < from) return false;
    if (to && date > to) return false;
    if (needle && !`${line.detailComment ?? ""}\n${line.lineItemComment ?? ""}`.toLowerCase().includes(needle)) return false;
    if (
      reference &&
      !String(line.documentReference ?? "")
        .toLowerCase()
        .includes(reference)
    )
      return false;
    return true;
  });

  const answer = { count: matched.length, totalPence: matched.reduce((sum, line) => sum + signedPence(line), 0) };

  if (!groupBy) {
    const ordered = top
      ? matched
          .slice()
          .sort((a, b) => Math.abs(signedPence(b)) - Math.abs(signedPence(a)))
          .slice(0, top)
      : matched;
    return { ...answer, lines: ordered };
  }

  const keyOf = GROUP_KEYS[groupBy];
  const groups = new Map();
  for (const line of matched) {
    const key = keyOf(line);
    if (!groups.has(key)) groups.set(key, { key, count: 0, totalPence: 0, entryNumbers: [] });
    const group = groups.get(key);
    group.count += 1;
    group.totalPence += signedPence(line);
    group.entryNumbers.push(line.entryNumber);
  }
  const names = groupBy === "accountMainID" ? accountNames(book) : {};
  let ordered = [...groups.values()].map((group) => (names[group.key] ? { ...group, name: names[group.key] } : group));
  ordered.sort(groupBy === "month" ? (a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0) : byLargest);
  if (top) ordered = ordered.slice(0, top);
  return { ...answer, groupBy, groups: ordered };
}

// A reconciliation table, not a line of the accounts: its rows restate
// journal totals the account rows already carry.
const NOT_A_REPORT_ROW = "section/journal-category-vat-netting/";

// The rows with the least else in them, among those a test admits.
function smallestRows(rows, admits) {
  let best = [];
  let bestSize = Infinity;
  for (const row of rows) {
    if (!admits(row)) continue;
    const size = row.entries.size;
    if (size < bestSize) {
      best = [row];
      bestSize = size;
    } else if (size === bestSize) {
      best.push(row);
    }
  }
  return best;
}

// The report rows an account feeds: of the rows built from whole accounts
// (every year line of each account they touch, so a month's or a debtor's
// slice of an account does not count), the smallest that holds every year
// line of this one. An account the engine splits across rows (a bank
// account whose opening line sits apart from its movements) feeds instead
// the smallest of the rows holding the most of its lines. Read off the
// engine's own attribution rather than restated here. A VAT-straddling line
// belongs to a return outside the year and reaches no row of the year's
// accounts.
function rowsFed(account, rows, entriesOfAccount, accountOfEntry) {
  const own = entriesOfAccount.get(account);
  if (!own || own.size === 0) return [];
  const holdsAll = (row) => [...own].every((entry) => row.entries.has(entry));
  const wholeAccounts = (row) =>
    [...row.entries].every((entry) => {
      const other = entriesOfAccount.get(accountOfEntry.get(entry));
      return !other || [...other].every((otherEntry) => row.entries.has(otherEntry));
    });
  let best = smallestRows(rows, (row) => holdsAll(row) && wholeAccounts(row));
  if (best.length === 0) {
    const held = (row) => [...own].filter((entry) => row.entries.has(entry)).length;
    const most = Math.max(0, ...rows.map(held));
    if (most > 0) best = smallestRows(rows, (row) => held(row) === most);
  }
  return best.map((row) => ({ key: row.key, label: row.label }));
}

/**
 * The book's chart of accounts: each account's id, name, group (the
 * book.toml table it sits in), its other declared fields, how many lines
 * post to it and their signed total in pence, and the report rows it feeds.
 * @param {Object} book
 * @param {Array} lines
 * @param {Object} attributedReport - R built with entryNumbers on every figure
 * @returns {Array<Object>}
 */
export function chartOfAccounts(book, lines, attributedReport) {
  const rows = attributedReport.values
    .filter((entry) => entry.key.startsWith("section/") && !entry.key.startsWith(NOT_A_REPORT_ROW) && entry.entryNumbers?.length > 0)
    .map((entry) => ({ key: entry.key, label: entry.label, entries: new Set(entry.entryNumbers) }));
  const accountOfEntry = new Map();
  const entriesOfAccount = new Map();
  for (const line of lines) {
    if (isStraddlingLine(line)) continue;
    const account = String(line.accountMainID);
    accountOfEntry.set(line.entryNumber, account);
    if (!entriesOfAccount.has(account)) entriesOfAccount.set(account, new Set());
    entriesOfAccount.get(account).add(line.entryNumber);
  }
  const chart = [];
  for (const [group, accounts] of Object.entries(book?.accounts || {})) {
    for (const [id, account] of Object.entries(accounts || {})) {
      const { accountMainDescription, ...declared } = account || {};
      const posted = lines.filter((line) => String(line.accountMainID) === id);
      chart.push({
        id,
        name: accountMainDescription ?? null,
        group,
        ...plainValue(declared),
        lineCount: posted.length,
        totalPence: posted.reduce((sum, line) => sum + signedPence(line), 0),
        feeds: rowsFed(id, rows, entriesOfAccount, accountOfEntry),
      });
    }
  }
  return chart;
}

/**
 * The book's own profile: product, period, the business, its tax settings,
 * its bank accounts, the journals its lines are posted on, and every other
 * table book.toml carries (registers, opening balances, stock).
 * @param {Object} book
 * @param {Array} lines
 * @param {string} product - bst, taxi, se or ltd
 * @returns {Object}
 */
export function bookProfile(book, lines, product) {
  const { documentInfo, entityInformation, tax, accounts, ...registers } = book || {};
  const journals = new Map();
  for (const line of lines) {
    const id = line.sourceJournalID;
    const date = isoDate(line.postingDate);
    if (!journals.has(id)) journals.set(id, { journal: id, count: 0, firstDate: date, lastDate: date });
    const entry = journals.get(id);
    entry.count += 1;
    if (date < entry.firstDate) entry.firstDate = date;
    if (date > entry.lastDate) entry.lastDate = date;
  }
  return {
    product,
    period: { start: isoDate(documentInfo?.periodCoveredStart), end: isoDate(documentInfo?.periodCoveredEnd) },
    documentInfo: plainValue(documentInfo ?? {}),
    entity: plainValue(entityInformation ?? {}),
    tax: plainValue(tax ?? {}),
    bankAccounts: Object.entries(accounts?.bank || {}).map(([id, account]) => ({
      id,
      name: account?.accountMainDescription ?? null,
      ...plainValue(Object.fromEntries(Object.entries(account || {}).filter(([key]) => key !== "accountMainDescription"))),
    })),
    journals: [...journals.values()].sort((a, b) => (a.journal < b.journal ? -1 : 1)),
    ...plainValue(registers),
  };
}

/**
 * The book checks and warnings with each one's verdict and the entryNumbers
 * of the lines that fail it.
 * @param {{results: Array, summary: Object}} bookChecks - runBookChecks() output
 * @returns {{summary: Object, checks: Array<Object>}}
 */
export function checksWithEntries(bookChecks) {
  return {
    summary: bookChecks.summary,
    checks: bookChecks.results.map(({ result, offenders, ...rest }) => ({
      ...rest,
      verdict: result,
      entryNumbers: (offenders || []).map((offender) => offender.entryNumber).filter((entry) => entry !== undefined),
      offenders: offenders || [],
    })),
  };
}
