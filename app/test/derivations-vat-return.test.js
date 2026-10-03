// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// derivations-vat-return.test.js — deriveVatReturn over the two example
// company books: every quarter it answers equals the engine's own VATQtr form
// for that period end, box by box, the attributed lines add up to the boxes,
// and the refusals name what is wrong.

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { beforeAll, describe, expect, it } from "vitest";

import { calculatedResultsFor } from "../bin/export.js";
import { loadDiyaGlData } from "../lib/diya-gl-loader.js";
import { loadTaxDataForBook } from "../lib/product-workbook.js";
import { deriveVatReturn, interfaceRows, isoFromSerial } from "../lib/derivations/vat-return.js";

const EXAMPLES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "examples");
const BRICKWORK_LTD_VAT = resolve(EXAMPLES_DIR, "brickwork-pro", "ltd-vat");

const EXAMPLES = [
  { name: "BrickWork Pro Ltd", dir: BRICKWORK_LTD_VAT, vrn: "376543219", straddling: 0 },
  { name: "Precision Code Ltd", dir: resolve(EXAMPLES_DIR, "precision-code-ltd", "full"), vrn: "123456789", straddling: 10 },
];

const pence = (value) => Math.round(value * 100) / 100;

// The four quarters the package's VATQtr1 to VATQtr4 forms are filled for,
// and the fifth that reaches past the year end into the straddling rows.
function quarterForms(results) {
  const forms = [];
  for (let q = 1; q <= 5; q++) {
    const form = results[`Vatreturns.xlsx!VATQtr${q}`];
    forms.push({ q, periodEnd: isoFromSerial(form.G5), dueDate: isoFromSerial(form.G7), form });
  }
  return forms;
}

describe("deriveVatReturn", () => {
  for (const example of EXAMPLES) {
    describe(example.name, () => {
      let book;
      let lines;
      let results;
      beforeAll(async () => {
        ({ book, lines } = loadDiyaGlData(example.dir));
        results = calculatedResultsFor(book, lines, await loadTaxDataForBook(book));
      });

      it("answers the five quarters the package's return forms are filled for, box by box", async () => {
        for (const { periodEnd, dueDate, form } of quarterForms(results)) {
          const answer = await deriveVatReturn(book, lines, { periodEnd });
          expect(answer.periodEnd).toBe(periodEnd);
          expect(answer.dueDate).toBe(dueDate);
          expect(answer.boxes.box1).toBe(pence(form.G9));
          expect(answer.boxes.box2).toBe(0);
          expect(answer.boxes.box3).toBe(pence(form.G13));
          expect(answer.boxes.box4).toBe(pence(form.G15));
          expect(Math.abs(answer.boxes.box5 - form.G17)).toBeLessThan(0.011);
          expect(answer.boxes.box6).toBe(Math.round(form.G21));
          expect(answer.boxes.box7).toBe(Math.round(form.G23));
          expect(answer.boxes.box8).toBe(0);
          expect(answer.boxes.box9).toBe(0);
        }
      });

      it("answers every in-year month end, equal to the interface row's quarter columns", async () => {
        const rows = interfaceRows(results).filter((r) => r.quarter);
        expect(rows).toHaveLength(15);
        for (const row of rows) {
          const answer = await deriveVatReturn(book, lines, { periodEnd: row.periodEnd });
          expect(answer.boxes.box1).toBe(pence(row.quarter.salesVat));
          expect(answer.boxes.box4).toBe(pence(row.quarter.purchasesVat));
          expect(answer.boxes.box6).toBe(Math.round(row.quarter.salesNet));
          expect(answer.boxes.box7).toBe(Math.round(row.quarter.purchasesNet));
          expect(answer.months).toHaveLength(3);
          expect(answer.months[2].periodEnd).toBe(row.periodEnd);
        }
      });

      it("attributes lines whose contributions add up to the boxes, and box 5 to HMRC's own check", async () => {
        const answer = await deriveVatReturn(book, lines, { periodEnd: "2025-09-30", periodStart: "2025-07-01", periodKey: "25A2" });
        expect(answer.periodKey).toBe("25A2");
        expect(answer.periodStart).toBe("2025-07-01");
        expect(answer.vatRegistrationNumber).toBe(example.vrn);
        expect(answer.scheme).toBe("standard");
        const total = (entries) => pence(entries.reduce((sum, entry) => sum + entry.contributes, 0));
        expect(Math.abs(total(answer.lines.box1) - answer.boxes.box1)).toBeLessThan(0.02);
        expect(Math.abs(total(answer.lines.box4) - answer.boxes.box4)).toBeLessThan(0.02);
        expect(Math.abs(total(answer.lines.box6) - answer.boxes.box6)).toBeLessThan(0.51);
        expect(Math.abs(total(answer.lines.box7) - answer.boxes.box7)).toBeLessThan(0.51);
        expect(answer.lines.box1.length).toBeGreaterThan(0);
        expect(answer.lines.box4.length).toBeGreaterThan(0);
        expect(answer.hmrc.netVatDue).toBe(pence(answer.hmrc.totalVatDue - answer.hmrc.vatReclaimedCurrPeriod));
        expect(answer.hmrc.totalVatDue).toBe(pence(answer.hmrc.vatDueSales + answer.hmrc.vatDueAcquisitions));
        for (const entry of [...answer.lines.box1, ...answer.lines.box6]) {
          expect(entry.date >= "2025-07-01" && entry.date <= "2025-09-30").toBe(true);
        }
      });

      it("takes the straddling lines by their own period end", async () => {
        const straddling = lines.filter((l) => l["diya-gl:vatPeriodEnd"] !== undefined);
        expect(straddling).toHaveLength(example.straddling);
        // The quarter ending three months after the year end reads rows 18 to
        // 20, which only the straddling lines feed.
        const answer = await deriveVatReturn(book, lines, { periodEnd: "2026-06-30" });
        const afterYear = straddling.filter((l) => l.sourceJournalID === "sales" && l["diya-gl:vatPeriodEnd"] > "2026-03-31");
        expect(answer.lines.box1.map((l) => l.entryNumber).sort()).toEqual(afterYear.map((l) => l.entryNumber).sort());
      });

      it("refuses a period end the book does not carry, and a start that does not open the quarter", async () => {
        await expect(deriveVatReturn(book, lines, { periodEnd: "2025-09-15" })).rejects.toThrow(/carries no VAT period ending 2025-09-15/);
        await expect(deriveVatReturn(book, lines, { periodEnd: "2025-09-30", periodStart: "2025-08-01" })).rejects.toThrow(
          /the quarter ending 2025-09-30 starts 2025-07-01/,
        );
        await expect(deriveVatReturn(book, lines, { periodEnd: "2025-03-31" })).rejects.toThrow(
          /earliest quarter this book answers ends 2025-04-30/,
        );
        await expect(deriveVatReturn(book, lines, {})).rejects.toThrow(/requires periodEnd/);
      });
    });
  }

  it("refuses without a book and its lines", async () => {
    await expect(deriveVatReturn(undefined, undefined, { periodEnd: "2025-06-30" })).rejects.toThrow(/requires a book and its lines/);
  });

  it("refuses a book that is not VAT registered instead of answering nil boxes", async () => {
    const { book, lines } = loadDiyaGlData(BRICKWORK_LTD_VAT);
    const unregistered = { ...book, entityInformation: { ...book.entityInformation, "diya-gl:vatRegistered": false } };
    await expect(deriveVatReturn(unregistered, lines, { periodEnd: "2025-06-30" })).rejects.toThrow(
      /not declare the company VAT registered/,
    );
  });

  it("refuses a book whose lines do not reconcile with its VAT interface", async () => {
    const { book, lines } = loadDiyaGlData(BRICKWORK_LTD_VAT);
    // A sales line moved a year back lands on the same month tab in the
    // engine (tabs are named by month, not year) but outside the quarter's
    // months here, so the attribution and the interface disagree.
    const sale = lines.find((l) => l.sourceJournalID === "sales" && l.postingDate.startsWith("2025-08"));
    const moved = lines.map((l) => (l === sale ? { ...l, postingDate: "2024-08-15" } : l));
    await expect(deriveVatReturn(book, moved, { periodEnd: "2025-09-30" })).rejects.toThrow(/cannot be derived/);
  });
});
