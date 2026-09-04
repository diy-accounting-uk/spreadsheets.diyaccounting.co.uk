// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// book-checks-taxi.test.js -- the Taxi Driver book's three warnings beside
// the shared eight, over the Taxi example books, with one crafted change
// per rule proving each of them breakable and nothing else moving with it.

import { describe, it, expect } from "vitest";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadDiyaGlData, extractTaxDataFromBook } from "../lib/diya-gl-loader.js";
import { runBookChecks, bookChecksJson, previewBookHelper, applyBookHelper } from "../lib/book-checks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

const SHARED_IDS = [
  "book-dates-in-period",
  "book-accounts-in-chart",
  "book-amounts-whole-pence",
  "book-vat-threshold",
  "book-duplicate-entries",
  "book-empty-detail",
  "book-negative-amount",
  "book-empty-month",
];
const TAXI_IDS = ["book-taxi-fare-miles", "book-taxi-vehicle-register", "book-taxi-miles-band"];
const ALL_IDS = SHARED_IDS.concat(TAXI_IDS);

function resultFor(results, id) {
  return results.find((r) => r.id === id);
}

function loadTaxi(dir) {
  const { book, lines } = loadDiyaGlData(resolve(REPO_ROOT, ...dir.split("/")));
  const taxData = extractTaxDataFromBook(book, "taxi");
  return { book, lines, taxData };
}

// ============================== the three example books ==============================
// Read as they stand, not as they are hoped to be.

describe("the three Taxi example books", () => {
  it("Basic Taxi Driver: all three Taxi rules pass, the registered vehicle needs no schedule", () => {
    const { book, lines, taxData } = loadTaxi("examples/basic-taxi-driver/taxi");
    const { results, summary } = runBookChecks({ book, lines, taxData });

    for (const id of TAXI_IDS) expect(resultFor(results, id).result, id).toBe("pass");
    expect(summary).toEqual({ pass: 11, warn: 0, fail: 0 });
  });

  it("Kestrel Executive Cars: all three Taxi rules pass; the shared VAT threshold is the book's only warning", () => {
    const { book, lines, taxData } = loadTaxi("examples/kestrel-executive-cars/taxi");
    const { results, summary } = runBookChecks({ book, lines, taxData });

    for (const id of TAXI_IDS) expect(resultFor(results, id).result, id).toBe("pass");
    expect(resultFor(results, "book-vat-threshold").result).toBe("warn");
    expect(summary).toEqual({ pass: 10, warn: 1, fail: 0 });
  });

  it("SP Sixty Driving: crosses the higher-rate mileage band in October, and fifteen fare days carry no miles of their own", () => {
    const { book, lines, taxData } = loadTaxi("examples/sp-sixty-driving/taxi");
    const { results, summary } = runBookChecks({ book, lines, taxData });

    // The committed fixture leaves TXN-0166 through TXN-0180 (the last
    // fifteen fare days of the year) with no measurableQuantity or
    // measurableUnitOfMeasure at all, unlike the other 165 fare days --
    // book-taxi-fare-miles already warns on this book unmodified.
    const fareMiles = resultFor(results, "book-taxi-fare-miles");
    expect(fareMiles.result).toBe("warn");
    expect(fareMiles.offenders.map((o) => o.entryNumber)).toEqual([
      "TXN-0166",
      "TXN-0167",
      "TXN-0168",
      "TXN-0169",
      "TXN-0170",
      "TXN-0171",
      "TXN-0172",
      "TXN-0173",
      "TXN-0174",
      "TXN-0175",
      "TXN-0176",
      "TXN-0177",
      "TXN-0178",
      "TXN-0179",
      "TXN-0180",
    ]);

    expect(resultFor(results, "book-taxi-vehicle-register").result).toBe("pass");

    const milesBand = resultFor(results, "book-taxi-miles-band");
    expect(milesBand.result).toBe("warn");
    expect(milesBand.offenders).toEqual([{ month: "2025-10", milesToDate: 11662 }]);

    expect(summary).toEqual({ pass: 9, warn: 2, fail: 0 });
  });
});

// ============================== clean baselines for breakability ==============================

// SP Sixty Driving with its fifteen gap fare days patched in, purely for
// this test: a plausible mileage entry on each, so book-taxi-fare-miles
// starts clean and one further crafted change can be shown to flip it
// alone. book-taxi-miles-band still warns here -- SP Sixty genuinely
// crosses the higher-rate band regardless of this patch.
function sp60CleanBaseline() {
  const fixture = loadTaxi("examples/sp-sixty-driving/taxi");
  for (const line of fixture.lines) {
    const isFareGap = line.sourceJournalID === "sales" && line.accountMainID === "4000" && line.amount > 0 && line.measurableUnitOfMeasure !== "miles";
    if (isFareGap) {
      line.measurableQuantity = 100;
      line.measurableUnitOfMeasure = "miles";
    }
  }
  return fixture;
}

// Runs a clean baseline and a mutated variant, and asserts that exactly the
// named rules changed result -- every other rule keeps the result it had on
// the baseline.
function assertOnlyTheseRulesFlip(baselineFixture, mutatedFixture, targetIds, expectedResult) {
  const before = runBookChecks(baselineFixture).results;
  const after = runBookChecks(mutatedFixture).results;

  for (const id of targetIds) expect(resultFor(after, id).result, id).toBe(expectedResult);
  for (const id of ALL_IDS) {
    if (targetIds.includes(id)) continue;
    expect(resultFor(after, id).result, id).toBe(resultFor(before, id).result);
  }
}

describe("the SP Sixty baseline starts clean once the fifteen gap days are patched", () => {
  it("book-taxi-fare-miles passes; book-taxi-miles-band still warns", () => {
    const { results } = runBookChecks(sp60CleanBaseline());
    expect(resultFor(results, "book-taxi-fare-miles").result).toBe("pass");
    expect(resultFor(results, "book-taxi-miles-band").result).toBe("warn");
  });
});

describe("each Taxi rule is breakable by one crafted change, and only that rule flips", () => {
  it("book-taxi-fare-miles: one fare day's own miles cleared", () => {
    const baseline = sp60CleanBaseline();
    const mutated = sp60CleanBaseline();
    delete mutated.lines.find((l) => l.entryNumber === "TXN-0001").measurableQuantity;

    assertOnlyTheseRulesFlip(baseline, mutated, ["book-taxi-fare-miles"], "warn");

    const after = runBookChecks(mutated).results;
    expect(resultFor(after, "book-taxi-fare-miles").offenders).toEqual([
      { entryNumber: "TXN-0001", postingDate: "2025-04-07", accountMainID: "4000", detail: "Daily fares", amount: 174 },
    ]);
  });

  it("book-taxi-vehicle-register: the registered vehicle's schedule entry removed", () => {
    const baseline = loadTaxi("examples/basic-taxi-driver/taxi");
    const mutated = loadTaxi("examples/basic-taxi-driver/taxi");
    mutated.book.fixedAssets = [];

    assertOnlyTheseRulesFlip(baseline, mutated, ["book-taxi-vehicle-register"], "warn");

    const after = runBookChecks(mutated).results;
    expect(resultFor(after, "book-taxi-vehicle-register").offenders).toEqual([
      { entryNumber: "TXN-0037", postingDate: "2025-06-01", accountMainID: "7000", detail: "Car Dealer", amount: 8000 },
    ]);
  });

  it("book-taxi-miles-band: a mileage claim past the higher-rate limit", () => {
    const baseline = loadTaxi("examples/basic-taxi-driver/taxi");
    const mutated = loadTaxi("examples/basic-taxi-driver/taxi");
    mutated.lines.push({
      entryNumber: "BREAK-MILES",
      sourceJournalID: "purchases",
      postingDate: "2026-03-31",
      accountMainID: "5100",
      amount: 4590.0,
      documentType: "mileage-log",
      detailComment: "Mileage claim",
      measurableQuantity: 15000,
      measurableUnitOfMeasure: "miles",
    });

    assertOnlyTheseRulesFlip(baseline, mutated, ["book-taxi-miles-band"], "warn");

    const after = runBookChecks(mutated).results;
    expect(resultFor(after, "book-taxi-miles-band").offenders).toEqual([{ month: "2026-03", milesToDate: 15000 }]);
  });
});

// ============================== the register helper ==============================

describe("the register helper", () => {
  it("previewBookHelper names the 7000 line", () => {
    const fixture = loadTaxi("examples/basic-taxi-driver/taxi");
    fixture.book.fixedAssets = [];

    const preview = previewBookHelper(fixture, "book-taxi-vehicle-register");
    expect(preview.title).toBe("Register these vehicles");
    expect(preview.summary).toBe("This will add 1 entry to the book. Nothing else moves.");
    expect(preview.changes).toEqual([{ entryNumber: "TXN-0037", what: "asset", becomes: "Taxi vehicle £8,000.00 bought 2025-06-01" }]);
  });

  it("applyBookHelper returns a new book with the vehicle registered, and the warning then passes on it; the input book is unchanged", () => {
    const fixture = loadTaxi("examples/basic-taxi-driver/taxi");
    fixture.book.fixedAssets = [];

    const appliedBook = applyBookHelper(fixture, "book-taxi-vehicle-register");

    expect(fixture.book.fixedAssets).toEqual([]);
    expect(appliedBook.fixedAssets).toEqual([{ assetID: "FA-001", description: "Taxi vehicle", cost: 8000, acquiredDate: "2025-06-01" }]);

    const after = runBookChecks({ book: appliedBook, lines: fixture.lines, taxData: fixture.taxData });
    expect(resultFor(after.results, "book-taxi-vehicle-register").result).toBe("pass");
  });

  it("returns null for a passing rule and throws for an unknown id", () => {
    const fixture = loadTaxi("examples/basic-taxi-driver/taxi");
    expect(previewBookHelper(fixture, "book-taxi-vehicle-register")).toBeNull();
    expect(() => applyBookHelper(fixture, "book-taxi-vehicle-register")).toThrow("Nothing left for this helper to fix.");
    expect(() => applyBookHelper(fixture, "not-a-real-check")).toThrow('No helper called "not-a-real-check"');
  });
});

// ============================== a BST book carries none of the three ids ==============================

describe("a BST book carries none of the three Taxi ids", () => {
  it("the shared eight run alone", () => {
    const { book, lines } = loadDiyaGlData(resolve(REPO_ROOT, "examples", "precision-code-ltd", "bst"));
    const taxData = extractTaxDataFromBook(book, "bst");
    const { results } = runBookChecks({ book, lines, taxData });
    expect(results.map((r) => r.id).sort()).toEqual(SHARED_IDS.slice().sort());
  });
});

// ============================== bookChecksJson ==============================

describe("bookChecksJson over a Taxi book", () => {
  it("stays byte-stable whatever order the lines arrived in, with the three new ids present", () => {
    const fixture = loadTaxi("examples/kestrel-executive-cars/taxi");
    const reversed = { ...fixture, lines: fixture.lines.slice().reverse() };

    const a = bookChecksJson(runBookChecks(fixture).results);
    const b = bookChecksJson(runBookChecks(reversed).results);
    expect(a).toBe(b);

    const ids = JSON.parse(a).map((r) => r.id);
    expect(ids).toEqual(ALL_IDS.slice().sort());
  });
});
