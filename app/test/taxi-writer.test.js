// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// taxi-writer.test.js — the Taxi Sales writer: day sums, joined names,
// caption rows and off-grid refusal. Pure Node, no LibreOffice.

import { describe, it, expect } from "vitest";
import { cellWrites, TaxiDateOffGridError } from "../products/taxi.js";
import { diyaGlToScenario } from "../lib/diya-gl-loader.js";

describe("Taxi writer — day sums and joined names", () => {
  it("two fares on one day write one E cell holding their sum", () => {
    const scenario = {
      sales: {
        apr: [
          { date: "2025-04-07", amount: 120, customer: "Daily fares" },
          { date: "2025-04-07", amount: 45.5, customer: "Airport run" },
        ],
      },
    };
    const writes = cellWrites(scenario, 2025);
    expect(writes.SalesApr.E10).toBe(165.5);
    expect(writes.SalesApr.C10).toBe("Daily fares; Airport run");
    expect(Object.keys(writes.SalesApr).filter((k) => k.startsWith("E"))).toEqual(["E10"]);
  });

  it("a repeated name joins once", () => {
    const scenario = {
      sales: {
        apr: [
          { date: "2025-04-07", amount: 120, customer: "Daily fares" },
          { date: "2025-04-07", amount: 45.5, customer: "Daily fares" },
        ],
      },
    };
    const writes = cellWrites(scenario, 2025);
    expect(writes.SalesApr.C10).toBe("Daily fares");
  });

  it("the day's miles add up", () => {
    const scenario = {
      sales: {
        apr: [
          { date: "2025-04-07", amount: 100, mileage: 40 },
          { date: "2025-04-07", amount: 60, mileage: 30 },
        ],
      },
    };
    const writes = cellWrites(scenario, 2025);
    expect(writes.SalesApr.D10).toBe(70);
  });

  it("a day driven with no fare writes a nil fare", () => {
    const scenario = { sales: { apr: [{ date: "2025-04-07", amount: 0, mileage: 30 }] } };
    const writes = cellWrites(scenario, 2025);
    expect(writes.SalesApr.E10).toBe(0);
    expect(writes.SalesApr.D10).toBe(30);
  });

  it("a Rental due line lands on its week's rental row", () => {
    const scenario = {
      sales: { apr: [{ date: "2025-04-09", amount: 300, customer: "Rental due", account: "4000" }] },
    };
    const writes = cellWrites(scenario, 2025);
    expect(writes.SalesApr.E17).toBe(300);
    expect(writes.SalesApr.E12).toBeUndefined();
  });

  it("an Any other income line lands on its week's other-income row", () => {
    const scenario = {
      sales: { apr: [{ date: "2025-04-09", amount: 50, customer: "Any other income", account: "4001" }] },
    };
    const writes = cellWrites(scenario, 2025);
    expect(writes.SalesApr.F18).toBe(50);
  });

  it("other income named anything else lands on its day", () => {
    const scenario = {
      sales: { apr: [{ date: "2025-04-09", amount: 500, customer: "Council grant", account: "4001" }] },
    };
    const writes = cellWrites(scenario, 2025);
    expect(writes.SalesApr.F12).toBe(500);
    expect(writes.SalesApr.C12).toBe("Council grant");
    expect(writes.SalesApr.E12).toBeUndefined();
  });

  it("a fare and other income on one day share the row", () => {
    const scenario = {
      sales: {
        apr: [
          { date: "2025-04-09", amount: 120, customer: "Daily fares", account: "4000" },
          { date: "2025-04-09", amount: 500, customer: "Grant", account: "4001" },
        ],
      },
    };
    const writes = cellWrites(scenario, 2025);
    expect(writes.SalesApr.E12).toBe(120);
    expect(writes.SalesApr.F12).toBe(500);
    expect(writes.SalesApr.C12).toBe("Daily fares; Grant");
  });

  it("a week that spans two calendar months writes on the tab of its Sunday", () => {
    const scenario = { sales: { apr: [{ date: "2025-04-28", amount: 90 }] } };
    const writes = cellWrites(scenario, 2025);
    expect(writes.SalesMay.E5).toBe(90);
    expect(writes.SalesApr).toBeUndefined();
  });

  it("a date the grid lacks is refused by name, all of them at once", () => {
    const scenario = {
      sales: {
        apr: [
          { date: "2025-04-03", amount: 10 },
          { date: "2025-04-07", amount: 20 },
        ],
        next: [{ date: "2026-04-07", amount: 30 }],
      },
    };
    let error;
    try {
      cellWrites(scenario, 2025);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(TaxiDateOffGridError);
    expect(error.dates).toEqual(["2025-04-03", "2026-04-07"]);
    expect(error.message).toContain("2025-04-03");
    expect(error.message).toContain("2026-04-07");
  });

  it("Business Details go to the cells the form reads", () => {
    const scenario = {
      business: { name: "SP Sixty Driving", description: "Private hire and taxi driving services", postcode: "DE1 2GH", utr: "5566778899" },
    };
    const writes = cellWrites(scenario, 2025);
    expect(writes["Business Details"]).toEqual({
      C5: "SP Sixty Driving",
      C8: "Private hire and taxi driving services",
      C17: "DE1 2GH",
      O5: "5566778899",
    });
  });

  it("the loader hands the writer a Taxi book in entry order", () => {
    const book = { documentInfo: { periodCoveredStart: "2025-04-06" } };
    const lineA = {
      sourceJournalID: "sales",
      accountMainID: "4000",
      postingDate: "2025-04-07",
      detailComment: "Daily fares A",
      amount: 100,
      entryNumber: "TXN-0001",
    };
    const lineB = {
      sourceJournalID: "sales",
      accountMainID: "4000",
      postingDate: "2025-04-07",
      detailComment: "Daily fares B",
      amount: 50,
      entryNumber: "TXN-0002",
    };
    const scenario = diyaGlToScenario(book, [lineB, lineA], "taxi");
    expect(scenario.sales.apr[0].customer).toBe(lineA.detailComment);
  });
});
