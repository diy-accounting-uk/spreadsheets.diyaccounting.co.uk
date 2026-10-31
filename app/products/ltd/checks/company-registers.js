// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { periodShiftMonths, shiftMonths } from "../../../lib/period-shift.js";
import { excelSerialToUtcDate } from "../../../lib/product-sheets/serial-dates.js";
import { parseDate, registerOfficers } from "../../../lib/scenario-loader.js";
import { toExcelSerial } from "../../../lib/spreadsheet-runner.js";
import {
  CHARGE_REGISTER_COLUMNS,
  CHARGE_REGISTER_ROWS,
  DIRECTORS_INTERESTS_COLUMNS,
  DIRECTORS_INTERESTS_ROWS,
  DIRECTOR_SECRETARY_COLUMNS,
  DIRECTOR_SECRETARY_OFFICER_ROWS,
  REGISTER_MEMBER_COLUMNS,
  REGISTER_MEMBER_ROWS,
} from "../layout.js";

export function checkCompanyRegisters(ctx) {
  const { check, checkText, checks, expected, num, pl, pubBalSht, register, results, text } = ctx;

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
      check(
        `Register of members: row ${row} prices ${member.name}'s shares`,
        num(register[`${REGISTER_MEMBER_COLUMNS.nominalValue}${row}`]),
        member.nominal_value,
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

  // ── The register of directors and secretary, and directors' interests ────
  //
  // Neither sheet carries a formula or a route to the accounts -- a missing
  // entry is a Companies House problem, not an arithmetic one -- so this
  // checks the entries land against the scenario's own officers. An empty
  // register fails here and nowhere else.
  const officers = results["Companysecretary.xlsx!Directors&Secretary"];
  const interests = results["Companysecretary.xlsx!DirectorsInterests"];
  const expectedDirectors = registerOfficers(expected);
  if (officers && expectedDirectors.length > 0) {
    expectedDirectors.forEach((director, index) => {
      const row = DIRECTOR_SECRETARY_OFFICER_ROWS[index];
      if (row === undefined) return;
      checkText(
        `Directors&Secretary: row ${row} names ${director.name}`,
        text(officers[`${DIRECTOR_SECRETARY_COLUMNS.name}${row}`]),
        (name) => name === director.name,
        director.name,
      );
      if (director.role) {
        checkText(
          `Directors&Secretary: row ${row} appoints ${director.name} as ${director.role}`,
          text(officers[`${DIRECTOR_SECRETARY_COLUMNS.capacity}${row}`]),
          (capacity) => capacity === director.role,
          director.role,
        );
      }
      if (director.appointed) {
        const appointed = parseDate(director.appointed);
        check(
          `Directors&Secretary: row ${row} dates ${director.name}'s appointment`,
          num(officers[`${DIRECTOR_SECRETARY_COLUMNS.appointed}${row}`]),
          toExcelSerial(appointed.getUTCFullYear(), appointed.getUTCMonth() + 1, appointed.getUTCDate()),
          0,
        );
      }
    });
  }
  if (interests && expectedDirectors.length > 0) {
    expectedDirectors.slice(0, DIRECTORS_INTERESTS_ROWS.length).forEach((director, index) => {
      const row = DIRECTORS_INTERESTS_ROWS[index];
      checkText(
        `DirectorsInterests: row ${row} names ${director.name}`,
        text(interests[`${DIRECTORS_INTERESTS_COLUMNS.name}${row}`]),
        (name) => name === director.name,
        director.name,
      );
      const holding = (expected.members || []).find((member) => member.name === director.name);
      if (holding?.acquired) {
        const acquired = parseDate(holding.acquired);
        check(
          `DirectorsInterests: row ${row} registers ${director.name}'s shareholding on the date the register of members carries`,
          num(interests[`${DIRECTORS_INTERESTS_COLUMNS.registered}${row}`]),
          toExcelSerial(acquired.getUTCFullYear(), acquired.getUTCMonth() + 1, acquired.getUTCDate()),
          0,
        );
      }
    });
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
    const packageYearEnd = excelSerialToUtcDate(num(results.Admin.F21));
    const monthOffset = periodShiftMonths(expected, packageYearEnd.getUTCFullYear() - 1, packageYearEnd.getUTCMonth() + 1);
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

  return { hp };
}
