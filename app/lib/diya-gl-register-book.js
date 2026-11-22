// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-register-book.js — the book of a company's next accounting period,
// built from what Companies House holds: the profile, the officers, the
// statement of capital with the shareholdings, and the last filed accounts.
//
// The inputs are plain data in the shapes of Submit's register routes. The
// function reads no file except through deps.resources and calls no network,
// so one copy serves Node and a browser bundle. Each field of the book is
// copied by name from the field map below; no input object is spread, so a
// date of birth, a nationality, an occupation, a residential address or a
// shareholder's address cannot reach the book, the lines or the differences.

import { buildIxbrlSummaryBooks } from "./ixbrl-summary-book.js";
import { rollForward } from "./diya-gl-roll-forward.js";
import { buildNewBook } from "./diya-gl-new-book.js";
import { loadTaxDataForBook, isTwelveWholeMonths } from "./product-workbook.js";
import { nodeResourceLoader } from "./app-resources.js";
import { validateBook, validateLines } from "./diya-gl-schema.js";
import { InvalidDiyaGlBookError } from "./diya-gl-interchange.js";

// The rows of the workbook's Directors&Secretary sheet and of its register of members.
const MAX_OFFICERS = 7;
const MAX_MEMBERS = 17;

// A capital difference under this many pounds is rounding in the filed figures.
const CAPITAL_TOLERANCE = 0.5;

const COMPANY_NUMBER = /^([0-9]{8}|[A-Z]{2}[0-9]{6})$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const DIRECTOR_ROLES = new Set(["director", "corporate-director"]);
const SECRETARY_ROLES = new Set(["secretary", "corporate-secretary"]);
const CORPORATE_ROLES = new Set(["corporate-director", "corporate-secretary"]);

/**
 * A refusal to build the book, naming the input at fault.
 */
export class RegisterBookError extends Error {
  /**
   * @param {"profile"|"period"|"periodEnd"|"lastAccounts"|"taxYear"} field
   * @param {string} message
   */
  constructor(field, message) {
    super(message);
    this.name = "RegisterBookError";
    this.field = field;
  }
}

const money = (value) => Math.round(value * 100) / 100;
const pounds = (value) => money(value).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const present = (value) => typeof value === "string" && value.trim() !== "";
const isDay = (value) => typeof value === "string" && ISO_DAY.test(value);

function addDays(day, days) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const sameNumber = (left, right) => {
  const plain = (value) =>
    String(value ?? "")
      .trim()
      .toUpperCase()
      .replace(/^0+(?=\d)/, "");
  return plain(left) === plain(right);
};

const sameName = (left, right) => left.toLowerCase().replace(/\s+/g, "") === right.toLowerCase().replace(/\s+/g, "");

// ============================================================================
// The period
// ============================================================================

function periodOf(profile, periodEnd) {
  const start =
    profile.accountsNextPeriodStart ||
    (profile.accountsLastPeriodEnd ? addDays(profile.accountsLastPeriodEnd, 1) : undefined) ||
    profile.dateOfCreation;
  const nextEnd = profile.accountsNextPeriodEnd;
  const end = periodEnd || nextEnd;
  if (!isDay(start)) throw new RegisterBookError("period", "The register gives no start for the next accounting period.");
  if (!isDay(end)) throw new RegisterBookError("period", "The register gives no end for the next accounting period.");
  if (periodEnd && !isDay(periodEnd)) throw new RegisterBookError("periodEnd", `The period end ${periodEnd} is not a YYYY-MM-DD date.`);
  if (periodEnd && isDay(nextEnd) && periodEnd < nextEnd) {
    throw new RegisterBookError("periodEnd", `The period end ${periodEnd} is before the register's next period end ${nextEnd}.`);
  }
  if (start > end) throw new RegisterBookError("period", `The period starts ${start}, after its end ${end}.`);
  return { start, end, nextEnd };
}

async function rateDataFor(period, resources) {
  const probe = {
    documentInfo: { periodCoveredStart: period.start, periodCoveredEnd: period.end },
    entityInformation: { "diya-gl:product": "Company" },
  };
  try {
    return await loadTaxDataForBook(probe, { resources });
  } catch (cause) {
    throw new RegisterBookError("taxYear", `diya-gl has no rate data for the year ending ${period.end} (${cause.message}).`);
  }
}

// ============================================================================
// The people
// ============================================================================

// "SURNAME, Forenames" becomes "Forenames SURNAME"; a company's name stays as filed.
function personName(name, role) {
  const text = String(name ?? "").trim();
  if (CORPORATE_ROLES.has(role)) return text;
  const comma = text.indexOf(",");
  if (comma < 0) return text;
  const surname = text.slice(0, comma).trim();
  const forenames = text.slice(comma + 1).trim();
  return forenames ? `${forenames} ${surname}` : surname;
}

function directorsOf(officers, periodStart, differences) {
  const held = [];
  const leftOut = [];
  for (const officer of officers) {
    const role = String(officer?.officerRole ?? "");
    const resigned = officer?.resignedOn;
    const named = personName(officer?.name, role);
    if (!DIRECTOR_ROLES.has(role) && !SECRETARY_ROLES.has(role)) {
      leftOut.push(`${named} (${role || "no role"}) holds a role the book does not carry`);
      continue;
    }
    if (resigned && resigned < periodStart) continue;
    if (held.length >= MAX_OFFICERS) {
      leftOut.push(`${named} (${role}) is past the ${MAX_OFFICERS} places of the officers sheet`);
      continue;
    }
    const entry = { name: named, role: DIRECTOR_ROLES.has(role) ? "Director" : "Company Secretary" };
    if (officer.appointedOn) entry.appointed = officer.appointedOn;
    if (resigned) entry.resigned = resigned;
    held.push(entry);
  }
  if (leftOut.length > 0) {
    differences.push({ code: "officers-left-out", text: `The book leaves out ${leftOut.length} officer(s): ${leftOut.join("; ")}.` });
  }
  return held;
}

// ============================================================================
// The members
// ============================================================================

const classKey = (name) =>
  String(name ?? "")
    .trim()
    .toLowerCase();

function holderName(holding) {
  const names = (holding.shareholders ?? [])
    .map((holder) =>
      present(holder?.amalgamatedName)
        ? holder.amalgamatedName.trim()
        : [holder?.forename, holder?.surname]
            .filter(present)
            .map((part) => part.trim())
            .join(" "),
    )
    .filter((name) => name !== "");
  return names.join(" and ");
}

function wholeNumber(value) {
  const text = String(value ?? "").trim();
  return /^\d+$/.test(text) ? Number(text) : undefined;
}

// The classes the statement of capital states, each with its nominal value per share.
function classesOf(capital) {
  return (capital.shares ?? []).map((share) => {
    const numShares = Number(share.numShares);
    const aggregate = Number(share.aggregateNominalValue);
    const valid = numShares > 0 && Number.isFinite(aggregate);
    return {
      key: classKey(share.shareClass),
      name: share.shareClass,
      numShares,
      aggregate,
      nominalValue: valid ? Math.round((aggregate / numShares) * 1e6) / 1e6 : undefined,
    };
  });
}

// One nominal value for every class: every holding. Different nominal values:
// the class with the largest total nominal value, because the book states
// one nominal value.
function carriedClassKeys(classes) {
  const priced = classes.filter((entry) => entry.nominalValue !== undefined);
  if (priced.length === 0) return new Set();
  if (priced.every((entry) => entry.nominalValue === priced[0].nominalValue)) return new Set(priced.map((entry) => entry.key));
  const largest = priced.reduce((best, entry) => (entry.aggregate > best.aggregate ? entry : best));
  return new Set([largest.key]);
}

function membersOf(capital, shareholdings, capitalDate, differences) {
  const classes = classesOf(capital);
  const carried = carriedClassKeys(classes);
  const byKey = new Map(classes.map((entry) => [entry.key, entry]));
  const leftOut = [];
  const members = [];
  const describe = (holding, name) =>
    `${holding.shareClass ?? "unnamed class"}, ${name || "no holder named"}, ${holding.numberHeld ?? "no"} shares`;

  for (const holding of shareholdings) {
    const name = holderName(holding);
    const entry = byKey.get(classKey(holding.shareClass));
    const shares = wholeNumber(holding.numberHeld);
    if (!entry || entry.nominalValue === undefined || !carried.has(entry.key)) {
      leftOut.push(`${describe(holding, name)}, in a class the book does not carry`);
    } else if (shares === undefined) {
      leftOut.push(`${describe(holding, name)}, not a whole number of shares`);
    } else if (name === "") {
      leftOut.push(`${describe(holding, name)}, with no holder`);
    } else if (members.length >= MAX_MEMBERS) {
      leftOut.push(`${describe(holding, name)}, past the ${MAX_MEMBERS} places of the register of members`);
    } else {
      members.push({ memberID: `M${members.length + 1}`, name, shares, nominalValue: entry.nominalValue });
    }
  }
  for (const text of leftOut) differences.push({ code: "holding-left-out", text: `The book leaves out a holding: ${text}.` });

  if (classes.length > 1 || new Set(shareholdings.map((holding) => classKey(holding.shareClass))).size > 1) {
    differences.push({
      code: "share-classes",
      text: `The company has ${Math.max(classes.length, 2)} share classes and the book states one nominal value, so it holds the members of ${
        carried.size === classes.length ? "every class" : "the class with the largest nominal value"
      }.`,
    });
  }
  for (const entry of classes) {
    const total = shareholdings
      .filter((holding) => classKey(holding.shareClass) === entry.key)
      .reduce((sum, holding) => sum + (wholeNumber(holding.numberHeld) ?? 0), 0);
    if (total !== entry.numShares) {
      differences.push({
        code: "shareholdings-total",
        text: `The holdings of the ${entry.name} shares add up to ${total} and the statement of capital gives ${entry.numShares}.`,
      });
    }
  }
  differences.push({
    code: "shareholders-date",
    text: `The members are stated as at ${capitalDate || "a date the register does not give"}; shares issued, bought back or transferred since are not in the book.`,
  });
  return members;
}

// ============================================================================
// The book
// ============================================================================

function checkProfile(profile) {
  if (!profile || typeof profile !== "object") throw new RegisterBookError("profile", "A company profile is required.");
  if (!present(profile.companyNumber)) throw new RegisterBookError("profile", "The profile has no company number.");
  if (!COMPANY_NUMBER.test(profile.companyNumber)) {
    throw new RegisterBookError(
      "profile",
      `The company number ${profile.companyNumber} is not eight digits or two letters and six digits.`,
    );
  }
  if (!present(profile.companyName)) throw new RegisterBookError("profile", "The profile has no company name.");
}

function checkLastAccounts(lastAccounts, profile, start) {
  if (!lastAccounts) return;
  if (!sameNumber(lastAccounts.company?.number, profile.companyNumber)) {
    throw new RegisterBookError(
      "lastAccounts",
      `The filed accounts are for company ${lastAccounts.company?.number}, not ${profile.companyNumber}.`,
    );
  }
  const expectedEnd = addDays(start, -1);
  if (lastAccounts.period?.end !== expectedEnd) {
    throw new RegisterBookError(
      "lastAccounts",
      `The filed accounts end ${lastAccounts.period?.end}; the next period starts ${start}, so they must end ${expectedEnd}.`,
    );
  }
}

function writeCompany(book, profile) {
  const entity = book.entityInformation;
  entity.organizationIdentifier = profile.companyName.trim();
  entity["diya-gl:companyNumber"] = profile.companyNumber;
  const office = profile.registeredOffice;
  if (office) {
    const line = [office.addressLine1, office.addressLine2, office.addressLine3]
      .filter(present)
      .map((part) => part.trim())
      .join(", ");
    if (line) entity.organizationAddressLine = line;
    if (present(office.cityOrTown)) entity.organizationTown = office.cityOrTown.trim();
    if (present(office.postalCode)) entity.organizationPostcode = office.postalCode.trim();
  }
}

function writePeople(book, directors, members) {
  if (directors) {
    if (directors.length > 0) book.directors = directors;
    else delete book.directors;
  }
  if (members.length > 0) {
    book.members = members;
    for (const director of book.directors ?? []) {
      const held = members.filter((member) => sameName(member.name, director.name));
      if (held.length > 0) director.shares = held.reduce((sum, member) => sum + member.shares, 0);
    }
  }
  const first = (book.directors ?? []).find((director) => director.role === "Director");
  if (first) book.entityInformation["diya-gl:companiesHouseName"] = first.name;
  else delete book.entityInformation["diya-gl:companiesHouseName"];
}

/**
 * The book of a company's next accounting period from the register's data.
 *
 * @param {Object} input
 * @param {Object} input.profile - the company profile: companyNumber, companyName, dateOfCreation, registeredOffice, accountsNextPeriodStart, accountsNextPeriodEnd, accountsLastPeriodEnd
 * @param {Object[]} [input.officers] - the officers: name, officerRole, appointedOn, resignedOn
 * @param {Object} [input.capital] - the statement of capital: shareCurrency, totalAggregateNominalValue, shares[]
 * @param {Object[]} [input.shareholdings] - the holdings: shareClass, numberHeld, shareholders[]
 * @param {string} [input.capitalDate] - the date the shareholdings are stated as at, YYYY-MM-DD
 * @param {Object} [input.lastAccounts] - mapIxbrlAccounts' result for the last filed set
 * @param {string} [input.periodEnd] - the year end the reader chose, on or after the register's next period end
 * @param {Object} [deps]
 * @param {Object} [deps.resources] - resource loader for the rate data; defaults to reading app/
 * @returns {Promise<{book: Object, lines: Array, differences: Array<{code: string, text: string}>}>}
 * @throws {RegisterBookError}
 */
export async function buildBookFromRegister(
  { profile, officers = [], capital, shareholdings, capitalDate, lastAccounts, periodEnd } = {},
  deps = {},
) {
  checkProfile(profile);
  const period = periodOf(profile, periodEnd);
  checkLastAccounts(lastAccounts, profile, period.start);
  const resources = deps.resources ?? nodeResourceLoader();
  const rateData = await rateDataFor(period, resources);
  const differences = [];

  let book;
  let lines;
  const rolls = Boolean(lastAccounts) && (!period.nextEnd || period.end === period.nextEnd);
  if (rolls) {
    const summary = await buildIxbrlSummaryBooks(lastAccounts, { resources });
    for (const text of summary.differences) differences.push({ code: "filed-accounts", text });
    ({ book, lines } = rollForward(summary.book, summary.lines, rateData));
    book.documentInfo.periodCoveredEnd = period.end;
  } else {
    book = buildNewBook({ product: "ltd", businessName: profile.companyName, yearEnd: period.end, vatRegistered: false }, rateData);
    book.documentInfo.periodCoveredStart = period.start;
    lines = [];
    if (lastAccounts) {
      differences.push({
        code: "periods-between",
        text: `The book ends ${period.end}, after the register's next period end ${period.nextEnd}. The periods between are not on the register, so type the opening balances.`,
      });
    } else if (profile.accountsLastPeriodEnd) {
      differences.push({
        code: "no-figures",
        text: `The register holds accounts to ${profile.accountsLastPeriodEnd} and no figures from them reached the builder. Type the opening balances from the filed accounts.`,
      });
    }
  }

  const gbp = !capital || capital.shareCurrency === undefined || capital.shareCurrency === "GBP";
  const issued = capital && gbp ? Number(capital.totalAggregateNominalValue) : undefined;
  if (!lastAccounts && !profile.accountsLastPeriodEnd) {
    const issuedText = Number.isFinite(issued)
      ? ` The statement of capital gives £${pounds(issued)} share capital issued; post it on the incorporation date.`
      : "";
    differences.push({ code: "first-period", text: `The company has filed no accounts, so the book starts empty.${issuedText}` });
  }
  if (!isTwelveWholeMonths(period.start, period.end)) {
    differences.push({
      code: "period",
      text: `The period runs ${period.start} to ${period.end}, which is not twelve whole months. The book file is available; the spreadsheet package is not.`,
    });
  }

  if (capital && !gbp) {
    differences.push({
      code: "capital-currency",
      text: `The statement of capital is in ${capital.shareCurrency}, not GBP, so the book carries no members.`,
    });
  }
  const filedCapital = lastAccounts?.balanceSheet?.currentYear?.calledUpShareCapital;
  if (Number.isFinite(issued) && Number.isFinite(filedCapital) && Math.abs(issued - filedCapital) > CAPITAL_TOLERANCE) {
    differences.push({
      code: "capital",
      text: `The filed accounts show £${pounds(filedCapital)} called up share capital and the statement of capital £${pounds(issued)}. The opening balance takes the filed figure; shares issued or bought back after the year end are a line in the new period.`,
    });
  }

  let members = [];
  const holdings = Array.isArray(shareholdings) ? shareholdings : [];
  if (holdings.length > 0 && capital && gbp) members = membersOf(capital, holdings, capitalDate, differences);
  else if (holdings.length > 0 && !capital) {
    differences.push({
      code: "no-members",
      text: "The shareholdings came without a statement of capital, so the book cannot state their nominal value and carries no members.",
    });
  } else if (holdings.length === 0) {
    differences.push({ code: "no-members", text: "No shareholdings reached the builder, so the book carries no members." });
  }

  const officerList = Array.isArray(officers) ? officers : [];
  const directors = officerList.length > 0 ? directorsOf(officerList, period.start, differences) : undefined;
  writeCompany(book, profile);
  writePeople(book, directors, members);

  const bookErrors = validateBook(book);
  const lineErrors = validateLines(lines, book);
  const errors = [...(bookErrors.valid ? [] : bookErrors.errors), ...(lineErrors.valid ? [] : lineErrors.errors)];
  if (errors.length > 0) throw new InvalidDiyaGlBookError(errors);
  return { book, lines, differences };
}
