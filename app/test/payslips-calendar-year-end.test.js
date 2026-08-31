// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// The Payslips Admin calendar seeds B2 with 6 April and lays out a fixed 53
// weeks below it. I1 names the day the calendar runs to; it must be 5 April
// of the next year whether or not the year spans a leap February, so it is
// derived from B2 rather than read from a fixed row.

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

describe.each(["se", "ltd"])("%s Payslips Admin calendar year end", (product) => {
  it("I1 derives 5 April of the next year from the B2 seed", async () => {
    const zip = await JSZip.loadAsync(readFileSync(resolve(ROOT, `app/templates/${product}/Payslips.xlsx`)));
    const xml = await zip.file("xl/worksheets/sheet16.xml").async("string");
    const cell = xml.match(/<c r="I1"[^>]*><f>([^<]*)<\/f>/);
    expect(cell).not.toBeNull();
    expect(cell[1]).toBe("DATE(YEAR(B2)+1,MONTH(B2),DAY(B2))-1");
  });
});

// The printed payslip pulls every figure off the month tab H3 names, at the
// row H4 works out. Spelling that reference as H3 & "!C" & H4 assumes the "!"
// sheet separator of Excel's own grammar: LibreOffice reads a name built that
// way as #REF! and prints a page of errors. ADDRESS emits whichever separator
// the engine reading the file uses, so the same formula resolves in both.
describe.each(["se", "ltd"])("%s Payslips print sheet period join", (product) => {
  it("names the month tab through ADDRESS rather than a hard-coded sheet separator", async () => {
    const zip = await JSZip.loadAsync(readFileSync(resolve(ROOT, `app/templates/${product}/Payslips.xlsx`)));
    const xml = await zip.file("xl/worksheets/sheet14.xml").async("string");
    const formulas = [...xml.matchAll(/<f[^>]*>([^<]*INDIRECT[^<]*)<\/f>/g)].map((m) => m[1]);
    expect(formulas).toHaveLength(104);
    for (const formula of formulas) {
      expect(formula).toMatch(/INDIRECT\(ADDRESS\([^)]*,\$H\$3\)\)/);
      expect(formula).not.toContain('&amp; "!');
    }
  });
});
