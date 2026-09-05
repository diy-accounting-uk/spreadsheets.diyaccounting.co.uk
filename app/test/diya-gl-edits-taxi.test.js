// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// The two edits the Taxi takings grain needs: a line's own detail comment
// (the name a fare prints under, and the caption that makes a sales line the
// week's rental rather than a day's fare) and its measured quantity (a fare
// day's business miles). Both are proved against a real fixture line rather
// than a synthetic one, so a change that silently dropped a field would show.

import { describe, it, expect } from "vitest";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadDiyaGlData } from "../lib/diya-gl-loader.js";
import { changeLineDetail, changeLineQuantity } from "../lib/diya-gl-edits.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "sp-sixty-driving", "taxi"));
const FARE = lines.find((line) => line.sourceJournalID === "sales" && line.measurableUnitOfMeasure === "miles");
const lineFor = (edited, entryNumber) => edited.find((line) => line.entryNumber === entryNumber);

describe("changeLineDetail", () => {
  it("replaces the detail comment and nothing else", () => {
    const edited = changeLineDetail(book, lines, { entryNumber: FARE.entryNumber, detailComment: "Airport run" });
    expect(lineFor(edited, FARE.entryNumber)).toEqual({ ...FARE, detailComment: "Airport run" });
  });

  it("returns a new array and leaves the input untouched", () => {
    const edited = changeLineDetail(book, lines, { entryNumber: FARE.entryNumber, detailComment: "Rental due" });
    expect(edited).not.toBe(lines);
    expect(edited).toHaveLength(lines.length);
    expect(FARE.detailComment).not.toBe("Rental due");
  });

  it("throws for an entry number no line carries", () => {
    expect(() => changeLineDetail(book, lines, { entryNumber: "TXN-9999", detailComment: "x" })).toThrow(
      "No line carries entryNumber TXN-9999",
    );
  });
});

describe("changeLineQuantity", () => {
  it("sets all three measurable fields for miles, naming the measurement itself", () => {
    const edited = changeLineQuantity(book, lines, { entryNumber: FARE.entryNumber, quantity: 142, unit: "miles" });
    expect(lineFor(edited, FARE.entryNumber)).toEqual({
      ...FARE,
      measurableQuantity: 142,
      measurableUnitOfMeasure: "miles",
      measurableDescription: "Business miles driven",
    });
  });

  it("takes the caller's description for any other unit", () => {
    const edited = changeLineQuantity(book, lines, {
      entryNumber: FARE.entryNumber,
      quantity: 3,
      unit: "hours",
      description: "Waiting time",
    });
    expect(lineFor(edited, FARE.entryNumber)).toMatchObject({
      measurableQuantity: 3,
      measurableUnitOfMeasure: "hours",
      measurableDescription: "Waiting time",
    });
  });

  it("removes all three fields for zero and for null", () => {
    for (const quantity of [0, null]) {
      const edited = changeLineQuantity(book, lines, { entryNumber: FARE.entryNumber, quantity, unit: "miles" });
      const changed = lineFor(edited, FARE.entryNumber);
      expect(changed).not.toHaveProperty("measurableQuantity");
      expect(changed).not.toHaveProperty("measurableUnitOfMeasure");
      expect(changed).not.toHaveProperty("measurableDescription");
      expect(changed.amount).toBe(FARE.amount);
    }
  });

  it("refuses a negative quantity", () => {
    expect(() => changeLineQuantity(book, lines, { entryNumber: FARE.entryNumber, quantity: -1, unit: "miles" })).toThrow(
      'changeLineQuantity expects a non-negative number or null, got "-1"',
    );
  });

  it("returns a new array and leaves the input untouched", () => {
    const before = FARE.measurableQuantity;
    const edited = changeLineQuantity(book, lines, { entryNumber: FARE.entryNumber, quantity: 500, unit: "miles" });
    expect(edited).not.toBe(lines);
    expect(FARE.measurableQuantity).toBe(before);
  });

  it("throws for an entry number no line carries", () => {
    expect(() => changeLineQuantity(book, lines, { entryNumber: "TXN-9999", quantity: 1, unit: "miles" })).toThrow(
      "No line carries entryNumber TXN-9999",
    );
  });
});
