// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// ltd-form-layouts.test.js — proves app/data/hmrc/form-layouts/ltd.json: every
// row resolves to exactly one row of the filing data it names, every cell it
// names is a cell the Ltd product reads back, no row names a cell the filing
// data already carries, every rule says why, the FRS 105 composite headings
// agree with the filing data, and the CT600 form prints the box list the four
// forms were built around.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { standardReads, multiFileOptions } from "../products/ltd.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const HUB_FILE = "Financialaccounts.xlsx";

const layout = JSON.parse(readFileSync(resolve(REPO_ROOT, "app", "data", "hmrc", "form-layouts", "ltd.json"), "utf8"));

function filingFile(name) {
  return parseTOML(readFileSync(resolve(REPO_ROOT, layout.filingData[name]), "utf8"));
}

const ct600 = filingFile("ct600");
const computation = filingFile("computation");
const accounts = filingFile("accounts");

// The three ref shapes, resolved the way products/ltd-forms.js resolves them.
function boxesNumbered(number) {
  return ct600.box.filter((box) => box.number === number);
}

function linesKeyed(ref) {
  const slash = ref.indexOf("/");
  const [section, part] = ref.slice(0, slash).split(".");
  const label = ref.slice(slash + 1);
  return computation.line.filter((line) => String(line.section) === section && String(line.part) === part && line.label === label);
}

function headingsKeyed(ref) {
  const [statement, format, letter] = ref.split("/");
  return accounts.heading.filter(
    (heading) =>
      heading.statement === statement &&
      String(heading.format === undefined ? "-" : heading.format) === format &&
      heading.letter === letter,
  );
}

function filingRowFor(row, form) {
  if (!form.source) return null;
  if (form.source === "ct600" && row.box !== undefined) return boxesNumbered(row.box)[0] ?? null;
  if (form.source === "computation" && row.line !== undefined) return linesKeyed(row.line)[0] ?? null;
  if (form.source === "accounts" && row.heading !== undefined) return headingsKeyed(row.heading)[0] ?? null;
  return null;
}

// Every row of a form, financial-year groups flattened, each paired with the
// form it belongs to. Statement sections carry prose, not rows.
function allRows(form) {
  const out = [];
  for (const section of form.sections ?? []) {
    for (const row of section.rows ?? []) {
      if (row.group) for (const inner of row.rows) out.push(inner);
      else out.push(row);
    }
  }
  return out;
}

const LAYOUT_FORMS = ["accounts", "computation", "ct600"];

// The reads the Ltd product performs: the hub's own sheets under the hub file
// name, every leaf sheet under its own file, keyed "<file>!<sheet>!<cell>".
function everyRead() {
  const reads = new Set();
  const standard = standardReads();
  for (const [sheet, cells] of Object.entries(standard)) {
    for (const cell of cells) reads.add(`${HUB_FILE}!${sheet}!${cell}`);
  }
  const { additionalReads } = multiFileOptions();
  for (const [file, sheets] of Object.entries(additionalReads)) {
    for (const [sheet, cells] of Object.entries(sheets)) {
      for (const cell of cells) reads.add(`${file}!${sheet}!${cell}`);
    }
  }
  return reads;
}

const READS = everyRead();

// A rule's cell may be wrapped as positivePartOf(<ref>) or
// negativePartOf(<ref>): the same reference, one side of nil.
function unwrapRef(ref) {
  const match = /^(?:positivePartOf|negativePartOf)\((.*)\)$/.exec(ref);
  return match ? match[1] : ref;
}

// Every cell reference a row names: its own cell, its comparative, and the
// cells behind a rule (a tick rule names the cells it tests and what it tests
// them against).
function cellsNamedBy(row) {
  const refs = [];
  if (row.cell) refs.push(row.cell);
  if (row.priorCell) refs.push(row.priorCell);
  if (row.blankWhen) refs.push(row.blankWhen);
  if (row.rule) {
    for (const ref of row.rule.cells ?? []) refs.push(unwrapRef(ref));
    for (const test of row.rule.tests ?? []) {
      refs.push(test.cell);
      if (test.against) refs.push(test.against);
    }
  }
  return refs;
}

function groupsOf(form) {
  const out = [];
  for (const section of form.sections ?? []) {
    for (const row of section.rows ?? []) if (row.group) out.push(row);
  }
  return out;
}

describe("every row the layout renders is in the filing data", () => {
  it("each CT600 box resolves to exactly one box in ct600-v3.toml", () => {
    for (const row of allRows(layout.forms.ct600)) {
      if (row.box === undefined) continue;
      expect(boxesNumbered(row.box).length, `CT600 box ${row.box}`).toBe(1);
    }
  });

  it("each computation line resolves to exactly one line in ct-computation-v1.1.toml", () => {
    const refs = allRows(layout.forms.computation)
      .filter((row) => row.line !== undefined)
      .map((row) => row.line);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(linesKeyed(ref).length, `computation line "${ref}"`).toBe(1);
  });

  it("each accounts heading resolves to exactly one heading in frs105-formats.toml", () => {
    const refs = allRows(layout.forms.accounts)
      .filter((row) => row.heading !== undefined)
      .map((row) => row.heading);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(headingsKeyed(ref).length, `accounts heading "${ref}"`).toBe(1);
  });
});

describe("every cell a layout row names is a read", () => {
  it("the three layout forms", () => {
    let counted = 0;
    for (const formName of LAYOUT_FORMS) {
      for (const row of allRows(layout.forms[formName])) {
        for (const ref of cellsNamedBy(row)) {
          expect(READS.has(ref), `${formName}: ${ref} is not a cell the Ltd product reads`).toBe(true);
          counted += 1;
        }
      }
      for (const group of groupsOf(layout.forms[formName])) {
        if (!group.blankWhen) continue;
        expect(READS.has(group.blankWhen), `${formName}: ${group.blankWhen} is not a read`).toBe(true);
      }
    }
    expect(counted).toBeGreaterThan(0);
  });

  it("the VAT block's own sheets and cells", () => {
    const vat = layout.forms.vat;
    for (const quarter of vat.quarters) {
      for (const cell of [vat.period.endCell, vat.period.dueCell]) {
        expect(READS.has(`${vat.file}!${vat.sheetPrefix}${quarter}!${cell}`)).toBe(true);
      }
      for (const box of vat.boxes) {
        if (!box.cell) continue;
        const ref = `${vat.file}!${vat.sheetPrefix}${quarter}!${box.cell}`;
        expect(READS.has(ref), `${ref} is not a read`).toBe(true);
      }
    }
    for (const row of [vat.coverage.firstRow, vat.coverage.lastRow]) {
      for (const column of [vat.coverage.endColumn, vat.coverage.outputVatColumn, vat.coverage.inputVatColumn]) {
        expect(READS.has(`${vat.coverage.sheet}!${column}${row}`)).toBe(true);
      }
      expect(READS.has(`${vat.flatRate.sheet}!${vat.flatRate.column}${row}`)).toBe(true);
    }
  });
});

describe("a row never names a cell the filing data already carries", () => {
  it("no row has both a cell and a filing row with a sheetCell", () => {
    for (const formName of LAYOUT_FORMS) {
      const form = layout.forms[formName];
      for (const row of allRows(form)) {
        if (!row.cell) continue;
        const filingRow = filingRowFor(row, form);
        expect(
          filingRow?.sheetCell,
          `${formName}: ${row.box ?? row.line ?? row.heading} carries a cell and its filing row already names ${filingRow?.sheetCell}`,
        ).toBeUndefined();
      }
    }
  });
});

describe("every rule carries a reason", () => {
  it("why is a sentence, not a placeholder", () => {
    const rules = [];
    for (const formName of LAYOUT_FORMS) for (const row of allRows(layout.forms[formName])) if (row.rule) rules.push(row.rule);
    for (const box of layout.forms.vat.boxes) if (box.rule) rules.push(box.rule);
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(typeof rule.why, `rule "${rule.op}" carries no why`).toBe("string");
      expect(rule.why.length, `rule "${rule.op}"'s why is too short to say anything`).toBeGreaterThan(20);
    }
  });
});

describe("the FRS 105 composite headings match the filing data", () => {
  function sheetCellsOf(heading) {
    const [sheetPart, first] = [heading.sheetCell.slice(0, heading.sheetCell.lastIndexOf("!")), heading.sheetCell.split("!").pop()];
    return first.split("+").map((cell) => `${sheetPart}!${cell}`);
  }

  it("headings D and E sum exactly the cells the filing data names", () => {
    for (const letter of ["D", "E"]) {
      const row = allRows(layout.forms.accounts).find((candidate) => candidate.heading === `profit-and-loss/-/${letter}`);
      const heading = headingsKeyed(row.heading)[0];
      expect(row.rule.op).toBe("sum");
      expect(row.rule.cells).toEqual(sheetCellsOf(heading));
    }
  });

  it("heading F deducts them from the administrative expenses the filing data names", () => {
    const row = allRows(layout.forms.accounts).find((candidate) => candidate.heading === "profit-and-loss/-/F");
    const heading = headingsKeyed(row.heading)[0];
    expect(row.rule.op).toBe("deduct");
    expect(row.rule.cells[0]).toBe(heading.sheetCell);
    const staffAndDepreciation = ["D", "E"].flatMap((letter) => sheetCellsOf(headingsKeyed(`profit-and-loss/-/${letter}`)[0]));
    expect(row.rule.cells.slice(1)).toEqual(staffAndDepreciation);
  });
});

describe("box numbers are unique within a form and rise through it", () => {
  function assertUniqueAscending(numbers, what) {
    const seen = new Set();
    let previous = -Infinity;
    for (const number of numbers) {
      expect(seen.has(number), `${what}: box ${number} is repeated`).toBe(false);
      seen.add(number);
      expect(number, `${what}: box ${number} does not sort after ${previous}`).toBeGreaterThan(previous);
      previous = number;
    }
  }

  it("CT600", () => {
    assertUniqueAscending(
      allRows(layout.forms.ct600)
        .filter((row) => row.box !== undefined)
        .map((row) => row.box),
      "CT600",
    );
  });

  it("VAT", () =>
    assertUniqueAscending(
      layout.forms.vat.boxes.map((box) => box.box),
      "VAT",
    ));

  it("the computation's CT600 cross-references are unique", () => {
    const boxes = allRows(layout.forms.computation)
      .filter((row) => row.ct600Box !== undefined)
      .map((row) => row.ct600Box);
    expect(new Set(boxes).size).toBe(boxes.length);
    for (const box of boxes) expect(boxesNumbered(box).length, `CT600 box ${box}`).toBe(1);
  });
});

describe("the CT600 form prints the boxes the plan names", () => {
  it("matches box for box", () => {
    expect(
      allRows(layout.forms.ct600)
        .filter((row) => row.box !== undefined)
        .map((row) => row.box),
    ).toEqual([
      1, 2, 3, 30, 35, 80, 145, 155, 160, 165, 170, 235, 295, 300, 305, 315, 326, 327, 328, 329, 330, 335, 340, 345, 380, 385, 390, 395,
      430, 435, 440, 475, 510, 515, 525, 528, 595, 600, 605, 620, 690, 695, 700, 705, 710, 760, 975, 980, 985,
    ]);
  });
});

describe("the four forms reach the sheet in at least forty-five places", () => {
  it("counts the cells behind them, layout and filing data together", () => {
    const cells = new Set();
    for (const formName of LAYOUT_FORMS) {
      const form = layout.forms[formName];
      for (const row of allRows(form)) {
        for (const ref of cellsNamedBy(row)) cells.add(ref);
        const filingRow = filingRowFor(row, form);
        if (!filingRow?.sheetCell) continue;
        const sheetPart = filingRow.sheetCell.slice(0, filingRow.sheetCell.lastIndexOf("!"));
        for (const cell of filingRow.sheetCell.split("!").pop().split("+")) cells.add(`${sheetPart}!${cell}`);
      }
    }
    const vat = layout.forms.vat;
    for (const quarter of vat.quarters) {
      for (const cell of [vat.period.endCell, vat.period.dueCell]) cells.add(`${vat.file}!${vat.sheetPrefix}${quarter}!${cell}`);
      for (const box of vat.boxes) if (box.cell) cells.add(`${vat.file}!${vat.sheetPrefix}${quarter}!${box.cell}`);
    }
    for (const ref of cells) expect(READS.has(ref), `${ref} is not a read`).toBe(true);
    expect(cells.size).toBeGreaterThanOrEqual(45);
  });
});
