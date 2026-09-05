// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// A Self Employed package keeps two calendars, and they move independently.
//
// The Admin sheet's period ends, the VAT interface's period rows and each
// return form's own period end follow the tax year the package is generated
// for. Every transaction, though, is written on the date its book gives it:
// se.js's cellWrites copies tx.date straight into the A column, where
// ltd.js's shifts it by the whole months between the book's period and the
// package's.
//
// That pairing is why a book and a package generated for a later year still
// agree cell for cell, and why moving the book's dates onto the package's
// year would break the agreement rather than make it: the figures never
// depended on the gap, and the dates are meant to keep the book's calendar.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse as parseTOML } from "smol-toml";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { cellWrites } from "../products/se.js";
import { VATINTERFACE_FIRST_ROW, VATINTERFACE_FIRST_MONTH_ROW, VATINTERFACE_LAST_ROW } from "../lib/tax/vat.js";

const ROOT = process.cwd();
const BOOK_DIR = path.join(ROOT, "examples/precision-code-ltd/advanced");

// The master book covers 2025-26. examples/se-latest is generated a year on,
// which is the widest gap the committed example ever puts between the two.
const OWN_YEAR = "se-2025-2026";
const LATER_YEAR = "se-2026-2027";
const DAYS_BETWEEN = 365;

const MONEY_BOXES = ["G9", "G11", "G13", "G15", "G17", "G21", "G23"];
const PERIOD_COLUMNS = ["D", "F", "H", "J"];

function scenarioFor(offset) {
  const { book, lines } = loadDiyaGlData(BOOK_DIR, offset);
  return { book, lines, scenario: diyaGlToScenario(book, lines, "se") };
}

function resultsFor({ book, lines, scenario }, years) {
  const taxData = parseTOML(fs.readFileSync(path.join(ROOT, "app/data", `${years}.toml`), "utf-8"));
  return calculateFromDiyaGl(book, lines, "se", taxData, scenario);
}

// Every entry date the writer puts on a journal tab. Row 1 and 2 carry the
// tab's own totals, so a date row starts at 3.
function entryDates(writes) {
  const dates = {};
  for (const [file, sheets] of Object.entries(writes)) {
    for (const [sheet, cells] of Object.entries(sheets)) {
      for (const [cell, value] of Object.entries(cells)) {
        const row = /^A(\d+)$/.exec(cell);
        if (row && Number(row[1]) >= 3) dates[`${file}!${sheet}!${cell}`] = value;
      }
    }
  }
  return dates;
}

describe("the Self Employed package's two calendars", () => {
  const master = scenarioFor();

  it("writes every entry on the book's own date, whichever year the package is generated for", () => {
    const dates = entryDates(cellWrites(master.scenario, 2025));
    expect(Object.keys(dates).length).toBeGreaterThan(500);
    expect(entryDates(cellWrites(master.scenario, 2026))).toEqual(dates);
  });

  it("moves the VAT calendar a whole year on when the package is", () => {
    const own = resultsFor(master, OWN_YEAR);
    const later = resultsFor(master, LATER_YEAR);
    for (let row = VATINTERFACE_FIRST_ROW; row <= VATINTERFACE_LAST_ROW; row++) {
      expect(later["Vat.xlsx!Vatinterface"][`B${row}`] - own["Vat.xlsx!Vatinterface"][`B${row}`]).toBe(DAYS_BETWEEN);
    }
    for (let form = 1; form <= 5; form++) {
      expect(later[`Vat.xlsx!VATQtr${form}`].G5 - own[`Vat.xlsx!VATQtr${form}`].G5).toBe(DAYS_BETWEEN);
    }
  });

  it("puts the same VAT figures on both years' returns, so the gap frames nothing", () => {
    const own = resultsFor(master, OWN_YEAR);
    const later = resultsFor(master, LATER_YEAR);
    for (let row = VATINTERFACE_FIRST_MONTH_ROW; row <= VATINTERFACE_LAST_ROW; row++) {
      for (const column of PERIOD_COLUMNS) {
        expect(later["Vat.xlsx!Vatinterface"][`${column}${row}`]).toBe(own["Vat.xlsx!Vatinterface"][`${column}${row}`]);
      }
    }
    for (let form = 1; form <= 5; form++) {
      for (const box of MONEY_BOXES) {
        expect(later[`Vat.xlsx!VATQtr${form}`][box]).toBe(own[`Vat.xlsx!VATQtr${form}`][box]);
      }
    }
  });

  it("takes every entry off the package's own dates when the book is shifted onto the later year", () => {
    const written = entryDates(cellWrites(master.scenario, 2026));
    const shifted = entryDates(cellWrites(scenarioFor("+P1Y").scenario, 2026));
    expect(Object.keys(shifted)).toEqual(Object.keys(written));
    const unmoved = Object.keys(written).filter((cell) => shifted[cell] === written[cell]);
    expect(unmoved).toEqual([]);
  });
});
