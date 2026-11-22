// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-register-book.test.js — the book of a company's next period from
// the register's data: the roll forward of the last filed set, the new book
// where there is none, the people and the members the register names, the
// differences the builder reports, the refusals, and the fields that never
// reach the output.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { buildBookFromRegister, RegisterBookError } from "../lib/diya-gl-register-book.js";
import * as engine from "../lib/diya-gl-engine.js";
import { mapIxbrlAccounts } from "../lib/ixbrl-accounts.js";
import { isTwelveWholeMonths } from "../lib/product-workbook.js";
import { validateBook, validateLines } from "../lib/diya-gl-schema.js";
import { engineClosure } from "../../diya-gl/scripts/engine-closure.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const fixture = (name) => readFileSync(resolve(HERE, "fixtures", "ixbrl", name));

const diyaAccounts = () => mapIxbrlAccounts(fixture("diya-2025-accounts.xhtml"), { companyNumber: "06846849", periodEnd: "2025-03-31" });
const stadiumAccounts = () => mapIxbrlAccounts(fixture("builder-micro.xhtml"), { companyNumber: "03176906", periodEnd: "2025-12-31" });

const diyaProfile = (extra = {}) => ({
  companyNumber: "06846849",
  companyName: "DIY ACCOUNTING LIMITED",
  dateOfCreation: "2009-03-13",
  registeredOffice: { addressLine1: "1 Test Street", addressLine2: "Test Quarter", cityOrTown: "Testtown", postalCode: "TT1 2AB" },
  accountsNextPeriodStart: "2025-04-01",
  accountsNextPeriodEnd: "2026-03-31",
  accountsLastPeriodEnd: "2025-03-31",
  ...extra,
});

const stadiumProfile = (extra = {}) => ({
  companyNumber: "03176906",
  companyName: "MILLENNIUM STADIUM PLC",
  dateOfCreation: "1996-03-20",
  accountsNextPeriodStart: "2026-01-01",
  accountsNextPeriodEnd: "2026-12-31",
  accountsLastPeriodEnd: "2025-12-31",
  ...extra,
});

const officer = (name, officerRole, extra = {}) => ({ name, officerRole, appointedOn: "2010-01-04", ...extra });

const capitalOf = (shares, extra = {}) => ({
  shareCurrency: "GBP",
  totalAggregateNominalValue: String(shares.reduce((sum, share) => sum + Number(share.aggregateNominalValue), 0)),
  shares,
  ...extra,
});

const holding = (shareClass, numberHeld, forename, surname) => ({
  shareClass,
  numberHeld: String(numberHeld),
  shareholders: [{ forename, surname }],
});

const codes = (result) => result.differences.map((difference) => difference.code);
const lineFor = (lines, account) => lines.find((line) => line.accountMainID === account);

async function rejection(input) {
  try {
    await buildBookFromRegister(input);
  } catch (error) {
    return error;
  }
  throw new Error("the builder did not refuse");
}

describe("the roll forward of the last filed accounts", () => {
  it("opens the next period on the filed closing balance sheet", async () => {
    const result = await buildBookFromRegister({ profile: diyaProfile(), lastAccounts: diyaAccounts() });
    expect(result.book.documentInfo).toMatchObject({ periodCoveredStart: "2025-04-01", periodCoveredEnd: "2026-03-31" });
    expect(lineFor(result.lines, "1200")).toMatchObject({ debitCreditCode: "D", amount: 3353, postingDate: "2025-04-01" });
    expect(lineFor(result.lines, "2100")).toMatchObject({ debitCreditCode: "C", amount: 3219, postingDate: "2025-04-01" });
    expect(lineFor(result.lines, "3100")).toMatchObject({ debitCreditCode: "C", amount: 134 });
    expect(validateBook(result.book).valid).toBe(true);
    expect(validateLines(result.lines, result.book).valid).toBe(true);
  });

  it("puts the company and its registered office where the package prints them", async () => {
    const { book } = await buildBookFromRegister({ profile: diyaProfile(), lastAccounts: diyaAccounts() });
    expect(book.entityInformation).toMatchObject({
      "organizationIdentifier": "DIY ACCOUNTING LIMITED",
      "diya-gl:companyNumber": "06846849",
      "organizationAddressLine": "1 Test Street, Test Quarter",
      "organizationTown": "Testtown",
      "organizationPostcode": "TT1 2AB",
    });
    expect(book.entityInformation.organizationDescription).toBe("Retailer of Accounting Software");
  });

  it("opens called up share capital on account 3000 at the filed figure", async () => {
    const result = await buildBookFromRegister({ profile: stadiumProfile(), lastAccounts: stadiumAccounts() });
    expect(lineFor(result.lines, "3000")).toMatchObject({ debitCreditCode: "C", amount: 100 });
  });

  it("reports each place the filed set and the book part", async () => {
    const result = await buildBookFromRegister({ profile: stadiumProfile(), lastAccounts: stadiumAccounts() });
    const filed = result.differences.filter((difference) => difference.code === "filed-accounts");
    expect(filed.every((difference) => typeof difference.text === "string" && difference.text.length > 0)).toBe(true);
  });
});

describe("the people", () => {
  it("keeps the directors of the filed set when the register gives no officers", async () => {
    const { book } = await buildBookFromRegister({ profile: diyaProfile(), lastAccounts: diyaAccounts() });
    expect(book.directors.map((director) => director.name)).toEqual([
      "Antony Christopher Cartwright",
      "Samantha Ashley Cartwright",
      "Jane Elizabeth Grundy",
    ]);
    expect(book.entityInformation["diya-gl:companiesHouseName"]).toBe("Antony Christopher Cartwright");
  });

  it("writes each current director and secretary, with the first director as the Companies House name", async () => {
    const officers = [
      officer("TESTER, Alex Jordan", "secretary"),
      officer("TESTER, Alex Jordan", "director", { appointedOn: "2011-02-03" }),
      officer("ACME HOLDINGS, LTD", "corporate-director"),
      officer("PRIOR, Pat", "director", { resignedOn: "2025-02-01" }),
      officer("LEAVER, Lee", "director", { resignedOn: "2025-09-30" }),
    ];
    const { book, differences } = await buildBookFromRegister({ profile: diyaProfile(), officers, lastAccounts: diyaAccounts() });
    expect(book.directors).toEqual([
      { name: "Alex Jordan TESTER", role: "Company Secretary", appointed: "2010-01-04" },
      { name: "Alex Jordan TESTER", role: "Director", appointed: "2011-02-03" },
      { name: "ACME HOLDINGS, LTD", role: "Director", appointed: "2010-01-04" },
      { name: "Lee LEAVER", role: "Director", appointed: "2010-01-04", resigned: "2025-09-30" },
    ]);
    expect(book.entityInformation["diya-gl:companiesHouseName"]).toBe("Alex Jordan TESTER");
    expect(book.entityInformation["diya-gl:companiesHouseName"]).not.toBe(book.entityInformation.organizationIdentifier);
    expect(differences.map((difference) => difference.code)).not.toContain("officers-left-out");
  });

  it("leaves out an officer of a role the book does not hold and every officer past the seventh", async () => {
    const officers = [
      ...Array.from({ length: 8 }, (_, index) => officer(`SURNAME${index}, Forename`, "director")),
      officer("MEMBER, Limited", "llp-member"),
    ];
    const { book, differences } = await buildBookFromRegister({ profile: diyaProfile(), officers, lastAccounts: diyaAccounts() });
    expect(book.directors).toHaveLength(7);
    const left = differences.find((difference) => difference.code === "officers-left-out");
    expect(left.text).toContain("Forename SURNAME7");
    expect(left.text).toContain("Limited MEMBER");
  });

  it("sums the shares of a director who is also a member", async () => {
    const officers = [officer("MEMBER, Jo Q", "director")];
    const capital = capitalOf([{ shareClass: "ORDINARY", numShares: "100", aggregateNominalValue: "100" }]);
    const shareholdings = [holding("ORDINARY", 60, "Jo Q", "Member"), holding("ORDINARY", 40, "Sam", "Other")];
    const { book } = await buildBookFromRegister({
      profile: stadiumProfile(),
      officers,
      capital,
      shareholdings,
      capitalDate: "2026-01-20",
      lastAccounts: stadiumAccounts(),
    });
    expect(book.directors[0].shares).toBe(60);
  });
});

describe("the members", () => {
  const profile = stadiumProfile();
  const oneClass = capitalOf([{ shareClass: "ORDINARY", numShares: "100", aggregateNominalValue: "100" }]);

  it("writes a full register: members, the date they are stated as at, and no difference when the capital agrees", async () => {
    const shareholdings = [
      holding("ORDINARY", 70, "Jo", "Member"),
      {
        shareClass: "ORDINARY",
        numberHeld: "30",
        shareholders: [
          { forename: "Ann", surname: "One" },
          { forename: "Bo", surname: "Two" },
        ],
      },
    ];
    const result = await buildBookFromRegister({
      profile,
      capital: oneClass,
      shareholdings,
      capitalDate: "2026-01-20",
      lastAccounts: stadiumAccounts(),
    });
    expect(result.book.members).toEqual([
      { memberID: "M1", name: "Jo Member", shares: 70, nominalValue: 1 },
      { memberID: "M2", name: "Ann One and Bo Two", shares: 30, nominalValue: 1 },
    ]);
    expect(codes(result)).toContain("shareholders-date");
    expect(result.differences.find((difference) => difference.code === "shareholders-date").text).toContain("2026-01-20");
    expect(codes(result)).not.toContain("capital");
    expect(codes(result)).not.toContain("no-members");
    expect(validateBook(result.book).valid).toBe(true);
  });

  it("names a company holder by its one name field", async () => {
    const shareholdings = [{ shareClass: "ORDINARY", numberHeld: "100", shareholders: [{ amalgamatedName: "HOLDER COMPANY LIMITED" }] }];
    const { book } = await buildBookFromRegister({
      profile,
      capital: oneClass,
      shareholdings,
      capitalDate: "2026-01-20",
      lastAccounts: stadiumAccounts(),
    });
    expect(book.members[0].name).toBe("HOLDER COMPANY LIMITED");
  });

  it("states no members and says so when no shareholdings arrive", async () => {
    const result = await buildBookFromRegister({
      profile,
      officers: [officer("TESTER, Alex", "director")],
      lastAccounts: stadiumAccounts(),
    });
    expect(result.book.members).toBeUndefined();
    expect(codes(result)).toEqual(expect.arrayContaining(["no-members", "filed-accounts"]));
    expect(codes(result)).not.toContain("shareholders-date");
  });

  it("reports the capital when the statement of capital and the filed accounts differ by more than 50p", async () => {
    const capital = capitalOf([{ shareClass: "ORDINARY", numShares: "150", aggregateNominalValue: "150" }]);
    const result = await buildBookFromRegister({
      profile,
      capital,
      shareholdings: [holding("ORDINARY", 150, "Jo", "Member")],
      capitalDate: "2026-01-20",
      lastAccounts: stadiumAccounts(),
    });
    const text = result.differences.find((difference) => difference.code === "capital").text;
    expect(text).toContain("100.00");
    expect(text).toContain("150.00");
    expect(lineFor(result.lines, "3000").amount).toBe(100);
  });

  it("accepts a capital within 50p of the filed figure", async () => {
    const capital = capitalOf([{ shareClass: "ORDINARY", numShares: "100", aggregateNominalValue: "100.4" }]);
    const result = await buildBookFromRegister({ profile, capital, lastAccounts: stadiumAccounts() });
    expect(codes(result)).not.toContain("capital");
  });

  it("carries no members for a statement of capital in another currency", async () => {
    const capital = capitalOf([{ shareClass: "ORDINARY", numShares: "100", aggregateNominalValue: "100" }], { shareCurrency: "EUR" });
    const result = await buildBookFromRegister({
      profile,
      capital,
      shareholdings: [holding("ORDINARY", 100, "Jo", "Member")],
      lastAccounts: stadiumAccounts(),
    });
    expect(result.book.members).toBeUndefined();
    expect(codes(result)).toContain("capital-currency");
  });

  it("carries no members for shareholdings that come without a statement of capital", async () => {
    const result = await buildBookFromRegister({
      profile,
      shareholdings: [holding("ORDINARY", 100, "Jo", "Member")],
      lastAccounts: stadiumAccounts(),
    });
    expect(result.book.members).toBeUndefined();
    expect(codes(result)).toContain("no-members");
  });

  it("reports holdings that do not add up to the class", async () => {
    const result = await buildBookFromRegister({
      profile,
      capital: oneClass,
      shareholdings: [holding("ORDINARY", 90, "Jo", "Member")],
      capitalDate: "2026-01-20",
      lastAccounts: stadiumAccounts(),
    });
    expect(result.differences.find((difference) => difference.code === "shareholdings-total").text).toContain("90");
  });

  it("leaves out a fractional holding with its class, holder and number", async () => {
    const shareholdings = [holding("ORDINARY", "99.5", "Jo", "Member"), holding("ORDINARY", 100, "Sam", "Other")];
    const result = await buildBookFromRegister({
      profile,
      capital: oneClass,
      shareholdings,
      capitalDate: "2026-01-20",
      lastAccounts: stadiumAccounts(),
    });
    expect(result.book.members.map((member) => member.name)).toEqual(["Sam Other"]);
    const left = result.differences.find((difference) => difference.code === "holding-left-out").text;
    expect(left).toContain("ORDINARY");
    expect(left).toContain("Jo Member");
    expect(left).toContain("99.5");
  });

  it("holds seventeen members and leaves out the rest", async () => {
    const shareholdings = Array.from({ length: 18 }, (_, index) => holding("ORDINARY", 1, `Holder${index}`, "Test"));
    const capital = capitalOf([{ shareClass: "ORDINARY", numShares: "18", aggregateNominalValue: "18" }]);
    const result = await buildBookFromRegister({
      profile,
      capital,
      shareholdings,
      capitalDate: "2026-01-20",
      lastAccounts: stadiumAccounts(),
    });
    expect(result.book.members).toHaveLength(17);
    expect(result.book.members[16].memberID).toBe("M17");
    expect(result.differences.filter((difference) => difference.code === "holding-left-out")).toHaveLength(1);
  });

  describe("two share classes", () => {
    it("carries every holding when the classes share a nominal value", async () => {
      const capital = capitalOf([
        { shareClass: "ORDINARY", numShares: "60", aggregateNominalValue: "60" },
        { shareClass: "ORDINARY B", numShares: "40", aggregateNominalValue: "40" },
      ]);
      const shareholdings = [holding("ORDINARY", 60, "Jo", "Member"), holding("ORDINARY B", 40, "Sam", "Other")];
      const result = await buildBookFromRegister({
        profile,
        capital,
        shareholdings,
        capitalDate: "2026-01-20",
        lastAccounts: stadiumAccounts(),
      });
      expect(result.book.members.map((member) => [member.name, member.nominalValue])).toEqual([
        ["Jo Member", 1],
        ["Sam Other", 1],
      ]);
      expect(codes(result)).toContain("share-classes");
      expect(codes(result)).not.toContain("holding-left-out");
    });

    it("carries the class of the largest total nominal value when the nominal values differ", async () => {
      const capital = capitalOf([
        { shareClass: "ORDINARY", numShares: "90", aggregateNominalValue: "90" },
        { shareClass: "PREFERENCE", numShares: "10", aggregateNominalValue: "50" },
      ]);
      const shareholdings = [holding("ORDINARY", 90, "Jo", "Member"), holding("PREFERENCE", 10, "Sam", "Other")];
      const result = await buildBookFromRegister({
        profile,
        capital,
        shareholdings,
        capitalDate: "2026-01-20",
        lastAccounts: stadiumAccounts(),
      });
      expect(result.book.members).toEqual([{ memberID: "M1", name: "Jo Member", shares: 90, nominalValue: 1 }]);
      expect(codes(result)).toContain("share-classes");
      const left = result.differences.find((difference) => difference.code === "holding-left-out").text;
      expect(left).toContain("PREFERENCE");
      expect(left).toContain("Sam Other");
    });
  });
});

describe("a book with no filed figures", () => {
  it("is an empty book for the next period, with the company and people, when the last set is a PDF", async () => {
    const officers = [officer("TESTER, Alex", "director")];
    const result = await buildBookFromRegister({ profile: diyaProfile(), officers });
    expect(result.lines).toEqual([]);
    expect(result.book.documentInfo).toMatchObject({ periodCoveredStart: "2025-04-01", periodCoveredEnd: "2026-03-31" });
    expect(result.book.entityInformation.organizationIdentifier).toBe("DIY ACCOUNTING LIMITED");
    expect(result.book.directors).toEqual([{ name: "Alex TESTER", role: "Director", appointed: "2010-01-04" }]);
    const none = result.differences.find((difference) => difference.code === "no-figures");
    expect(none.text).toContain("2025-03-31");
    expect(codes(result)).not.toContain("first-period");
    expect(validateBook(result.book).valid).toBe(true);
  });

  it("starts at incorporation for a company with no accounts yet, and names the share capital issued", async () => {
    const profile = {
      companyNumber: "15000001",
      companyName: "NEW TEST LIMITED",
      dateOfCreation: "2026-03-10",
      accountsNextPeriodStart: "2026-03-10",
      accountsNextPeriodEnd: "2027-03-31",
    };
    const capital = capitalOf([{ shareClass: "ORDINARY", numShares: "1000", aggregateNominalValue: "1000" }]);
    const result = await buildBookFromRegister({ profile, capital });
    expect(result.lines).toEqual([]);
    expect(result.book.documentInfo).toMatchObject({ periodCoveredStart: "2026-03-10", periodCoveredEnd: "2027-03-31" });
    expect(codes(result)).toEqual(expect.arrayContaining(["first-period", "period"]));
    expect(result.differences.find((difference) => difference.code === "first-period").text).toContain("1,000.00");
  });

  it("starts at the date of incorporation when the register gives no next period start", async () => {
    const profile = {
      companyNumber: "15000002",
      companyName: "NEW TEST TWO LIMITED",
      dateOfCreation: "2026-04-01",
      accountsNextPeriodEnd: "2027-03-31",
    };
    const result = await buildBookFromRegister({ profile });
    expect(result.book.documentInfo.periodCoveredStart).toBe("2026-04-01");
    expect(codes(result)).toContain("first-period");
    expect(codes(result)).not.toContain("period");
  });
});

describe("a period that is not twelve whole months", () => {
  it("states the register's period and reports it", async () => {
    const profile = diyaProfile({ accountsNextPeriodEnd: "2025-12-31" });
    const result = await buildBookFromRegister({ profile, lastAccounts: diyaAccounts() });
    expect(result.book.documentInfo).toMatchObject({ periodCoveredStart: "2025-04-01", periodCoveredEnd: "2025-12-31" });
    expect(codes(result)).toContain("period");
    expect(validateBook(result.book).valid).toBe(true);
  });

  it("builds a new book, and reports the periods between, when the chosen year end is later than the register's", async () => {
    const result = await buildBookFromRegister({ profile: diyaProfile(), lastAccounts: diyaAccounts(), periodEnd: "2027-03-31" });
    expect(result.lines).toEqual([]);
    expect(result.book.documentInfo).toMatchObject({ periodCoveredStart: "2025-04-01", periodCoveredEnd: "2027-03-31" });
    expect(codes(result)).toEqual(expect.arrayContaining(["periods-between", "period"]));
  });

  it("rolls forward when the chosen year end is the register's own", async () => {
    const result = await buildBookFromRegister({ profile: diyaProfile(), lastAccounts: diyaAccounts(), periodEnd: "2026-03-31" });
    expect(result.lines.length).toBeGreaterThan(0);
    expect(codes(result)).not.toContain("periods-between");
  });
});

describe("isTwelveWholeMonths", () => {
  it.each([
    ["2025-04-01", "2026-03-31", true],
    ["2024-03-01", "2025-02-28", true],
    ["2023-03-01", "2024-02-29", true],
    ["2025-04-01", "2025-12-31", false],
    ["2025-04-02", "2026-04-01", false],
    ["2025-04-01", "2026-04-01", false],
  ])("%s to %s is %s", (start, end, expected) => {
    expect(isTwelveWholeMonths(start, end)).toBe(expected);
  });
});

describe("the refusals", () => {
  it.each([
    ["no profile", {}, "profile"],
    ["no company number", { profile: { companyName: "X" } }, "profile"],
    ["a malformed company number", { profile: diyaProfile({ companyNumber: "12345" }) }, "profile"],
    ["no company name", { profile: diyaProfile({ companyName: "" }) }, "profile"],
    ["no period end", { profile: diyaProfile({ accountsNextPeriodEnd: undefined }) }, "period"],
    ["no period start", { profile: { companyNumber: "06846849", companyName: "X", accountsNextPeriodEnd: "2026-03-31" } }, "period"],
    ["a start after the end", { profile: diyaProfile({ accountsNextPeriodStart: "2026-04-01" }) }, "period"],
    ["a period end before the register's", { profile: diyaProfile(), periodEnd: "2025-12-31" }, "periodEnd"],
  ])("refuses %s, naming %s", async (_name, input, field) => {
    const error = await rejection(input);
    expect(error).toBeInstanceOf(RegisterBookError);
    expect(error.field).toBe(field);
    expect(error.message.length).toBeGreaterThan(0);
  });

  it("refuses accounts filed for another company", async () => {
    const error = await rejection({ profile: stadiumProfile(), lastAccounts: diyaAccounts() });
    expect(error).toMatchObject({ name: "RegisterBookError", field: "lastAccounts" });
  });

  it("refuses accounts that do not end the day before the period starts", async () => {
    const error = await rejection({ profile: diyaProfile({ accountsNextPeriodStart: "2025-05-01" }), lastAccounts: diyaAccounts() });
    expect(error).toMatchObject({ name: "RegisterBookError", field: "lastAccounts" });
  });

  it("refuses a period whose year has no rate data, naming the year end", async () => {
    const profile = diyaProfile({
      accountsNextPeriodStart: "2090-04-01",
      accountsNextPeriodEnd: "2091-03-31",
      accountsLastPeriodEnd: undefined,
    });
    const error = await rejection({ profile });
    expect(error).toMatchObject({ name: "RegisterBookError", field: "taxYear" });
    expect(error.message).toContain("2091-03-31");
  });
});

describe("a Scottish or Northern Ireland company number", () => {
  it("passes the book schema, and an eight digit number still does", async () => {
    const { book } = await buildBookFromRegister({ profile: diyaProfile({ companyNumber: "SC123456" }) });
    expect(book.entityInformation["diya-gl:companyNumber"]).toBe("SC123456");
    expect(validateBook(book).valid).toBe(true);
    for (const number of ["06846849", "NI123456", ""]) {
      expect(
        validateBook({ ...book, entityInformation: { ...book.entityInformation, "diya-gl:companyNumber": number } }).valid,
        number,
      ).toBe(true);
    }
    for (const number of ["SC12345", "sc123456", "S1234567", "0684684"]) {
      expect(
        validateBook({ ...book, entityInformation: { ...book.entityInformation, "diya-gl:companyNumber": number } }).valid,
        number,
      ).toBe(false);
    }
  });
});

describe("what never reaches the output", () => {
  it("copies no date of birth, nationality, occupation, residence or address of a person", async () => {
    const secrets = [
      "1971-03-04",
      "Utopian",
      "Wizard-for-hire",
      "Narnia",
      "7 Hidden Lane",
      "ID-SECRET-99",
      "9 Service Row",
      "3 Shareholder Walk",
    ];
    const officers = [
      {
        ...officer("TESTER, Alex", "director"),
        dateOfBirth: { month: 3, year: 1971 },
        dob: "1971-03-04",
        nationality: "Utopian",
        occupation: "Wizard-for-hire",
        countryOfResidence: "Narnia",
        address: { addressLine1: "7 Hidden Lane", postalCode: "HH1 1HH" },
        serviceAddress: { addressLine1: "9 Service Row" },
        identification: { number: "ID-SECRET-99" },
      },
    ];
    const capital = capitalOf([{ shareClass: "ORDINARY", numShares: "100", aggregateNominalValue: "100" }]);
    const shareholdings = [
      {
        ...holding("ORDINARY", 100, "Alex", "Tester"),
        shareholders: [{ forename: "Alex", surname: "Tester", address: { addressLine1: "3 Shareholder Walk" }, nationality: "Utopian" }],
      },
    ];
    const profile = stadiumProfile({ serviceAddress: "9 Service Row", sicCodes: ["99999"], companyStatus: "active" });
    const result = await buildBookFromRegister({
      profile,
      officers,
      capital,
      shareholdings,
      capitalDate: "2026-01-20",
      lastAccounts: stadiumAccounts(),
    });
    const everything = JSON.stringify(result);
    for (const secret of secrets) expect(everything, secret).not.toContain(secret);
    expect(result.book.directors[0]).toEqual({ name: "Alex TESTER", role: "Director", appointed: "2010-01-04", shares: 100 });
    expect(Object.keys(result.book.members[0]).sort()).toEqual(["memberID", "name", "nominalValue", "shares"]);
  });
});

describe("where the function is published", () => {
  it("is part of the engine surface the page bundle is built from", () => {
    expect(engine.buildBookFromRegister).toBe(buildBookFromRegister);
    expect(engine.RegisterBookError).toBe(RegisterBookError);
    expect(engine.isTwelveWholeMonths).toBe(isTwelveWholeMonths);
  });

  it("is in the file set the published package copies into dist", () => {
    const closure = engineClosure(ROOT);
    expect(closure).toContain("app/lib/diya-gl-register-book.js");
  });
});
