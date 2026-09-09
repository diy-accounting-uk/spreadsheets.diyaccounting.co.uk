// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

// ecommerce-events.js is a classic browser script (no import/export) loaded via
// <script src="lib/ecommerce-events.js">, so it publishes its builder on
// `window`. Run it in a sandbox and read the function back off that global,
// the same way a browser would.
let buildPurchaseEvent;
let buildRunnerDownloadEvent;

beforeAll(() => {
  const src = readFileSync(resolve(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public/lib/ecommerce-events.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  buildPurchaseEvent = sandbox.window.buildPurchaseEvent;
  buildRunnerDownloadEvent = sandbox.window.buildRunnerDownloadEvent;
});

describe("buildPurchaseEvent", () => {
  it("carries the paid amount as value and item price", () => {
    const event = buildPurchaseEvent("stripe", "Company", 45, "GBP");
    expect(event.value).toBe(45);
    expect(event.currency).toBe("GBP");
    expect(event.items).toEqual([{ item_id: "Company", item_name: "Company", price: 45, currency: "GBP" }]);
  });

  it("names the item after the product", () => {
    const event = buildPurchaseEvent("paypal", "BasicSoleTrader", 10, "GBP");
    expect(event.items[0].item_id).toBe("BasicSoleTrader");
    expect(event.items[0].item_name).toBe("BasicSoleTrader");
  });

  it("prefixes the transaction id with the provider", () => {
    const event = buildPurchaseEvent("stripe", "Company", 45, "GBP");
    expect(event.transaction_id.startsWith("stripe_")).toBe(true);
  });

  it("reports no revenue when the amount is unknown, rather than a guess", () => {
    const event = buildPurchaseEvent("paypal", "Company", null, "GBP");
    expect(event.value).toBe(0);
    expect(event.items[0].price).toBe(0);
  });

  it("defaults the currency to GBP when none is given", () => {
    const event = buildPurchaseEvent("stripe", "Company", 45, undefined);
    expect(event.currency).toBe("GBP");
    expect(event.items[0].currency).toBe("GBP");
  });
});

describe("buildRunnerDownloadEvent", () => {
  it("names the event runner_download and carries the product", () => {
    const event = buildRunnerDownloadEvent("bst");
    expect(event.name).toBe("runner_download");
    expect(event.params).toEqual({ product: "bst" });
  });
});
