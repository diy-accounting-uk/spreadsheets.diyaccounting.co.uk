// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-se-disallowable-memo.test.js — The Profit & Loss view's
// disallowable-expenses memo block (web/.../diya-gl/products/se.js,
// renderDisallowableMemo), proved against the fixture's own [disallowable]
// percentages and the JS engine's own computed figures rather than restated
// numbers. The manifest is a classic script that assigns one global, so it
// is imported for its side effect and read back off globalThis.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { loadScenario } from "../lib/scenario-loader.js";
import { calculateSeResults } from "../lib/calculators/se.js";
import { canonicalForUnit } from "../lib/canonical-report-value.js";
import * as se from "../products/se.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const ROOT = resolve(APP_DIR, "..");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");
const MANIFEST_FILE = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public", "diya-gl", "products", "se.js");

const TAX_DATA = parseTOML(readFileSync(resolve(APP_DIR, "data", "se-2025-2026.toml"), "utf8"));

await import(MANIFEST_FILE);
const manifest = globalThis.DiyaGlProducts.se;
const profitLossView = manifest.views.find((view) => view.id === "profit-loss");

// A stand-in for shell.js's own render helpers: real formatting
// (canonicalForUnit is the engine's own, re-exported the way shell.js's
// fmtMoney uses it) behind the same API surface renderProfitLoss and its
// memo block call, small enough to keep beside the test that drives it.
function makeHelpers() {
  const moneyFmt = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 });
  const viewsState = {};
  function esc(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  return {
    esc,
    fmtMoney: (n) => moneyFmt.format(Number(canonicalForUnit(String(n), "money"))),
    fmtRate: (n) => (n * 100).toFixed(n * 100 === Math.round(n * 100) ? 0 : 1) + "%",
    fmtPence: (n) => Math.round(n * 100) + "p",
    kvRows: (rows) =>
      "<table>" +
      rows
        .map(
          (row) =>
            '<tr class="' +
            (row.total ? "total" : "") +
            '"><td>' +
            esc(row.label) +
            "</td><td" +
            (row.rKeyAttr || "") +
            ">" +
            (row.text !== undefined ? row.text : row.value) +
            "</td></tr>",
        )
        .join("") +
      "</table>",
    viewState: (id, init) => {
      if (!viewsState[id]) viewsState[id] = typeof init === "function" ? init() : Object.assign({}, init);
      return viewsState[id];
    },
    // Every cell this view reads that carries a value gets a key; rk's own
    // contract (shell.js) is to drop a falsy argument rather than key it.
    rk: (...keys) => {
      const present = keys.filter(Boolean);
      return present.length ? ' data-r-key="' + esc(present.join(" || ")) + '"' : "";
    },
    cellKey: (sheet, cell) => "cell/" + sheet + "!" + cell,
    // None of this view's memo cells are CELL_MAP rows of their own, so the
    // real rkFor would return "" for every one of them too.
    rkFor: () => "",
    setMonthsOpen: (open) => {
      viewsState["profit-loss"] = { monthsOpen: open };
    },
  };
}

function loadFixtureResults(name) {
  const scenario = loadScenario(resolve(FIXTURES_DIR, `${name}.toml`));
  const results = calculateSeResults({}, [], TAX_DATA, scenario);
  return { scenario, results };
}

describe("the SE Profit & Loss view's disallowable-expenses memo (CQ-25)", () => {
  const { scenario, results } = loadFixtureResults("se-scenario-advanced");

  // The JS calculator computes VitalTax's disallowable percentages
  // internally (app/lib/calculators/se.js, the DISALLOWABLE_ROWS loop) but
  // does not yet assign them onto its own I36-I50 the way it assigns the
  // boxes they drive, so calculateSeResults' read-scoped VitalTax carries no
  // "I" cell at all. Patched in here from the same fixture the calculator
  // itself read its percentages from, so the memo's percentage row is
  // proved against the real input independently of that calculator gap; the
  // add-back, entertainment and total rows below need no patch, since the
  // calculator already exposes SE Full and the Profit & Loss Account in
  // full.
  const patchedResults = {
    ...results,
    VitalTax: {
      ...results.VitalTax,
      ...Object.fromEntries(Object.entries(se.DISALLOWABLE_PERCENT_CELLS).map(([field, cell]) => [cell, scenario.disallowable[field]])),
    },
  };

  const helpers = makeHelpers();
  const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"].map((label) => ({ label }));
  const snap = { results: patchedResults, context: { productMod: se }, months };

  it("prints the memo heading and a plain-language row per disallowable category", () => {
    const html = profitLossView.render(snap, {}, helpers);
    expect(html).toContain("Disallowable expenses (memo)");
    expect(html).toContain("Cost of goods bought for resale or goods used");
    expect(html).toContain("Business Entertainment (memo)");
    expect(html).toContain("Advertising and business entertainment costs (box 39)");
    expect(html).toContain("Depreciation and loss or profit on sale of assets (box 44)");
  });

  it("carries the fixture's own percentage against each category, in the box 32-45 form (VitalTax reads the fraction, not the whole number)", () => {
    const html = profitLossView.render(snap, {}, helpers);
    for (const [field, cell] of Object.entries(se.DISALLOWABLE_PERCENT_CELLS)) {
      const rate = helpers.fmtRate(scenario.disallowable[field]);
      const rKey = ' data-r-key="cell/Financialaccounts.xlsx!VitalTax!' + cell + '"';
      expect(html, `${field} (${cell}) carries its own rate and r-key`).toContain(rKey);
      expect(html, `${field} (${cell}) shows ${rate}`).toContain(">" + rate + "<");
    }
  });

  it("shows the engine's own figure for every box 32-45 add-back, the box 46 total and the box 64 taxable profit", () => {
    const html = profitLossView.render(snap, {}, helpers);
    for (const cell of [
      "O66",
      "O70",
      "O74",
      "O78",
      "O82",
      "O86",
      "O90",
      "O94",
      "O98",
      "O102",
      "O106",
      "O110",
      "O114",
      "O118",
      "O122",
      "O174",
    ]) {
      const rKey = ' data-r-key="cell/Financialaccounts.xlsx!SE Full!' + cell + '"';
      expect(html, `${cell} carries its own r-key`).toContain(rKey);
      expect(html, `${cell} shows the engine's own figure`).toContain(">" + helpers.fmtMoney(results["SE Full"][cell]) + "<");
    }
  });

  it("shows the entertainment memo's own annual total, read from Profit & Loss Account row 49", () => {
    const html = profitLossView.render(snap, {}, helpers);
    const rKey = ' data-r-key="' + helpers.esc("cell/Financialaccounts.xlsx!Profit & Loss Account!B49") + '"';
    expect(html).toContain(rKey);
    expect(html).toContain(">" + helpers.fmtMoney(results["Profit & Loss Account"].B49) + "<");
  });

  it("carries the entertainment memo's own months behind the same months toggle, once it is open", () => {
    helpers.setMonthsOpen(true);
    const html = profitLossView.render(snap, {}, helpers);
    const rKey = ' data-r-key="' + helpers.esc("cell/Financialaccounts.xlsx!Profit & Loss Account!C49") + '"';
    expect(html).toContain(rKey);
    expect(html).toContain(">" + helpers.fmtMoney(results["Profit & Loss Account"].C49) + "<");
    helpers.setMonthsOpen(false);
  });

  // Unpatched: the JS engine as it stands today, with no "I" cell of its own
  // on VitalTax at all (see the comment above patchedResults). A percentage
  // row must read as "not computed" rather than a false 0%, which is what
  // would show if the row read through cellValue()'s zero-default the way
  // the statement above it does.
  it("reads a percentage as not computed, not zero, while the engine carries no VitalTax I cell of its own", () => {
    const unpatchedSnap = { results, context: { productMod: se }, months: [] };
    const html = profitLossView.render(unpatchedSnap, {}, helpers);
    for (const cell of Object.values(se.DISALLOWABLE_PERCENT_CELLS)) {
      const rKey = ' data-r-key="cell/Financialaccounts.xlsx!VitalTax!' + cell + '"';
      expect(html, `${cell} carries no r-key while its own cell is absent`).not.toContain(rKey);
    }
    expect(html).toContain(">—<");
    expect(html).not.toContain(">0%<");
  });
});
