// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// books/products/taxi.js
//
// The Taxi Driver view manifest: what the shared shell (shell.js) mounts
// for a Taxi book. Every sheet cell it names comes from the product
// module's own CELL_MAP (app/products/taxi.js); the tables kept here name
// snapshot keys, the display labels the sheet's own rows are too long for,
// and the two sales captions the writer treats as a week's own rows.
//
// The takings grain -- weeks, days and the fares of a day -- is grouped
// once here, into snapshot.takings, and rendered by products/taxi-takings.js.
// The P&L, vehicle, quarterly and forecast views live in
// products/taxi-views.js and the two forms in products/taxi-forms.js; this
// file reaches all three by name at render time, so the load order of the
// product scripts does not matter and a Taxi book dropped on another
// product's page pulls them in itself.

(function (global) {
  "use strict";
  global.DiyaGlProducts = global.DiyaGlProducts || {};

  var SCHEMA_NAME = "TaxiDriver";

  // Snapshot key per annual P&L cell, in the sheet's own row order. Labels,
  // sections and units come from CELL_MAP; this table names the key a month
  // row and the annual row carry and the shorter display label for the four
  // rows whose sheet wording is a sentence.
  var PL_KEYS = {
    B5: { key: "sales", label: "Takings" },
    B6: { key: "fuel" },
    B7: { key: "carHire" },
    B8: { key: "repairs" },
    B9: { key: "roadTaxInsurance" },
    B10: { key: "capitalAllowances" },
    B11: { key: "mileageAllowance" },
    B12: { key: "costOfSales", label: "Vehicle costs" },
    B13: { key: "grossProfit" },
    B14: { key: "employeeCosts" },
    B15: { key: "premisesCosts" },
    B16: { key: "generalAdmin" },
    B17: { key: "advertising" },
    B18: { key: "legalProfessional" },
    B19: { key: "interestFinance" },
    B20: { key: "bankCharges" },
    B21: { key: "otherExpenses" },
    B22: { key: "totalExpenses", label: "Running costs" },
    B23: { key: "netProfit", label: "Profit" },
    B24: { key: "otherIncome", label: "Other income" },
  };
  // The year table's columns stop at the sheet's own last P&L row.
  var LAST_CATEGORY_CELL = "B24";
  // The rows the sheet computes rather than sums from lines: two allowance
  // rows the tax data decides, the two subtotals and the two profit lines.
  var DERIVED = { capitalAllowances: 1, mileageAllowance: 1, costOfSales: 1, grossProfit: 1, totalExpenses: 1, netProfit: 1 };
  // Taxi code letter (the value TAXI_PURCHASE_CODE_MAP gives a purchase
  // code) to snapshot key.
  var LETTER_KEYS = {
    d: "fuel",
    h: "carHire",
    r: "repairs",
    t: "roadTaxInsurance",
    e: "employeeCosts",
    p: "premisesCosts",
    g: "generalAdmin",
    a: "advertising",
    l: "legalProfessional",
    i: "interestFinance",
    b: "bankCharges",
    o: "otherExpenses",
    f: "capex",
  };

  var PL_SECTION = "Profit & Loss Account";
  // The P&L's monthly columns, Apr through Mar, and the four rows the sheet
  // fills a month at a time. CELL_MAP names all 48 of those cells.
  var MONTH_COL = {
    Apr: "C",
    May: "D",
    Jun: "E",
    Jul: "F",
    Aug: "G",
    Sep: "H",
    Oct: "I",
    Nov: "J",
    Dec: "K",
    Jan: "L",
    Feb: "M",
    Mar: "N",
  };
  var MONTHLY_ROW = { sales: 5, costOfSales: 12, totalExpenses: 22, otherIncome: 24 };
  var MONTH_LABELS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  var DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  var TAKINGS_ACCOUNT = "4000";
  var OTHER_INCOME_ACCOUNT = "4001";
  // The two captions the writer reads as a week's own rows rather than a
  // day's fare: a sales line detailed exactly this is the week's rental or
  // its other income, wherever inside the week it is dated (cellWrites,
  // app/products/taxi.js).
  var RENTAL_CAPTION = "Rental due";
  var OTHER_INCOME_CAPTION = "Any other income";

  var PURCHASE_ANALYSIS_SHEET = "PurchasesMar";
  var VEHICLE_CELLS = { miles: "A1", allowance: "A2", running: "I2", capex: "T1" };
  var MILEAGE_ROUTE_TEXT = "MILEAGE ALLOWANCE";
  var VEHICLE_COMPARISON_CELL = "J1";
  var VEHICLE_ROUTE_CELL = "C1";

  var FIXED_ASSETS_SHEET = "Fixed Assets";
  var FIXED_ASSET_CELLS = {
    firstAssetCost: "D47",
    aia: "I1",
    wda: "J1",
    writtenDownValue: "K1",
    disposals: "P1",
    balancingCharge: "Q1",
  };

  // The Draft Tax calculation sheet's own cells, named once so the snapshot
  // and the tax view read the same ones. The Additional band carries no
  // ceiling of its own.
  var COMPUTATION_CELLS = {
    profit: "E5",
    allowance: "E6",
    taxable: "E7",
    bands: [
      { label: "Basic rate", rate: "D8", ceiling: "C9", tax: "E8" },
      { label: "Higher rate", rate: "D9", ceiling: "C10", tax: "E9" },
      { label: "Additional rate", rate: "D10", ceiling: null, tax: "E10" },
    ],
    incomeTax: "E11",
    class4: ["E14", "E15"],
    total: "E17",
    paymentsOnAccount: ["E25", "E26"],
  };

  var QUARTERLY_SECTION = "Quarterly Summary";
  var FORECAST_SECTION = "Wages Forecast";
  var FORECAST_MONTHS_TRADED_CELL = "C19";
  var FORECAST_PROFIT_CELL = "C30";
  var FORECAST_LIABILITY_CELL = "C41";
  // The P&L's own health-check block: a forecast month's profit against the
  // four weeks of drawings and the month's share of the year's tax. The
  // drawings are the customer's to enter and no cell of the book fills
  // them, so the snapshot carries four empty weeks for the view to offer.
  var HEALTH_CHECK_WEEKS = 4;

  var BUSINESS_DETAILS_SECTION = "Business Details";
  var ENTITY_PATH_PREFIX = "entityInformation.";
  // The two book fields the workbook has no cell for, so they are edited as
  // book fields with the hint saying why they carry no drift mark.
  var BOOK_ONLY_ENTITY_FIELDS = [
    ["Address", "organizationAddressLine"],
    ["Town", "organizationTown"],
  ];

  var ADMIN_SECTION = "Admin (Generator Injected)";
  // The Admin cells echo whichever app/data/<year>.toml the page fetched,
  // not a figure derived from the book's lines, so they never read as drift.
  var DRIFT_EXCLUDED_SECTIONS = {};
  DRIFT_EXCLUDED_SECTIONS[ADMIN_SECTION] = 1;
  // The four Admin cells whose CELL_MAP unit misdescribes how they print:
  // the mileage limits are miles, the mileage rates are pence.
  var ADMIN_FORMATS = { F21: "number", F22: "number", G21: "pence", G22: "pence" };
  var UNIT_FORMATS = { money: "currency", rate: "rate", count: "number" };

  // The chart a new Taxi book starts from: the two sales accounts the sheet
  // separates (fares on B5, anything else on B24) and one purchase account
  // per code the Taxi purchase map carries, worded as the example books
  // word them (examples/basic-taxi-driver/taxi/book.toml).
  var TAXI_NEW_BOOK_CHART = {
    sales: {
      4000: { accountMainDescription: "Fares income" },
      4001: { accountMainDescription: "Other business income" },
    },
    purchases: {
      5100: { accountMainDescription: "Fuel" },
      5200: { accountMainDescription: "Car hire" },
      5300: { accountMainDescription: "Repairs and maintenance" },
      5400: { accountMainDescription: "Road tax and insurance" },
      5500: { accountMainDescription: "Employee costs" },
      5600: { accountMainDescription: "Premises costs" },
      5700: { accountMainDescription: "General admin" },
      5800: { accountMainDescription: "Advertising" },
      5900: { accountMainDescription: "Legal and professional" },
      6000: { accountMainDescription: "Interest" },
      6100: { accountMainDescription: "Bank charges" },
      6200: { accountMainDescription: "Other expenses" },
      7000: { accountMainDescription: "Fixed assets" },
    },
  };

  // The view modules this manifest renders through, as products/<file>.js
  // each defining DiyaGlTaxi<Name>.
  var SIBLING_MODULES = { Takings: "taxi-takings", Views: "taxi-views", Forms: "taxi-forms" };

  // ============================== the sibling view modules ==============================

  var requested = {};

  // Renders while a sibling module is still on its way. taxi.html lists
  // every product script, so this is only ever seen on another product's
  // page, in the moment between the manifest arriving and its views
  // following it.
  var LOADING_HTML = '<p class="view-loading">Loading the Taxi views…</p>';
  var LOADING_MODULE = {
    renderMonthDetail: function () {
      return LOADING_HTML;
    },
    bind: function () {},
  };

  function module(name) {
    var loaded = global["DiyaGlTaxi" + name];
    if (loaded) return loaded;
    requestModule(name);
    return LOADING_MODULE;
  }

  function requestModule(name) {
    if (requested[name]) return;
    requested[name] = true;
    var script = global.document.createElement("script");
    script.src = "products/" + SIBLING_MODULES[name] + ".js";
    script.addEventListener("load", function () {
      global.DiyaGlBooksPage.helpers.render();
    });
    global.document.head.appendChild(script);
  }

  function viaModule(name, fn) {
    return function (snapshot, state, helpers) {
      var mod = module(name);
      return mod === LOADING_MODULE ? LOADING_HTML : mod[fn](snapshot, state, helpers);
    };
  }

  function bindViaModule(name, fn) {
    return function (root, state, helpers) {
      var mod = module(name);
      if (mod !== LOADING_MODULE) mod[fn](root, state, helpers);
    };
  }

  // ============================== CELL_MAP readers ==============================

  function plainLabel(label) {
    return String(label).replace(/\*\*/g, "");
  }

  function sectionRows(productMod, section) {
    return productMod.CELL_MAP.filter(function (row) {
      return row[4] === section;
    });
  }

  // The P&L sheet is whichever sheet CELL_MAP puts its annual section on.
  function plRows(productMod) {
    return sectionRows(productMod, PL_SECTION);
  }

  function plSheetOf(productMod) {
    return plRows(productMod)[0][0];
  }

  // The annual P&L cell one snapshot key is carried on.
  function plCellOf(key) {
    for (var cell in PL_KEYS) {
      if (PL_KEYS[cell].key === key) return cell;
    }
    return null;
  }

  function categories(productMod) {
    var rows = plRows(productMod);
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var cell = rows[i][1];
      var meta = PL_KEYS[cell];
      out.push({
        key: meta.key,
        label: meta.label || plainLabel(rows[i][2]),
        sheet: rows[i][0],
        cell: cell,
        computed: !!DERIVED[meta.key],
      });
      if (cell === LAST_CATEGORY_CELL) break;
    }
    return out;
  }

  // Of the categories, four have a cell of their own per month: the rows
  // the sheet fills a column at a time, which CELL_MAP names C5 to N24.
  function monthlyCell(monthLabel, productMod, categoryKey) {
    var row = MONTHLY_ROW[categoryKey];
    if (!row) return null;
    return [plSheetOf(productMod), MONTH_COL[monthLabel] + row];
  }

  // ============================== the Sales tab grid ==============================
  // The Taxi Sales tabs hold whole Monday-to-Sunday weeks, and a week's tab
  // is the one named after the calendar month its ending Sunday falls in --
  // not a 6th-to-5th date range. The year's first week runs from 6 April to
  // the first Sunday and its last ends on 5 April, so both may be short.
  // taxi-books-manifest.test.js proves this walk identical to the engine's
  // own generateTaxYearWeeks and groupWeeksIntoMonths, which is the layout
  // the workbook is written from.

  var DAY_MS = 86400000;

  // The Sales grid the current book's twelve tab months were built from:
  // every day of the tax year mapped to its tab, and every week in the
  // order the sheets lay them out. months.build sets it before any line is
  // placed, which is the only order data.js calls them in.
  var GRID = null;

  function isoOf(value) {
    if (!value) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  }

  function utcOf(iso) {
    var parts = iso.split("-");
    return Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function isoAt(ms) {
    return new Date(ms).toISOString().slice(0, 10);
  }

  function taxYearWeeks(startYear) {
    var end = Date.UTC(startYear + 1, 3, 5);
    var weeks = [];
    var day = Date.UTC(startYear, 3, 6);
    var week = [];
    while (day <= end) {
      week.push(isoAt(day));
      if (new Date(day).getUTCDay() === 0) {
        weeks.push(week);
        week = [];
      }
      day += DAY_MS;
    }
    if (week.length) weeks.push(week);
    return weeks;
  }

  // The twelve tab months in the order the workbook names them, each with
  // the weeks whose last day is a Sunday of that calendar month. Whatever
  // is left when February closes belongs to SalesMar, so a final part-week
  // ending 5 April lands there.
  function buildTabMonths(book) {
    var startYear = Number(isoOf(book.documentInfo.periodCoveredStart).slice(0, 4));
    var weeks = taxYearWeeks(startYear);
    var months = [];
    var grid = { startYear: startYear, dayMonth: {}, weeks: [] };
    var weekIndex = 0;

    for (var i = 0; i < MONTH_LABELS.length; i++) {
      var label = MONTH_LABELS[i];
      var monthNumber = ((i + 3) % 12) + 1;
      var key = (monthNumber >= 4 ? startYear : startYear + 1) + "-" + String(monthNumber).padStart(2, "0");
      var monthWeeks = [];
      var isLastTab = i === MONTH_LABELS.length - 1;
      while (weekIndex < weeks.length) {
        var candidate = weeks[weekIndex];
        var lastDay = new Date(utcOf(candidate[candidate.length - 1]));
        if (!isLastTab && (lastDay.getUTCDay() !== 0 || lastDay.getUTCMonth() + 1 !== monthNumber)) break;
        monthWeeks.push(candidate);
        weekIndex++;
      }
      var month = {
        key: key,
        label: label,
        sheet: "Sales" + label,
        start: monthWeeks.length ? monthWeeks[0][0] : null,
        end: monthWeeks.length ? monthWeeks[monthWeeks.length - 1].slice(-1)[0] : null,
        caption: null,
      };
      // "from Mon 28 Apr": the tab opens in the calendar month before the
      // one it is named for, because its first week's Sunday falls in this
      // one. Without it a reader takes the month row for the calendar month.
      if (month.start && Number(month.start.slice(5, 7)) !== monthNumber) month.caption = "from " + dayLabel(month.start);
      months.push(month);

      for (var w = 0; w < monthWeeks.length; w++) {
        var days = monthWeeks[w];
        grid.weeks.push({ index: grid.weeks.length, monthKey: key, start: days[0], end: days[days.length - 1], days: days });
        for (var d = 0; d < days.length; d++) grid.dayMonth[days[d]] = key;
      }
    }

    GRID = grid;
    return months;
  }

  // Where a line's month row is: a sales line by the tab its date's week
  // ends in, a purchase line by the plain calendar month name, which is the
  // Purchases sheet cellWrites puts it on -- so a purchase dated 3 April
  // 2026 is still PurchasesApr, at the far start of the year. A sales date
  // the grid has no row for belongs to no month; the takings view lists it
  // and the book check names it.
  function tabMonthKeyOf(line) {
    if (!GRID) throw new Error("months.keyOf was called before months.build");
    if (line.sourceJournalID === "sales") return GRID.dayMonth[line.postingDate] || null;
    var monthNumber = new Date(utcOf(line.postingDate)).getUTCMonth() + 1;
    return (monthNumber >= 4 ? GRID.startYear : GRID.startYear + 1) + "-" + String(monthNumber).padStart(2, "0");
  }

  function dayLabel(iso) {
    var date = new Date(utcOf(iso));
    return DAY_NAMES[date.getUTCDay()] + " " + date.getUTCDate() + " " + MONTH_LABELS[(date.getUTCMonth() + 9) % 12];
  }

  // ============================== the month rows ==============================

  function classify(line, book, ctx) {
    var code = String(line.accountMainID);
    if (line.sourceJournalID === "sales") {
      if (code === TAKINGS_ACCOUNT) return { journal: "sales", key: "sales" };
      if (code === OTHER_INCOME_ACCOUNT) return { journal: "sales", key: "otherIncome" };
      return { journal: "sales", key: null };
    }
    if (line.sourceJournalID === "purchases") {
      var letter = ctx.engine.TAXI_PURCHASE_CODE_MAP[code];
      return { journal: "purchases", key: letter ? LETTER_KEYS[letter] || null : null };
    }
    return { journal: null, key: null };
  }

  function num(value) {
    return typeof value === "number" ? value : 0;
  }

  // The four figures the sheet fills a month at a time are read off the
  // sheet's own cells rather than re-added from the lines: on the mileage
  // route the month's vehicle cost is that month's share of the claim, not
  // what the driver spent, and the year table has to show what the workbook
  // shows. The vehicle and expense lines keep their own aggregation, which
  // is the spend, and the comparison panel is where the two are set side by
  // side.
  function derive(row, monthKey, ctx) {
    var pl = ctx.results[plSheetOf(ctx.productMod)] || {};
    var col = MONTH_COL[labelOfMonthKey(monthKey)];
    row.directCosts = 0;
    row.sales = num(pl[col + MONTHLY_ROW.sales]);
    row.costOfSales = num(pl[col + MONTHLY_ROW.costOfSales]);
    row.totalExpenses = num(pl[col + MONTHLY_ROW.totalExpenses]);
    row.otherIncome = num(pl[col + MONTHLY_ROW.otherIncome]);
    row.grossProfit = row.sales - row.costOfSales;
    // Other income stays below the line, exactly where B24 sits.
    row.netProfit = row.grossProfit - row.totalExpenses;
    // Both are year figures the sheet claims once, never a month's share;
    // the year table hides both columns and the total row reads annual.
    row.capitalAllowances = 0;
    row.mileageAllowance = 0;
    return row;
  }

  // "2025-05" is the May tab, which is MONTH_LABELS' second entry: the tabs
  // run April first, so a calendar month number is nine months on.
  function labelOfMonthKey(monthKey) {
    return MONTH_LABELS[(Number(monthKey.slice(5, 7)) + 8) % 12];
  }

  // ============================== the takings grain ==============================

  function fareOf(line, addressable) {
    return {
      entryNumber: line.entryNumber,
      account: String(line.accountMainID),
      amount: line.amount,
      detail: line.detailComment || "",
      miles: line.measurableUnitOfMeasure === "miles" && typeof line.measurableQuantity === "number" ? line.measurableQuantity : 0,
      other: String(line.accountMainID) === OTHER_INCOME_ACCOUNT,
      addressable: addressable,
    };
  }

  function emptyDay(date) {
    return { date: date, dow: DAY_NAMES[new Date(utcOf(date)).getUTCDay()], lines: [], takings: 0, miles: 0, other: 0, names: [] };
  }

  function emptyWeek(week, sheet) {
    return {
      index: week.index,
      start: week.start,
      end: week.end,
      sheet: sheet,
      daysTraded: 0,
      takings: 0,
      rental: 0,
      otherIncome: 0,
      miles: 0,
      total: 0,
      days: week.days.map(emptyDay),
      rentalLines: [],
      otherIncomeLines: [],
    };
  }

  // The edit functions name a line by its entryNumber, so a line sharing
  // one with another cannot be changed on its own; the takings view renders
  // those as figures rather than fields, the same rule the shared entries
  // grid follows.
  function addressableEntryNumbers(lines) {
    var seen = {};
    for (var i = 0; i < lines.length; i++) seen[lines[i].entryNumber] = (seen[lines[i].entryNumber] || 0) + 1;
    return seen;
  }

  // Every sales line grouped the way the workbook lays it out: a week per
  // Sales-sheet block, a row per calendar day, plus the week's own rental
  // and other-income rows. The two captions are matched exactly as
  // cellWrites matches them, so what the view shows is what the sheet will
  // carry.
  function groupTakings(lines, months) {
    var byMonth = {};
    var monthOf = {};
    months.forEach(function (month) {
      monthOf[month.key] = month;
      byMonth[month.key] = {
        key: month.key,
        label: month.label,
        sheet: month.sheet,
        start: month.start,
        end: month.end,
        caption: month.caption,
        miles: 0,
        daysTraded: 0,
        takings: 0,
        rental: 0,
        otherIncome: 0,
        weeks: [],
      };
    });

    var weekOfDay = {};
    GRID.weeks.forEach(function (week) {
      var month = byMonth[week.monthKey];
      if (!month) return;
      var built = emptyWeek(week, monthOf[week.monthKey].sheet);
      month.weeks.push(built);
      week.days.forEach(function (date) {
        weekOfDay[date] = built;
      });
    });

    var counts = addressableEntryNumbers(lines);
    var offGrid = [];
    var carriesMiles = false;

    lines.forEach(function (line) {
      if (line.sourceJournalID !== "sales") return;
      var code = String(line.accountMainID);
      if (code !== TAKINGS_ACCOUNT && code !== OTHER_INCOME_ACCOUNT) return;
      var week = weekOfDay[line.postingDate];
      if (!week) {
        offGrid.push({
          entryNumber: line.entryNumber,
          postingDate: line.postingDate,
          amount: line.amount,
          detail: line.detailComment || "",
        });
        return;
      }
      var fare = fareOf(line, !!line.entryNumber && counts[line.entryNumber] === 1);
      if (fare.miles > 0) carriesMiles = true;
      var caption = fare.detail.trim();
      if (code === TAKINGS_ACCOUNT && caption === RENTAL_CAPTION) {
        week.rentalLines.push(fare);
        week.rental += fare.amount;
        return;
      }
      if (code === OTHER_INCOME_ACCOUNT && caption === OTHER_INCOME_CAPTION) {
        week.otherIncomeLines.push(fare);
        week.otherIncome += fare.amount;
        return;
      }
      var day = week.days.filter(function (d) {
        return d.date === line.postingDate;
      })[0];
      day.lines.push(fare);
      if (fare.other) day.other += fare.amount;
      else {
        day.takings += fare.amount;
        day.miles += fare.miles;
      }
      if (caption && day.names.indexOf(caption) === -1) day.names.push(caption);
    });

    Object.keys(byMonth).forEach(function (key) {
      var month = byMonth[key];
      month.weeks.forEach(function (week) {
        week.days.forEach(function (day) {
          // A fare day with no miles of its own leaves the year's claim
          // short, but only a book that records miles somewhere is one
          // where a day without them is an omission rather than a choice.
          day.isMissingMiles = carriesMiles && day.takings > 0 && day.miles === 0;
          if (day.takings > 0 || day.other > 0) week.daysTraded++;
          week.takings += day.takings;
          week.miles += day.miles;
          week.otherIncome += day.other;
        });
        week.total = week.takings + week.rental + week.otherIncome;
        month.daysTraded += week.daysTraded;
        month.takings += week.takings;
        month.rental += week.rental;
        month.otherIncome += week.otherIncome;
        month.miles += week.miles;
      });
    });

    return { months: byMonth, offGrid: offGrid };
  }

  // ============================== the snapshot's product half ==============================

  function cellValue(results, sheet, cell) {
    return (results[sheet] && results[sheet][cell]) || 0;
  }

  function buildAnnual(ctx) {
    var sheet = plSheetOf(ctx.productMod);
    var annual = {};
    Object.keys(PL_KEYS).forEach(function (cell) {
      annual[PL_KEYS[cell].key] = cellValue(ctx.results, sheet, cell);
    });
    annual.capex = cellValue(ctx.results, PURCHASE_ANALYSIS_SHEET, VEHICLE_CELLS.capex);
    return annual;
  }

  // The mileage-against-actual-cost comparison the sheet makes for itself:
  // the miles driven, what they claim at the approved rate, what the
  // vehicle actually cost to run, and which of the two the P&L charged.
  function buildVehicle(ctx) {
    var routeText = (ctx.results[plSheetOf(ctx.productMod)] || {})[VEHICLE_ROUTE_CELL] || null;
    var route = routeText === MILEAGE_ROUTE_TEXT ? "mileage" : "actual";
    var read = function (cell) {
      return cellValue(ctx.results, PURCHASE_ANALYSIS_SHEET, cell);
    };
    var compared = cellValue(ctx.results, plSheetOf(ctx.productMod), VEHICLE_COMPARISON_CELL);
    var allowance = read(VEHICLE_CELLS.allowance);
    return {
      present: read(VEHICLE_CELLS.miles) > 0,
      miles: read(VEHICLE_CELLS.miles),
      allowance: allowance,
      running: read(VEHICLE_CELLS.running),
      compared: compared,
      charged: cellValue(ctx.results, plSheetOf(ctx.productMod), plCellOf("costOfSales")),
      route: route,
      routeText: routeText,
      // What taking the other route would have charged instead.
      forgone: route === "mileage" ? compared : allowance,
    };
  }

  // The vehicle register: what the book declares it owns, each asset's
  // writing-down allowance at the year's main rate (the schedule's own
  // block claims nothing else), and the capital purchases whose date and
  // amount no register entry matches -- a car bought and never registered
  // claims nothing.
  function buildRegister(ctx) {
    var wdaRate = (ctx.taxData && ctx.taxData.capital_allowances && ctx.taxData.capital_allowances.writing_down_allowance) || 0;
    var assets = (ctx.book.fixedAssets || []).map(function (asset) {
      var wda = (asset.cost || 0) * wdaRate;
      return {
        assetID: asset.assetID || "",
        description: asset.description || "",
        cost: asset.cost || 0,
        acquiredDate: isoOf(asset.acquiredDate),
        wda: wda,
        writtenDown: (asset.cost || 0) - wda,
      };
    });
    var unregistered = ctx.lines
      .filter(function (line) {
        if (classify(line, ctx.book, ctx).key !== "capex") return false;
        return !assets.some(function (asset) {
          return asset.acquiredDate === line.postingDate && asset.cost === line.amount;
        });
      })
      .map(function (line) {
        return { entryNumber: line.entryNumber, postingDate: line.postingDate, amount: line.amount, detail: line.detailComment || "" };
      });
    var totals = { capex: cellValue(ctx.results, PURCHASE_ANALYSIS_SHEET, VEHICLE_CELLS.capex) };
    Object.keys(FIXED_ASSET_CELLS).forEach(function (field) {
      totals[field] = cellValue(ctx.results, FIXED_ASSETS_SHEET, FIXED_ASSET_CELLS[field]);
    });
    return { assets: assets, unregistered: unregistered, totals: totals, cells: FIXED_ASSET_CELLS };
  }

  // 31 January and 31 July of the year after the period ends, which is what
  // the sheet's own two payment cells read out of Admin.
  function paymentDueDates(periodEnd) {
    var year = Number(isoOf(periodEnd).slice(0, 4)) + 1;
    return [year + "-01-31", year + "-07-31"];
  }

  function buildComputation(ctx) {
    var sheet = ctx.productMod.TAX_SHEET;
    var read = function (cell) {
      return cellValue(ctx.results, sheet, cell);
    };
    var due = paymentDueDates(ctx.book.documentInfo.periodCoveredEnd);
    return {
      sheet: sheet,
      cells: COMPUTATION_CELLS,
      profit: read(COMPUTATION_CELLS.profit),
      allowance: read(COMPUTATION_CELLS.allowance),
      taxable: read(COMPUTATION_CELLS.taxable),
      bands: COMPUTATION_CELLS.bands.map(function (band) {
        return {
          label: band.label,
          rate: read(band.rate),
          ceiling: band.ceiling ? read(band.ceiling) || null : null,
          tax: read(band.tax),
          cells: band,
        };
      }),
      incomeTax: read(COMPUTATION_CELLS.incomeTax),
      class4: COMPUTATION_CELLS.class4.map(read),
      total: read(COMPUTATION_CELLS.total),
      paymentsOnAccount: COMPUTATION_CELLS.paymentsOnAccount.map(function (cell, i) {
        return { cell: cell, amount: read(cell), due: due[i] };
      }),
      class2: buildClass2(read(COMPUTATION_CELLS.profit), ctx),
    };
  }

  // Class 2 is the flat weekly charge the sheet never prints. Below the
  // small profits threshold nothing is due, but a year's contributions can
  // be paid voluntarily to keep the state pension record; above it the
  // record is credited without payment. A tax year that declares no
  // threshold gives no figures at all, and the view leaves the line out
  // rather than printing a zero that means "not computed".
  function buildClass2(profit, ctx) {
    var expected = ctx.engine.calculateExpectedTax(profit, ctx.taxData);
    if (expected.ni_class2_threshold === undefined) return { amount: undefined, weekly: undefined, threshold: undefined, voluntary: false };
    return {
      amount: expected.ni_class2,
      weekly: expected.ni_class2_weekly,
      threshold: expected.ni_class2_threshold,
      voluntary: expected.ni_class2 > 0,
    };
  }

  // The quarterly sheet as it prints: one row per figure, one column per
  // quarter with the year beside them. CELL_MAP's own section order is the
  // sheet's, so the rows fall out of it by cell row number.
  function buildQuarterly(ctx) {
    var rows = [];
    var byRow = {};
    sectionRows(ctx.productMod, QUARTERLY_SECTION).forEach(function (row) {
      var rowNumber = row[1].replace(/[^0-9]/g, "");
      if (!byRow[rowNumber]) {
        byRow[rowNumber] = { label: quarterlyRowLabel(row[2]), cells: [] };
        rows.push(byRow[rowNumber]);
      }
      byRow[rowNumber].cells.push({ sheet: row[0], cell: row[1], value: cellValue(ctx.results, row[0], row[1]) });
    });
    return { rows: rows };
  }

  // "Q1 Turnover" and "**Annual Turnover**" are the same row's cells, so
  // the row takes the figure's own name without the quarter in front.
  function quarterlyRowLabel(label) {
    return plainLabel(label).replace(/^(Q[1-4]|Annual)\s+/, "");
  }

  function buildForecast(ctx) {
    var rows = sectionRows(ctx.productMod, FORECAST_SECTION).map(function (row) {
      return { sheet: row[0], cell: row[1], label: plainLabel(row[2]), value: cellValue(ctx.results, row[0], row[1]), unit: row[6] };
    });
    return { rows: rows, monthsTraded: cellValue(ctx.results, ctx.productMod.FORECAST_SHEET, FORECAST_MONTHS_TRADED_CELL) };
  }

  function buildHealthCheck(ctx) {
    var sheet = ctx.productMod.FORECAST_SHEET;
    var drawings = [];
    for (var i = 0; i < HEALTH_CHECK_WEEKS; i++) drawings.push(null);
    return {
      forecastProfit: cellValue(ctx.results, sheet, FORECAST_PROFIT_CELL),
      liabilityTwelfth: cellValue(ctx.results, sheet, FORECAST_LIABILITY_CELL) / 12,
      drawings: drawings,
    };
  }

  function buildAdmin(ctx) {
    return {
      year: (ctx.taxData.tax_year && ctx.taxData.tax_year.label) || ctx.taxYearName,
      rates: sectionRows(ctx.productMod, ADMIN_SECTION).map(function (row) {
        return {
          sheet: row[0],
          cell: row[1],
          label: plainLabel(row[2]),
          value: cellValue(ctx.results, row[0], row[1]),
          format: ADMIN_FORMATS[row[1]] || UNIT_FORMATS[row[6]] || "currency",
        };
      }),
    };
  }

  function snapshot(ctx) {
    return {
      annual: buildAnnual(ctx),
      takings: groupTakings(ctx.lines, ctx.months),
      vehicle: buildVehicle(ctx),
      register: buildRegister(ctx),
      computation: buildComputation(ctx),
      quarterly: buildQuarterly(ctx),
      forecast: buildForecast(ctx),
      healthCheck: buildHealthCheck(ctx),
      admin: buildAdmin(ctx),
    };
  }

  // ============================== business details and admin ==============================

  function renderBusinessDetails(snap, state, helpers) {
    var bd = snap.businessDetails;
    var entity = snap.book.entityInformation || {};
    var entityFields = helpers
      .sectionRows(BUSINESS_DETAILS_SECTION, function (row) {
        return row.path.indexOf(ENTITY_PATH_PREFIX) === 0;
      })
      .map(function (row) {
        var bookField = row.path.slice(ENTITY_PATH_PREFIX.length);
        return helpers.field(row.label, bookField, entity[bookField] || "", { rKeyAttr: helpers.rkFor(row.sheet, row.cell) });
      })
      .join("");
    var bookOnlyFields = BOOK_ONLY_ENTITY_FIELDS.map(function (pair) {
      return helpers.field(pair[0], pair[1], bd[pair[1]], { hint: "kept in the book; the workbook has no cell for it" });
    }).join("");
    return (
      "<h2>Business Details</h2>" +
      '<div class="panel-card panel-form-width">' +
      entityFields +
      bookOnlyFields +
      helpers.field("Period start", "periodCoveredStart", bd.periodCoveredStart, { type: "date" }) +
      helpers.field("Year end", "periodCoveredEnd", bd.periodCoveredEnd, {
        type: "date",
        hint: "Changing this loads that year's tax rates and runs every check again.",
      }) +
      helpers.readOnlyField("Basis of accounting", bd.basisOfAccounting) +
      helpers.readOnlyField("VAT registered", bd.vatRegistered ? "Yes" : "No") +
      "</div>"
    );
  }

  function bindBusinessDetails(root, state, helpers) {
    helpers.bindBookFields(root);
  }

  function renderAdmin(snap, state, helpers) {
    var rows = snap.admin.rates.map(function (r) {
      var text =
        r.format === "rate"
          ? helpers.fmtRate(r.value)
          : r.format === "pence"
            ? helpers.fmtPence(r.value)
            : r.format === "number"
              ? r.value.toLocaleString("en-GB")
              : helpers.fmtMoney(r.value);
      return { label: r.label, text: text, rKeyAttr: helpers.rkFor(r.sheet, r.cell) };
    });
    return (
      "<h2>Admin</h2>" +
      '<p class="view-lede rate-provenance">Rates for the ' +
      helpers.esc(snap.admin.year) +
      " tax year, read-only.</p>" +
      '<div class="panel-card">' +
      helpers.kvRows(rows) +
      "</div>"
    );
  }

  // ============================== new book and upload ==============================

  function buildNewBook(values, ctx) {
    var name = values.businessName;
    return {
      documentInfo: {
        entriesType: "journal",
        language: "en",
        periodCoveredStart: ctx.period.start,
        periodCoveredEnd: ctx.period.end,
        defaultCurrency: "GBP",
        entriesComment: "New book for " + name,
      },
      entityInformation: {
        "organizationIdentifier": name,
        "diya-gl:product": SCHEMA_NAME,
        "diya-gl:vatRegistered": false,
        "diya-gl:basisOfAccounting": "cash",
      },
      accounts: JSON.parse(JSON.stringify(TAXI_NEW_BOOK_CHART)),
      fixedAssets: [],
    };
  }

  // The Admin sheet's own period start: the 6 April the workbook was
  // generated for. A workbook that carries it is authoritative about which
  // tax year it is; without it the lines are all there is to go on.
  var ADMIN_PERIOD_START_CELL = { sheet: "Admin", cell: "B4" };
  var EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

  function periodFromAdminSerial(serial) {
    if (typeof serial !== "number") return null;
    var start = isoAt(EXCEL_EPOCH_MS + serial * DAY_MS);
    var year = Number(start.slice(0, 4));
    if (start !== year + "-04-06") return null;
    return { start: start, end: year + 1 + "-04-05" };
  }

  // The register block the schedule prints, five slots deep: the date, the
  // description, the reference and the cost of each vehicle the workbook
  // declares.
  var REGISTER_BLOCK = { sheet: "Fixed Assets", firstRow: 47, lastRow: 51 };

  async function readRegister(cells) {
    var assets = [];
    for (var row = REGISTER_BLOCK.firstRow; row <= REGISTER_BLOCK.lastRow; row++) {
      var cost = await cells.readCell(REGISTER_BLOCK.sheet, "D" + row);
      if (typeof cost !== "number" || cost === 0) continue;
      var serial = await cells.readCell(REGISTER_BLOCK.sheet, "A" + row);
      var description = await cells.readCell(REGISTER_BLOCK.sheet, "B" + row);
      assets.push({
        assetID: "FA-" + (assets.length + 1),
        description: description === undefined || description === "" ? "Vehicle" : String(description),
        cost: cost,
        acquiredDate: typeof serial === "number" ? isoAt(EXCEL_EPOCH_MS + serial * DAY_MS) : null,
      });
    }
    return assets;
  }

  // A book built from the same cells CELL_MAP names: the four entity fields
  // on the Business Details sheet, plus the register block and the Admin
  // period the calculator needs and no CELL_MAP row carries as a book path.
  async function bookFromWorkbook(cells, lines, ctx) {
    var entity = { "diya-gl:product": SCHEMA_NAME, "diya-gl:vatRegistered": false };
    var rows = ctx.productMod.CELL_MAP;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row[4] !== BUSINESS_DETAILS_SECTION || row[3].indexOf(ENTITY_PATH_PREFIX) !== 0) continue;
      var text = await cells.readCell(row[0], row[1]);
      if (text !== undefined && text !== "") entity[row[3].slice(ENTITY_PATH_PREFIX.length)] = String(text);
    }
    var adminStart = await cells.readCell(ADMIN_PERIOD_START_CELL.sheet, ADMIN_PERIOD_START_CELL.cell);
    var period = periodFromAdminSerial(adminStart) || ctx.period;
    return {
      documentInfo: {
        entriesType: "journal",
        language: "en",
        periodCoveredStart: period.start,
        periodCoveredEnd: period.end,
        defaultCurrency: "GBP",
        entriesComment: "Uploaded from " + ctx.fileName,
      },
      entityInformation: entity,
      accounts: ctx.accounts,
      fixedAssets: await readRegister(cells),
    };
  }

  global.DiyaGlProducts.taxi = {
    id: "taxi",
    schemaName: SCHEMA_NAME,
    title: "Taxi Driver",
    page: "taxi.html",
    stylesheet: "taxi.css",
    multiFile: false,
    emptyState: {
      intro: "Open a Taxi Driver workbook as editable books in your browser. Nothing is uploaded; the file never leaves your machine.",
    },
    // The example books arrive with taxi.html; the bundle carries no Taxi
    // fixture yet, so the empty state offers a file and a new book only.
    examples: [],
    views: [
      { id: "home", label: "Home", sheets: "Home", shared: "home" },
      { id: "year", label: "Year", sheets: "SalesApr–Mar, PurchasesApr–Mar", shared: "year" },
      { id: "profit-loss", label: "P&L", sheets: plSheetOf, render: viaModule("Views", "renderProfitLoss") },
      { id: "fixed-assets", label: "Vehicles", sheets: FIXED_ASSETS_SHEET, render: viaModule("Views", "renderVehicles") },
      { id: "tax-computation", label: "Tax", sheets: "Draft Tax calculation", render: viaModule("Views", "renderComputation") },
      { id: "sa103s", label: "SA103S", sheets: "SE Short", render: viaModule("Forms", "renderSa103s") },
      { id: "quarterly", label: "Quarterly", sheets: "VitalTax", render: viaModule("Views", "renderQuarterly") },
      { id: "forecast", label: "Forecast", sheets: "Wages Forecast", render: viaModule("Views", "renderForecast") },
      {
        id: "business-details",
        label: "Business Details",
        sheets: "Business Details",
        render: renderBusinessDetails,
        bind: bindBusinessDetails,
      },
      { id: "admin", label: "Admin", sheets: "Admin", render: renderAdmin },
    ],
    months: {
      // The takings journal leaves the shared entries grid: its lines are a
      // week and a day deep, which the month detail below renders.
      journals: [
        { id: "sales", label: "Takings", entriesGrid: false },
        { id: "purchases", label: "Purchases" },
      ],
      build: buildTabMonths,
      keyOf: tabMonthKeyOf,
      categories: categories,
      classify: classify,
      derive: derive,
    },
    yearTable: {
      defaultColumns: ["sales", "otherIncome", "costOfSales", "totalExpenses", "netProfit"],
      alwaysHidden: ["capitalAllowances", "mileageAllowance", "grossProfit"],
      composite: [],
      monthlyCell: monthlyCell,
      summary: [
        ["Takings", "sales", true],
        ["Other income", "otherIncome"],
        ["Vehicle costs", "costOfSales"],
        ["Running costs", "totalExpenses"],
        ["Profit", "netProfit"],
      ],
      sticky: [
        ["Takings", "sales"],
        ["Profit", "netProfit"],
      ],
      card: {
        headline: "netProfit",
        figures: [
          ["Takings", "sales", true],
          ["Vehicle costs", "costOfSales"],
          ["Running costs", "totalExpenses"],
        ],
      },
      monthDetail: function (monthKey, state, helpers) {
        return module("Takings").renderMonthDetail(monthKey, state, helpers);
      },
      bindMonthDetail: bindViaModule("Takings", "bind"),
    },
    // The two inputs the takings view carries that the shared grid does not,
    // so the caret returns to the field an edit was made in.
    focusFieldAttr: { miles: "data-miles-entry", detail: "data-detail-entry" },
    snapshot: snapshot,
    newBook: {
      fields: [
        { id: "new-book-name", name: "businessName", label: "Business name", type: "text", required: "Enter a business name." },
        { id: "new-book-year-end", name: "yearEnd", label: "Year end (5 April)", type: "date", required: "Enter a real year-end date." },
      ],
      build: buildNewBook,
      label: function (values) {
        return values.businessName;
      },
    },
    upload: {
      validate: function (engine, xlsxBytes) {
        return engine.validateTaxiAnchors(xlsxBytes);
      },
      extract: function (engine, xlsxBytes) {
        return engine.extractTaxiTransactions(xlsxBytes);
      },
      bookFromWorkbook: bookFromWorkbook,
    },
    bookFields: { documentInfo: ["periodCoveredStart", "periodCoveredEnd"] },
    drift: { units: { money: 1, rate: 1, count: 1 }, excludedSections: DRIFT_EXCLUDED_SECTIONS },
    save: { singleFile: true, workbookName: "taxi-excel.xlsx" },
    internals: {
      taxYearWeeks: taxYearWeeks,
      buildTabMonths: buildTabMonths,
      tabMonthKeyOf: tabMonthKeyOf,
      groupTakings: groupTakings,
      classify: classify,
      derive: derive,
      dayLabel: dayLabel,
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
