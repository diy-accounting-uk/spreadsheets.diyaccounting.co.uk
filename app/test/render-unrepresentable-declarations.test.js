// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// A node-only companion to web/browser-tests/diya-gl-*-render-coverage.
// browser.test.js and diya-gl-taxi-equivalence.browser.test.js: those specs
// prove every S2 key is either rendered on the page or named in
// app/data/render-unrepresentable/<product>.json, but proving a key IS
// currently rendered needs a live DOM (shell.js's rkFor() derives a cell's
// data-r-key from productMod.CELL_MAP and the page's own view code at
// runtime, not from any literal string this file could grep for), so that
// direction stays a Playwright concern.
//
// This file catches the other, purely static way a declaration goes stale:
// a declared key that no fixture's S2 -- the same report.js output the
// coverage tests call s2KeysFor() -- produces at all. Most such keys are a
// typo or a leftover from a report shape that has since changed (this check
// found and fixed one: bst.json still named "net-profit-for-tax-calc" after
// the section's own label grew a "(box 31)" suffix). A handful stay
// legitimately absent from every canonical fixture for a documented reason
// (KNOWN_ABSENT_FOR_REASONS_OTHER_THAN_STALENESS below); every other
// declared key must still be something a fixture actually produces.

import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { readFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const NODE = process.execPath;

// One product's report can omit a CELL_MAP row's key from a given fixture's
// S2 (a box the fixture's own figures leave blank, say), so checking a
// declaration against a single fixture reads a real declared key as stale.
// Each product's own render-coverage browser spec already names the set of
// fixtures it holds every S2 key accountable to; union the same set here.
const PRODUCTS = [
  {
    name: "bst",
    fixtures: ["examples/precision-code-ltd/bst", "examples/brickwork-pro/bst-nonvat", "examples/sp-sixty-driving/bst"],
  },
  {
    name: "se",
    fixtures: ["examples/precision-code-ltd/advanced", "examples/brickwork-pro/se-nonvat", "examples/brickwork-pro/se-vat"],
    years: "se-2025-2026",
  },
  {
    name: "ltd",
    fixtures: ["examples/precision-code-ltd/full", "examples/brickwork-pro/ltd-vat", "examples/brickwork-pro/ltd-nonvat"],
  },
  {
    name: "taxi",
    fixtures: ["examples/basic-taxi-driver/taxi", "examples/sp-sixty-driving/taxi", "examples/kestrel-executive-cars/taxi"],
  },
];

// A handful of declared keys stay absent from every one of a product's own
// fixtures for a reason this check cannot tell apart from staleness by
// examining S2 alone -- confirmed by hand, not assumed, so each earns a
// one-line reason rather than a blanket pass.
const KNOWN_ABSENT_FOR_REASONS_OTHER_THAN_STALENESS = {
  bst: [
    // SE Short!O38 echoes box 10 on a second column; report-serializer.js's
    // collectCellEntries() only emits a key where the JS calculator wrote a
    // value, and calculateBstResults() never writes this echo column under
    // any scenario -- a permanent JS-engine gap, not a fixture gap.
    "cell/SE Short!O38",
    "section/self-assessment-sa103s/other-business-income-box-10",
  ],
  se: [
    // The accounting-profit-to-tax-profit bridge's depreciation add-back and
    // net-loss deduction rows are real profitBridge() output, but only when
    // the scenario carries depreciation or a loss for the year -- none of
    // the three canonical SE fixtures do, the same "no shipped fixture
    // reaches this" gap the band-sweep tests document elsewhere.
    "section/accounting-profit-to-tax-profit-bridge/add-depreciation-charged-in-the-accounts",
    "section/accounting-profit-to-tax-profit-bridge/less-net-loss-for-the-year-box-22",
  ],
};

function s2KeysFor(product, dataDir, years) {
  const outputDir = mkdtempSync(join(tmpdir(), `render-unrepresentable-s2-${product}-`));
  const args = ["app/bin/report.js", "--package", product, "--data", dataDir, "--output-dir", outputDir];
  if (years) args.push("--years", years);
  execFileSync(NODE, args, { cwd: ROOT, encoding: "utf8" });
  const report = JSON.parse(readFileSync(resolve(outputDir, "report.json"), "utf8"));
  return report.values.map((v) => v.key);
}

function unionS2Keys(product, fixtures, years) {
  const keys = new Set();
  for (const dataDir of fixtures) for (const key of s2KeysFor(product, dataDir, years)) keys.add(key);
  return keys;
}

function declarationFor(product) {
  return JSON.parse(readFileSync(resolve(ROOT, "app", "data", "render-unrepresentable", `${product}.json`), "utf8"));
}

// Every declared key that no fixture's S2 produces, apart from the ones
// confirmed absent for a reason other than staleness -- the check the rest
// of this file exercises.
function staleKeys(declared, s2Keys, knownAbsent) {
  return Object.keys(declared).filter((key) => !s2Keys.has(key) && !(knownAbsent || []).includes(key));
}

describe.each(PRODUCTS)("$name's render-unrepresentable declarations", ({ name, fixtures, years }) => {
  it("names no key that no fixture's S2 produces", () => {
    const s2Keys = unionS2Keys(name, fixtures, years);
    const declared = declarationFor(name);
    const knownAbsent = KNOWN_ABSENT_FOR_REASONS_OTHER_THAN_STALENESS[name];
    expect(staleKeys(declared, s2Keys, knownAbsent), "declared key(s) no fixture's S2 produces").toEqual([]);
  }, 60000);

  it("is proved breakable: a declared key no fixture's S2 produces fails the check", () => {
    const s2Keys = unionS2Keys(name, fixtures, years);
    const declared = declarationFor(name);
    const knownAbsent = KNOWN_ABSENT_FOR_REASONS_OTHER_THAN_STALENESS[name];
    const withStaleEntry = { ...declared, "cell/Nowhere Sheet!ZZ999": "a key no fixture's S2 has ever produced" };
    expect(staleKeys(withStaleEntry, s2Keys, knownAbsent)).toEqual(["cell/Nowhere Sheet!ZZ999"]);
  }, 60000);
});
