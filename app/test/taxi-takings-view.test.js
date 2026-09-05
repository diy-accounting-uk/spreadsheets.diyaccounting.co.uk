// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// The takings view under the Taxi year table (web/.../books/products/
// taxi-takings.js), rendered against the takings the Taxi manifest groups
// from the example books. Both product files are classic scripts assigning
// one global each, so they are imported for their side effects and the
// rendered HTML is asserted as a string.

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadDiyaGlData } from "../lib/diya-gl-loader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const PRODUCTS_DIR = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public", "books", "products");
const TAKINGS_FILE = resolve(PRODUCTS_DIR, "taxi-takings.js");

await import(resolve(PRODUCTS_DIR, "taxi.js"));
await import(TAKINGS_FILE);
const manifest = globalThis.DiyaGlProducts.taxi;
const view = globalThis.DiyaGlTaxiTakings;
const { weekLabel, dayLabel, draftLine, subtotals } = view.internals;

const moneyFmt = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

function loadBook(dir) {
  return loadDiyaGlData(resolve(ROOT, "examples", dir, "taxi"));
}

function takingsOf(book, lines) {
  return manifest.internals.groupTakings(lines, manifest.internals.buildTabMonths(book));
}

// The helpers the shell hands a view, reduced to what the takings view
// calls: formatting, one view-state bag, the layout question, and the
// commit route recorded rather than run.
function stubHelpers(opts = {}) {
  const bags = {};
  const calls = { commits: [], toasts: [], renders: 0 };
  return {
    calls,
    esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]),
    fmtMoney: (n) => moneyFmt.format(n),
    fmtWhole: (n) => moneyFmt.format(Math.round(n)).replace(/\.00$/, ""),
    viewState: (id, init) => {
      if (!bags[id]) bags[id] = { ...init };
      return bags[id];
    },
    isMobilePortrait: () => !!opts.mobilePortrait,
    showToast: (m) => calls.toasts.push(m),
    commit: (fn, label, toast) => calls.commits.push({ fn, label, toast }),
    render: () => calls.renders++,
  };
}

function render(fixture, monthKey, { bag = {}, state = {}, mobilePortrait = false } = {}) {
  globalThis.DIYA_BOOKS_SNAPSHOT = { takings: fixture.takings, lines: fixture.lines };
  const helpers = stubHelpers({ mobilePortrait });
  Object.assign(helpers.viewState("taxi-takings", { openWeek: null, openDay: null, draft: null, pendingFocus: null }), bag);
  const html = view.renderMonthDetail(monthKey, { focusEntry: null, focusField: null, ...state }, helpers);
  return { html, helpers };
}

function count(html, needle) {
  return html.split(needle).length - 1;
}

// The `<tr ...>...</tr>` whose opening tag carries the attribute.
function rowWith(html, attribute) {
  const start = html.lastIndexOf("<tr", html.indexOf(attribute));
  const end = html.indexOf("</tr>", start) + "</tr>".length;
  return html.slice(start, end);
}

const basicData = loadBook("basic-taxi-driver");
const basic = { ...basicData, takings: takingsOf(basicData.book, basicData.lines) };
const spSixtyData = loadBook("sp-sixty-driving");
const spSixty = { ...spSixtyData, takings: takingsOf(spSixtyData.book, spSixtyData.lines) };
const kestrelData = loadBook("kestrel-executive-cars");
const kestrel = { ...kestrelData, takings: takingsOf(kestrelData.book, kestrelData.lines) };

const APRIL = "2025-04";
const MAY = "2025-05";
const SECOND_WEEK = "2025-04-07";
const TWO_FARE_DAY = "2025-04-07";
const ONE_FARE_DAY = "2025-04-08";
const ONE_FARE_ENTRY = "TXN-0004";

beforeEach(() => {
  delete globalThis.DIYA_BOOKS_SNAPSHOT;
});

describe("the takings view", () => {
  it("April renders one week row per week, the first captioned Sun 6 Apr alone, and May's summary says from Mon 28 Apr", () => {
    const april = render(basic, APRIL).html;
    expect(count(april, '<tr class="week-row')).toBe(basic.takings.months[APRIL].weeks.length);
    expect(april).toContain('data-week="2025-04-06"');
    expect(rowWith(april, 'data-week="2025-04-06"')).toContain("Sun 6 Apr");
    expect(rowWith(april, 'data-week="2025-04-06"')).not.toContain("w/c");
    expect(rowWith(april, 'data-week="2025-04-07"')).toContain("w/c Mon 7 Apr");
    expect(april).toContain('<table class="week-strip" data-month="2025-04"');
    expect(april).toContain('<div class="takings-month" data-month="2025-04">');
    expect(april).toContain("days traded");
    expect(count(april, 'id="takings-note"')).toBe(1);
    expect(april).toContain("The workbook carries one row per day; your fares stay in the book.");
    expect(april).not.toContain("from Mon");

    const may = render(basic, MAY).html;
    expect(may).toMatch(/<p class="takings-summary">[^<]*· from Mon 28 Apr/);
  });

  it("the two-fare day renders data-lines=2 with the sum £245.00 and the names Daily fares; Airport run, and no inputs while closed", () => {
    const html = render(basic, APRIL, { bag: { openWeek: SECOND_WEEK } }).html;
    const row = rowWith(html, `data-day="${TWO_FARE_DAY}"`);
    expect(row).toContain('data-lines="2"');
    expect(row).toContain("£245.00");
    expect(row).toContain("Daily fares; Airport run");
    expect(row).toContain('<span class="fare-count">2 fares</span>');
    expect(row).not.toContain("<input");
    expect(row).toContain(`data-day-toggle="${TWO_FARE_DAY}" aria-expanded="false"`);
    expect(row).toContain(`data-add-fare="${TWO_FARE_DAY}"`);
  });

  it("an open week renders seven day rows, the rental row, the other-income row and the total row; the one-day first week renders one day row", () => {
    const html = render(basic, APRIL, { bag: { openWeek: SECOND_WEEK } }).html;
    expect(count(html, '<tr class="week-detail-row">')).toBe(1);
    expect(html).toContain(`<table class="day-grid" data-week="${SECOND_WEEK}">`);
    expect(count(html, '<tr class="day-row')).toBe(7);
    expect(html).toContain('<tr class="caption-row" data-caption="rental">');
    expect(html).toContain('<tr class="caption-row" data-caption="other-income">');
    expect(html).toContain('data-add-caption="rental" data-week="2025-04-07"');
    expect(html).toContain('data-add-caption="other-income" data-week="2025-04-07"');
    expect(count(html, '<tr class="week-total-row">')).toBe(1);
    expect(rowWith(html, 'data-week="2025-04-07" tabindex')).toContain('aria-expanded="true"');
    expect(rowWith(html, 'data-week="2025-04-07" tabindex')).toContain("is-open");

    const firstWeek = render(basic, APRIL, { bag: { openWeek: "2025-04-06" } }).html;
    expect(count(firstWeek, '<tr class="day-row')).toBe(1);
    expect(firstWeek).toContain('data-day="2025-04-06" data-lines="0"');
    expect(rowWith(firstWeek, 'data-day="2025-04-06"')).toContain('data-add-fare="2025-04-06"');
  });

  it("a day's inputs live in one place: closed with one fare the row carries data-amount-entry once; open, the fare list carries it once and the row none", () => {
    const closed = render(basic, APRIL, { bag: { openWeek: SECOND_WEEK } }).html;
    expect(count(closed, `data-amount-entry="${ONE_FARE_ENTRY}"`)).toBe(1);
    expect(count(closed, `data-detail-entry="${ONE_FARE_ENTRY}"`)).toBe(1);
    expect(count(closed, `data-miles-entry="${ONE_FARE_ENTRY}"`)).toBe(1);
    expect(count(closed, `data-delete-entry="${ONE_FARE_ENTRY}"`)).toBe(1);
    const closedRow = rowWith(closed, `data-day="${ONE_FARE_DAY}"`);
    expect(closedRow).toContain(`data-amount-entry="${ONE_FARE_ENTRY}"`);
    expect(closedRow).toContain('data-lines="1"');
    expect(closed).not.toContain(`<table class="fare-list" data-day="${ONE_FARE_DAY}">`);

    const open = render(basic, APRIL, { bag: { openWeek: SECOND_WEEK, openDay: ONE_FARE_DAY } }).html;
    expect(count(open, `data-amount-entry="${ONE_FARE_ENTRY}"`)).toBe(1);
    expect(count(open, `data-date-entry="${ONE_FARE_ENTRY}"`)).toBe(1);
    const openRow = rowWith(open, `data-day="${ONE_FARE_DAY}"`);
    expect(openRow).not.toContain("<input");
    expect(openRow).toContain(`data-day-toggle="${ONE_FARE_DAY}" aria-expanded="true"`);
    expect(open).toContain(`<table class="fare-list" data-day="${ONE_FARE_DAY}">`);
    expect(open).toContain(`<tr class="fare-row" data-entry="${ONE_FARE_ENTRY}">`);
    expect(open).toContain("1 fare on Tue 8 Apr. The workbook row will carry £220.00 and 'Daily fares'.");
    expect(count(open, '<tr class="day-detail-row">')).toBe(1);
  });

  it("a focus entry opens its week and day", () => {
    const html = render(basic, APRIL, { state: { focusEntry: "TXN-0202", focusField: "miles" } }).html;
    expect(html).toContain('data-miles-entry="TXN-0202"');
    expect(html).toContain('<tr class="week-row is-open" data-week="2025-04-07"');
    expect(html).toContain('<table class="fare-list" data-day="2025-04-07">');
    expect(html).toContain("2 fares on Mon 7 Apr. The workbook row will carry £245.00 and 'Daily fares; Airport run'.");
  });

  it("a focused one-fare day keeps its inputs in its row unless the day was already open", () => {
    const closed = render(basic, APRIL, { state: { focusEntry: ONE_FARE_ENTRY, focusField: "detail" } }).html;
    expect(rowWith(closed, `data-day="${ONE_FARE_DAY}"`)).toContain(`data-detail-entry="${ONE_FARE_ENTRY}"`);
    expect(closed).not.toContain(`<table class="fare-list" data-day="${ONE_FARE_DAY}">`);

    const open = render(basic, APRIL, {
      bag: { openWeek: SECOND_WEEK, openDay: ONE_FARE_DAY },
      state: { focusEntry: ONE_FARE_ENTRY, focusField: "amount" },
    }).html;
    expect(open).toContain(`<table class="fare-list" data-day="${ONE_FARE_DAY}">`);
  });

  it("the levels a focus entry opens are written back to the bag so the next render keeps them", () => {
    const { helpers } = render(basic, APRIL, { state: { focusEntry: "TXN-0202", focusField: "miles" } });
    const bag = helpers.viewState("taxi-takings");
    expect(bag.openWeek).toBe("2025-04-07");
    expect(bag.openDay).toBe("2025-04-07");
  });

  it("draftLine dates a fare on its day as a receipt, a rental on the week's last day with the caption, other income on 4001", () => {
    const week = basic.takings.months[APRIL].weeks[1];
    expect(week.end).toBe("2025-04-13");
    expect(draftLine({ kind: "fare", day: "2025-04-08", amount: "45", detail: "Station run", miles: "12" }, week)).toEqual({
      journal: "sales",
      date: "2025-04-08",
      account: "4000",
      detail: "Station run",
      amount: 45,
      miles: 12,
      documentType: "receipt",
    });
    expect(draftLine({ kind: "fare", day: "2025-04-08", amount: "£1,045.50", detail: "", miles: "" }, week)).toMatchObject({
      amount: 1045.5,
      miles: 0,
    });
    expect(draftLine({ kind: "rental", weekStart: week.start, amount: "150" }, week)).toEqual({
      journal: "sales",
      date: "2025-04-13",
      account: "4000",
      detail: "Rental due",
      amount: 150,
      documentType: "invoice",
    });
    expect(draftLine({ kind: "other-income", weekStart: week.start, amount: "80" }, week)).toEqual({
      journal: "sales",
      date: "2025-04-13",
      account: "4001",
      detail: "Any other income",
      amount: 80,
      documentType: "invoice",
    });
    const lastWeek = basic.takings.months["2026-03"].weeks.slice(-1)[0];
    expect(draftLine({ kind: "rental", weekStart: lastWeek.start, amount: "1" }, lastWeek).date).toBe("2026-04-05");
  });

  it("weekLabel and dayLabel read w/c Mon 7 Apr and Mon 7 Apr; a one-day week reads Sun 6 Apr; the last week of 2025-26 reads w/c Mon 30 Mar", () => {
    const april = basic.takings.months[APRIL].weeks;
    expect(weekLabel(april[0])).toBe("Sun 6 Apr");
    expect(weekLabel(april[1])).toBe("w/c Mon 7 Apr");
    expect(dayLabel("2025-04-07")).toBe("Mon 7 Apr");
    expect(dayLabel("2026-01-01")).toBe("Thu 1 Jan");
    const lastWeek = basic.takings.months["2026-03"].weeks.slice(-1)[0];
    expect(lastWeek.days.length).toBe(7);
    expect(weekLabel(lastWeek)).toBe("w/c Mon 30 Mar");
  });

  it("subtotals gives the sheet's two figures", () => {
    const week = kestrel.takings.months["2025-06"].weeks.find((w) => w.start === "2025-06-09");
    expect(week.rental).toBe(150);
    expect(week.rentalLines.map((l) => l.entryNumber)).toEqual(["TXN-0156"]);
    expect(subtotals(week)).toEqual({ takings: week.takings + 150, otherIncome: week.otherIncome });
    expect(week.takings).toBeGreaterThan(0);

    const html = render(kestrel, "2025-06", { bag: { openWeek: "2025-06-09" } }).html;
    const total = rowWith(html, '<tr class="week-total-row">');
    expect(total).toContain(moneyFmt.format(week.takings + 150));
    const rental = rowWith(html, 'data-caption="rental"');
    expect(rental).toContain('<span class="caption-line" data-entry="TXN-0156">');
    expect(rental).toContain('data-date-entry="TXN-0156"');
    expect(rental).toContain('value="2025-06-13"');
    expect(rental).toContain('data-amount-entry="TXN-0156"');
    expect(rental).toContain('data-delete-entry="TXN-0156"');
    expect(rental).toContain("£150.00");
    const novemberHtml = render(kestrel, "2025-11", { bag: { openWeek: "2025-11-10" } }).html;
    expect(rowWith(novemberHtml, 'data-caption="other-income"')).toContain('data-entry="TXN-0158"');
  });

  it("a fare day without miles renders is-missing-miles and the flag only when the book carries miles", () => {
    const lines = spSixty.lines.map((line) => {
      if (line.entryNumber !== "TXN-0002") return line;
      const { measurableQuantity, measurableUnitOfMeasure, measurableDescription, ...rest } = line;
      return rest;
    });
    const takings = takingsOf(spSixty.book, lines);
    const html = render({ takings, lines }, APRIL, { bag: { openWeek: "2025-04-07" } }).html;
    const row = rowWith(html, 'data-day="2025-04-08"');
    expect(row).toContain("is-missing-miles");
    expect(row).toContain('<span class="entry-flag">no miles</span>');
    expect(row).toContain('data-miles-entry="TXN-0002"');
    expect(row).toContain('placeholder="miles"');
    expect(row).toContain('value=""');
    expect(rowWith(html, 'data-week="2025-04-07" tabindex')).toContain('data-missing-miles="1"');
    expect(html).toMatch(
      /<p class="takings-summary">Miles [\d,]+ · \d+ days traded · <span class="entry-flag">1 fare day without miles<\/span><\/p>/,
    );

    const basicHtml = render(basic, APRIL, { bag: { openWeek: SECOND_WEEK } }).html;
    expect(basicHtml).not.toContain("is-missing-miles");
    expect(basicHtml).not.toContain("without miles");
    expect(basicHtml).not.toContain("data-missing-miles");
    expect(basicHtml).toMatch(/<p class="takings-summary">Miles 0 · \d+ days traded<\/p>/);
  });

  it("mobile portrait renders week cards, day cards and one copy of every control", () => {
    const opts = { bag: { openWeek: SECOND_WEEK, openDay: ONE_FARE_DAY }, mobilePortrait: true };
    const html = render(basic, APRIL, opts).html;
    expect(html).not.toContain("<table");
    expect(count(html, 'data-week-card="')).toBe(basic.takings.months[APRIL].weeks.length);
    expect(count(html, 'class="week-card-head"')).toBe(basic.takings.months[APRIL].weeks.length);
    expect(html).toContain(`data-week-card="${SECOND_WEEK}"`);
    expect(count(html, 'data-day-card="')).toBe(7);
    expect(html).toContain(`data-day-card="${ONE_FARE_DAY}" data-lines="1"`);
    expect(html).toContain(`data-day-toggle="${ONE_FARE_DAY}" aria-expanded="true"`);
    expect(html).toContain(`<div class="fare-card" data-entry="${ONE_FARE_ENTRY}">`);
    for (const attr of ["data-amount-entry", "data-date-entry", "data-detail-entry", "data-miles-entry", "data-delete-entry"]) {
      expect(count(html, `${attr}="${ONE_FARE_ENTRY}"`), attr).toBe(1);
    }
    expect(count(html, `data-add-fare="${ONE_FARE_DAY}"`)).toBe(1);
    expect(count(html, 'data-add-caption="rental"')).toBe(1);
    expect(count(html, 'data-add-caption="other-income"')).toBe(1);
    expect(html).toContain('<div class="caption-card" data-caption="rental">');
    expect(html).toContain('<div class="caption-card" data-caption="other-income">');
    expect(html).toContain('class="week-card-figures"');
    expect(count(html, '<span class="figure-value">')).toBeGreaterThanOrEqual(4 * basic.takings.months[APRIL].weeks.length);

    const closedDay = render(basic, APRIL, { bag: { openWeek: SECOND_WEEK }, mobilePortrait: true }).html;
    expect(closedDay).not.toContain("data-amount-entry");
    expect(closedDay).toContain(`data-day-toggle="${TWO_FARE_DAY}" aria-expanded="false"`);
    expect(closedDay).toContain(`data-day-card="2025-04-13" data-lines="0"`);
  });

  it("a draft renders where its control was, keeps its text, and gives the amount field its label", () => {
    const fareDraft = { kind: "fare", day: ONE_FARE_DAY, weekStart: null, amount: "45", detail: "Station run", miles: "12" };
    const closed = render(basic, APRIL, { bag: { openWeek: SECOND_WEEK, draft: fareDraft } }).html;
    expect(closed).toContain(`<tr class="fare-draft" data-day="${ONE_FARE_DAY}">`);
    expect(closed.indexOf('<tr class="fare-draft"')).toBeGreaterThan(closed.indexOf(`data-day="${ONE_FARE_DAY}" data-lines`));
    expect(closed).toContain(
      'data-draft-field="amount" inputmode="decimal" placeholder="0.00" aria-label="Amount for the new fare" value="45"',
    );
    expect(closed).toContain('data-draft-field="detail" placeholder="Name" aria-label="Name for the new fare" value="Station run"');
    expect(closed).toContain(
      'data-draft-field="miles" inputmode="numeric" placeholder="miles" aria-label="Miles for the new fare" value="12"',
    );
    expect(count(closed, "data-draft-commit")).toBe(1);
    expect(count(closed, "data-draft-cancel")).toBe(1);

    const open = render(basic, APRIL, { bag: { openWeek: SECOND_WEEK, openDay: ONE_FARE_DAY, draft: fareDraft } }).html;
    const fareList = open.slice(
      open.indexOf('<table class="fare-list"'),
      open.indexOf("</table>", open.indexOf('<table class="fare-list"')),
    );
    expect(fareList).toContain('<tr class="fare-draft"');
    expect(count(open, '<tr class="fare-draft"')).toBe(1);

    const rentalDraft = { kind: "rental", day: null, weekStart: SECOND_WEEK, amount: "150" };
    const caption = render(basic, APRIL, { bag: { openWeek: SECOND_WEEK, draft: rentalDraft } }).html;
    expect(caption).toContain(`<tr class="fare-draft" data-week="${SECOND_WEEK}" data-caption="rental">`);
    expect(caption).toContain('aria-label="Amount for the new rental"');
    expect(rowWith(caption, 'data-caption="rental">')).not.toContain("data-draft-field");
    expect(caption).not.toContain('data-draft-field="detail"');
    expect(caption).not.toContain('data-draft-field="miles"');
  });

  it("lines dated off the grid are listed with a date field, a delete and the helper, on every month", () => {
    const lines = basic.lines.map((line) => (line.entryNumber === "TXN-0002" ? { ...line, postingDate: "2026-04-07" } : line));
    const takings = takingsOf(basic.book, lines);
    expect(takings.offGrid.map((l) => l.entryNumber)).toEqual(["TXN-0002"]);
    for (const monthKey of [APRIL, "2026-03"]) {
      const html = render({ takings, lines }, monthKey).html;
      expect(html).toContain('<div class="takings-offgrid panel-card">');
      expect(html).toContain("1 entry is dated outside this year's grid (6 April to 5 April), so the workbook cannot hold it.");
      expect(html).toContain('<tr class="offgrid-row" data-entry="TXN-0002">');
      expect(html).toContain('data-date-entry="TXN-0002"');
      expect(html).toContain('value="2026-04-07"');
      expect(html).toContain('data-delete-entry="TXN-0002"');
      expect(html).toContain('data-offgrid-helper="book-dates-in-period"');
      expect(html).toContain("Move them into the period");
      expect(html).toContain("£200.00");
    }
    expect(render(basic, APRIL).html).not.toContain("takings-offgrid");
  });

  it("the module reads no results and names no sheet, and reads the snapshot through one accessor", () => {
    const source = readFileSync(TAKINGS_FILE, "utf8");
    expect(count(source, "results[")).toBe(0);
    expect(count(source, "Profit & Loss Acc")).toBe(0);
    expect(count(source, "rkFor(")).toBe(0);
    expect(count(source, "DIYA_BOOKS_SNAPSHOT")).toBe(1);
  });

  it("defines DiyaGlTaxiTakings with its two entry points and internals", () => {
    expect(Object.keys(view).sort()).toEqual(["bind", "internals", "renderMonthDetail"]);
    expect(typeof view.bind).toBe("function");
    expect(Object.keys(view.internals).sort()).toEqual([
      "dayLabel",
      "draftLine",
      "levelsFor",
      "parseAmount",
      "parseMiles",
      "subtotals",
      "weekLabel",
    ]);
    expect(view.internals.parseAmount("£1,234.50")).toBe(1234.5);
    expect(view.internals.parseAmount("abc")).toBeNull();
    expect(view.internals.parseMiles("1,640")).toBe(1640);
    expect(view.internals.parseMiles("12.5")).toBeNull();
    expect(view.internals.parseMiles("-3")).toBeNull();
  });
});
