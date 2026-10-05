// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/unit-tests/diya-gl-submit-handoff.test.js
//
// submit-handoff.js is a classic browser script; it runs here in a bare context the way the page
// runs it. The decode below is a copy of Submit's lib/auth-url-builder.js decodeBase64Url and the
// checks follow its readBooksFragment and widgets/books-import.js parseHandoff.

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";

import { loadDiyaGlData } from "../../app/lib/diya-gl-loader.js";
import * as engine from "../../app/lib/diya-gl-engine.js";

let handoff;
const examples = resolve(process.cwd(), "examples");

beforeAll(() => {
  const context = createContext({ TextEncoder, btoa });
  context.window = context;
  const file = resolve(process.cwd(), "web/diya-gl.co.uk/public/submit-handoff.js");
  runInContext(readFileSync(file, "utf8"), context, { filename: file });
  handoff = context.DiyaGlSubmitHandoff;
});

function decodeBase64Url(encoded) {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function decodeFragment(fragment) {
  expect(fragment.startsWith("#books=")).toBe(true);
  const encoded = fragment.slice("#books=".length);
  expect(encoded.length).toBeLessThanOrEqual(32768);
  expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  return JSON.parse(decodeBase64Url(encoded));
}

const source = { sourceFileName: "brickwork.zip", packageVersion: "1.2.48+abc" };
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function expectNumbers(figures) {
  Object.values(figures).forEach((figure) => expect(Number.isFinite(figure)).toBe(true));
}

describe("encodeFragment", () => {
  it("round-trips non-ASCII text through the receiver's decode", () => {
    const original = {
      kind: "itsa-annual",
      sourceFileName: "Café £ books.zip",
      packageVersion: "1",
      period: { taxYear: "2025-26" },
      figures: {},
    };
    expect(decodeFragment(handoff.encodeFragment({ ...original }))).toEqual(original);
  });

  it("refuses figures that encode past the receiver's length limit", () => {
    const figures = {};
    for (let i = 0; i < 3000; i++) figures[`field${i}`] = 123456.78;
    expect(() =>
      handoff.encodeFragment({
        kind: "itsa-annual",
        ...source,
        period: { taxYear: "2025-26" },
        figures: { allowances: figures, adjustments: {} },
      }),
    ).toThrow(/too large/);
  });

  it("refuses a handoff with no source file name", () => {
    expect(() => handoff.encodeFragment({ kind: "vat", sourceFileName: "", packageVersion: "1" })).toThrow(/sourceFileName/);
  });
});

describe("submitUrl", () => {
  it.each([
    ["vat", "/hmrc/vat/submitVat.html"],
    ["itsa-quarterly", "/hmrc/itsa/selfEmploymentPeriod.html"],
    ["itsa-annual", "/hmrc/itsa/annualSubmission.html"],
  ])("puts the %s fragment on %s", (kind, path) => {
    expect(handoff.submitUrl("https://submit.diyaccounting.co.uk/", kind, "#books=abc")).toBe(
      `https://submit.diyaccounting.co.uk${path}#books=abc`,
    );
  });
});

describe("activitiesFor", () => {
  const company = (registered) => ({ entityInformation: { "diya-gl:vatRegistered": registered } });
  it("offers VAT to a VAT registered company book only", () => {
    expect(handoff.activitiesFor({ submitActivities: ["vat"] }, company(true))).toEqual(["vat"]);
    expect(handoff.activitiesFor({ submitActivities: ["vat"] }, company(false))).toEqual([]);
  });
  it("offers a self employed book the two Income Tax filings", () => {
    expect(handoff.activitiesFor({ submitActivities: ["itsa-quarterly", "itsa-annual"] }, company(false))).toEqual([
      "itsa-quarterly",
      "itsa-annual",
    ]);
  });
  it("offers nothing for a manifest that names no activity", () => {
    expect(handoff.activitiesFor({}, company(true))).toEqual([]);
  });
});

describe("the figures a book hands over", () => {
  it("VAT: the seven box ids and the quarter's dates, from a VAT registered company book", async () => {
    const { book, lines } = await loadDiyaGlData(resolve(examples, "brickwork-pro", "ltd-vat"));
    const monthEnds = ["2025-06-30", "2025-09-30", "2025-12-31", "2026-03-31", "2025-07-31", "2025-08-31", "2025-10-31", "2025-11-30"];
    let periodEnd = null;
    for (const candidate of monthEnds) {
      if (
        await engine.deriveVatReturn(book, lines, { periodEnd: candidate }).then(
          () => true,
          () => false,
        )
      ) {
        periodEnd = candidate;
        break;
      }
    }
    expect(periodEnd).not.toBeNull();
    const built = await handoff.buildHandoff(engine, "vat", book, lines, periodEnd, source);
    const sent = decodeFragment(handoff.encodeFragment(built));
    expect(sent.kind).toBe("vat");
    expect(Object.keys(sent.figures).sort()).toEqual([...handoff.VAT_BOX_IDS].sort());
    expectNumbers(sent.figures);
    expect(sent.period.periodStart).toMatch(ISO_DATE);
    expect(sent.period.periodEnd).toBe(periodEnd);
  });

  it("ITSA quarterly: tax year, period dates and the three figure groups", async () => {
    const { book, lines } = await loadDiyaGlData(resolve(examples, "brickwork-pro", "se-vat"));
    const choices = await handoff.periodChoices(engine, "itsa-quarterly", book, lines);
    expect(choices.length).toBeGreaterThan(0);
    const built = await handoff.buildHandoff(engine, "itsa-quarterly", book, lines, choices[0].value, source);
    const sent = decodeFragment(handoff.encodeFragment(built));
    expect(sent.kind).toBe("itsa-quarterly");
    expect(sent.period.taxYear).toMatch(/^\d{4}-\d{2}$/);
    expect(sent.period.periodStartDate).toMatch(ISO_DATE);
    expect(sent.period.periodEndDate).toBe(choices[0].value);
    expect(Object.keys(sent.figures).sort()).toEqual(["periodDisallowableExpenses", "periodExpenses", "periodIncome"]);
    Object.values(sent.figures).forEach(expectNumbers);
  });

  it("ITSA annual: the tax year and numeric allowances and adjustments", async () => {
    const { book, lines } = await loadDiyaGlData(resolve(examples, "brickwork-pro", "se-vat"));
    const choices = await handoff.periodChoices(engine, "itsa-annual", book, lines);
    expect(choices).toHaveLength(1);
    const built = await handoff.buildHandoff(engine, "itsa-annual", book, lines, choices[0].value, source);
    const sent = decodeFragment(handoff.encodeFragment(built));
    expect(sent.kind).toBe("itsa-annual");
    expect(sent.period).toEqual({ taxYear: choices[0].value });
    expectNumbers(sent.figures.allowances);
    expectNumbers(sent.figures.adjustments);
  });
});
