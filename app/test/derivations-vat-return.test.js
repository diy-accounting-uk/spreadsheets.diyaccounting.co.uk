// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// derivations-vat-return.test.js — deriveVatReturn over the two example
// company books, over generated books and over small books with a stated
// answer: the workbook's figures equal the engine's own VATQtr form for each
// period end, a quarter of standard rated lines answers those figures, a
// quarter with other tax codes answers each line's VAT by its code, the
// attributed lines add up to the boxes, and the refusals name what is wrong.

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import fc from "fast-check";
import { parse as parseTOML } from "smol-toml";
import { beforeAll, describe, expect, it } from "vitest";

import { calculatedResultsFor } from "../bin/export.js";
import { loadDiyaGlData } from "../lib/diya-gl-loader.js";
import { loadTaxDataForBook } from "../lib/product-workbook.js";
import { buildNewBook } from "../lib/diya-gl-new-book.js";
import { addPurchaseLine, addSaleLine } from "../lib/diya-gl-edits.js";
import { LTD_PURCHASE_CODE_MAP, LTD_SALES_CODE_MAP } from "../lib/scenario-extractor.js";
import { deriveVatReturn, interfaceRows, isoFromSerial } from "../lib/derivations/vat-return.js";
import { buildBooksFromPlan, companyBookPlans } from "./support/book-generators.js";

const EXAMPLES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "examples");
const BRICKWORK_LTD_VAT = resolve(EXAMPLES_DIR, "brickwork-pro", "ltd-vat");

const EXAMPLES = [
  { name: "BrickWork Pro Ltd", dir: BRICKWORK_LTD_VAT, vrn: "376543219", straddling: 0, allStandardRated: true },
  {
    name: "Precision Code Ltd",
    dir: resolve(EXAMPLES_DIR, "precision-code-ltd", "full"),
    vrn: "123456789",
    straddling: 10,
    allStandardRated: false,
  },
];

const pence = (value) => Math.round(value * 100) / 100;

function expectWorkbookForm(boxes, form) {
  expect(boxes.box1).toBe(pence(form.G9));
  expect(boxes.box2).toBe(0);
  expect(boxes.box3).toBe(pence(form.G13));
  expect(boxes.box4).toBe(pence(form.G15));
  expect(Math.abs(boxes.box5 - form.G17)).toBeLessThan(0.011);
  expect(boxes.box6).toBe(Math.round(form.G21));
  expect(boxes.box7).toBe(Math.round(form.G23));
  expect(boxes.box8).toBe(0);
  expect(boxes.box9).toBe(0);
}

// The sales or purchases lines of a quarter the engine reads, with no
// straddling period end, that are not standard rated at 20%.
function departingLines(lines, journal, start, end) {
  const map = journal === "sales" ? LTD_SALES_CODE_MAP : LTD_PURCHASE_CODE_MAP;
  return lines.filter(
    (l) =>
      l.sourceJournalID === journal &&
      map[l.accountMainID] &&
      l["diya-gl:vatPeriodEnd"] === undefined &&
      l.postingDate >= start &&
      l.postingDate <= end &&
      (l.taxCode !== "S" || l.taxRate !== 0.2),
  );
}

const grossOf = (lines) => lines.reduce((sum, l) => sum + (l.documentType === "credit-note" ? -l.amount : l.amount), 0);

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

      it("states the workbook's figures for the five quarters the package's return forms are filled for, box by box", async () => {
        for (const { periodEnd, dueDate, form } of quarterForms(results)) {
          const answer = await deriveVatReturn(book, lines, { periodEnd });
          expect(answer.periodEnd).toBe(periodEnd);
          expect(answer.dueDate).toBe(dueDate);
          expectWorkbookForm(answer.workbookBoxes, form);
          if (example.allStandardRated) {
            expect(answer.followsTaxCodes).toBe(false);
            expect(answer.boxes).toEqual(answer.workbookBoxes);
            expect(answer.workbookDifference).toBeNull();
          }
        }
      });

      it("states the workbook's figures for every in-year month end, equal to the interface row's quarter columns", async () => {
        const rows = interfaceRows(results).filter((r) => r.quarter);
        expect(rows).toHaveLength(15);
        for (const row of rows) {
          const answer = await deriveVatReturn(book, lines, { periodEnd: row.periodEnd });
          expect(answer.workbookBoxes.box1).toBe(pence(row.quarter.salesVat));
          expect(answer.workbookBoxes.box4).toBe(pence(row.quarter.purchasesVat));
          expect(answer.workbookBoxes.box6).toBe(Math.round(row.quarter.salesNet));
          expect(answer.workbookBoxes.box7).toBe(Math.round(row.quarter.purchasesNet));
          if (example.allStandardRated) expect(answer.boxes).toEqual(answer.workbookBoxes);
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

  it("takes the VAT of Precision Code Ltd's exempt and outside the scope lines out of the workbook's boxes, quarter by quarter", async () => {
    const { book, lines } = loadDiyaGlData(resolve(EXAMPLES_DIR, "precision-code-ltd", "full"));
    for (const [start, end] of [
      ["2025-04-01", "2025-06-30"],
      ["2025-07-01", "2025-09-30"],
      ["2025-10-01", "2025-12-31"],
      ["2026-01-01", "2026-03-31"],
    ]) {
      const answer = await deriveVatReturn(book, lines, { periodEnd: end });
      const sales = departingLines(lines, "sales", start, end);
      const purchases = departingLines(lines, "purchases", start, end);
      expect(sales.every((l) => l.taxCode === "OS")).toBe(true);
      expect(purchases.every((l) => l.taxCode === "OS" || l.taxCode === "E")).toBe(true);
      expect(purchases.length).toBeGreaterThan(0);
      const workbook = answer.workbookBoxes;
      // The workbook takes a sixth of every gross as VAT. An outside the scope
      // sale counts whole in box 6; an exempt purchase counts whole in box 7;
      // an outside the scope purchase is in no box.
      const exempt = purchases.filter((l) => l.taxCode === "E");
      expect(Math.abs(answer.boxes.box1 - (workbook.box1 - grossOf(sales) / 6))).toBeLessThan(0.011);
      expect(Math.abs(answer.boxes.box4 - (workbook.box4 - grossOf(purchases) / 6))).toBeLessThan(0.011);
      expect(answer.boxes.box3).toBe(answer.boxes.box1);
      expect(answer.boxes.box5).toBe(pence(answer.boxes.box3 - answer.boxes.box4));
      expect(Math.abs(answer.boxes.box6 - (workbook.box6 + grossOf(sales) / 6))).toBeLessThanOrEqual(1);
      expect(Math.abs(answer.boxes.box7 - (workbook.box7 - grossOf(purchases) / 1.2 + grossOf(exempt)))).toBeLessThanOrEqual(1);
      expect(answer.followsTaxCodes).toBe(true);
      expect(answer.workbookDifference).toMatch(/so the boxes follow each line's tax code and differ from the workbook's VAT return/);
      expect(answer.workbookDifference).toContain(`box 4 £${answer.boxes.box4.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`);
      expect(answer.notes).toContain(answer.workbookDifference);
      const total = (entries) => pence(entries.reduce((sum, entry) => sum + entry.contributes, 0));
      expect(Math.abs(total(answer.lines.box4) - answer.boxes.box4)).toBeLessThan(0.011);
      expect(Math.abs(total(answer.lines.box7) - answer.boxes.box7)).toBeLessThanOrEqual(0.5);
      expect(answer.lines.box7.some((l) => l.taxCode === "OS")).toBe(false);
    }
  });

  describe("a book whose lines carry other tax codes", () => {
    const rateData = parseTOML(readFileSync(resolve(EXAMPLES_DIR, "..", "app", "data", "ltd-2025.toml"), "utf8"));
    let sequence = 0;
    const trade = (journal, day, account, amount, taxCode, extra = {}) => ({
      entryNumber: `T-${String(++sequence).padStart(3, "0")}`,
      sourceJournalID: journal,
      postingDate: day,
      accountMainID: account,
      amount,
      documentType: "invoice",
      documentReference: `REF-${sequence}`,
      detailComment: "Counterparty",
      taxCode,
      ...extra,
    });
    const bookWith = (entries) => {
      const book = buildNewBook({ product: "ltd", businessName: "Tax Codes Ltd", yearEnd: "2026-03-31", vatRegistered: true }, rateData);
      let lines = [];
      for (const line of entries) {
        lines = line.sourceJournalID === "sales" ? addSaleLine(book, lines, { line }) : addPurchaseLine(book, lines, { line });
      }
      return { book, lines };
    };

    it("one zero-rated sale and one exempt purchase beside standard rated lines give the boxes worked by hand", async () => {
      const { book, lines } = bookWith([
        trade("sales", "2025-07-10", "4000", 1200, "S", { taxRate: 0.2 }),
        trade("sales", "2025-08-12", "4001", 500, "Z", { taxRate: 0 }),
        trade("purchases", "2025-07-20", "5000", 240, "S", { taxRate: 0.2 }),
        trade("purchases", "2025-09-01", "5700", 300, "E", { taxRate: 0 }),
      ]);
      const answer = await deriveVatReturn(book, lines, { periodEnd: "2025-09-30" });
      // Box 1: 1200 / 6 = 200. Box 4: 240 / 6 = 40. Box 6: 1000 + 500. Box 7: 200 + 300.
      expect(answer.boxes).toEqual({ box1: 200, box2: 0, box3: 200, box4: 40, box5: 160, box6: 1500, box7: 500, box8: 0, box9: 0 });
      // The workbook takes 20% off all four lines.
      expect(answer.workbookBoxes).toEqual({
        box1: pence(1700 / 6),
        box2: 0,
        box3: pence(1700 / 6),
        box4: pence(540 / 6),
        box5: pence(pence(1700 / 6) - pence(540 / 6)),
        box6: Math.round(1700 / 1.2),
        box7: Math.round(540 / 1.2),
        box8: 0,
        box9: 0,
      });
      expect(answer.workbookDifference).toBe(
        "2 sales and purchases lines are not standard rated (1 E, 1 Z), so the boxes follow each line's tax code and differ from the workbook's VAT return, which takes 20% VAT off every line: " +
          "box 1 £200.00 (workbook £283.33), box 3 £200.00 (workbook £283.33), box 4 £40.00 (workbook £90.00), box 5 £160.00 (workbook £193.33), box 6 £1,500 (workbook £1,417), box 7 £500 (workbook £450).",
      );
      expect(answer.lines.box1.map((l) => l.taxCode)).toEqual(["S"]);
      expect(answer.lines.box6.map((l) => [l.taxCode, l.contributes])).toEqual([
        ["S", 1000],
        ["Z", 500],
      ]);
      expect(answer.lines.box7.map((l) => [l.taxCode, l.contributes])).toEqual([
        ["S", 200],
        ["E", 300],
      ]);
    });

    it("every tax code puts its line in the boxes HMRC names for it", async () => {
      const { book, lines } = bookWith([
        trade("sales", "2025-10-03", "4000", 1200, "S"),
        trade("sales", "2025-10-04", "4000", 120, "S", { documentType: "credit-note" }),
        trade("sales", "2025-10-05", "4001", 105, "R"),
        trade("sales", "2025-10-06", "4002", 400, "E"),
        trade("sales", "2025-10-07", "4002", 300, "OS"),
        trade("sales", "2025-10-08", "4003", 900, "RC"),
        trade("sales", "2025-11-09", "4004", 2500, "NA"),
        trade("purchases", "2025-10-10", "5000", 600, "S", { taxRate: 0.2 }),
        trade("purchases", "2025-10-11", "5200", 210, "R", { taxRate: 0.05 }),
        trade("purchases", "2025-10-12", "5400", 80, "Z"),
        trade("purchases", "2025-10-13", "5600", 45, "OS"),
        trade("purchases", "2025-10-14", "5100", 1000, "NA"),
        trade("purchases", "2025-11-15", "5800", 1000, "RC"),
        trade("purchases", "2025-12-16", "5000", 2000, "RC", { "diya-gl:cisRate": 0.2 }),
      ]);
      const answer = await deriveVatReturn(book, lines, { periodEnd: "2025-12-31" });
      // Box 1: 200 - 20 (S less its credit note) + 5 (R) + 200 + 400 (the two reverse charge purchases).
      // Box 4: 100 (S) + 10 (R) + 200 + 400 (reverse charge).
      // Box 6: 1000 - 100 + 100 + 400 + 300 + 900, and 1000 for the reverse charge purchase of a service from abroad.
      // Box 7: 500 + 200 + 80, and 1000 + 2000 for both reverse charge purchases; the OS and NA purchases are left out.
      expect(answer.boxes).toEqual({ box1: 785, box2: 0, box3: 785, box4: 710, box5: 75, box6: 3600, box7: 3780, box8: 0, box9: 0 });
      expect(answer.notes.some((note) => note.includes("domestic reverse charge"))).toBe(true);
      const accounts = (box) => answer.lines[box].map((l) => `${l.account}:${l.taxCode}`);
      expect(accounts("box1")).toEqual(["4000:S", "4000:S", "4001:R", "5800:RC", "5000:RC"]);
      expect(accounts("box6")).toEqual(["4000:S", "4000:S", "4001:R", "4002:E", "4002:OS", "4003:RC", "5800:RC"]);
      expect(accounts("box7")).toEqual(["5000:S", "5200:R", "5400:Z", "5800:RC", "5000:RC"]);
    });

    it("refuses a line whose tax code no VAT return knows", async () => {
      const { book, lines } = bookWith([trade("sales", "2025-07-10", "4000", 1200, "S"), trade("sales", "2025-07-11", "4000", 60, "X")]);
      await expect(deriveVatReturn(book, lines, { periodEnd: "2025-09-30" })).rejects.toThrow(/T-\d+ carries tax code X/);
    });
  });

  it("a book of standard rated lines gives the workbook's VAT return forms exactly, for any book the engine writes", async () => {
    const standardRatedPlans = companyBookPlans
      .filter((plan) => plan.kind === "statements")
      .map((plan) => ({
        ...plan,
        vatRegistered: true,
        stages: plan.stages.map((stage) => ({
          ...stage,
          actions: stage.actions.map((action) => ("taxed" in action ? { ...action, taxed: true } : action)),
        })),
      }));
    await fc.assert(
      fc.asyncProperty(standardRatedPlans, async (plan) => {
        const books = await buildBooksFromPlan(plan);
        const { book, lines } = books[books.length - 1];
        const results = calculatedResultsFor(book, lines, await loadTaxDataForBook(book));
        for (const { periodEnd, form } of quarterForms(results).slice(0, 4)) {
          const answer = await deriveVatReturn(book, lines, { periodEnd });
          expect(answer.followsTaxCodes).toBe(false);
          expectWorkbookForm(answer.boxes, form);
        }
      }),
      { numRuns: 25 },
    );
  });

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
