// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// What the download page and the DIYA-GL books page share when they look a company up: the two
// public Submit routes, the period dates of the lookup, the fields the book builder reads from
// the register answer, and the address of the DIYA-GL page that starts a book for a company.
// One source: the DIYA-GL bundle build copies this file onto diya-gl.co.uk. Neither page calls
// Companies House; both call DIY Accounting Submit's public routes.

var COMPANY_DEADLINES_URL = "https://submit.diyaccounting.co.uk/api/v1/public/company-deadlines";
var COMPANY_MIN_QUERY_LENGTH = 2;
var COMPANY_MAX_COMPUTED_PERIODS = 3;
var ACCOUNTS_DUE_MONTHS_AFTER_PERIOD_END = 9;
var COMPANY_MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value + "T00:00:00Z"));
}

function formatIsoDate(iso) {
  var parts = iso.split("-");
  return Number(parts[2]) + " " + COMPANY_MONTH_NAMES[Number(parts[1]) - 1] + " " + parts[0];
}

function daysInMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

// Adds whole months. A date at the end of its month stays at the end of the target month;
// any other day is kept, or cut back to the last day when the target month is shorter.
function addMonthsIso(iso, months) {
  var parts = iso.split("-").map(Number);
  var total = parts[0] * 12 + (parts[1] - 1) + months;
  var year = Math.floor(total / 12);
  var monthIndex = total - year * 12;
  var wasMonthEnd = parts[2] === daysInMonth(parts[0], parts[1] - 1);
  var day = wasMonthEnd ? daysInMonth(year, monthIndex) : Math.min(parts[2], daysInMonth(year, monthIndex));
  return year + "-" + String(monthIndex + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
}

function dayAfterIso(iso) {
  var next = new Date(Date.parse(iso + "T00:00:00Z") + 24 * 60 * 60 * 1000);
  return next.toISOString().slice(0, 10);
}

// The periods with no accounts filed, earliest first. The first is the period Companies House
// states. Each later one is the twelve months that follow, marked computed, and is listed while
// the period before it has already ended. A missing date is left out: nothing is worked out
// from it.
function unfiledPeriods(answer, todayIso) {
  if (!answer || !isIsoDate(answer.accountsNextPeriodEnd)) return [];
  var periods = [
    {
      start: isIsoDate(answer.accountsNextPeriodStart) ? answer.accountsNextPeriodStart : null,
      end: answer.accountsNextPeriodEnd,
      due: isIsoDate(answer.accountsNextDue) ? answer.accountsNextDue : null,
      overdue: answer.accountsOverdue === true,
      computed: false,
    },
  ];
  var previousEnd = answer.accountsNextPeriodEnd;
  while (previousEnd < todayIso && periods.length <= COMPANY_MAX_COMPUTED_PERIODS) {
    var end = addMonthsIso(previousEnd, 12);
    periods.push({
      start: dayAfterIso(previousEnd),
      end: end,
      due: addMonthsIso(end, ACCOUNTS_DUE_MONTHS_AFTER_PERIOD_END),
      overdue: false,
      computed: true,
    });
    previousEnd = end;
  }
  return periods;
}

function periodWords(period) {
  var span = period.start ? formatIsoDate(period.start) + " to " + formatIsoDate(period.end) : "Period ending " + formatIsoDate(period.end);
  var due = period.due ? ", accounts due " + formatIsoDate(period.due) : "";
  return span + due;
}

function CompanyLookupError(status) {
  this.status = status;
}

function fetchCompanyDeadlines(parameter, value) {
  return fetch(COMPANY_DEADLINES_URL + "?" + parameter + "=" + encodeURIComponent(value)).then(
    function (response) {
      if (!response.ok) throw new CompanyLookupError(response.status);
      return response.json().catch(function () {
        throw new CompanyLookupError(502);
      });
    },
    function () {
      throw new CompanyLookupError(0);
    },
  );
}

var COMPANY_REGISTER_URL = "https://submit.diyaccounting.co.uk/api/v1/public/company-register";
function RegisterCallError(status) {
  this.status = status;
}

function fetchCompanyRegister(companyNumber) {
  return fetch(COMPANY_REGISTER_URL + "?number=" + encodeURIComponent(companyNumber)).then(
    function (response) {
      if (!response.ok) throw new RegisterCallError(response.status);
      return response.json().catch(function () {
        throw new RegisterCallError(502);
      });
    },
    function () {
      throw new RegisterCallError(0);
    },
  );
}

// The profile fields the builder reads, one at a time.
function profileForBook(profile) {
  var office = profile.registeredOffice || {};
  return {
    companyNumber: profile.companyNumber,
    companyName: profile.companyName,
    dateOfCreation: profile.dateOfCreation,
    registeredOffice: {
      addressLine1: office.addressLine1,
      addressLine2: office.addressLine2,
      addressLine3: office.addressLine3,
      cityOrTown: office.cityOrTown,
      postalCode: office.postalCode,
    },
    accountsNextPeriodStart: profile.accountsNextPeriodStart,
    accountsNextPeriodEnd: profile.accountsNextPeriodEnd,
    accountsLastPeriodEnd: profile.accountsLastPeriodEnd,
  };
}

// An officer's name, role and appointment date.
function officersForBook(officers) {
  return (officers || []).map(function (officer) {
    return { name: officer.name, officerRole: officer.officerRole, appointedOn: officer.appointedOn };
  });
}

// True when the last filed set starts on the day the company was incorporated.
function isFirstAccounts(profile) {
  return Boolean(profile.dateOfCreation) && profile.accountsLastPeriodStart === profile.dateOfCreation;
}

// The book the register answer builds for a year end, with the engine already loaded. Maps the
// last filed accounts when they are iXBRL; a set that cannot be read is named in `unreadable`
// and the builder gets no figures. Resolves to { result, lastAccounts, filed, unreadable }.
function buildBookFromRegisterAnswer(engine, answer, yearEnd, resources) {
  return Promise.resolve().then(function () {
    var profile = profileForBook(answer.profile);
    var filed = answer.filedAccounts || { status: "none" };
    var lastAccounts;
    var unreadable;
    if (filed.status === "ixbrl") {
      try {
        lastAccounts = engine.mapIxbrlAccounts(filed.ixbrl, {
          companyNumber: profile.companyNumber,
          periodEnd: profile.accountsLastPeriodEnd,
          regime: "any",
          firstAccounts: isFirstAccounts(answer.profile),
        });
      } catch (error) {
        if (!(error instanceof engine.IxbrlError)) throw error;
        unreadable = error.message;
      }
    }
    return engine
      .buildBookFromRegister(
        { profile: profile, officers: officersForBook(answer.officers), lastAccounts: lastAccounts, periodEnd: yearEnd },
        { resources: resources },
      )
      .then(function (result) {
        return { result: result, lastAccounts: lastAccounts, filed: filed, unreadable: unreadable };
      });
  });
}

// The DIYA-GL site that matches the site the page is on: the ci spreadsheets site links to the ci
// DIYA-GL site, every other host to the production one.
function diyaGlBaseUrlFor(hostname) {
  return /^ci-/.test(hostname || "") ? "https://ci.diya-gl.co.uk" : "https://diya-gl.co.uk";
}

// The address on the DIYA-GL Ltd page that looks the company up and, with a year end, opens its
// book for that period.
function newBookFromCompanyLink(hostname, companyNumber, yearEnd) {
  var query = "?company=" + encodeURIComponent(companyNumber);
  if (yearEnd) query += "&yearEnd=" + encodeURIComponent(yearEnd);
  return diyaGlBaseUrlFor(hostname) + "/ltd.html" + query;
}

// The company number and the optional year end a link carries, or null when it names no company.
function companyFromLinkParams(params) {
  var number = (params.get("company") || "").trim().toUpperCase();
  if (!/^([0-9]{8}|[A-Z]{2}[0-9]{6})$/.test(number)) return null;
  var yearEnd = params.get("yearEnd");
  return { companyNumber: number, yearEnd: isIsoDate(yearEnd) ? yearEnd : null };
}
