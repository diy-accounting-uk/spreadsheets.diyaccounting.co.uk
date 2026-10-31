// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { SCHEDULE_ASSET_CLASSES, SCHEDULE_EXISTING_WRITING_DOWN_PERCENT } from "../layout.js";

export function checkFixedAssets(ctx) {
  const { check, checkText, num, results, taxData } = ctx;

  // ── Fixed assets: the published note against the asset schedule ──────────
  //
  // PubNotes reads the Schedule class by class across a cross-file external
  // link, so reading both sides and comparing them proves the link carried
  // the right figures. Every row is anchored in the Schedule's own totals,
  // never in another cell of the note, so consistent zeros cannot pass.
  const schedule = results["Fixedassets.xlsx!Schedule"];
  const notes = results.PubNotes;
  if (schedule) {
    // Closing NBV identity within the Schedule itself: cost less disposals,
    // less depreciation carried forward less depreciation on the disposals.
    check(
      "Fixed assets: closing NBV = cost less disposals, less depreciation carried forward less depreciation on disposals",
      num(schedule.K1),
      num(schedule.E1) - num(schedule.W1) - (num(schedule.J1) - num(schedule.X1)),
    );
  }
  // Row 50's opening tax value (O50) and disposal proceeds (V50, read via
  // Y50's own inputs) are values this module wrote from the fixture, not
  // sheet arithmetic, so recomputing the WDA and balancing allowance from
  // them independently pins the disposal-year split: WDA claimed in full
  // even in the year of sale, then the remaining pool measured against the
  // sale proceeds. A reintroduced cap or threshold on the motor vehicle
  // formulas would move R50/Y50 away from this figure without moving O50.
  if (schedule && taxData && num(schedule.O50) > 0) {
    const openingTaxValue = num(schedule.O50);
    const proceeds = num(schedule.V50) || 0;
    const wdaRate = SCHEDULE_EXISTING_WRITING_DOWN_PERCENT(taxData);
    const expectedWda = openingTaxValue * wdaRate;
    const expectedPool = openingTaxValue - expectedWda;
    const expectedBalancingAllowance = expectedPool - proceeds;
    check("Schedule: motor vehicle WDA = opening tax value x the year's WDA rate, uncapped", num(schedule.R50), expectedWda);
    check("Schedule: motor vehicle pool after WDA = opening tax value less WDA", num(schedule.S50), expectedPool);
    check(
      "Schedule: motor vehicle balancing allowance = pool after WDA less disposal proceeds",
      num(schedule.Y50),
      expectedBalancingAllowance,
    );
    check(
      "Schedule: motor vehicle WDA + balancing allowance = opening tax value less disposal proceeds",
      num(schedule.R50) + num(schedule.Y50),
      openingTaxValue - proceeds,
    );
  }
  if (schedule && notes) {
    for (const [className, layout] of Object.entries(SCHEDULE_ASSET_CLASSES)) {
      const col = layout.noteColumn;
      const existing = layout.existingTotalRow;
      const added = layout.newTotalRow;
      const noteRow = (row) => num(notes[`${col}${row}`]);
      const both = (scheduleCol) => num(schedule[`${scheduleCol}${existing}`]) + num(schedule[`${scheduleCol}${added}`]);

      check(`Fixed asset note (${className}): cost brought forward = Schedule`, noteRow(8), num(schedule[`E${existing}`]));
      check(`Fixed asset note (${className}): additions = Schedule`, noteRow(9), num(schedule[`E${added}`]));
      check(`Fixed asset note (${className}): disposals at cost = Schedule`, noteRow(10), both("W"));
      check(`Fixed asset note (${className}): cost carried forward`, noteRow(11), noteRow(8) + noteRow(9) - noteRow(10));
      check(`Fixed asset note (${className}): depreciation brought forward = Schedule`, noteRow(14), num(schedule[`F${existing}`]));
      check(`Fixed asset note (${className}): charge for the year = Schedule`, noteRow(15), both("I"));
      check(`Fixed asset note (${className}): depreciation on disposals = Schedule`, noteRow(16), both("X"));
      check(`Fixed asset note (${className}): depreciation carried forward`, noteRow(17), noteRow(14) + noteRow(15) - noteRow(16));
      check(`Fixed asset note (${className}): net book value = cost less depreciation`, noteRow(20), noteRow(11) - noteRow(17));
    }

    check("Fixed asset note: total cost brought forward = Schedule existing assets", num(notes.G8), num(schedule.E57));
    check("Fixed asset note: total additions = Schedule new assets", num(notes.G9), num(schedule.E110));
    check("Fixed asset note: total charge for the year = Schedule", num(notes.G15), num(schedule.I1));
    check("Fixed asset note: total disposals at cost = Schedule", num(notes.G10), num(schedule.W1));
    check("Fixed asset note: total depreciation on disposals = Schedule", num(notes.G16), num(schedule.X1));
    check(
      "Fixed asset note: total net book value = the asset class columns",
      num(notes.G20),
      Object.values(SCHEDULE_ASSET_CLASSES).reduce((s, l) => s + num(notes[`${l.noteColumn}20`]), 0),
    );

    // The Schedule's own per-class comparison against the opening balance
    // sheet. Column B on each class totals row reads OpenAccounts across a
    // leaf-to-hub external link and reports either the class name or a
    // warning to go back and check the opening figures. It is the only place
    // the fixed asset schedule and the opening balance sheet meet, so a
    // class entered on one and not the other shows up here and nowhere else.
    for (const [className, layout] of Object.entries(SCHEDULE_ASSET_CLASSES)) {
      const verdict = schedule[`B${layout.existingTotalRow}`];
      checkText(
        `Fixed asset schedule (${className}): opening cost and depreciation agree with the opening balance sheet`,
        typeof verdict === "string" ? verdict : "",
        (text) => text.startsWith("Existing "),
        "an Existing ... heading",
      );
    }
  }

  // The balance sheet's fixed asset line is built from the trial balance,
  // which takes the cost movements from Purchases and Sales and the
  // depreciation from the Schedule. It can only equal the note's net book
  // value when the Schedule and the two ledgers agree.
  const pubBalSht = results.PubBalSht;
  if (pubBalSht && notes) {
    check("Published balance sheet: fixed assets = fixed asset note net book value", num(pubBalSht.F6), num(notes.G20));
  }

  // The share register carries no opening/closing split of its own -- it is
  // the company's live share register as of the accounts date -- so it ties
  // to the closing balance sheet figure. F1 is the sheet's own nominal-value
  // formula (=F3) and G1 its own shares-issued total (=SUM(G3:G19)).
  const register = results["Companysecretary.xlsx!RegisterofMembers"];
  if (register && pubBalSht) {
    check(
      "RegisterofMembers: nominal value x shares issued = PubBalSht share capital",
      (register.F1 || 0) * (register.G1 || 0),
      num(pubBalSht.F36),
    );
  }

  return { schedule, notes, pubBalSht, register };
}
