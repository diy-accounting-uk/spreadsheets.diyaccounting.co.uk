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
// taxData). The three checks' fix-it helpers live here too, built over the
// named edits in diya-gl-edits.js, so a caller applies a whole plan as one
// step without reimplementing an edit.

import { changeLinePostingDate, changeLineAccount, changeLineAmount } from "./diya-gl-edits.js";

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
// that journal, preferring the code the sheet files miscellaneous spend
// under, falling back to whichever account the chart declares first. A
// book whose chart declares nothing on that side gets no fix-it.
function repostAccount(chart, journal) {
  const side = journal === "sales" ? chart.sales : chart.purchases;
  const preferred = journal === "sales" ? "4000" : "5002";
  const list = side || [];
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
        const account = repostAccount(ctx.chart, line.sourceJournalID);
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
        const account = repostAccount(ctx.chart, line.sourceJournalID);
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

function checkSpecById(checkId) {
  return CHECK_SPECS.find(function (spec) {
    return spec.id === checkId;
  });
}

function contextOf(book, lines) {
  return { book: book, lines: lines, period: periodOf(book), chart: chartOf(book) };
}

function runChecks(ctx) {
  return CHECK_SPECS.map(function (spec) {
    const offenders = spec.offenders(ctx).slice().sort(byEntryNumber);
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
      const plan = spec.buildHelper(ctx, offenders);
      if (plan) result.helper = { id: spec.id, label: plan.title };
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

function duplicateEntriesWarning(ctx) {
  const groups = new Map();
  for (const line of ctx.lines) {
    const key = duplicateKey(line);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(line);
  }
  let offenders = [];
  for (const group of groups.values()) if (group.length > 1) offenders = offenders.concat(group);
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

function runWarnings(ctx, taxData) {
  return [
    vatWarning(ctx, taxData),
    duplicateEntriesWarning(ctx),
    emptyDetailWarning(ctx),
    negativeAmountWarning(ctx),
    emptyMonthWarning(ctx),
  ];
}

// ============================== public API ==============================

/**
 * Every book check and warning, run over one book. Deterministic: the same
 * (book, lines, taxData) always produces the same results in the same
 * order, whatever order the lines array carries its entries in.
 * @param {{book: Object, lines: Array, taxData: Object}} args
 * @returns {{results: Array, summary: {pass: number, warn: number, fail: number}}}
 */
export function runBookChecks({ book, lines, taxData }) {
  const ctx = contextOf(book, lines);
  const results = runChecks(ctx).concat(runWarnings(ctx, taxData));
  const summary = { pass: 0, warn: 0, fail: 0 };
  for (const result of results) summary[result.result]++;
  return { results: results, summary: summary };
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
 * @param {string} checkId - one of the three check ids
 * @returns {?{title: string, summary: string, changes: Array}}
 */
export function previewHelper({ book, lines }, checkId) {
  const spec = checkSpecById(checkId);
  if (!spec) return null;
  const ctx = contextOf(book, lines);
  const offenders = spec.offenders(ctx).slice().sort(byEntryNumber);
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
 * @param {string} checkId - one of the three check ids
 * @returns {Array} a new lines array with the plan applied
 */
export function applyHelper({ book, lines }, checkId) {
  const spec = checkSpecById(checkId);
  if (!spec) throw new Error('No helper called "' + checkId + '"');
  const ctx = contextOf(book, lines);
  const offenders = spec.offenders(ctx).slice().sort(byEntryNumber);
  if (offenders.length === 0) throw new Error("Nothing left for this helper to fix.");
  return spec.apply(ctx, offenders);
}
