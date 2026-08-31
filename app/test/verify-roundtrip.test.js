// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// The comparator that scores both halves of the export tuple: EQ1 over the
// two report.json documents, EQ2 over the two data/ directories.
//
// The end-to-end case runs diya-gl -> Excel -> export and scores the export
// against the original fixture. Comparing a second export with the first one
// instead is stable on data the first pass has already changed, so it passes
// whatever the first pass lost.
//
// The end-to-end case requires LibreOffice (brew install --cask libreoffice).

import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "child_process";
import JSZip from "jszip";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { hasLibreOffice, buildSheetMap, readCellValue, loadSharedStrings } from "../lib/spreadsheet-runner.js";
import {
  roundHalfUp,
  canonicalForUnit,
  entriesEqual,
  toleranceByKey,
  scoreReportDocuments,
  scoreReportDocumentsByKind,
  scoreDataHalves,
  flattenBook,
  unrepresentableFields,
  periodFrameOffset,
  shiftPostingDate,
} from "../bin/verify-roundtrip.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const NODE = process.execPath;

// A multi-file generate drives roughly thirty LibreOffice conversions, and
// macOS LibreOffice runs several times slower than the Linux build CI uses.
// Give each child the whole test budget so a slow host reports a fidelity
// difference rather than killing the generate before anything is compared.
const STEP_TIMEOUT_MS = 900_000;

function run(args) {
  return execFileSync(NODE, args, { cwd: ROOT, encoding: "utf8", timeout: STEP_TIMEOUT_MS });
}

// ── Canonicalisation by unit ───────────────────────────────────────────────

describe("roundHalfUp", () => {
  it("rounds a half away from zero on the digits, not through a float", () => {
    expect(roundHalfUp("0.005", 2)).toBe("0.01");
    expect(roundHalfUp("1.005", 2)).toBe("1.01");
    expect(roundHalfUp("2.675", 2)).toBe("2.68");
    expect(roundHalfUp("-0.005", 2)).toBe("-0.01");
  });

  it("keeps every real penny and drops representation noise below one", () => {
    expect(roundHalfUp("6926.399999999999", 2)).toBe("6926.40");
    expect(roundHalfUp("6926.404", 2)).toBe("6926.40");
    expect(roundHalfUp("6926.406", 2)).toBe("6926.41");
  });

  it("pads a short fraction and writes a rounded nil without a sign bit", () => {
    expect(roundHalfUp("12", 2)).toBe("12.00");
    expect(roundHalfUp("-0.001", 2)).toBe("0.00");
  });
});

describe("canonicalForUnit", () => {
  it("rounds money to the penny and a rate to six places", () => {
    expect(canonicalForUnit("6926.399999999999", "money")).toBe("6926.40");
    expect(canonicalForUnit("0.2000000001", "rate")).toBe("0.200000");
  });

  it("compares an unrounded unit as its own trimmed text", () => {
    expect(canonicalForUnit(" 2026-03-31 ", "date")).toBe("2026-03-31");
    expect(canonicalForUnit(" 5501 ", "identifier")).toBe("5501");
    expect(canonicalForUnit("12.0", "count")).toBe("12.0");
  });

  it("leaves a value with no declared unit exactly as it stands", () => {
    expect(canonicalForUnit("6926.399999999999")).toBe("6926.399999999999");
  });
});

// ── The tolerance policy ───────────────────────────────────────────────────

const BRIDGE_CHECK = {
  key: "check/Accounting profit to tax profit bridge closes to zero",
  unit: "verdict",
  value: "pass",
  tolerance: "0.01",
};
const NETTING_CHECK = {
  key: "check/Category netting: Stock (s) net reaches Profit & Loss Acc!C6 with no residue",
  unit: "verdict",
  value: "pass",
  tolerance: "0.01",
};
const SA103S_CHECK = { key: "check/SA103S: Net profit close to P&L Net", unit: "verdict", value: "pass", tolerance: "3339.08" };

describe("toleranceByKey", () => {
  it("gives the bridge residue the window its own check allows", () => {
    expect(toleranceByKey([BRIDGE_CHECK]).get("section/accounting-profit-to-tax-profit-bridge/residue")).toBe(0.01);
  });

  it("gives a netting row's net and residue the window that row's check allows", () => {
    const tolerances = toleranceByKey([NETTING_CHECK]);
    expect(tolerances.get("section/journal-category-vat-netting/stock-s/net")).toBe(0.01);
    expect(tolerances.get("section/journal-category-vat-netting/stock-s/residue")).toBe(0.01);
  });

  it("hands a row's window to the cell it is scored through", () => {
    const tolerances = toleranceByKey([
      SA103S_CHECK,
      { key: "section/self-assessment-sa103s/net-profit-loss", unit: "money", value: "333908", source: "cell/SE Short!D71" },
    ]);
    expect(tolerances.get("cell/SE Short!D71")).toBe(3339.08);
  });

  it("opens no window for a key no tolerance row names", () => {
    const tolerances = toleranceByKey([
      BRIDGE_CHECK,
      { key: "check/Total Sales", unit: "verdict", value: "pass", tolerance: "1" },
      { key: "check/Gross Profit", unit: "verdict", value: "pass", tolerance: "1" },
    ]);
    expect(tolerances.size).toBe(1);
    expect(tolerances.has("cell/Profit & Loss Acc!C4")).toBe(false);
  });
});

describe("entriesEqual", () => {
  const money = (value) => ({ key: "k", unit: "money", value });

  it("passes a money difference under half a penny and fails one over it", () => {
    expect(entriesEqual(money("100.000"), money("100.004"))).toBe(true);
    expect(entriesEqual(money("100.000"), money("100.006"))).toBe(false);
  });

  it("fails a money difference of a penny however wide the owning check is", () => {
    expect(entriesEqual(money("100.00"), money("100.01"))).toBe(false);
  });

  it("passes a money difference inside a window the policy grants", () => {
    expect(entriesEqual(money("100.00"), money("100.01"), 0.01)).toBe(true);
    expect(entriesEqual(money("100.00"), money("100.02"), 0.01)).toBe(false);
  });

  it("fails any difference in an identifier, however small it looks", () => {
    const left = { key: "k", unit: "identifier", value: "5501" };
    const right = { key: "k", unit: "identifier", value: "5300" };
    expect(entriesEqual(left, right)).toBe(false);
    expect(entriesEqual(left, right, 1000)).toBe(false);
  });

  it("fails a text, date or verdict difference and never widens one", () => {
    expect(entriesEqual({ key: "k", unit: "date", value: "2026-03-31" }, { key: "k", unit: "date", value: "2025-03-31" })).toBe(false);
    expect(entriesEqual({ key: "k", unit: "verdict", value: "pass" }, { key: "k", unit: "verdict", value: "fail" }, 1)).toBe(false);
  });

  it("compares an undeclared unit exactly", () => {
    expect(entriesEqual({ key: "k", value: "100.000" }, { key: "k", value: "100.0" })).toBe(false);
  });
});

// ── EQ1 ────────────────────────────────────────────────────────────────────

function document(values) {
  return { package: "bst", engine: "excel", values };
}

describe("scoreReportDocuments", () => {
  const excel = document([
    { key: "cell/A!B1", unit: "money", value: "100" },
    { key: "cell/A!B2", unit: "money", value: "200" },
    { key: "cell/A!B3", unit: "money", value: "300" },
  ]);

  it("counts equal, differing, no JS value and no Excel value", () => {
    const js = document([
      { key: "cell/A!B1", unit: "money", value: "100" },
      { key: "cell/A!B2", unit: "money", value: "999" },
      { key: "cell/A!B4", unit: "money", value: "400" },
    ]);
    const score = scoreReportDocuments(excel, js);
    expect(score).toMatchObject({ equal: 1, differing: 1, noJsValue: 1, noExcelValue: 1 });
    expect(score.differingKeys).toEqual(["cell/A!B2"]);
    expect(score.noJsValueKeys).toEqual(["cell/A!B3"]);
    expect(score.noExcelValueKeys).toEqual(["cell/A!B4"]);
  });

  it("flips exactly one key when exactly one value is corrupted", () => {
    const before = scoreReportDocuments(excel, excel);
    expect(before).toMatchObject({ equal: 3, differing: 0 });
    const corrupted = document(excel.values.map((entry) => (entry.key === "cell/A!B2" ? { ...entry, value: "201" } : entry)));
    const after = scoreReportDocuments(excel, corrupted);
    expect(after.differing).toBe(1);
    expect(after.differingKeys).toEqual(["cell/A!B2"]);
    expect(after.equal).toBe(2);
  });

  it("scores a row that reprints a cell through that cell, not a second time", () => {
    const values = [
      { key: "cell/A!B1", unit: "money", value: "100" },
      { key: "section/p-l/sales", unit: "money", value: "100", source: "cell/A!B1" },
    ];
    const score = scoreReportDocuments(document(values), document(values));
    expect(score.equal).toBe(1);
  });

  it("scores a total through its operands, and on its own when one is absent", () => {
    const derived = { key: "section/bridge/total", unit: "money", value: "300", derivedFrom: ["section/bridge/a", "section/bridge/b"] };
    const whole = [
      { key: "section/bridge/a", unit: "money", value: "100" },
      { key: "section/bridge/b", unit: "money", value: "200" },
      derived,
    ];
    expect(scoreReportDocuments(document(whole), document(whole)).equal).toBe(2);

    const partial = [{ key: "section/bridge/a", unit: "money", value: "100" }, derived];
    expect(scoreReportDocuments(document(partial), document(partial)).equal).toBe(2);
  });

  it("applies a window only where a tolerance row names the key", () => {
    const build = (residue, other) =>
      document([
        BRIDGE_CHECK,
        { key: "section/accounting-profit-to-tax-profit-bridge/residue", unit: "money", value: residue },
        { key: "cell/Profit & Loss Acc!C24", unit: "money", value: other },
      ]);
    const score = scoreReportDocuments(build("0", "100.00"), build("0.008", "100.01"));
    expect(score.differingKeys).toEqual(["cell/Profit & Loss Acc!C24"]);
    expect(score.equal).toBe(2);
  });

  it("breaks a compliance verdict down beside the values it is drawn from", () => {
    const byKind = scoreReportDocumentsByKind(
      document([
        { key: "cell/A!B1", unit: "money", value: "1" },
        { key: "section/p-l/x", unit: "money", value: "2" },
        { key: "check/Total Sales", unit: "verdict", value: "pass" },
      ]),
      document([
        { key: "cell/A!B1", unit: "money", value: "1" },
        { key: "section/p-l/x", unit: "money", value: "3" },
        { key: "check/Total Sales", unit: "verdict", value: "fail" },
      ]),
    );
    expect(byKind.get("cell")).toMatchObject({ equal: 1, differing: 0 });
    expect(byKind.get("section/p-l")).toMatchObject({ equal: 0, differing: 1 });
    expect(byKind.get("check")).toMatchObject({ equal: 0, differing: 1 });
  });
});

// ── EQ2 ────────────────────────────────────────────────────────────────────

describe("flattenBook", () => {
  it("writes one dotted path per leaf, arrays indexed and dates as YYYY-MM-DD", () => {
    const flat = flattenBook({
      documentInfo: { periodCoveredEnd: new Date(Date.UTC(2026, 2, 31)) },
      members: [{ memberID: "M1", shares: 100 }],
      accounts: { sales: { 4000: { accountMainDescription: "Sales" } } },
    });
    expect(flat.get("documentInfo.periodCoveredEnd")).toBe("2026-03-31");
    expect(flat.get("members[0].memberID")).toBe("M1");
    expect(flat.get("accounts.sales.4000.accountMainDescription")).toBe("Sales");
  });
});

describe("periodFrameOffset", () => {
  it("finds no offset when the year end already sits on the scenario's own period start", () => {
    expect(periodFrameOffset(4, 3)).toBe(0);
  });

  it("finds the whole-month gap for a non-March year end", () => {
    expect(periodFrameOffset(4, 5)).toBe(2);
    expect(periodFrameOffset(4, 2)).toBe(11);
  });
});

describe("shiftPostingDate", () => {
  it("moves a date forward by whole months", () => {
    expect(shiftPostingDate("2025-04-01", 2)).toBe("2025-06-01");
  });

  it("clamps a day the shifted month lacks to that month's own last day", () => {
    expect(shiftPostingDate("2025-03-31", 1)).toBe("2025-04-30");
    expect(shiftPostingDate("2025-01-31", 1)).toBe("2025-02-28");
  });
});

describe("scoreDataHalves", () => {
  let dir;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  function writePair(fixtureLines, exportLines, fixtureBook = "", exportBook = "") {
    dir = mkdtempSync(join(tmpdir(), "verify-roundtrip-eq2-"));
    const fixture = join(dir, "fixture");
    const exported = join(dir, "export");
    mkdirSync(fixture);
    mkdirSync(exported);
    writeFileSync(join(fixture, "lines.jsonl"), fixtureLines.map((line) => JSON.stringify(line)).join("\n") + "\n");
    writeFileSync(join(exported, "lines.jsonl"), exportLines.map((line) => JSON.stringify(line)).join("\n") + "\n");
    writeFileSync(join(fixture, "book.toml"), fixtureBook);
    writeFileSync(join(exported, "book.toml"), exportBook);
    return { fixture, exported };
  }

  const LINE = {
    sourceJournalID: "purchases",
    postingDate: "2025-04-01",
    accountMainID: "5501",
    amount: 120,
    detailComment: "Acme",
    documentReference: "INV-1",
  };

  it("counts a line the export loses", () => {
    const { fixture, exported } = writePair([LINE, { ...LINE, entryNumber: "B" }], [LINE]);
    const score = scoreDataHalves(fixture, exported);
    expect(score).toMatchObject({ fixtureLines: 2, exportedLines: 1, linesLost: 1 });
  });

  it("separates a surviving transaction from a surviving account identity", () => {
    const { fixture, exported } = writePair([LINE], [{ ...LINE, accountMainID: "5300" }]);
    const score = scoreDataHalves(fixture, exported);
    expect(score.coarseMatches).toBe(1);
    expect(score.accountMatches).toBe(0);
    expect(score.wholeLineMatches).toBe(0);
  });

  it("names every field kind the export drops", () => {
    const { fixture, exported } = writePair(
      [{ ...LINE, "taxCode": "S", "diya-gl:employeeID": "E1" }],
      [{ ...LINE, documentReference: undefined }],
    );
    const score = scoreDataHalves(fixture, exported);
    expect(score.fieldsDropped).toEqual(["diya-gl:employeeID", "documentReference", "taxCode"]);
    expect(score.fieldsDroppedCount).toBe(3);
  });

  it("counts a field the encoding has no home for apart from one the export drops", () => {
    const inventory = { fields: [{ field: "measurableQuantity", products: ["bst", "ltd"], reason: "no column holds it" }] };
    const { fixture, exported } = writePair([{ ...LINE, measurableQuantity: 120, taxCode: "S" }], [LINE]);
    const score = scoreDataHalves(fixture, exported, unrepresentableFields("bst", inventory));
    expect(score.fieldsDropped).toEqual(["taxCode"]);
    expect(score.fieldsUnrepresentable).toEqual(["measurableQuantity"]);
    expect(unrepresentableFields("se", inventory).size).toBe(0);
  });

  it("matches lines on every field the encoding claims to carry", () => {
    const inventory = { fields: [{ field: "entryNumber", products: ["bst"], reason: "renumbered on the way out" }] };
    const { fixture, exported } = writePair([{ ...LINE, entryNumber: "PC-0007" }], [{ ...LINE, entryNumber: "EXP-0001" }]);
    expect(scoreDataHalves(fixture, exported).wholeLineMatches).toBe(0);
    expect(scoreDataHalves(fixture, exported, unrepresentableFields("bst", inventory)).wholeLineMatches).toBe(1);
  });

  it("matches on the full field set only when every field survives", () => {
    const { fixture, exported } = writePair([LINE], [LINE]);
    expect(scoreDataHalves(fixture, exported).wholeLineMatches).toBe(1);
  });

  it("matches a coarse and account line only once the fixture is shifted into the export's frame", () => {
    const { fixture, exported } = writePair([LINE], [{ ...LINE, postingDate: "2025-06-01" }]);
    expect(scoreDataHalves(fixture, exported).coarseMatches).toBe(0);
    const shifted = scoreDataHalves(fixture, exported, new Set(), 2);
    expect(shifted.coarseMatches).toBe(1);
    expect(shifted.accountMatches).toBe(1);
    // The wrong offset stays unmatched, so the shift is doing the work and
    // not just widening the comparison generally.
    expect(scoreDataHalves(fixture, exported, new Set(), 1).coarseMatches).toBe(0);
  });

  it("leaves an opening-balance journal line at the date it was written on both sides", () => {
    const openingLine = { ...LINE, sourceJournalID: "journal", documentReference: "OB-001" };
    const { fixture, exported } = writePair([openingLine], [openingLine]);
    // Every ordinary line moves with the shift, but this one already matches
    // the export at its own date, so shifting it would break a match that
    // holds without one.
    expect(scoreDataHalves(fixture, exported, new Set(), 2).coarseMatches).toBe(1);
  });

  it("compares book.toml field by field, naming what is missing", () => {
    const fixtureBook = [
      "[documentInfo]",
      'entriesType = "journal"',
      'defaultCurrency = "GBP"',
      "",
      "[accounts.sales.4000]",
      'accountMainDescription = "Sales"',
    ].join("\n");
    const exportBook = ["[documentInfo]", 'entriesType = "journal"', 'defaultCurrency = "EUR"'].join("\n");
    const { fixture, exported } = writePair([LINE], [LINE], fixtureBook, exportBook);
    const score = scoreDataHalves(fixture, exported);
    expect(score.book).toMatchObject({ equal: 1, differing: 1, missing: 1 });
    expect(score.book.differingPaths).toEqual(["documentInfo.defaultCurrency"]);
    expect(score.book.missingPaths).toEqual(["accounts.sales.4000.accountMainDescription"]);
  });
});

// ── The whole tuple, end to end ────────────────────────────────────────────

// unreached is how many fixture lines the export does not bring back as the
// same transaction today: Taxi reprices its mileage claim at the rates the
// sheet bands it by, SE loses its stock adjustment, and Ltd collapses the
// fixed asset debit and credit to net book value and drops two bank opening
// balances. dropped names the fields the export leaves out with no reason
// declared for them. The assertions below are a ratchet, so both can fall and
// the numbers here come down with them, and nothing can raise them.
const PRODUCTS = [
  { name: "bst", data: "examples/precision-code-ltd/bst", years: "se-2025-2026", yearEnd: "2026-04-05", unreached: 0 },
  {
    name: "taxi",
    data: "examples/sp-sixty-driving/taxi",
    years: "se-2025-2026",
    yearEnd: "2026-04-05",
    unreached: 0,
  },
  { name: "se", data: "examples/precision-code-ltd/advanced", years: "se-2025-2026", yearEnd: "2026-04-05", unreached: 2 },
  { name: "ltd", data: "examples/precision-code-ltd/full", years: "ltd-2025", yearEnd: "2026-03-31", unreached: 5 },
  {
    // A non-March year end exercises the tab-rename and formula-rewrite path
    // (getMonthTabSequence, renameMonthTabs, renameExternalLinkSheetNames,
    // rewriteVatinterfaceFormulas) that the March run never touches, since
    // March is the template's native tab order. generate.js also shifts
    // every posting date onto this package's own accounting period, so the
    // exported dates sit a month or two from the fixture's; dateShiftMonths
    // below puts the fixture through the identical shift before comparing.
    name: "ltd",
    label: "ltd-may",
    data: "examples/precision-code-ltd/full",
    years: "ltd-2025",
    yearEnd: "2025-05-31",
    unreached: 5,
  },
];

// generate.js only reorients Ltd's month tabs (app/products/ltd.js); the
// other three products post the fixture's own dates unchanged whatever
// year end they run at. periodFrameOffset needs the ltd fixture's own
// declared period start, read from its book.toml rather than hand-typed, so
// a change to that fixture keeps this offset correct.
const LTD_PERIOD_START_MONTH =
  new Date(
    parseTOML(readFileSync(resolve(ROOT, "examples/precision-code-ltd/full/book.toml"), "utf8")).documentInfo.periodCoveredStart,
  ).getUTCMonth() + 1;
for (const product of PRODUCTS) {
  if (product.name === "ltd") product.dateShiftMonths = periodFrameOffset(LTD_PERIOD_START_MONTH, Number(product.yearEnd.slice(5, 7)));
}

describe.skipIf(!hasLibreOffice())("Export tuple against the original fixture", () => {
  for (const product of PRODUCTS) {
    const label = product.label || product.name;
    it(`${label}: the export brings the fixture's own lines and accounts back`, { timeout: STEP_TIMEOUT_MS }, () => {
      const pkg = resolve(ROOT, "target", `${label}-rt-pkg`);
      const exported = resolve(ROOT, "target", `${label}-rt-data`);
      const fixture = resolve(ROOT, "target", `${label}-rt-fixture`);

      run([
        "app/bin/generate.js",
        "--package",
        product.name,
        "--years",
        product.years,
        "--year-end",
        product.yearEnd,
        "--data",
        product.data,
        "--output-dir",
        pkg,
        "--skip-guide",
      ]);
      run(["app/bin/export.js", "--package", product.name, "--source-dir", pkg, "--output-dir", exported]);
      // report.js --data writes the fixture itself in canonical form, which
      // is the side the export is measured against.
      run([
        "app/bin/report.js",
        "--package",
        product.name,
        "--data",
        product.data,
        "--years",
        product.years,
        "--year-end",
        product.yearEnd,
        "--output-dir",
        fixture,
      ]);
      // report.js --source-dir alongside --data gives the Excel run the same
      // scenario the JS run has, which is what lets it publish compliance
      // verdicts of its own rather than leaving every check/ key unscored.
      const excelReport = resolve(ROOT, "target", `${label}-rt-excel`);
      run([
        "app/bin/report.js",
        "--package",
        product.name,
        "--source-dir",
        pkg,
        "--data",
        product.data,
        "--years",
        product.years,
        "--year-end",
        product.yearEnd,
        "--output-dir",
        excelReport,
      ]);
      const excelDocument = JSON.parse(readFileSync(resolve(excelReport, "report.json"), "utf8"));
      expect(excelDocument.values.some((entry) => entry.key.startsWith("check/"))).toBe(true);

      const inventory = JSON.parse(readFileSync(resolve(ROOT, "app", "data", "roundtrip-unrepresentable.json"), "utf8"));
      const score = scoreDataHalves(
        resolve(fixture, "data"),
        exported,
        unrepresentableFields(product.name, inventory),
        product.dateShiftMonths ?? 0,
      );

      // Every line the fixture carries comes back, bar the ones this run is
      // known not to reach.
      expect(score.exportedLines).toBeGreaterThanOrEqual(score.fixtureLines - product.unreached);
      // Nothing is silently dropped: every field the export leaves out is
      // one the inventory names a reason for, or one this run already counts.
      expect(score.fieldsDropped).toEqual(product.dropped ?? []);

      // A fixture line reaches the export as at least the same transaction:
      // same date, same amount, same journal (in the period-frame this run's
      // own year end shifted the export's dates into, for the Ltd tracks).
      expect(score.coarseMatches).toBeGreaterThanOrEqual(score.fixtureLines - product.unreached);
      // And wherever the transaction survives, so does the account it was
      // posted to. Several accounts share one code letter, so this is the
      // claim the carrier column exists to make.
      expect(score.accountMatches).toBe(score.coarseMatches);
    });
  }
});

// ── The fixed asset register across a double roundtrip ─────────────────────

const SE_VAN_ROW = 38;
const SE_ASSET_COLUMNS = ["C", "E", "F", "O", "U", "V"];

async function scheduleRow(packageDir, row) {
  const zip = await JSZip.loadAsync(readFileSync(join(packageDir, "Fixedassets.xlsx")));
  const xml = await zip.file((await buildSheetMap(zip)).get("Schedule")).async("string");
  const sharedStrings = await loadSharedStrings(zip);
  return Object.fromEntries(SE_ASSET_COLUMNS.map((column) => [column, readCellValue(xml, `${column}${row}`, sharedStrings)]));
}

describe.skipIf(!hasLibreOffice())("The fixed asset register across a double roundtrip", () => {
  const generate = (data, out) =>
    run([
      "app/bin/generate.js",
      "--package",
      "se",
      "--years",
      "se-2025-2026",
      "--year-end",
      "2026-04-05",
      "--data",
      data,
      "--output-dir",
      out,
      "--skip-guide",
    ]);
  const exportData = (source, out) => run(["app/bin/export.js", "--package", "se", "--source-dir", source, "--output-dir", out]);

  it("carries an opening asset and its in-year disposal into the second pass", { timeout: STEP_TIMEOUT_MS }, async () => {
    const firstPackage = resolve(ROOT, "target", "se-register-pkg1");
    const firstData = resolve(ROOT, "target", "se-register-data1");
    const secondPackage = resolve(ROOT, "target", "se-register-pkg2");
    const secondData = resolve(ROOT, "target", "se-register-data2");

    generate("examples/precision-code-ltd/advanced", firstPackage);
    exportData(firstPackage, firstData);

    // The register the first export recovers, in the order it declares it:
    // the van the year disposes of comes first, so the disposal has an asset
    // to land on when the register is read back.
    const register = parseTOML(readFileSync(join(firstData, "book.toml"), "utf8")).fixedAssets;
    expect(register?.map((asset) => [asset.class, asset.cost, asset.accumulatedDepreciation, asset.taxWrittenDownValue])).toEqual([
      ["motorVehicles", 30000, 9828, 24000],
      ["computerTechnology", 3000, 270, undefined],
    ]);

    generate(firstData, secondPackage);
    exportData(secondPackage, secondData);

    // The van's row on the second package's Schedule is the first package's
    // row: same description, cost, depreciation and tax written down value,
    // and the same disposal date and proceeds in U and V. Without the
    // register the second pass has no opening asset to attach the "fs" sale
    // to and generate throws instead.
    const firstRow = await scheduleRow(firstPackage, SE_VAN_ROW);
    expect(firstRow.U).toBeGreaterThan(0);
    expect(firstRow.V).toBeGreaterThan(0);
    expect(await scheduleRow(secondPackage, SE_VAN_ROW)).toEqual(firstRow);

    // And the data half is a fixed point: the second pass reads back exactly
    // what the first one wrote.
    expect(readFileSync(join(secondData, "lines.jsonl"), "utf8")).toBe(readFileSync(join(firstData, "lines.jsonl"), "utf8"));
    expect(readFileSync(join(secondData, "book.toml"), "utf8")).toBe(readFileSync(join(firstData, "book.toml"), "utf8"));
  });
});
