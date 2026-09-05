// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// book-checks.js — the book checks and warnings, run over a book's own
// declared data: is every entry dated inside the accounting period, does
// every entry reach an account the book's own chart declares, is every
// amount a whole number of pence, plus five warnings that flag a book
// worth a second look. A check can pass or fail; a warning can only pass
// or warn -- neither kind ever blocks a save.
//
// Pure functions only, no Node built-ins and no DOM, so the browser page,
// the CLI and the MCP server run exactly the same rules over (book, lines,
// taxData). Fix-it helpers live beside the checks they belong to, built over
// the named edits in diya-gl-edits.js, so a caller applies a whole plan as
// one step without reimplementing an edit. A book naming a product with
// rules of its own runs those after the shared ones -- see book-checks/.

import { changeLinePostingDate, changeLineAccount, changeLineAmount, addSaleLine, addPurchaseLine, addBankLine } from "./diya-gl-edits.js";
import { LTD_PRODUCT_RULES } from "./book-checks/ltd.js";
import { TAXI_PRODUCT_RULES } from "./book-checks/taxi.js";
import { SE_PRODUCT_RULES } from "./book-checks/se.js";

// ============================== shared helpers ==============================

function isoDate(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function periodOf(book) {
  const info = (book && book.documentInfo) || {};
  return { start: isoDate(info.periodCoveredStart), end: isoDate(info.periodCoveredEnd) };
}

// Half up away from zero at the penny, guarded against binary-float noise.
function round2(value) {
  const scaled = value * 100;
  const guarded = scaled + (scaled >= 0 ? 1 : -1) * Math.max(Math.abs(scaled), 1) * 1e-9;
  const sign = guarded < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(guarded))) / 100;
}

function isWholePence(amount) {
  return typeof amount === "number" && isFinite(amount) && Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-6;
}

function formatMoney(value) {
  const sign = value < 0 ? "-" : "";
  return sign + "£" + Math.abs(value).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// The book's own chart of accounts, one list per journal -- book.toml's
// [accounts.sales.*] and [accounts.purchases.*] tables, the accounts the
// book itself declares rather than any one product's fixed money-column
// map. A book on a different chart (the Taxi Driver masters read onto the
// Basic Sole Trader package's columns, for one) still gets a true reading:
// its entries reach the accounts it actually declares.
function chartOf(book) {
  const accounts = (book && book.accounts) || {};
  function listOf(side) {
    const section = accounts[side] || {};
    return Object.keys(section)
      .sort()
      .map((code) => ({ code, description: section[code].accountMainDescription || "Account " + code }));
  }
  return { sales: listOf("sales"), purchases: listOf("purchases") };
}

function declaredCodes(chart, journal) {
  const side = journal === "sales" ? chart.sales : journal === "purchases" ? chart.purchases : [];
  const codes = new Set();
  for (const account of side) codes.add(account.code);
  return codes;
}

function reachesAnAccount(chart, line) {
  return declaredCodes(chart, line.sourceJournalID).has(String(line.accountMainID));
}

// The account an offending line is reposted to: the book's own chart for
// that journal, preferring the code each product's sheet files
// miscellaneous spend under, falling back to whichever account the chart
// declares first. A book whose chart declares nothing on that side, or
// whose product has no entry here, gets no preferred code and falls back.
const REPOST_PREFERRED = {
  BasicSoleTrader: { sales: "4000", purchases: "5002" },
  TaxiDriver: { sales: "4000", purchases: "6200" },
};

function repostAccount(ctx, journal) {
  const product = (ctx.book && ctx.book.entityInformation && ctx.book.entityInformation["diya-gl:product"]) || "";
  const preferred = (REPOST_PREFERRED[product] || {})[journal];
  const list = (journal === "sales" ? ctx.chart.sales : ctx.chart.purchases) || [];
  return list.find((account) => account.code === preferred) || list[0] || null;
}

function clampIntoPeriod(date, period) {
  if (date < period.start) return period.start;
  if (date > period.end) return period.end;
  return date;
}

function monthKeyOf(dateStr) {
  return dateStr.slice(0, 7);
}

function nextMonthKey(key) {
  const parts = key.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  return month === 12 ? year + 1 + "-01" : year + "-" + String(month + 1).padStart(2, "0");
}

function offenderOf(line) {
  return {
    entryNumber: line.entryNumber,
    postingDate: line.postingDate,
    accountMainID: line.accountMainID,
    detail: line.detailComment || "",
    amount: line.amount,
  };
}

function byEntryNumber(a, b) {
  const ka = a.entryNumber || "";
  const kb = b.entryNumber || "";
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

// ============================== the three checks ==============================
// Each spec answers: which lines offend, why it matters, and (where a
// mechanical fix exists) how to build and apply the fix-it plan. `ctx` is
// { book, lines, period, chart }.

const CHECK_SPECS = [
  {
    id: "book-dates-in-period",
    label: "Every entry is dated inside the accounting period",
    offenders: function (ctx) {
      return ctx.lines.filter(function (line) {
        return line.postingDate < ctx.period.start || line.postingDate > ctx.period.end;
      });
    },
    consequence: function (ctx) {
      return (
        "An entry dated outside " +
        ctx.period.start +
        " to " +
        ctx.period.end +
        " still lands on the month tab of the same calendar month, so it is counted in a year it does not belong to."
      );
    },
    buildHelper: function (ctx, offenders) {
      return {
        title: "Move these entries into the period",
        actionLabel: "Move " + offenders.length + (offenders.length === 1 ? " entry" : " entries") + " into the period",
        changes: offenders.map(function (line) {
          return {
            entryNumber: line.entryNumber,
            was: line.postingDate,
            becomes: clampIntoPeriod(line.postingDate, ctx.period),
            amount: line.amount,
            what: "date",
          };
        }),
      };
    },
    apply: function (ctx, offenders) {
      return offenders.reduce(function (currentLines, line) {
        return changeLinePostingDate(ctx.book, currentLines, {
          entryNumber: line.entryNumber,
          newPostingDate: clampIntoPeriod(line.postingDate, ctx.period),
        });
      }, ctx.lines);
    },
  },
  {
    id: "book-accounts-in-chart",
    label: "Every entry reaches an account in the book's chart",
    offenders: function (ctx) {
      return ctx.lines.filter(function (line) {
        return !reachesAnAccount(ctx.chart, line);
      });
    },
    consequence: function () {
      return "An entry posted to an account outside the chart is filtered out before any sheet totals it, so its amount reaches no column at all.";
    },
    buildHelper: function (ctx, offenders) {
      const changes = [];
      for (const line of offenders) {
        const account = repostAccount(ctx, line.sourceJournalID);
        if (!account) return null;
        changes.push({
          entryNumber: line.entryNumber,
          was: line.accountMainID,
          becomes: account.code + " — " + account.description,
          amount: line.amount,
          what: "account",
        });
      }
      return {
        title: "Repost these entries to the chart",
        actionLabel: "Repost " + offenders.length + (offenders.length === 1 ? " entry" : " entries"),
        changes: changes,
      };
    },
    apply: function (ctx, offenders) {
      return offenders.reduce(function (currentLines, line) {
        const account = repostAccount(ctx, line.sourceJournalID);
        if (!account) throw new Error("No account in the book's chart to repost this entry to.");
        return changeLineAccount(ctx.book, currentLines, { entryNumber: line.entryNumber, newAccountMainID: account.code });
      }, ctx.lines);
    },
  },
  {
    id: "book-amounts-whole-pence",
    label: "Every amount is a whole number of pence",
    offenders: function (ctx) {
      return ctx.lines.filter(function (line) {
        return !isWholePence(line.amount);
      });
    },
    consequence: function () {
      return "An amount finer than a penny is carried in full through the totals but shown rounded, so the sheet's own figures stop adding up to what is printed.";
    },
    buildHelper: function (ctx, offenders) {
      return {
        title: "Round these amounts to the penny",
        actionLabel: "Round " + offenders.length + (offenders.length === 1 ? " amount" : " amounts"),
        changes: offenders.map(function (line) {
          return {
            entryNumber: line.entryNumber,
            was: String(line.amount),
            becomes: round2(line.amount).toFixed(2),
            amount: line.amount,
            what: "amount",
          };
        }),
      };
    },
    apply: function (ctx, offenders) {
      return offenders.reduce(function (currentLines, line) {
        return changeLineAmount(ctx.book, currentLines, { entryNumber: line.entryNumber, newAmount: round2(line.amount) });
      }, ctx.lines);
    },
  },
];

// ============================== the per-product rules ==============================
// A product's own checks and warnings, and the shared checks whose
// offenders that product reads differently, keyed by the product name the
// book states in entityInformation["diya-gl:product"]. A book naming a
// product with no entry here runs the shared rules alone.

const PRODUCT_RULES = { Company: LTD_PRODUCT_RULES, TaxiDriver: TAXI_PRODUCT_RULES, SelfEmployed: SE_PRODUCT_RULES };
const SHARED_RULES_ONLY = { checks: [], warnings: [], sharedOffenders: {} };

function productRulesFor(book) {
  const entity = (book && book.entityInformation) || {};
  return PRODUCT_RULES[entity["diya-gl:product"]] || SHARED_RULES_ONLY;
}

function specsFor(ctx) {
  return CHECK_SPECS.concat(ctx.productRules.checks);
}

function offendersFor(spec, ctx) {
  const narrow = ctx.productRules.sharedOffenders[spec.id];
  const offenders = spec.offenders(ctx);
  return (narrow ? narrow(ctx, offenders) : offenders).slice().sort(byEntryNumber);
}

function checkSpecById(ctx, checkId) {
  return specsFor(ctx).find(function (spec) {
    return spec.id === checkId;
  });
}

function contextOf(book, lines) {
  return { book: book, lines: lines, period: periodOf(book), chart: chartOf(book), productRules: productRulesFor(book) };
}

function runChecks(ctx) {
  return specsFor(ctx).map(function (spec) {
    const offenders = offendersFor(spec, ctx);
    const pass = offenders.length === 0;
    const result = {
      id: spec.id,
      tier: "check",
      label: spec.label,
      result: pass ? "pass" : "fail",
      actual: offenders.length,
      consequence: pass ? null : spec.consequence(ctx),
      offenders: offenders.map(offenderOf),
    };
    if (!pass) {
      // A check whose fix changes the book rather than its lines names its
      // helper in the product's bookHelpers registry, and is applied
      // through applyBookHelper rather than applyHelper.
      const bookHelper = (ctx.productRules.bookHelpers || {})[spec.id];
      if (bookHelper) {
        const plan = bookHelper.buildHelper(ctx, bookHelper.offenders(ctx));
        if (plan) result.helper = { id: spec.id, label: plan.title, kind: "book" };
      } else if (spec.buildHelper) {
        const plan = spec.buildHelper(ctx, offenders);
        if (plan) result.helper = { id: spec.id, label: plan.title };
      }
    }
    return result;
  });
}

// ============================== the five warnings ==============================
// Advisory only: a warning can pass or warn, never fail, and never blocks
// a save. Each rule looks at the same ctx the checks use, plus taxData for
// the year's VAT registration threshold.

function salesTotal(lines) {
  let total = 0;
  for (const line of lines) if (line.sourceJournalID === "sales") total += line.amount;
  return total;
}

function vatWarning(ctx, taxData) {
  const vat = (taxData && taxData.vat) || {};
  const threshold = typeof vat.registration_threshold === "number" ? vat.registration_threshold : null;
  const turnover = salesTotal(ctx.lines);
  const warn = threshold !== null && turnover >= threshold;
  const label =
    threshold === null
      ? "Turnover for the year is " + formatMoney(turnover) + "; no VAT registration threshold is available for this year."
      : "Turnover for the year is " + formatMoney(turnover) + ", against a " + formatMoney(threshold) + " VAT registration threshold.";
  return {
    id: "book-vat-threshold",
    tier: "warning",
    label: label,
    result: warn ? "warn" : "pass",
    actual: turnover,
    consequence: warn
      ? "Once a business's turnover passes the VAT registration threshold, it must register for VAT with HMRC within 30 days."
      : null,
    offenders: [],
  };
}

function duplicateKey(line) {
  return [line.sourceJournalID, line.postingDate, line.amount, line.detailComment || ""].join("|");
}

// Two lines that share a journal, date, amount and detail are each other's
// own two legs, not a duplicate, when one debits and the other credits a
// different account: a balanced double-entry pair nets to nil, which no
// accidental re-entry of the same one-sided posting ever does. Sales and
// purchases lines carry no debitCreditCode at all, so this never exempts a
// pair of those -- only bank and journal lines can ever match it.
function isBalancedPair(group) {
  if (group.length !== 2) return false;
  const [first, second] = group;
  if (first.accountMainID === second.accountMainID) return false;
  const codes = [first.debitCreditCode, second.debitCreditCode].sort();
  return codes[0] === "C" && codes[1] === "D";
}

function duplicateEntriesWarning(ctx) {
  const groups = new Map();
  for (const line of ctx.lines) {
    const key = duplicateKey(line);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(line);
  }
  let offenders = [];
  for (const group of groups.values()) if (group.length > 1 && !isBalancedPair(group)) offenders = offenders.concat(group);
  offenders = offenders.sort(byEntryNumber);
  const warn = offenders.length > 0;
  return {
    id: "book-duplicate-entries",
    tier: "warning",
    label: "No two entries share the same journal, date, amount and detail",
    result: warn ? "warn" : "pass",
    actual: offenders.length,
    consequence: warn ? "A duplicate entry counts the same transaction twice in every total until one copy is removed or corrected." : null,
    offenders: offenders.map(offenderOf),
  };
}

function emptyDetailWarning(ctx) {
  const offenders = ctx.lines
    .filter(function (line) {
      return !line.detailComment || !String(line.detailComment).trim();
    })
    .sort(byEntryNumber);
  const warn = offenders.length > 0;
  return {
    id: "book-empty-detail",
    tier: "warning",
    label: "Every entry names who or what it was with",
    result: warn ? "warn" : "pass",
    actual: offenders.length,
    consequence: warn ? "A blank detail leaves no way to tell what the amount was for when the books are reviewed later." : null,
    offenders: offenders.map(offenderOf),
  };
}

function negativeAmountWarning(ctx) {
  const offenders = ctx.lines
    .filter(function (line) {
      return (line.sourceJournalID === "sales" || line.sourceJournalID === "purchases") && line.amount < 0;
    })
    .sort(byEntryNumber);
  const warn = offenders.length > 0;
  return {
    id: "book-negative-amount",
    tier: "warning",
    label: "Every sale and purchase amount is zero or more",
    result: warn ? "warn" : "pass",
    actual: offenders.length,
    consequence: warn ? "A negative amount on a sale or purchase usually belongs as a positive entry on the other journal instead." : null,
    offenders: offenders.map(offenderOf),
  };
}

function emptyMonthWarning(ctx) {
  const dated = ctx.lines.map(function (line) {
    return line.postingDate;
  });
  if (dated.length === 0) {
    return {
      id: "book-empty-month",
      tier: "warning",
      label: "Every month between the first and last entry has at least one entry",
      result: "pass",
      actual: 0,
      consequence: null,
      offenders: [],
    };
  }
  const sortedDates = dated.slice().sort();
  const firstMonth = monthKeyOf(sortedDates[0]);
  const lastMonth = monthKeyOf(sortedDates[sortedDates.length - 1]);
  const present = new Set(dated.map(monthKeyOf));
  const emptyMonths = [];
  let key = nextMonthKey(firstMonth);
  while (key < lastMonth) {
    if (!present.has(key)) emptyMonths.push(key);
    key = nextMonthKey(key);
  }
  const warn = emptyMonths.length > 0;
  return {
    id: "book-empty-month",
    tier: "warning",
    label: "Every month between the first and last entry has at least one entry",
    result: warn ? "warn" : "pass",
    actual: emptyMonths.length,
    consequence: warn ? "No entries are dated in " + emptyMonths.join(", ") + ", leaving a gap between the months around it." : null,
    offenders: emptyMonths.map(function (month) {
      return { month: month };
    }),
  };
}

function runWarnings(ctx, taxData, results) {
  const shared = [
    vatWarning(ctx, taxData),
    duplicateEntriesWarning(ctx),
    emptyDetailWarning(ctx),
    negativeAmountWarning(ctx),
    emptyMonthWarning(ctx),
  ].map(function (warning) {
    // A product whose sheets measure a shared warning differently replaces
    // the whole result, keeping its id; every other product keeps this one.
    const readDifferently = (ctx.productRules.sharedWarnings || {})[warning.id];
    return readDifferently ? readDifferently(ctx, taxData, warning) : warning;
  });
  return shared.concat(
    ctx.productRules.warnings.map(function (warning) {
      return warning(ctx, taxData, results);
    }),
  );
}

// ============================== public API ==============================

/**
 * Every book check and warning, run over one book. Deterministic: the same
 * (book, lines, taxData) always produces the same results in the same
 * order, whatever order the lines array carries its entries in.
 * @param {{book: Object, lines: Array, taxData: Object, results: Object}} args - results is the calculated accounts, which a product warning may read
 * @returns {{results: Array, summary: {pass: number, warn: number, fail: number}}}
 */
export function runBookChecks({ book, lines, taxData, results }) {
  const ctx = contextOf(book, lines);
  const checkResults = runChecks(ctx).concat(runWarnings(ctx, taxData, results));
  const summary = { pass: 0, warn: 0, fail: 0 };
  for (const result of checkResults) summary[result.result]++;
  return { results: checkResults, summary: summary };
}

/**
 * The canonical bytes of bookchecks.json: results sorted by id, 2-space
 * indent, newline-terminated, stable across runs and across whatever order
 * the offenders behind them arrived in.
 * @param {Array} results - the `results` array runBookChecks returns
 * @returns {string}
 */
export function bookChecksJson(results) {
  const sorted = results.slice().sort(function (a, b) {
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return JSON.stringify(sorted, null, 2) + "\n";
}

/**
 * The preview a helper shows before it is applied: exactly which lines
 * change, and how. Returns null when the check passes or has no fix-it.
 * @param {{book: Object, lines: Array}} args
 * @param {string} checkId - the id of a check the book runs
 * @returns {?{title: string, summary: string, changes: Array}}
 */
export function previewHelper({ book, lines }, checkId) {
  const ctx = contextOf(book, lines);
  const spec = checkSpecById(ctx, checkId);
  if (!spec || !spec.buildHelper) return null;
  const offenders = offendersFor(spec, ctx);
  if (offenders.length === 0) return null;
  const plan = spec.buildHelper(ctx, offenders);
  if (!plan) return null;
  return {
    title: plan.title,
    summary:
      "This will change " + plan.changes.length + (plan.changes.length === 1 ? " line" : " lines") + ". Nothing else in the book moves.",
    changes: plan.changes,
  };
}

/**
 * Apply a helper's whole plan through the named edits in diya-gl-edits.js,
 * as one step.
 * @param {{book: Object, lines: Array}} args
 * @param {string} checkId - the id of a check the book runs
 * @returns {Array} a new lines array with the plan applied
 */
export function applyHelper({ book, lines }, checkId) {
  const ctx = contextOf(book, lines);
  const spec = checkSpecById(ctx, checkId);
  if (!spec || !spec.apply) throw new Error('No helper called "' + checkId + '"');
  const offenders = offendersFor(spec, ctx);
  if (offenders.length === 0) throw new Error("Nothing left for this helper to fix.");
  return spec.apply(ctx, offenders);
}

/**
 * The preview for a helper that changes the book rather than the lines --
 * a product's own registry, keyed by check id, of { offenders, buildHelper,
 * apply } specs over the same ctx the checks use. Returns null when the
 * check passes or names no such helper.
 * @param {{book: Object, lines: Array}} args
 * @param {string} checkId - the id of a warning the book runs
 * @returns {?{title: string, summary: string, changes: Array}}
 */
export function previewBookHelper({ book, lines }, checkId) {
  const ctx = contextOf(book, lines);
  const spec = (ctx.productRules.bookHelpers || {})[checkId];
  if (!spec) return null;
  const offenders = spec.offenders(ctx);
  if (offenders.length === 0) return null;
  const plan = spec.buildHelper(ctx, offenders);
  if (!plan) return null;
  return {
    title: plan.title,
    summary:
      "This will add " + plan.changes.length + (plan.changes.length === 1 ? " entry" : " entries") + " to the book. Nothing else moves.",
    changes: plan.changes,
  };
}

/**
 * Apply a book-changing helper's whole plan as one step, the same way
 * applyHelper does for a lines-changing one.
 * @param {{book: Object, lines: Array}} args
 * @param {string} checkId - the id of a warning the book runs
 * @returns {Object} a new book with the plan applied; the input book is unchanged
 */
export function applyBookHelper({ book, lines }, checkId) {
  const ctx = contextOf(book, lines);
  const spec = (ctx.productRules.bookHelpers || {})[checkId];
  if (!spec || !spec.apply) throw new Error('No helper called "' + checkId + '"');
  const offenders = spec.offenders(ctx);
  if (offenders.length === 0) throw new Error("Nothing left for this helper to fix.");
  return spec.apply(ctx, offenders);
}

// ============================== the settlement helpers ==============================
// A bank entry and the invoice behind it are two halves of one transaction,
// and a book carrying one half without the other is a book with a hole in
// it. These four suggestions name each hole and fill it through a named
// edit: a receipt from a debtor with no sale behind it becomes a sale, a
// payment to a creditor with no purchase becomes a purchase, and a sale or
// purchase that never reached the bank gets the entry that banks it.
//
// Nothing here reads a product's sheets. DR and CR are the codes every
// package's bank book analyses money in from a debtor and money out to a
// creditor under, and every account comes from the book's own chart, so the
// same four suggestions run over a sole trader's book and a company's.

const RECEIPT_BANK_CODE = "DR";
const PAYMENT_BANK_CODE = "CR";
const CURRENT_ACCOUNT = "1200";
const SETTLEMENT_ENTRY_PREFIX = "SET-";

function counterpartyOf(line) {
  return String(line.detailComment || "")
    .trim()
    .toLowerCase();
}

// Two halves match when they name the same counterparty and come to the
// same amount to the penny.
function settlementKey(line) {
  return counterpartyOf(line) + "|" + round2(line.amount).toFixed(2);
}

// The left-hand lines with no right-hand line left to pair off against.
// Two receipts of the same amount from the same customer need two sales to
// settle them, not one, so this draws down a count rather than asking
// whether a match exists at all.
function unpaired(left, right) {
  const spare = new Map();
  for (const line of right) {
    const key = settlementKey(line);
    spare.set(key, (spare.get(key) || 0) + 1);
  }
  const rest = [];
  for (const line of left) {
    const key = settlementKey(line);
    const available = spare.get(key) || 0;
    if (available > 0) {
      spare.set(key, available - 1);
      continue;
    }
    rest.push(line);
  }
  return rest;
}

function bankEntries(lines, bankCode, side) {
  return lines.filter(function (line) {
    return line.sourceJournalID === "bank" && line["diya-gl:bankCode"] === bankCode && line.debitCreditCode === side;
  });
}

function journalEntries(lines, journal) {
  return lines.filter(function (line) {
    return line.sourceJournalID === journal;
  });
}

// The bank account a settlement's new entry is banked through: the current
// account where the book's chart declares one, otherwise the first bank
// account it does declare. A book that declares none -- a Basic Sole Trader
// book, which keeps no bank journal at all -- has nowhere to bank, so the
// two suggestions that add a bank entry are not offered on it.
function settlementBankAccount(ctx) {
  const declared = (ctx.book && ctx.book.accounts && ctx.book.accounts.bank) || {};
  const codes = Object.keys(declared).sort();
  const code = codes.indexOf(CURRENT_ACCOUNT) === -1 ? codes[0] : CURRENT_ACCOUNT;
  if (!code) return null;
  return { code: code, description: declared[code].accountMainDescription || "Account " + code };
}

// A settlement's new sale or purchase is coded the way that journal is
// already coded in this book, so a registered book's new line carries that
// book's VAT rate and an unregistered book's carries none.
function taxTreatmentOf(lines, journal) {
  const existing = lines.find(function (line) {
    return line.sourceJournalID === journal;
  });
  return { taxCode: existing ? existing.taxCode : "OS", taxRate: existing ? existing.taxRate : 0 };
}

// One past the highest settlement number the book already carries, so
// applying two suggestions in a row does not hand out the same number
// twice.
function nextSettlementEntryNumber(lines) {
  let highest = 0;
  for (const line of lines) {
    const numbered = String(line.entryNumber || "").match(/^SET-(\d+)$/);
    if (numbered) highest = Math.max(highest, Number(numbered[1]));
  }
  return SETTLEMENT_ENTRY_PREFIX + String(highest + 1).padStart(4, "0");
}

function tradeLine(ctx, journal, source, account, entryNumber) {
  const treatment = taxTreatmentOf(ctx.lines, journal);
  return {
    entryNumber: entryNumber,
    sourceJournalID: journal,
    postingDate: source.postingDate,
    accountMainID: account.code,
    amount: source.amount,
    documentType: "invoice",
    documentReference: entryNumber,
    detailComment: source.detailComment || "",
    lineItemComment: journal === "sales" ? "Sale behind the banked receipt" : "Purchase behind the bank payment",
    taxCode: treatment.taxCode,
    taxRate: treatment.taxRate,
  };
}

function bankLineFor(journal, source, account, entryNumber) {
  const receipt = journal === "sales";
  return {
    "entryNumber": entryNumber,
    "sourceJournalID": "bank",
    "postingDate": source.postingDate,
    "accountMainID": account.code,
    "amount": source.amount,
    "debitCreditCode": receipt ? "D" : "C",
    "documentType": "bank-statement",
    "documentReference": entryNumber,
    "detailComment": source.detailComment || "",
    "lineItemComment": receipt ? "Receipt banking the sale" : "Payment settling the purchase",
    "taxCode": "OS",
    "taxRate": 0,
    "diya-gl:bankCode": receipt ? RECEIPT_BANK_CODE : PAYMENT_BANK_CODE,
    "diya-gl:bankAccountID": account.code,
  };
}

const SETTLEMENT_KINDS = [
  {
    kind: "sale-from-receipt",
    title: "Make a sale from this receipt",
    actionLabel: "Add the sale",
    what: "sale",
    sources: function (ctx) {
      return unpaired(bankEntries(ctx.lines, RECEIPT_BANK_CODE, "D"), journalEntries(ctx.lines, "sales"));
    },
    account: function (ctx) {
      return ctx.chart.sales[0] || null;
    },
    build: function (ctx, source, account, entryNumber) {
      return tradeLine(ctx, "sales", source, account, entryNumber);
    },
    edit: addSaleLine,
  },
  {
    kind: "purchase-from-payment",
    title: "Make a purchase from this payment",
    actionLabel: "Add the purchase",
    what: "purchase",
    sources: function (ctx) {
      return unpaired(bankEntries(ctx.lines, PAYMENT_BANK_CODE, "C"), journalEntries(ctx.lines, "purchases"));
    },
    account: function (ctx) {
      return repostAccount(ctx, "purchases");
    },
    build: function (ctx, source, account, entryNumber) {
      return tradeLine(ctx, "purchases", source, account, entryNumber);
    },
    edit: addPurchaseLine,
  },
  {
    kind: "receipt-for-sale",
    title: "Record the receipt for this sale",
    actionLabel: "Add the receipt",
    what: "receipt",
    sources: function (ctx) {
      return unpaired(journalEntries(ctx.lines, "sales"), bankEntries(ctx.lines, RECEIPT_BANK_CODE, "D"));
    },
    account: settlementBankAccount,
    build: function (ctx, source, account, entryNumber) {
      return bankLineFor("sales", source, account, entryNumber);
    },
    edit: addBankLine,
  },
  {
    kind: "payment-for-purchase",
    title: "Record the payment for this purchase",
    actionLabel: "Add the payment",
    what: "payment",
    sources: function (ctx) {
      return unpaired(journalEntries(ctx.lines, "purchases"), bankEntries(ctx.lines, PAYMENT_BANK_CODE, "C"));
    },
    account: settlementBankAccount,
    build: function (ctx, source, account, entryNumber) {
      return bankLineFor("purchases", source, account, entryNumber);
    },
    edit: addBankLine,
  },
];

function settlementIdOf(kind, source) {
  return kind + ":" + source.entryNumber;
}

function suggestionOf(spec, ctx, source, account) {
  return {
    id: settlementIdOf(spec.kind, source),
    kind: spec.kind,
    entryNumber: source.entryNumber,
    title: spec.title,
    actionLabel: spec.actionLabel,
    changes: [
      {
        what: spec.what,
        becomes: account.code + " — " + account.description,
        amount: source.amount,
        postingDate: source.postingDate,
        counterparty: source.detailComment || "",
      },
    ],
  };
}

// Every unsettled half, paired with the account its other half would post
// to. A suggestion names the line it is built from, so a line the book left
// unnumbered is not one this can offer: there would be no way to ask for it
// back by id.
function settlementsOf(ctx) {
  const found = [];
  for (const spec of SETTLEMENT_KINDS) {
    const account = spec.account(ctx);
    if (!account) continue;
    for (const source of spec.sources(ctx)) {
      if (!source.entryNumber) continue;
      found.push({ spec: spec, source: source, account: account });
    }
  }
  return found;
}

/**
 * The settlements a book is missing: for every bank receipt or payment with
 * no invoice behind it, and every invoice that never reached the bank, one
 * suggestion naming what applying it would add.
 * @param {{book: Object, lines: Array}} args
 * @returns {Array<{id: string, kind: string, entryNumber: string, title: string, actionLabel: string, changes: Array}>}
 */
export function settlementSuggestions({ book, lines }) {
  const ctx = contextOf(book, lines);
  return settlementsOf(ctx).map(function (settlement) {
    return suggestionOf(settlement.spec, ctx, settlement.source, settlement.account);
  });
}

/**
 * Apply one settlement suggestion, by the id settlementSuggestions gave it,
 * through the named edit that adds its missing half.
 * @param {{book: Object, lines: Array}} args
 * @param {string} id - a suggestion's own id, "<kind>:<entryNumber>"
 * @returns {Array} a new lines array with the missing half added
 */
export function applySettlement({ book, lines }, id) {
  const ctx = contextOf(book, lines);
  const settlement = settlementsOf(ctx).find(function (candidate) {
    return settlementIdOf(candidate.spec.kind, candidate.source) === id;
  });
  if (!settlement) throw new Error('No settlement called "' + id + '"');
  const entryNumber = nextSettlementEntryNumber(lines);
  const line = settlement.spec.build(ctx, settlement.source, settlement.account, entryNumber);
  return settlement.spec.edit(book, lines, { line: line });
}
