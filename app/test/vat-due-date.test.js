// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { vatDueDateSerial, toExcelSerial, utcDate, fromExcelSerial } from "../lib/generator.js";

const iso = (serial) => fromExcelSerial(serial).toISOString().slice(0, 10);
const due = (y, m, d) => iso(vatDueDateSerial(toExcelSerial(utcDate(y, m, d))));

describe("VAT return due date", () => {
  it.each([
    [2025, 6, 30, "2025-08-07"],
    [2026, 3, 31, "2026-05-07"],
    [2025, 1, 31, "2025-03-07"],
    [2025, 2, 28, "2025-04-07"],
    [2024, 2, 29, "2024-04-07"],
    [2025, 11, 30, "2026-01-07"],
    [2025, 12, 31, "2026-02-07"],
  ])("period ending %i-%i-%i is due %s", (y, m, d, expected) => {
    expect(due(y, m, d)).toBe(expected);
  });

  it.each(["app/templates/ltd/Vatreturns.xlsx", "app/templates/se/Vat.xlsx"])(
    "%s dates every interface row EOMONTH(B,1)+7",
    async (file) => {
      const zip = await JSZip.loadAsync(readFileSync(new URL(`../../${file}`, import.meta.url)));
      const xml = await zip.file("xl/worksheets/sheet6.xml").async("string");
      for (let r = 4; r <= 20; r++) {
        const b = Number(xml.match(new RegExp(`<c r="B${r}"[^>]*><f>[^<]*</f><v>(\\d+)</v>`))[1]);
        const c = xml.match(new RegExp(`<c r="C${r}"[^>]*><f>([^<]*)</f><v>(\\d+)</v>`));
        expect(c[1]).toBe(`EOMONTH(B${r},1)+7`);
        expect(Number(c[2])).toBe(vatDueDateSerial(b));
      }
    },
  );
});
