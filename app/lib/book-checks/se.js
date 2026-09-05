// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// book-checks/se.js -- the Self Employed book's own checks and warnings,
// the things a customer can get wrong on a nine-workbook package: a bank
// line on an account with no workbook of its own, a code the workbook
// analyses no column for, a bank line that is neither a receipt nor a
// payment, a month either book closes overdrawn, a payslip naming nobody
// on the payroll, an employee paid in patches, and more asset rows than
// the Fixed Assets Schedule has room for. It also reads two shared rules
// the Self Employed way: turnover measured net of VAT on a book that says
// it is registered, and entries dated outside the year that name the VAT
// period they belong to.
//
// Pure functions only, no Node built-ins and no DOM, so the page, the CLI
// and the MCP server run the same rules. book-checks.js picks this module
// up from the book's own entityInformation["diya-gl:product"].

import { changeLineBankAccount } from "../diya-gl-edits.js";
import { SE_PURCHASE_CODE_MAP, LTD_SALES_CODE_MAP } from "../scenario-extractor.js";

// The workbook each bank account is kept in. A Self Employed package
// carries two of them where a Company package carries four, so an account
// outside this pair reaches no workbook at all (app/products/se.js
// BANK_ACCOUNT_FILES).
const BANK_ACCOUNT_FILES = { 1200: "Bank.xlsx", 1220: "Cash.xlsx" };
const CURRENT_ACCOUNT = "1200";
const CASH_ACCOUNT = "1220";

// The code letters each workbook's month tabs carry an analysis column
// for, receipts and payments apart -- the lists BANK_LAYOUTS lays the
// columns out from in app/products/se.js. Cash.xlsx has no X column at
// all, and its own transfer letter is BB where Bank.xlsx's is BC.
// cellWrites() refuses to write a code outside these lists, which is the
// failure this check catches before the writer runs.
const ANALYSED_CODES = {
  "Bank.xlsx": {
    receipts: ["BC", "DR", "CR", "K", "RV", "DL", "X"],
    payments: ["BC", "CR", "DR", "W", "B", "J", "RP", "DL", "X"],
  },
  "Cash.xlsx": {
    receipts: ["BB", "DR", "CR", "DL"],
    payments: ["BB", "CR", "DR", "W", "J", "RP", "DL"],
  },
};

// A Company book splits its HMRC payments four ways; both Self Employed
// workbooks carry a single HMRC Payments column, so a payment coded for
// VAT, CIS or corporation tax lands under RP (app/products/se.js
// paymentCodeFor).
const SE_HMRC_PAYMENT_CODE = "RP";
const COMPANY_TAX_PAYMENT_CODES = ["RV", "RC", "RT"];

function paymentCodeFor(code) {
  return COMPANY_TAX_PAYMENT_CODES.includes(code) ? SE_HMRC_PAYMENT_CODE : code;
}

// An opening balance goes into its month tab's A1 rather than onto a
// statement row, whichever of the two workbooks holds it, so it is neither
// analysed nor a receipt.
const OPENING_BALANCE_CODE = "BC";

// The Fixed Assets Schedule's rows for assets already owned, keyed by the
// category the loader's own class-to-category map turns a book's declared
// class into. The Self Employed Schedule carries a motor block and a
// computer block and nothing else, so an asset of any other class has no
// row on it (app/products/se.js EXISTING_ASSET_ROWS). Assets bought in the
// year land on the New Plant & Machinery block whatever they are.
const SCHEDULE_EXISTING_ASSET_ROWS = { motor: [38, 39, 40, 41, 42], computer: [30, 31, 32, 33, 34] };
const SCHEDULE_NEW_ASSET_ROWS = [67, 68, 69, 70, 71];
const HP_AGREEMENT_ROWS = [8, 10];

const ASSET_CLASS_TO_CATEGORY = {
  landBuildings: "land",
  plantMachinery: "plant",
  fixturesFittings: "fixtures",
  computerTechnology: "computer",
  motorVehicles: "motor",
};

// The Employee sheet's own blocks: five employees, and the Payslips month
// tabs keep one monthly row each.
const PAYSLIP_EMPLOYEE_BLOCKS = 5;

const ASSET_PURCHASE_CODE = "fa";
const ASSET_SALE_CODE = "fs";

function formatMoney(value) {
  const sign = value < 0 ? "-" : "";
  return sign + "£" + Math.abs(value).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// A record the book declares that no block of its sheet has a row left
// for, in the offender shape runChecks reports lines in.
function noRowOffender(entryNumber, postingDate, detail, amount) {
  return { entryNumber: entryNumber, postingDate: postingDate, accountMainID: "", detailComment: detail, amount: amount };
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

// A period's own field carries its date as a Date when the book was parsed
// from TOML and as a "YYYY-MM-DD" string when it came from JSON; both read
// as the same ISO string.
function isoDate(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function monthNumber(key) {
  const parts = key.split("-").map(Number);
  return parts[0] * 12 + (parts[1] - 1);
}

// Every month the period covers, first to last. A period naming no month
// this way -- an unparseable date on either end -- covers none, rather than
// counting months forever looking for an end it will never reach.
function periodMonths(period) {
  const first = monthKeyOf(isoDate(period.start));
  const span = monthNumber(monthKeyOf(isoDate(period.end))) - monthNumber(first);
  if (!Number.isFinite(span) || span < 0) return [];
  const months = [];
  let key = first;
  for (let index = 0; index <= span; index++) {
    months.push(key);
    key = nextMonthKey(key);
  }
  return months;
}

function isBankLine(line) {
  return line.sourceJournalID === "bank";
}

function bankFileOf(line) {
  return BANK_ACCOUNT_FILES[line["diya-gl:bankAccountID"]];
}

function hasSide(line) {
  return line.debitCreditCode === "D" || line.debitCreditCode === "C";
}

function nameOf(value) {
  return String(value || "").trim();
}

function declaredEmployees(book) {
  return (book && book.employees) || [];
}

function payrollLines(lines) {
  return lines.filter(function (line) {
    return line.sourceJournalID === "payroll";
  });
}

// ============================== bank balances ==============================

/**
 * One bank account's running balance, month by month across the book's own
 * accounting period, from the book's lines alone. An opening balance entry
 * sets the opening of the month it is dated in, replacing the balance the
 * month before would otherwise carry forward; every other entry moves the
 * balance by its own side. This is what Bank.xlsx and Cash.xlsx hold in
 * each month tab's A1 and A2.
 * @param {Array} lines - the book's lines.jsonl entries
 * @param {string} accountID - the bank account to follow, "1200" or "1220"
 * @param {{start: string, end: string}} period - the book's accounting period
 * @returns {Array<{month: string, opening: number, receipts: number, payments: number, closing: number}>}
 */
export function bankBalancesByMonth(lines, accountID, period) {
  const months = periodMonths(period);
  const movements = new Map();
  for (const month of months) movements.set(month, { receipts: 0, payments: 0, openingWritten: null });

  for (const line of lines) {
    if (!isBankLine(line)) continue;
    if (String(line["diya-gl:bankAccountID"]) !== String(accountID)) continue;
    const movement = movements.get(monthKeyOf(line.postingDate));
    if (!movement) continue;
    if (line["diya-gl:bankCode"] === OPENING_BALANCE_CODE) {
      movement.openingWritten = (movement.openingWritten || 0) + line.amount;
      continue;
    }
    if (line.debitCreditCode === "D") movement.receipts += line.amount;
    else if (line.debitCreditCode === "C") movement.payments += line.amount;
  }

  let carried = 0;
  return months.map(function (month) {
    const movement = movements.get(month);
    const opening = movement.openingWritten === null ? carried : movement.openingWritten;
    const closing = opening + movement.receipts - movement.payments;
    carried = closing;
    return { month: month, opening: opening, receipts: movement.receipts, payments: movement.payments, closing: closing };
  });
}

// ============================== the checks ==============================
// The CHECK_SPECS shape book-checks.js runs: which lines offend, why it
// matters, and where a mechanical fix exists, how to build and apply it.
// ctx is { book, lines, period, chart }.

function bankLinesOffTheTwoWorkbooks(ctx) {
  return ctx.lines.filter(function (line) {
    return isBankLine(line) && !bankFileOf(line);
  });
}

// The current account as the book's own chart declares it. A book that
// declares no current account has nowhere to move an entry to, so the
// helper is not offered at all.
function currentAccount(book) {
  const declared = ((book && book.accounts && book.accounts.bank) || {})[CURRENT_ACCOUNT];
  if (!declared) return null;
  return { code: CURRENT_ACCOUNT, description: declared.accountMainDescription || "Account " + CURRENT_ACCOUNT };
}

function unanalysedBankLines(ctx) {
  return ctx.lines.filter(function (line) {
    if (!isBankLine(line)) return false;
    if (line["diya-gl:bankCode"] === OPENING_BALANCE_CODE) return false;
    const fileName = bankFileOf(line);
    if (!fileName) return false;
    if (!hasSide(line)) return false;
    const isReceipt = line.debitCreditCode === "D";
    const analysed = isReceipt ? ANALYSED_CODES[fileName].receipts : ANALYSED_CODES[fileName].payments;
    const code = isReceipt ? line["diya-gl:bankCode"] : paymentCodeFor(line["diya-gl:bankCode"]);
    return !analysed.includes(code);
  });
}

function assetPurchaseLines(lines) {
  return lines.filter(function (line) {
    return line.sourceJournalID === "purchases" && SE_PURCHASE_CODE_MAP[line.accountMainID] === ASSET_PURCHASE_CODE;
  });
}

// A Self Employed book's sales accounts are read through the same map the
// loader's own filterAdvanced() reads them through, which the Company
// masters named first; the two products share one sales chart.
function assetSaleLines(lines) {
  return lines.filter(function (line) {
    return line.sourceJournalID === "sales" && LTD_SALES_CODE_MAP[line.accountMainID] === ASSET_SALE_CODE;
  });
}

// The Schedule rows the assets brought forward take up, class block by
// class block, and the assets that find no row in their own block.
function existingAssetRows(assets) {
  const seatedByCategory = {};
  const unseated = [];
  for (const asset of assets) {
    const category = ASSET_CLASS_TO_CATEGORY[asset.class];
    const rows = SCHEDULE_EXISTING_ASSET_ROWS[category] || [];
    const taken = seatedByCategory[category] || 0;
    if (taken >= rows.length) {
      unseated.push(asset);
      continue;
    }
    seatedByCategory[category] = taken + 1;
  }
  let seated = 0;
  for (const category of Object.keys(seatedByCategory)) seated += seatedByCategory[category];
  return { seated: seated, unseated: unseated };
}

export const SE_CHECK_SPECS = [
  {
    id: "book-bank-account-has-workbook",
    label: "Every bank entry is on an account the package keeps a workbook for",
    offenders: bankLinesOffTheTwoWorkbooks,
    consequence: function () {
      return (
        "A Self Employed package carries two bank workbooks, " +
        Object.values(BANK_ACCOUNT_FILES).join(" and ") +
        ", for accounts " +
        Object.keys(BANK_ACCOUNT_FILES).join(" and ") +
        ". An entry on any other account reaches neither of them, so its amount leaves the bank book and the year's closing balance altogether."
      );
    },
    buildHelper: function (ctx, offenders) {
      const account = currentAccount(ctx.book);
      if (!account) return null;
      return {
        title: "Move these entries to the current account",
        actionLabel: "Move " + offenders.length + (offenders.length === 1 ? " entry" : " entries") + " to the current account",
        changes: offenders.map(function (line) {
          return {
            entryNumber: line.entryNumber,
            was: line["diya-gl:bankAccountID"],
            becomes: account.code + " — " + account.description,
            amount: line.amount,
            what: "account",
          };
        }),
      };
    },
    apply: function (ctx, offenders) {
      return offenders.reduce(function (currentLines, line) {
        return changeLineBankAccount(ctx.book, currentLines, {
          entryNumber: line.entryNumber,
          newBankAccountID: CURRENT_ACCOUNT,
        });
      }, ctx.lines);
    },
  },
  {
    id: "book-bank-code-analysed",
    label: "Every bank entry is coded to a column its workbook analyses",
    offenders: unanalysedBankLines,
    consequence: function (ctx) {
      const files = [];
      for (const line of unanalysedBankLines(ctx)) {
        const fileName = bankFileOf(line);
        if (!files.includes(fileName)) files.push(fileName);
      }
      const lists = files.map(function (fileName) {
        return (
          fileName +
          " analyses receipts under " +
          ANALYSED_CODES[fileName].receipts.join(", ") +
          " and payments under " +
          ANALYSED_CODES[fileName].payments.join(", ") +
          "."
        );
      });
      return (
        lists.join(" ") +
        " An entry coded outside its own workbook's list has no column to land in, and the package cannot be written at all."
      );
    },
    buildHelper: null,
    apply: null,
  },
  {
    id: "book-bank-line-has-side",
    label: "Every bank entry is a receipt or a payment",
    offenders: function (ctx) {
      return ctx.lines.filter(function (line) {
        return isBankLine(line) && !hasSide(line);
      });
    },
    consequence: function () {
      return "A code letter alone cannot say which way the money went -- CR is a refund received on one side of a month tab and a creditor paid on the other. An entry that names neither side reaches neither block, so its amount leaves the bank book and the closing balance with it.";
    },
    buildHelper: null,
    apply: null,
  },
  {
    id: "book-payslip-names-employee",
    label: "Every payslip names someone the book employs",
    offenders: function (ctx) {
      const employees = declaredEmployees(ctx.book);
      const names = new Set(
        employees.map(function (employee) {
          return nameOf(employee.name);
        }),
      );
      const offenders = payrollLines(ctx.lines).filter(function (line) {
        return !names.has(nameOf(line.detailComment));
      });
      for (const employee of employees.slice(PAYSLIP_EMPLOYEE_BLOCKS)) {
        offenders.push(noRowOffender(employee.employeeID, "", nameOf(employee.name), employee.grossPay));
      }
      return offenders;
    },
    consequence: function () {
      return (
        "The Payslips month tabs key their rows by the employee's name and the Employee sheet has " +
        PAYSLIP_EMPLOYEE_BLOCKS +
        " blocks to name them in. A payslip naming nobody the book employs reaches no row, so its pay, tax and National Insurance leave the payroll, and an employee past the last block has no block to be named in at all."
      );
    },
    buildHelper: null,
    apply: null,
  },
  {
    id: "book-fixed-asset-rows-fit",
    label: "Every asset, disposal and hire purchase agreement has a row on the Fixed Assets Schedule",
    offenders: function (ctx) {
      const assets = (ctx.book && ctx.book.fixedAssets) || [];
      const agreements = (ctx.book && ctx.book.hpAgreements) || [];
      const purchases = assetPurchaseLines(ctx.lines);
      const offenders = purchases.slice(SCHEDULE_NEW_ASSET_ROWS.length);

      const rows = existingAssetRows(assets);
      for (const asset of rows.unseated) {
        offenders.push(noRowOffender(asset.assetID, "", asset.description || String(asset.class), asset.cost));
      }

      // A disposal is written onto the row of the asset it disposed of, so
      // only the assets brought forward that found a row can carry one.
      for (const line of assetSaleLines(ctx.lines).slice(rows.seated)) offenders.push(line);

      for (const agreement of agreements.slice(HP_AGREEMENT_ROWS.length)) {
        offenders.push(noRowOffender(agreement.agreementID, agreement.startDate, agreement.financeCompany || "", agreement.amountFinanced));
      }
      return offenders;
    },
    consequence: function () {
      return (
        "The Schedule has " +
        SCHEDULE_NEW_ASSET_ROWS.length +
        " rows for assets bought in the year, a motor block and a computer block of " +
        SCHEDULE_EXISTING_ASSET_ROWS.motor.length +
        " rows each for the assets brought forward, one disposal per asset row, and " +
        HP_AGREEMENT_ROWS.length +
        " hire purchase rows. Anything past the end of a block has nowhere to go, and the package cannot be written at all."
      );
    },
    buildHelper: null,
    apply: null,
  },
];

// ============================== the warnings ==============================
// Advisory only: a warning passes or warns, never fails, and never blocks
// a save. Each takes (ctx, taxData, results) and returns its own result.

function overdrawnMonths(ctx, accountID) {
  return bankBalancesByMonth(ctx.lines, accountID, ctx.period).filter(function (month) {
    return month.closing < 0;
  });
}

function overdrawnOffender(month) {
  return { month: month.month, closing: month.closing };
}

function cashOverdrawnWarning(ctx) {
  const offenders = overdrawnMonths(ctx, CASH_ACCOUNT);
  const warn = offenders.length > 0;
  return {
    id: "book-cash-never-overdrawn",
    tier: "warning",
    label: "The cash book closes every month at zero or more",
    result: warn ? "warn" : "pass",
    actual: offenders.length,
    consequence: warn
      ? "Cash in hand cannot go below nothing. " +
        offenders[0].month +
        " closes at " +
        formatMoney(offenders[0].closing) +
        ", so either a cash receipt is missing or a payment was entered on the cash book that came out of the bank."
      : null,
    offenders: offenders.map(overdrawnOffender),
  };
}

function bankOverdrawnWarning(ctx) {
  const offenders = overdrawnMonths(ctx, CURRENT_ACCOUNT);
  const warn = offenders.length > 0;
  return {
    id: "book-bank-overdrawn",
    tier: "warning",
    label: "The bank book closes every month at zero or more",
    result: warn ? "warn" : "pass",
    actual: offenders.length,
    consequence: warn
      ? "The current account closes " +
        offenders[0].month +
        " at " +
        formatMoney(offenders[0].closing) +
        ". An overdrawn month is real enough on a bank account, but it is also what a missing receipt or a payment entered twice looks like."
      : null,
    offenders: offenders.map(overdrawnOffender),
  };
}

// The months an employee was paid in, keyed the way the Payslips sheet
// keys its rows: by the name the payslip carries.
function payMonthsByEmployee(ctx) {
  const months = new Map();
  for (const line of payrollLines(ctx.lines)) {
    const name = nameOf(line.detailComment);
    if (!months.has(name)) months.set(name, new Set());
    months.get(name).add(monthKeyOf(line.postingDate));
  }
  return months;
}

function employeePaidEveryMonthWarning(ctx) {
  const paid = payMonthsByEmployee(ctx);
  const offenders = [];
  for (const employee of declaredEmployees(ctx.book)) {
    const name = nameOf(employee.name);
    const months = Array.from(paid.get(name) || []).sort();
    if (months.length === 0) continue;
    let key = nextMonthKey(months[0]);
    const last = months[months.length - 1];
    while (key < last) {
      if (!months.includes(key)) offenders.push({ employeeID: employee.employeeID, name: name, month: key });
      key = nextMonthKey(key);
    }
  }
  const warn = offenders.length > 0;
  return {
    id: "book-employee-paid-every-month",
    tier: "warning",
    label: "Every employee is paid in each month between their first payslip and their last",
    result: warn ? "warn" : "pass",
    actual: offenders.length,
    consequence: warn
      ? offenders[0].name +
        " has no payslip in " +
        offenders
          .map(function (offender) {
            return offender.month;
          })
          .join(", ") +
        ", between their first payslip and their last. A missing month leaves that month's pay, tax and National Insurance out of the payroll and off the wages the accounts carry."
      : null,
    offenders: offenders,
  };
}

export const SE_WARNINGS = [cashOverdrawnWarning, bankOverdrawnWarning, employeePaidEveryMonthWarning];

// ============================== the shared rules Self Employed reads differently ==============================

function isVatRegistered(book) {
  return ((book && book.entityInformation) || {})["diya-gl:vatRegistered"] === true;
}

function netOfVatTurnover(lines, rate) {
  let total = 0;
  for (const line of lines) if (line.sourceJournalID === "sales") total += line.amount / (1 + rate);
  return total;
}

// A registered book charges VAT on top of its prices, so the gross the
// sales journal carries is not the turnover the threshold is measured
// against -- the Sales.xlsx analysis columns read the net I column. And a
// book that says it is registered has already done the thing the shared
// warning asks for, so it passes and says so.
function vatThresholdWarning(ctx, taxData, sharedResult) {
  if (!isVatRegistered(ctx.book)) return sharedResult;
  const vat = (taxData && taxData.vat) || {};
  const threshold = typeof vat.registration_threshold === "number" ? vat.registration_threshold : null;
  const rate = typeof vat.standard_rate === "number" ? vat.standard_rate : 0;
  const turnover = netOfVatTurnover(ctx.lines, rate);
  const label =
    threshold === null
      ? "Turnover for the year is " + formatMoney(turnover) + " net of VAT; the book says the business is registered."
      : "Turnover for the year is " +
        formatMoney(turnover) +
        " net of VAT, against a " +
        formatMoney(threshold) +
        " VAT registration threshold; the book says the business is registered.";
  return {
    id: "book-vat-threshold",
    tier: "warning",
    label: label,
    result: "pass",
    actual: turnover,
    consequence: null,
    offenders: [],
  };
}

export const SE_SHARED_WARNINGS = { "book-vat-threshold": vatThresholdWarning };

export const SE_SHARED_OFFENDERS = {
  // Bank and payroll lines post to the bank and wage accounts the chart
  // lists under its other sections, not to the sales and purchases tables
  // the check reads.
  "book-accounts-in-chart": function (ctx, offenders) {
    return offenders.filter(function (line) {
      return line.sourceJournalID === "sales" || line.sourceJournalID === "purchases";
    });
  },
  // A line carrying a VAT period end is dated outside the year on purpose:
  // it belongs to a VAT quarter that straddles the year end, which Vat.xlsx
  // keeps its own sales and purchases sheets for.
  "book-dates-in-period": function (ctx, offenders) {
    return offenders.filter(function (line) {
      return !line["diya-gl:vatPeriodEnd"];
    });
  },
};

// ============================== the book helper ==============================
// Adding the employee a payslip names changes the book, not the lines.

function unnamedPayslips(ctx) {
  const names = new Set(
    declaredEmployees(ctx.book).map(function (employee) {
      return nameOf(employee.name);
    }),
  );
  const seen = new Set();
  return payrollLines(ctx.lines).filter(function (line) {
    const name = nameOf(line.detailComment);
    if (!name || names.has(name) || seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

// The next employee id: one past the highest number the book already
// carries, so a book whose ids start at EMP002 does not hand out EMP002
// again.
function nextEmployeeNumber(employees) {
  let highest = 0;
  for (const employee of employees) {
    const digits = String(employee.employeeID || "").match(/(\d+)\s*$/);
    if (digits) highest = Math.max(highest, Number(digits[1]));
  }
  return highest + 1;
}

function addEmployeePlan(ctx, offenders) {
  return {
    title: "Add these people to the payroll",
    actionLabel: "Add " + offenders.length + (offenders.length === 1 ? " employee" : " employees"),
    changes: offenders.map(function (line) {
      return { entryNumber: line.entryNumber, what: "employee", becomes: nameOf(line.detailComment) };
    }),
  };
}

function addEmployeeApply(ctx, offenders) {
  const existing = declaredEmployees(ctx.book);
  const first = nextEmployeeNumber(existing);
  const added = offenders.map(function (line, index) {
    return {
      employeeID: "EMP" + String(first + index).padStart(3, "0"),
      name: nameOf(line.detailComment),
      grossPay: line["diya-gl:grossPay"] === undefined ? line.amount : line["diya-gl:grossPay"],
      payFrequency: "monthly",
      taxCode: "",
      niCategory: "A",
      isDirector: false,
    };
  });
  return { ...ctx.book, employees: existing.concat(added) };
}

export const SE_BOOK_HELPERS = {
  "book-payslip-names-employee": {
    offenders: unnamedPayslips,
    buildHelper: addEmployeePlan,
    apply: addEmployeeApply,
  },
};

export const SE_PRODUCT_RULES = {
  checks: SE_CHECK_SPECS,
  warnings: SE_WARNINGS,
  sharedOffenders: SE_SHARED_OFFENDERS,
  sharedWarnings: SE_SHARED_WARNINGS,
  bookHelpers: SE_BOOK_HELPERS,
};
