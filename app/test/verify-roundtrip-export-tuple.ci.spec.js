// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// The whole-tuple, end-to-end fidelity check: generate -> export -> report,
// scored against the original fixture, once per product. CI's
// roundtrip-<product> jobs (.github/workflows/test.yml) already run the same
// chain and diff the whole report, so this check buys nothing beyond a
// second, hand-picked-field cross-check of the same ground. It earns its
// keep only in CI, not in the default local run.
//
// Filename convention, not a feature of the test runner: this file's suffix
// is ".ci.spec.js", not ".test.js", so it falls outside both
// scripts/test-scope.mjs's file-discovery regex (^(app/test/.*|
// web/unit-tests/.*)\.test\.js$) and vitest.config.js's "unit-tests" project
// include globs. Neither `npm test` nor a bare `npx vitest run` reaches it.
// It runs only through vitest.config.js's "ci-only" project, which
// .github/workflows/test.yml's app-test job invokes explicitly. There is no
// other CI-only marker in this codebase; this is the smallest one that does
// not require changing scripts/test-scope.mjs.
//
// Requires LibreOffice (brew install --cask libreoffice).

import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { scoreDataHalves, unrepresentableScope } from "../bin/verify-roundtrip.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const NODE = process.execPath;

// A multi-file generate drives roughly thirty LibreOffice conversions, and a
// slow host runs several times slower than the Linux build CI uses. Give
// each child the whole test budget so a slow host reports a fidelity
// difference rather than killing the generate before anything is compared.
const STEP_TIMEOUT_MS = 900_000;

function run(args) {
  return execFileSync(NODE, args, { cwd: ROOT, encoding: "utf8", timeout: STEP_TIMEOUT_MS });
}

// Every fixture line comes back as the same transaction, posted to the same
// account. dropped names the fields the export leaves out with no reason
// declared for them. wholeLineMatches is a ratchet: a rise is welcome (a
// sheet gained a column, or an inventory entry gained a block), a fall means
// some line lost a field the inventory does not yet excuse.
//
// se and ltd still fall short of their own fixtureLines count, on two
// unrelated, pre-existing gaps neither of which the bank-opening-balance
// scope touches:
//
// - Four of the Ltd OA_JOURNAL_MAP and SE opening-fixed-asset journal lines
//   carry a lineItemComment the export does not lose but does not match
//   either: the sheet gives each account (or, for SE, each asset) one
//   generic label ("Trade debtors", "Long term creditors") or its own
//   free-text description ("Van (2.5 years old)"), while the fixture states
//   a fuller, scenario-specific description ("Trade debtors (Acme 7200 +
//   Beta 1200 + Gamma 2400)", "Bank loan secured on the motor vehicle").
//   That is a wording mismatch on a field the sheet does carry, not an
//   absent field the inventory can excuse without also hiding a real defect
//   on the account-level lines that already match correctly.
// - Seven of the SE ordinary bank payment rows post the generic "RP" code
//   letter where the fixture expects the specific settlement code ("RV" for
//   a VAT payment, "RC" for a CIS remittance, "RT" for Corporation Tax) on
//   diya-gl:bankCode -- a payment-code mapping gap, unrelated to opening
//   balances or lineItemComment.
//
// Both are held steady here rather than papered over.
const PRODUCTS = [
  { name: "bst", data: "examples/precision-code-ltd/bst", years: "se-2025-2026", yearEnd: "2026-04-05", wholeLineMatches: 528 },
  {
    name: "taxi",
    data: "examples/sp-sixty-driving/taxi",
    years: "se-2025-2026",
    yearEnd: "2026-04-05",
    wholeLineMatches: 264,
  },
  {
    name: "se",
    data: "examples/precision-code-ltd/advanced",
    years: "se-2025-2026",
    yearEnd: "2026-04-05",
    wholeLineMatches: 687,
  },
  { name: "ltd", data: "examples/precision-code-ltd/full", years: "ltd-2025", yearEnd: "2026-03-31", wholeLineMatches: 723 },
  {
    // A non-March year end exercises the tab-rename and formula-rewrite path
    // (getMonthTabSequence, renameMonthTabs, renameExternalLinkSheetNames,
    // rewriteVatinterfaceFormulas) that the March run never touches, since
    // March is the template's native tab order. generate.js also shifts
    // every posting date onto this package's own accounting period, so the
    // exported dates sit a month or two from the fixture's; scoreDataHalves
    // derives that shift itself from the two book.tomls before comparing.
    name: "ltd",
    label: "ltd-may",
    data: "examples/precision-code-ltd/full",
    years: "ltd-2025",
    yearEnd: "2025-05-31",
    wholeLineMatches: 723,
  },
];

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
      const score = scoreDataHalves(resolve(fixture, "data"), exported, unrepresentableScope(product.name, inventory));

      // Every line the fixture carries comes back.
      expect(score.exportedLines).toBeGreaterThanOrEqual(score.fixtureLines);
      // Nothing is silently dropped: every field the export leaves out is
      // one the inventory names a reason for.
      expect(score.fieldsDropped).toEqual(product.dropped ?? []);

      // A fixture line reaches the export as at least the same transaction:
      // same date, same amount, same journal (in the period-frame this run's
      // own year end shifted the export's dates into, for the Ltd tracks).
      expect(score.coarseMatches).toBeGreaterThanOrEqual(score.fixtureLines);
      // And wherever the transaction survives, so does the account it was
      // posted to. Several accounts share one code letter, so this is the
      // claim the carrier column exists to make.
      expect(score.accountMatches).toBe(score.coarseMatches);

      // The ratchet: a fixture line matches the export on every field the
      // inventory does not excuse. A rise is welcome; a fall means some
      // block lost a field the inventory has not caught up with.
      expect(score.wholeLineMatches).toBe(product.wholeLineMatches);
    });
  }
});
