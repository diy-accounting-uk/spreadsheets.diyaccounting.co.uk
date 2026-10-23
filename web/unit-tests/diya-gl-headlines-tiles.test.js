// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { headlinesFromReport } from "../../app/lib/headlines.js";
import * as bst from "../../app/products/bst.js";
import * as se from "../../app/products/se.js";
import * as taxi from "../../app/products/taxi.js";
import * as ltd from "../../app/products/ltd.js";

// headlines.js is a classic browser script that publishes on `window`. Run it
// in a sandbox and read the tile renderer back off that global.
let renderTiles;

beforeAll(() => {
  const source = readFileSync(resolve(import.meta.dirname, "../diya-gl.co.uk/public/headlines.js"), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  renderTiles = sandbox.window.DiyaGlHeadlines.renderTiles;
});

function declaredKeys(declaration) {
  const keys = [];
  const collect = (spec) => {
    if (!spec) return;
    if (spec.keys) keys.push(...spec.keys);
    else if (spec.key) keys.push(spec.key);
  };
  collect(declaration.turnover);
  for (const line of declaration.turnover.secondLine ?? []) keys.push(line.key);
  for (const line of declaration.turnover.pieExtra ?? []) keys.push(line.key);
  collect(declaration.costOfSales);
  collect(declaration.runningCosts);
  collect(declaration.tax);
  collect(declaration.tax.secondLine);
  for (const part of ["writtenDown", "stock", "cash", "debtors", "secondLine"]) collect(declaration.assets?.[part]);
  for (const line of declaration.assets?.extra ?? []) keys.push(line.key);
  for (const pair of [...(declaration.expenseLines ?? []), ...(declaration.pieLines ?? [])]) keys.push(pair[0]);
  for (const key of Object.values(declaration.vehicle ?? {})) keys.push(key);
  return keys;
}

// R carrying every declared key at 1, with the named keys overridden.
function reportWith(declaration, overrides) {
  const values = [...new Set(declaredKeys(declaration))].map((key) => ({ key, value: String(overrides[key] ?? 1) }));
  return { values };
}

const money = (n) => `£${n.toFixed(2)}`;

function tilesHtml(product, overrides) {
  const headlines = headlinesFromReport(reportWith(product.HEADLINES, overrides), product.HEADLINES);
  return renderTiles(headlines, money);
}

describe("the Year page tiles name each product's own figures", () => {
  it("Company: cash is cash, stock is stock, and the tax tile says corporation tax", () => {
    const html = tilesHtml(ltd, {
      "cell/Financialaccounts.xlsx!PubBalSht!E10": 111,
      "cell/Financialaccounts.xlsx!PubBalSht!E12": 1348.56,
      "cell/Financialaccounts.xlsx!PubBalSht!E11": 333,
    });
    expect(html).toContain("cash £1348.56");
    expect(html).toContain("stock £111.00");
    expect(html).toContain("owed to you £333.00");
    expect(html).toContain("corporation tax");
    expect(html).not.toContain("Class 4");
    expect(html).not.toContain("CIS");
  });

  it("Company: a book holding no stock shows no stock figure beside its cash", () => {
    const declaration = { ...ltd.HEADLINES, assets: { ...ltd.HEADLINES.assets, stock: { key: "cell/absent!X!1", optional: true } } };
    const headlines = headlinesFromReport(reportWith(ltd.HEADLINES, {}), declaration);
    const html = renderTiles(headlines, money);
    expect(html).not.toContain("stock");
    expect(html).toContain("cash £1.00");
  });

  it("Basic Sole Trader: stock is stock, no cash figure, income tax and Class 4 NI wording", () => {
    const html = tilesHtml(bst, { "cell/PurchasesStock!D30": 222 });
    expect(html).toContain("stock £222.00");
    expect(html).not.toContain("cash");
    expect(html).toContain("income tax and Class 4 NI, less CIS");
  });

  it("Self Employed: cash at bank and in hand is cash, stock is stock, income tax and Class 4 NI wording", () => {
    const html = tilesHtml(se, {
      "cell/Financialaccounts.xlsx!StockControl!AB30": 444,
      "cell/Bank.xlsx!Mar!A2": 500,
      "cell/Cash.xlsx!Mar!A2": 25,
    });
    expect(html).toContain("stock £444.00");
    expect(html).toContain("cash £525.00");
    expect(html).toContain("income tax and Class 4 NI, less CIS");
  });

  it("Taxi: no stock or cash figure, income tax and Class 4 NI wording", () => {
    const html = tilesHtml(taxi, {});
    expect(html).not.toContain("stock");
    expect(html).not.toContain("cash");
    expect(html).toContain("income tax and Class 4 NI, less CIS");
  });
});
