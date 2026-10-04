// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// LibreOffice opens an xlsx on the results its formula cells cache and
// ignores fullCalcOnLoad, so converting a sheet to CSV shows exactly what a
// LibreOffice or Collabora user sees on open. Each case converts the sheet a
// workbook heads with its year and looks for that year, and for the absence
// of the template's.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

import { getLibreOffice, hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { saveWorkbook } from "../lib/product-workbook.js";
import { loadDiyaGlData } from "../lib/diya-gl-loader.js";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(APP_DIR, "..");
const GENERATE_JS = resolve(APP_DIR, "bin", "generate.js");
const CSV_FILTER = "csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,-1";

const describeCalc = hasLibreOffice() ? describe : describe.skip;

const BASIC_SOLE_TRADER_HEADINGS = {
  sheet: "Profit & Loss Acc",
  expected: ["2026-27", "30/04/2026", "31/03/2027"],
  stale: ["2025-26", "30/04/2025"],
};

const GENERATED = [
  {
    product: "Basic Sole Trader",
    args: ["--package", "bst", "--years", "se-2026-2027"],
    workbook: "Financialaccountsto050427.xlsx",
    ...BASIC_SOLE_TRADER_HEADINGS,
  },
  {
    product: "Self Employed",
    args: ["--package", "se", "--years", "se-2026-2027"],
    workbook: "Financialaccounts.xlsx",
    sheet: "Profit & Loss Account",
    expected: ["05/04/2027", "30/04/2026", "31/03/2027"],
    stale: ["05/04/2026", "30/04/2025"],
  },
  {
    product: "Company",
    args: ["--package", "ltd", "--years", "ltd-2026", "--year-end", "2027-03-31"],
    workbook: "Financialaccounts.xlsx",
    sheet: "MnthP&L",
    expected: ["31/03/2027", "30/04/2026"],
    stale: ["31/03/2026", "30/04/2025"],
  },
];

function localeRegistry(locale) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n' +
    `<item oor:path="/org.openoffice.Setup/L10N"><prop oor:name="ooSetupSystemLocale" oor:op="fuse"><value>${locale}</value></prop></item>\n` +
    "</oor:items>\n"
  );
}

// The first three rows of one sheet as LibreOffice shows them on open.
function headingRows(workbookPath, sheet, workDir) {
  const csvDir = join(workDir, "csv");
  mkdirSync(csvDir, { recursive: true });
  // LibreOffice prints dates in its profile's locale, which otherwise follows
  // the machine: a Linux runner prints 04/30/2026 where a UK desktop prints
  // 30/04/2026.
  const profileUser = join(workDir, "profile", "user");
  mkdirSync(profileUser, { recursive: true });
  writeFileSync(join(profileUser, "registrymodifications.xcu"), localeRegistry("en-GB"));
  execFileSync(
    getLibreOffice(),
    [
      "--headless",
      "--norestore",
      `-env:UserInstallation=file://${join(workDir, "profile")}`,
      "--convert-to",
      CSV_FILTER,
      "--outdir",
      csvDir,
      workbookPath,
    ],
    { stdio: "pipe", timeout: 540000 },
  );
  const stem = workbookPath
    .split("/")
    .pop()
    .replace(/\.xlsx$/, "");
  return readFileSync(join(csvDir, `${stem}-${sheet}.csv`), "utf8")
    .split("\n")
    .slice(0, 3)
    .join("\n");
}

describeCalc("a workbook opens in LibreOffice on the year it was written for", () => {
  let workDir;
  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), "recalc-on-open-"));
  });
  afterAll(() => {
    if (workDir) rmSync(workDir, { recursive: true, force: true });
  });

  for (const { product, args, workbook, sheet, expected, stale } of GENERATED) {
    it(`${product}: a generated package's ${sheet} shows its own year`, () => {
      const caseDir = join(workDir, product.replace(/\W+/g, "_"));
      const outDir = join(caseDir, "out");
      execFileSync(process.execPath, [GENERATE_JS, ...args, "--skip-guide", "--output-dir", outDir], { stdio: "pipe" });
      const [packageDir] = readdirSync(outDir);

      const rows = headingRows(join(outDir, packageDir, workbook), sheet, caseDir);

      for (const text of expected) expect(rows).toContain(text);
      for (const text of stale) expect(rows).not.toContain(text);
    }, 900000);
  }

  it("Basic Sole Trader: a book saved a year on from the template shows its own year", async () => {
    const caseDir = join(workDir, "saved");
    mkdirSync(caseDir, { recursive: true });
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples/brickwork-pro/bst-nonvat"), "+P1Y");
    const { workbook, filename } = await saveWorkbook(book, lines);
    const path = join(caseDir, filename);
    writeFileSync(path, workbook);

    const rows = headingRows(path, BASIC_SOLE_TRADER_HEADINGS.sheet, caseDir);

    for (const text of BASIC_SOLE_TRADER_HEADINGS.expected) expect(rows).toContain(text);
    for (const text of BASIC_SOLE_TRADER_HEADINGS.stale) expect(rows).not.toContain(text);
  }, 900000);
});
