// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// ixbrl-reader.test.js — the Inline XBRL reader, row by row: what it takes
// in, how it names a concept, how it turns a number or a date, which
// contexts and units it reads, and every file it refuses.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { sniffIxbrl, readIxbrl, IxbrlError } from "../lib/ixbrl-reader.js";
import { CORE, BUSINESS, IX_10, context, ixbrlDocument, money, words, xbrlInstance, STANDARD_CONTEXTS } from "./helpers/ixbrl-document.js";

const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures", "ixbrl");
const fixture = (name) => readFileSync(resolve(FIXTURES, name));

const factNamed = (read, localName, contextRef) =>
  read.facts.find((fact) => fact.localName === localName && (!contextRef || fact.contextRef === contextRef));
const valueOf = (text, attributes = "") =>
  readIxbrl(ixbrlDocument({ body: money("core:TurnoverRevenue", "CY", text, attributes) })).facts[0].value;

describe("what the reader takes in", () => {
  it("recognises an inline XBRL 1.1 document by its namespace, whatever the file is called", () => {
    expect(sniffIxbrl(new TextEncoder().encode(ixbrlDocument()))).toBe("ixbrl");
  });

  it("recognises an inline XBRL 1.0 document", () => {
    const bytes = new TextEncoder().encode(ixbrlDocument({ ix: IX_10 }));
    expect(sniffIxbrl(bytes)).toBe("ixbrl");
    expect(readIxbrl(bytes).kind).toBe("ixbrl");
  });

  it("recognises a plain XBRL instance by its xbrli:xbrl root", () => {
    expect(sniffIxbrl(new TextEncoder().encode(xbrlInstance("")))).toBe("xbrl");
  });

  it("recognises a document that starts with a byte order mark or blank lines", () => {
    const bytes = new TextEncoder().encode(`﻿\n\n${ixbrlDocument()}`);
    expect(sniffIxbrl(bytes)).toBe("ixbrl");
  });

  it("does not recognise JSON, a zip or plain XHTML", () => {
    expect(sniffIxbrl(new TextEncoder().encode('{"format":"diya-gl"}'))).toBeNull();
    expect(sniffIxbrl(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]))).toBeNull();
    expect(sniffIxbrl(new TextEncoder().encode("<html xmlns='http://www.w3.org/1999/xhtml'><body/></html>"))).toBeNull();
  });

  it("reads a plain XBRL instance as facts, with the instance's own contexts and units", () => {
    const read = readIxbrl(
      xbrlInstance(
        `<core:TurnoverRevenue contextRef="CY" unitRef="GBP" decimals="0">1200</core:TurnoverRevenue><uk-bus:EntityCurrentLegalOrRegisteredName contextRef="CY">Test Ltd</uk-bus:EntityCurrentLegalOrRegisteredName>`,
      ),
    );
    expect(read.kind).toBe("xbrl");
    const turnover = factNamed(read, "TurnoverRevenue");
    expect(turnover).toMatchObject({ namespace: CORE, value: 1200, unit: "GBP", decimals: 0 });
    expect(turnover.period).toEqual({ startDate: "2024-04-01", endDate: "2025-03-31" });
    expect(factNamed(read, "EntityCurrentLegalOrRegisteredName").value).toBe("Test Ltd");
  });

  it("refuses a file that is neither", () => {
    expect(() => readIxbrl("<html/>")).toThrow(IxbrlError);
    expect(() => readIxbrl("not xml at all")).toThrow(/not an Inline XBRL document/);
  });

  it("refuses a file that is not well-formed XML", () => {
    expect(() => readIxbrl(ixbrlDocument({ body: "<p>unclosed" }))).toThrow(/not well-formed XML/);
  });
});

describe("how a concept is named", () => {
  it("resolves the prefix to its namespace on each element, so uk-bus and bus are the same namespace", () => {
    const first = readIxbrl(ixbrlDocument({ body: words("uk-bus:EntityCurrentLegalOrRegisteredName", "CY", "A Ltd") }));
    const second = readIxbrl(
      ixbrlDocument({
        namespaces: `xmlns:bus="${BUSINESS}"`,
        body: words("bus:EntityCurrentLegalOrRegisteredName", "CY", "A Ltd"),
      }),
    );
    expect(first.facts[0].namespace).toBe(BUSINESS);
    expect(second.facts[0].namespace).toBe(BUSINESS);
    expect(first.facts[0].localName).toBe(second.facts[0].localName);
  });

  it("reads a prefix declared on the element itself", () => {
    const read = readIxbrl(
      ixbrlDocument({ body: `<ix:nonNumeric xmlns:filer="${BUSINESS}" name="filer:ReportTitle" contextRef="CY">Accounts</ix:nonNumeric>` }),
    );
    expect(read.facts[0]).toMatchObject({ namespace: BUSINESS, localName: "ReportTitle" });
  });

  it("refuses a name whose prefix is not declared", () => {
    expect(() => readIxbrl(ixbrlDocument({ body: words("nope:Thing", "CY", "x") }))).toThrow(/prefix is not declared/);
  });

  it("names the suite from the FRC namespaces and the entry point", () => {
    const read = readIxbrl(ixbrlDocument({ body: money("core:TurnoverRevenue", "CY", "1") + words("uk-bus:ReportTitle", "CY", "t") }));
    expect(read.suite.family).toBe("FRS-102");
    expect(read.suite.date).toBe("2024-01-01");
    expect(read.suite.modules).toEqual(expect.arrayContaining(["core", "business"]));
  });

  it("reads the suite date from the namespace when the file names no entry point", () => {
    const read = readIxbrl(ixbrlDocument({ schemaRef: "https://example.org/own.xsd", body: money("core:TurnoverRevenue", "CY", "1") }));
    expect(read.suite).toMatchObject({ family: null, date: "2024-01-01" });
  });
});

describe("ix:nonFraction", () => {
  it("multiplies by 10 to the scale", () => {
    expect(valueOf("7.639", 'scale="3"')).toBe(7639);
    expect(valueOf("1,234", 'scale="-2"')).toBe(12.34);
    expect(valueOf("5", 'scale="0"')).toBe(5);
  });

  it("negates a fact with sign=-", () => {
    expect(valueOf("2,482", 'sign="-"')).toBe(-2482);
  });

  it("applies scale and sign together", () => {
    expect(valueOf("1.5", 'scale="3" sign="-"')).toBe(-1500);
  });

  it("ignores brackets, which are display only", () => {
    expect(valueOf("(2,482)")).toBe(2482);
  });

  it("reads the text of the innermost nested nonFraction", () => {
    const body = `<ix:nonFraction name="core:TurnoverRevenue" contextRef="CY" unitRef="GBP" decimals="0"><span><ix:nonFraction name="core:Turnover" contextRef="CY" unitRef="GBP" decimals="0">310</ix:nonFraction></span></ix:nonFraction>`;
    const read = readIxbrl(ixbrlDocument({ body }));
    expect(factNamed(read, "TurnoverRevenue").value).toBe(310);
  });

  it("skips a nil fact", () => {
    const body = `<ix:nonFraction name="core:TurnoverRevenue" contextRef="CY" unitRef="GBP" xsi:nil="true" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>`;
    expect(readIxbrl(ixbrlDocument({ body })).facts).toEqual([]);
  });

  it("records decimals, including INF", () => {
    const read = readIxbrl(
      ixbrlDocument({
        body:
          money("core:TurnoverRevenue", "CY", "1").replace('decimals="0"', 'decimals="-3"') +
          money("core:CostSales", "CY", "2").replace('decimals="0"', 'decimals="INF"'),
      }),
    );
    expect(factNamed(read, "TurnoverRevenue").decimals).toBe(-3);
    expect(factNamed(read, "CostSales").decimals).toBe(Infinity);
  });
});

describe("number formats", () => {
  const registryOne = "ixt";
  const rows = [
    ["numdotdecimal", "ixt2", "1,234.56", 1234.56],
    ["num-dot-decimal", "ixt3", "1,234.56", 1234.56],
    ["numcommadot", "ixt", "1,234.56", 1234.56],
    ["numcommadecimal", "ixt2", "1.234,56", 1234.56],
    ["num-comma-decimal", "ixt3", "1.234,56", 1234.56],
    ["numdotcomma", "ixt", "1.234,56", 1234.56],
    ["numspacedot", "ixt", "1 234.56", 1234.56],
    ["numspacecomma", "ixt", "1 234,56", 1234.56],
    ["nocontent", "ixt2", "", 0],
    ["zerodash", "ixt2", "-", 0],
    ["numdash", registryOne, "-", 0],
    ["fixed-zero", "ixt3", "none", 0],
    ["numdotdecimal", "ixt4", "9,000", 9000],
    ["numdotdecimal", "ixt5", "9,000", 9000],
  ];
  it.each(rows)("%s in registry %s turns %j into %d", (format, prefix, text, expected) => {
    expect(valueOf(text, `format="${prefix}:${format}"`)).toBe(expected);
  });

  it("reads a format from the 2008 registry used with inline XBRL 1.0", () => {
    const document = ixbrlDocument({
      ix: IX_10,
      namespaces: 'xmlns:ixt0="http://www.xbrl.org/2008/inlineXBRL/transformation"',
      body: money("core:TurnoverRevenue", "CY", "1,200", 'format="ixt0:numcommadot"'),
    });
    expect(readIxbrl(document).facts[0].value).toBe(1200);
  });

  it("refuses an unknown format and names it", () => {
    expect(() => valueOf("1", 'format="ixt2:numfoo"')).toThrow(/ixt2:numfoo/);
  });

  it("refuses a format whose prefix is not a transformation registry", () => {
    expect(() => valueOf("1", 'format="uk-bus:numdotdecimal"')).toThrow(/not in a transformation registry/);
  });

  it("refuses text that does not fit its format", () => {
    expect(() => valueOf("twelve", 'format="ixt2:numdotdecimal"')).toThrow(/does not fit the format/);
  });
});

describe("ix:nonNumeric", () => {
  const text = (inner, attributes = "") =>
    readIxbrl(ixbrlDocument({ body: words("uk-bus:ReportTitle", "CY", inner, attributes) })).facts[0].value;

  it("reads the text with whitespace collapsed", () => {
    expect(text("  Annual\n   accounts ")).toBe("Annual accounts");
  });

  it("leaves out ix:exclude", () => {
    expect(text("Prepared <ix:exclude>(draft) </ix:exclude>for filing")).toBe("Prepared for filing");
  });

  it("joins a continuation chain", () => {
    const body = `${words("uk-bus:ReportTitle", "CY", "First", 'continuedAt="c1"')}<ix:continuation id="c1" continuedAt="c2"> second</ix:continuation><ix:continuation id="c2"> third</ix:continuation>`;
    expect(readIxbrl(ixbrlDocument({ body })).facts[0].value).toBe("First second third");
  });

  const dates = [
    ["ixt2:datedaymonthyear", "1.4.24", "2024-04-01"],
    ["ixt2:datedaymonthyear", "31/3/2025", "2025-03-31"],
    ["ixt2:datedaymonthyearen", "31 March 2025", "2025-03-31"],
    ["ixt3:date-day-monthname-year-en", "5 Sep 2025", "2025-09-05"],
    ["ixt:dateslasheu", "05/09/2025", "2025-09-05"],
    ["ixt:datedoteu", "05.09.2025", "2025-09-05"],
    ["ixt:datelonguk", "1st February 2025", "2025-02-01"],
    ["ixt2:datemonthdayyearen", "March 31, 2025", "2025-03-31"],
    ["ixt:dateslashus", "03/31/2025", "2025-03-31"],
    ["ixt:datelongus", "March 31, 2025", "2025-03-31"],
  ];
  it.each(dates)("%s turns %j into %s", (format, input, expected) => {
    expect(text(input, `format="${format}"`)).toBe(expected);
  });

  it("turns the boolean formats into true and false", () => {
    expect(text("Yes", 'format="ixt2:booleantrue"')).toBe("true");
    expect(text("No", 'format="ixt2:booleanfalse"')).toBe("false");
  });

  it("turns nocontent into an empty string", () => {
    expect(text("", 'format="ixt2:nocontent"')).toBe("");
  });

  it("refuses a date that does not fit its format", () => {
    expect(() => text("sometime", 'format="ixt2:datedaymonthyear"')).toThrow(/does not fit the format/);
  });
});

describe("hidden facts", () => {
  it("counts a fact in ix:hidden as a fact and marks it hidden", () => {
    const read = readIxbrl(
      ixbrlDocument({
        hidden: words("uk-bus:UKCompaniesHouseRegisteredNumber", "CY", "12345678"),
        body: words("uk-bus:EntityCurrentLegalOrRegisteredName", "CY", "A Ltd"),
      }),
    );
    expect(factNamed(read, "UKCompaniesHouseRegisteredNumber")).toMatchObject({ value: "12345678", hidden: true });
    expect(factNamed(read, "EntityCurrentLegalOrRegisteredName").hidden).toBe(false);
  });
});

describe("contexts", () => {
  it("reads the entity identifier and scheme, and an instant period", () => {
    const [fact] = readIxbrl(ixbrlDocument({ body: money("core:FixedAssets", "CY_END", "5") })).facts;
    expect(fact.entity).toEqual({ identifier: "12345678", scheme: "http://www.companieshouse.gov.uk/" });
    expect(fact.period).toEqual({ instant: "2025-03-31" });
    expect(fact.dimensions).toEqual({});
  });

  it("reads a duration period", () => {
    const [fact] = readIxbrl(ixbrlDocument({ body: money("core:TurnoverRevenue", "PY", "5") })).facts;
    expect(fact.period).toEqual({ startDate: "2023-04-01", endDate: "2024-03-31" });
  });

  it("reads an explicit member from the segment into a namespaced dimension map", () => {
    const contexts =
      STANDARD_CONTEXTS + context("SC", { instant: "2025-03-31", members: [["core:EquityClassesDimension", "core:ShareCapital"]] });
    const [fact] = readIxbrl(ixbrlDocument({ contexts, body: money("core:Equity", "SC", "100") })).facts;
    expect(fact.dimensions).toEqual({ [`${CORE}#EquityClassesDimension`]: `${CORE}#ShareCapital` });
  });

  it("reads an explicit member from the scenario too", () => {
    const contexts =
      STANDARD_CONTEXTS +
      context("SC", { instant: "2025-03-31", scenario: true, members: [["core:EquityClassesDimension", "core:ShareCapital"]] });
    const [fact] = readIxbrl(ixbrlDocument({ contexts, body: money("core:Equity", "SC", "100") })).facts;
    expect(Object.values(fact.dimensions)).toEqual([`${CORE}#ShareCapital`]);
  });

  it("reads a typed member", () => {
    const typed = `<xbrli:context id="T"><xbrli:entity><xbrli:identifier scheme="s">1</xbrli:identifier><xbrli:segment><xbrldi:typedMember dimension="core:OfficerDimension"><core:Officer>Ann</core:Officer></xbrldi:typedMember></xbrli:segment></xbrli:entity><xbrli:period><xbrli:instant>2025-03-31</xbrli:instant></xbrli:period></xbrli:context>`;
    const [fact] = readIxbrl(
      ixbrlDocument({ contexts: STANDARD_CONTEXTS + typed, body: words("uk-bus:NameEntityOfficer", "T", "Ann") }),
    ).facts;
    expect(fact.dimensions).toEqual({ [`${CORE}#OfficerDimension`]: "typed:Ann" });
  });

  it("gives a fact with no member an empty dimension map, the dimension's default", () => {
    const [fact] = readIxbrl(ixbrlDocument({ body: money("core:Equity", "CY_END", "5") })).facts;
    expect(fact.dimensions).toEqual({});
  });

  it("refuses a fact whose context is not in the file", () => {
    expect(() => readIxbrl(ixbrlDocument({ body: money("core:Equity", "NOPE", "5") }))).toThrow(/context "NOPE"/);
  });
});

describe("duplicate facts", () => {
  it("keeps one fact when the same concept, context and unit repeat with one value", () => {
    const body = money("core:TurnoverRevenue", "CY", "100") + money("core:TurnoverRevenue", "CY", "100");
    expect(readIxbrl(ixbrlDocument({ body })).facts).toHaveLength(1);
  });

  it("treats two contexts with the same content as one context", () => {
    const contexts = STANDARD_CONTEXTS + context("CY2", { start: "2024-04-01", end: "2025-03-31" });
    const body = money("core:TurnoverRevenue", "CY", "100") + money("core:TurnoverRevenue", "CY2", "100");
    expect(readIxbrl(ixbrlDocument({ contexts, body })).facts).toHaveLength(1);
  });

  it("refuses the same concept, context and unit with two values", () => {
    const body = money("core:TurnoverRevenue", "CY", "100") + money("core:TurnoverRevenue", "CY", "101");
    expect(() => readIxbrl(ixbrlDocument({ body }))).toThrow(/TurnoverRevenue twice .* different values \(100 and 101\)/);
  });
});

describe("units", () => {
  it("reads GBP, shares and pure units", () => {
    const body =
      money("core:TurnoverRevenue", "CY", "1") +
      `<ix:nonFraction name="core:NumberSharesIssuedFullyPaid" contextRef="CY_END" unitRef="shares" decimals="0">100</ix:nonFraction>` +
      `<ix:nonFraction name="core:AverageNumberEmployeesDuringPeriod" contextRef="CY" unitRef="pure" decimals="0">3</ix:nonFraction>`;
    const read = readIxbrl(ixbrlDocument({ body }));
    expect(read.facts.map((fact) => fact.unit)).toEqual(["GBP", "shares", "pure"]);
  });

  it("reads a per-share value in a divide unit", () => {
    const units = `<xbrli:unit id="GBP"><xbrli:measure>iso4217:GBP</xbrli:measure></xbrli:unit><xbrli:unit id="perShare"><xbrli:divide><xbrli:unitNumerator><xbrli:measure>iso4217:GBP</xbrli:measure></xbrli:unitNumerator><xbrli:unitDenominator><xbrli:measure>xbrli:shares</xbrli:measure></xbrli:unitDenominator></xbrli:divide></xbrli:unit>`;
    const body = `<ix:nonFraction name="core:ParValueShare" contextRef="CY_END" unitRef="perShare" decimals="2">1.00</ix:nonFraction>`;
    expect(readIxbrl(ixbrlDocument({ units, body })).facts[0].unit).toBe("divide:GBP/shares");
  });

  it("refuses a currency other than pounds sterling", () => {
    const units = `<xbrli:unit id="GBP"><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unit>`;
    expect(() => readIxbrl(ixbrlDocument({ units, body: money("core:TurnoverRevenue", "CY", "1") }))).toThrow(/USD/);
  });

  it("refuses a fact whose unit is not in the file", () => {
    const body = `<ix:nonFraction name="core:TurnoverRevenue" contextRef="CY" unitRef="EUR" decimals="0">1</ix:nonFraction>`;
    expect(() => readIxbrl(ixbrlDocument({ body }))).toThrow(/unit "EUR"/);
  });
});

describe("the taxonomy a file uses", () => {
  const withNamespace = (namespace, schemaRef) =>
    ixbrlDocument({
      namespaces: `xmlns:other="${namespace}"`,
      schemaRef,
      body: money("other:Revenue", "CY", "1"),
    });

  it("reads FRS 102 and FRS 105 entry points", () => {
    expect(readIxbrl(ixbrlDocument({ schemaRef: "https://xbrl.frc.org.uk/FRS-105/2022-01-01/FRS-105-2022-01-01.xsd" })).suite.family).toBe(
      "FRS-105",
    );
    expect(readIxbrl(ixbrlDocument({ schemaRef: "https://xbrl.frc.org.uk/FRS-102/2022-01-01/FRS-102-2022-01-01.xsd" })).suite.date).toBe(
      "2022-01-01",
    );
  });

  it.each([
    ["FRS-101", "FRS 101"],
    ["IFRS", "IFRS"],
    ["Charities", "Charities SORP"],
    ["UKSEF", "UK Single Electronic Format"],
  ])("refuses the %s taxonomy with the form's message", (family, label) => {
    const schemaRef = `https://xbrl.frc.org.uk/${family}/2024-01-01/${family}-2024-01-01.xsd`;
    expect(() => readIxbrl(withNamespace("http://xbrl.frc.org.uk/fr/2024-01-01/core", schemaRef))).toThrow(
      `This file uses the ${label} taxonomy; the form takes FRS 102 and FRS 105 accounts.`,
    );
  });

  it("refuses an old UK GAAP taxonomy of another date, naming the date", () => {
    expect(() =>
      readIxbrl(
        withNamespace(
          "http://www.xbrl.org/uk/gaap/core/2012-01-01",
          "http://www.xbrl.org/uk/gaap/core/2012-01-01/uk-gaap-full-2012-01-01.xsd",
        ),
      ),
    ).toThrow("This file uses the UK GAAP taxonomy of 2012-01-01; the form reads the 2009-09-01 suite.");
  });
});

describe("a document set", () => {
  it("refuses a fact that continues in another file", () => {
    const body = words("uk-bus:ReportTitle", "CY", "First", 'continuedAt="elsewhere"');
    expect(() => readIxbrl(ixbrlDocument({ body }))).toThrow(/one part of a document set/);
  });

  it("refuses a file whose contexts are in another file", () => {
    expect(() => readIxbrl(ixbrlDocument({ contexts: "", body: money("core:TurnoverRevenue", "CY", "1") }))).toThrow(
      /one part of a document set/,
    );
  });
});

describe("the fixtures", () => {
  const readable = readdirSync(FIXTURES).filter(
    (name) => /\.(xhtml|html)$/.test(name) && !name.startsWith("doctored-") && !name.startsWith("uk-gaap-"),
  );

  it("holds a fixture of every kind", () => {
    expect(readable).toEqual(
      expect.arrayContaining([
        "diya-2025-accounts.xhtml",
        "builder-micro.xhtml",
        "builder-micro-dormant.xhtml",
        "builder-small.xhtml",
        "builder-small-consistent.xhtml",
        "builder-small-filleted.xhtml",
        "adp-micro.xhtml",
        "adp-dormant.xhtml",
        "adp-small-full.xhtml",
        "adp-small-filleted.xhtml",
      ]),
    );
  });

  it.each(readable)("reads %s", (name) => {
    const read = readIxbrl(fixture(name));
    expect(read.kind).toBe("ixbrl");
    expect(read.suite.family).toBe("FRS-102");
    expect(read.facts.length).toBeGreaterThan(20);
    expect(Object.keys(read.contexts).length).toBeGreaterThan(3);
  });

  describe("DIY Accounting Limited's 2025 accounts", () => {
    const read = readIxbrl(fixture("diya-2025-accounts.xhtml"));

    it("is FRS 105 micro-entity accounts on the FRC 2024 suite, under the prefix uk-bus", () => {
      expect(read.suite).toMatchObject({ family: "FRS-102", date: "2024-01-01" });
      expect(factNamed(read, "UKCompaniesHouseRegisteredNumber").namespace).toBe("http://xbrl.frc.org.uk/cd/2024-01-01/business");
    });

    it("states the company and the period, the dates through ixt2 formats", () => {
      expect(factNamed(read, "UKCompaniesHouseRegisteredNumber").value).toBe("06846849");
      expect(factNamed(read, "EntityCurrentLegalOrRegisteredName").value).toBe("DIY ACCOUNTING LIMITED");
      expect(factNamed(read, "StartDateForPeriodCoveredByReport").value).toBe("2024-04-01");
      expect(factNamed(read, "EndDateForPeriodCoveredByReport").value).toBe("2025-03-31");
      expect(factNamed(read, "DateAuthorisationFinancialStatementsForIssue").value).toBe("2025-12-31");
    });

    it("carries both years of a Format 2 profit and loss account", () => {
      const figures = (contextRef) =>
        Object.fromEntries(
          [
            "TurnoverRevenue",
            "OtherOperatingIncomeFormat2",
            "OtherOperatingExpensesFormat2",
            "TaxTaxCreditOnProfitOrLossOnOrdinaryActivities",
            "ProfitLoss",
          ].map((name) => [name, factNamed(read, name, contextRef).value]),
        );
      expect(figures("CY")).toEqual({
        TurnoverRevenue: 7639,
        OtherOperatingIncomeFormat2: 22,
        OtherOperatingExpensesFormat2: 2482,
        TaxTaxCreditOnProfitOrLossOnOrdinaryActivities: 984,
        ProfitLoss: 4195,
      });
      expect(figures("PY")).toEqual({
        TurnoverRevenue: 8908,
        OtherOperatingIncomeFormat2: 36,
        OtherOperatingExpensesFormat2: 3014,
        TaxTaxCreditOnProfitOrLossOnOrdinaryActivities: 1127,
        ProfitLoss: 4803,
      });
    });

    it("carries the balance sheet at both dates, with the creditors on their maturity member", () => {
      expect(factNamed(read, "CurrentAssets", "CY_END").value).toBe(3353);
      expect(factNamed(read, "CurrentAssets", "PY_END").value).toBe(3409);
      expect(factNamed(read, "Creditors", "CreditorsWithinOneYear_CY_END").value).toBe(3219);
      expect(factNamed(read, "Creditors", "CreditorsWithinOneYear_PY_END").value).toBe(3307);
      expect(factNamed(read, "Equity", "CY_END").value).toBe(134);
      expect(factNamed(read, "Equity", "PY_END").value).toBe(102);
    });

    it("reads the zeros the filer wrote as 0, and the ixt2:nocontent facts as empty", () => {
      expect(factNamed(read, "FixedAssets", "CY_END").value).toBe(0);
      expect(factNamed(read, "RawMaterialsConsumablesUsed", "CY").value).toBe(0);
      expect(factNamed(read, "LegalFormEntity").value).toBe("");
    });

    it("reads the hidden blocks as facts", () => {
      expect(factNamed(read, "EntityDormantTruefalse")).toMatchObject({ value: "false", hidden: true });
      expect(factNamed(read, "NameProductionSoftware").hidden).toBe(true);
    });

    it("names the three directors", () => {
      const names = read.facts.filter((fact) => fact.localName === "NameEntityOfficer").map((fact) => fact.value);
      expect([...new Set(names)]).toEqual(["Antony Christopher Cartwright", "Samantha Ashley Cartwright", "Jane Elizabeth Grundy"]);
    });
  });
});

describe("the doctored fixtures", () => {
  it("reads scale=3 as thousands", () => {
    expect(factNamed(readIxbrl(fixture("doctored-scale.xhtml")), "TurnoverRevenue", "CY").value).toBe(7639);
  });

  it("reads sign=- as a negative", () => {
    expect(factNamed(readIxbrl(fixture("doctored-sign.xhtml")), "OtherOperatingExpensesFormat2", "CY").value).toBe(-2482);
  });

  it("refuses a duplicate fact with two values", () => {
    expect(() => readIxbrl(fixture("doctored-duplicate.xhtml"))).toThrow(/TurnoverRevenue twice .*7640 and 7639/);
  });

  it("refuses an unknown format and names it", () => {
    expect(() => readIxbrl(fixture("doctored-unknown-format.xhtml"))).toThrow(/ixt2:numfoo/);
  });
});
