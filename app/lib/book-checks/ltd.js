// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// book-checks/ltd.js -- the Company book's own checks and warnings, the
// things a customer can get wrong on a thirteen-workbook package that the
// sheet still totals: a bank line the workbook has no analysis column for,
// a transfer with only one leg, a straddling invoice with no VAT period, a
// payslip naming nobody on the payroll, dividends above the profits there
// are to distribute, a CIS deduction off the sub-contractor account, and
// more asset rows than the Fixed Assets Schedule has room for.
//
// Pure functions only, no Node built-ins and no DOM, so the page, the CLI
// and the MCP server run the same rules. book-checks.js picks this module
// up from the book's own entityInformation["diya-gl:product"].

import { changeLinePostingDate } from "../diya-gl-edits.js";
import { LTD_PURCHASE_CODE_MAP, LTD_SALES_CODE_MAP } from "../scenario-extractor.js";

// The bank workbook each bank account is kept in, and the transfer letter
// each workbook stands for -- Currentaccount is BB, so a BB-coded line on
// any other workbook is a transfer to or from the current account.
const BANK_ACCOUNT_FILES = {
  1200: "Currentaccount.xlsx",
  1210: "Savingaccount.xlsx",
  1220: "Cashaccount.xlsx",
  1230: "Creditcardaccount.xlsx",
};

const BANK_TRANSFER_CODES = {
  "Currentaccount.xlsx": "BB",
  "Savingaccount.xlsx": "BS",
  "Cashaccount.xlsx": "BC",
  "Creditcardaccount.xlsx": "BD",
};

const TRANSFER_SIBLING_ACCOUNTS = Object.fromEntries(
  Object.entries(BANK_ACCOUNT_FILES).map(function (entry) {
    return [BANK_TRANSFER_CODES[entry[1]], String(entry[0])];
  }),
);

// The code letters each workbook's month tabs carry an analysis column
// for, receipts and payments apart. Cashaccount analyses four fewer
// receipt codes than the three statement books, and no payment X. These
// are the lists bankLayout() lays the columns out from in
// app/lib/ltd-layout.js; cellWrites() refuses to write a code outside them,
// which is the failure this check catches before the writer runs.
function analysedCodes(fileName) {
  const transfers = Object.values(BANK_TRANSFER_CODES).filter(function (code) {
    return code !== BANK_TRANSFER_CODES[fileName];
  });
  if (fileName === "Cashaccount.xlsx") {
    return {
      receipts: transfers.concat(["DR", "K", "LDR", "LCR", "DL"]),
      payments: transfers.concat(["CR", "W", "B", "J", "LDR", "LCR", "RP", "RV", "RC", "RT", "DV", "DL"]),
    };
  }
  return {
    receipts: transfers.concat(["DR", "K", "LDR", "LCR", "RV", "RC", "DL", "X"]),
    payments: transfers.concat(["CR", "W", "B", "J", "LDR", "LCR", "RP", "RV", "RC", "RT", "DV", "DL", "X"]),
  };
}

// The Fixed Assets Schedule's rows for assets already owned, one block per
// class, keyed by the class name a book declares (app/products/ltd.js
// SCHEDULE_ASSET_CLASSES, reached through the loader's class-to-category
// map). Assets bought in the year land on the New Plant & Machinery block
// instead, whatever they are, so that block has one row list of its own.
const SCHEDULE_EXISTING_ASSET_ROWS = {
  landBuildings: [8, 9, 10],
  plantMachinery: [14, 15, 16, 17, 18, 19, 20, 21],
  fixturesFittings: [25, 26, 27, 28, 29],
  computerTechnology: [33, 34, 35, 36, 37, 38, 39, 40],
  motorVehicles: [50, 51, 52, 53, 54],
};

const SCHEDULE_NEW_ASSET_ROWS = [67, 68, 69, 70, 71, 72, 73, 74];

// HPfinance takes two agreements: row 8, the New block's working master,
// and row 10, the first row the sheet's #REF! repair fixes.
const HP_AGREEMENT_ROWS = [8, 10];

// The sub-contractor account. A CIS deduction belongs to a payment for
// construction work, which the Company chart files here and nowhere else.
const SUBCONTRACTOR_ACCOUNT = "5001";

const ASSET_PURCHASE_CODE = "fa";
const ASSET_SALE_CODE = "fs";

function formatMoney(value) {
  const sign = value < 0 ? "-" : "";
  return sign + "£" + Math.abs(value).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function byEntryNumber(a, b) {
  const ka = a.entryNumber || "";
  const kb = b.entryNumber || "";
  return ka < kb ? -1 : ka > kb ? 1 : 0;
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

function isBankLine(line) {
  return line.sourceJournalID === "bank";
}

function bankFileOf(line) {
  return BANK_ACCOUNT_FILES[line["diya-gl:bankAccountID"]];
}

// A "BC"-coded bank line dated the first day of the period is the
// account's opening balance, which the workbook takes in A1 rather than as
// a statement line -- the shape extractBankTransactions writes it back in.
// A BC line dated any other day is a real transfer from the cash account.
function isOpeningBankBalance(line, period) {
  return line["diya-gl:bankCode"] === "BC" && line.postingDate === period.start;
}

function clampIntoPeriod(date, period) {
  if (date < period.start) return period.start;
  if (date > period.end) return period.end;
  return date;
}

function purchaseCodeOf(line) {
  return LTD_PURCHASE_CODE_MAP[line.accountMainID];
}

function salesCodeOf(line) {
  return LTD_SALES_CODE_MAP[line.accountMainID];
}

function linesCoded(lines, journal, codeOf, code) {
  return lines.filter(function (line) {
    return line.sourceJournalID === journal && codeOf(line) === code;
  });
}

function employeeIDs(book) {
  return new Set(
    ((book && book.employees) || []).map(function (employee) {
      return employee.employeeID;
    }),
  );
}

function employeeNames(book) {
  return new Set(
    ((book && book.employees) || []).map(function (employee) {
      return String(employee.name || "").trim();
    }),
  );
}

// A row of the Schedule, the HPfinance sheet or a ledger that has no room
// left, in the offender shape runChecks reports lines in.
function scheduleOffender(entryNumber, postingDate, detailComment, amount) {
  return { entryNumber: entryNumber, postingDate: postingDate, accountMainID: "", detailComment: detailComment, amount: amount };
}

// ============================== the checks ==============================
// The CHECK_SPECS shape book-checks.js runs: which lines offend, why it
// matters, and where a mechanical fix exists, how to build and apply it.
// ctx is { book, lines, period, chart }.

export const LTD_CHECK_SPECS = [
  {
    id: "ltd-bank-line-has-side",
    label: "Every bank entry is a receipt or a payment",
    offenders: function (ctx) {
      return ctx.lines.filter(function (line) {
        return isBankLine(line) && line.debitCreditCode !== "D" && line.debitCreditCode !== "C";
      });
    },
    consequence: function () {
      return "A bank entry that is neither a receipt nor a payment reaches neither block of its month tab, so its amount leaves the bank workbook and the trial balance altogether.";
    },
    buildHelper: null,
    apply: null,
  },
  {
    id: "ltd-bank-code-analysed",
    label: "Every bank entry is coded to a column its workbook analyses",
    offenders: function (ctx) {
      return ctx.lines.filter(function (line) {
        if (!isBankLine(line)) return false;
        if (isOpeningBankBalance(line, ctx.period)) return false;
        const fileName = bankFileOf(line);
        if (!fileName) return true;
        if (line.debitCreditCode !== "D" && line.debitCreditCode !== "C") return false;
        const codes = analysedCodes(fileName);
        const analysed = line.debitCreditCode === "D" ? codes.receipts : codes.payments;
        return !analysed.includes(line["diya-gl:bankCode"]);
      });
    },
    consequence: function () {
      return "Each bank workbook analyses its own list of codes, and the four workbooks do not share one list -- the cash book has no receipt column for RV, RC or X. An entry coded outside its workbook's list has no column to land in, and the package cannot be written at all.";
    },
    buildHelper: null,
    apply: null,
  },
  {
    id: "ltd-straddling-line-has-vat-period",
    label: "Every sale and purchase outside the period names the VAT period it belongs to",
    offenders: function (ctx) {
      return ctx.lines.filter(function (line) {
        if (line.sourceJournalID !== "sales" && line.sourceJournalID !== "purchases") return false;
        if (line.postingDate >= ctx.period.start && line.postingDate <= ctx.period.end) return false;
        return !line["diya-gl:vatPeriodEnd"];
      });
    },
    consequence: function (ctx) {
      return (
        "An entry dated outside " +
        ctx.period.start +
        " to " +
        ctx.period.end +
        " belongs to this book only as part of a VAT quarter that straddles the year end. Without a VAT period end it is not a straddling entry, and it still lands on the month tab of the same calendar month, so it is counted in a year it does not belong to."
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
    id: "ltd-payroll-line-names-employee",
    label: "Every payroll entry names someone on the payroll",
    offenders: function (ctx) {
      const ids = employeeIDs(ctx.book);
      const names = employeeNames(ctx.book);
      return ctx.lines.filter(function (line) {
        if (line.sourceJournalID !== "payroll") return false;
        if (ids.has(line["diya-gl:employeeID"])) return false;
        return !names.has(String(line.detailComment || "").trim());
      });
    },
    consequence: function () {
      return "The payroll workbook keeps one month tab row per employee and WagesInterface reads those rows by employee. An entry naming nobody the book employs reaches no row, so its pay, tax and National Insurance leave the payroll and the wages a Company reports.";
    },
    buildHelper: null,
    apply: null,
  },
  {
    id: "ltd-fixed-asset-rows-fit-schedule",
    label: "Every asset, disposal and hire purchase agreement has a row on the Fixed Assets Schedule",
    offenders: function (ctx) {
      const assets = (ctx.book && ctx.book.fixedAssets) || [];
      const agreements = (ctx.book && ctx.book.hpAgreements) || [];
      const assetPurchases = linesCoded(ctx.lines, "purchases", purchaseCodeOf, ASSET_PURCHASE_CODE);
      const assetSales = linesCoded(ctx.lines, "sales", salesCodeOf, ASSET_SALE_CODE);
      const offenders = assetPurchases.slice(SCHEDULE_NEW_ASSET_ROWS.length);

      const seenInClass = {};
      for (const asset of assets) {
        const rows = SCHEDULE_EXISTING_ASSET_ROWS[asset.class] || [];
        const index = seenInClass[asset.class] || 0;
        seenInClass[asset.class] = index + 1;
        if (index >= rows.length) {
          offenders.push(scheduleOffender(asset.assetID, "", asset.description || String(asset.class), asset.cost));
        }
      }

      // A disposal attaches to an asset already on the Schedule: the ones
      // brought forward, then the ones bought in the year.
      const disposalRows = assets.length + Math.min(assetPurchases.length, SCHEDULE_NEW_ASSET_ROWS.length);
      for (const line of assetSales.slice(disposalRows)) offenders.push(line);

      for (const agreement of agreements.slice(HP_AGREEMENT_ROWS.length)) {
        offenders.push(
          scheduleOffender(agreement.agreementID, agreement.startDate, agreement.financeCompany || "", agreement.amountFinanced),
        );
      }
      return offenders;
    },
    consequence: function () {
      return (
        "The Schedule has " +
        SCHEDULE_NEW_ASSET_ROWS.length +
        " rows for assets bought in the year, a fixed block per class for assets brought forward, one disposal per asset row and " +
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

function transferCounterLegWarning(ctx) {
  const offenders = ctx.lines
    .filter(function (line) {
      if (!isBankLine(line)) return false;
      const sibling = TRANSFER_SIBLING_ACCOUNTS[line["diya-gl:bankCode"]];
      if (!sibling) return false;
      if (isOpeningBankBalance(line, ctx.period)) return false;
      return !ctx.lines.some(function (other) {
        if (other === line) return false;
        const onSibling = other["diya-gl:bankAccountID"] === sibling || String(other.accountMainID) === sibling;
        return onSibling && other.postingDate === line.postingDate && other.amount === line.amount;
      });
    })
    .sort(byEntryNumber);
  const warn = offenders.length > 0;
  return {
    id: "ltd-transfer-has-counter-leg",
    tier: "warning",
    label: "Every transfer between the company's own accounts appears on both of them",
    result: warn ? "warn" : "pass",
    actual: offenders.length,
    consequence: warn
      ? "A transfer entered on one account only moves money the other account never loses, so one of the two closing balances is wrong by the amount transferred and the trial balance nets it away under intra-account transfers."
      : null,
    offenders: offenders.map(offenderOf),
  };
}

function dividendsWarning(ctx, taxData, results) {
  const dividends = (ctx.book && ctx.book.dividends) || [];
  let declared = 0;
  for (const dividend of dividends) declared += dividend.amount || 0;

  const openAccounts = (results && results.OpenAccounts) || null;
  const publishedPl = (results && results["PubP&L"]) || null;
  if (!openAccounts || !publishedPl) {
    return {
      id: "ltd-dividend-within-distributable-profits",
      tier: "warning",
      label:
        "Dividends declared are " +
        formatMoney(declared) +
        "; the profits available to distribute are not known without the calculated accounts.",
      result: "pass",
      actual: declared,
      consequence: null,
      offenders: [],
    };
  }

  const available = (openAccounts.E34 || 0) + (publishedPl.F51 || 0);
  const warn = declared > available;
  return {
    id: "ltd-dividend-within-distributable-profits",
    tier: "warning",
    label:
      "Dividends declared are " +
      formatMoney(declared) +
      ", against " +
      formatMoney(available) +
      " of retained profit brought forward plus profit after tax for the year.",
    result: warn ? "warn" : "pass",
    actual: declared,
    consequence: warn
      ? "A dividend above the profits a company has to distribute is unlawful, and the directors who declared it can be asked to repay it."
      : null,
    offenders: [],
  };
}

function cisAccountWarning(ctx) {
  const offenders = ctx.lines
    .filter(function (line) {
      return (
        line.sourceJournalID === "purchases" &&
        line["diya-gl:cisDeduction"] !== undefined &&
        String(line.accountMainID) !== SUBCONTRACTOR_ACCOUNT
      );
    })
    .sort(byEntryNumber);
  const warn = offenders.length > 0;
  return {
    id: "ltd-cis-on-subcontractor-line",
    tier: "warning",
    label: "Every CIS deduction sits on a sub-contractor purchase",
    result: warn ? "warn" : "pass",
    actual: offenders.length,
    consequence: warn
      ? "A CIS deduction is what a contractor withholds from a sub-contractor's labour, so it belongs on account " +
        SUBCONTRACTOR_ACCOUNT +
        ". On any other account the deduction is still totalled into what is owed to HMRC while the spend it came from is analysed somewhere the CIS return never looks."
      : null,
    offenders: offenders.map(offenderOf),
  };
}

export const LTD_WARNINGS = [transferCounterLegWarning, dividendsWarning, cisAccountWarning];

// ============================== the shared checks Ltd reads differently ==============================
// A Company book reaches four more journals than a sole trader's, and its
// sales and purchases straddle the year end for VAT. Each entry narrows
// one shared check's offenders; the shared consequence and helper stand.

export const LTD_SHARED_OFFENDERS = {
  // Bank, payroll and journal lines post to the bank, wage and balance
  // sheet accounts the chart lists under its other sections, not to the
  // sales and purchases tables the check reads.
  "book-accounts-in-chart": function (ctx, offenders) {
    return offenders.filter(function (line) {
      return line.sourceJournalID === "sales" || line.sourceJournalID === "purchases";
    });
  },
  // A line carrying a VAT period end is a straddling entry, dated outside
  // the year on purpose. ltd-straddling-line-has-vat-period is the rule
  // that judges it.
  "book-dates-in-period": function (ctx, offenders) {
    return offenders.filter(function (line) {
      return !line["diya-gl:vatPeriodEnd"];
    });
  },
};

export const LTD_PRODUCT_RULES = { checks: LTD_CHECK_SPECS, warnings: LTD_WARNINGS, sharedOffenders: LTD_SHARED_OFFENDERS };
