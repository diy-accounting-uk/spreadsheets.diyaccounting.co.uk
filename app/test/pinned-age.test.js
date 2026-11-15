// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// A pinned example package older than six months no longer shows what the
// generator makes. The generate workflows switch this check off so that an
// old pin never stops new packages.

import { describe, it, expect } from "vitest";
import { readPinned, sixMonthsBefore, stalePins } from "../lib/pinned.js";

describe("pinned example packages", () => {
  it("pins each product with a year-end and a build date", () => {
    const pinned = readPinned();
    expect(Object.keys(pinned).sort()).toEqual(["bst", "ltd", "se", "taxi"]);
    for (const pin of Object.values(pinned)) {
      expect(pin.yearEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(pin.built).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("counts six calendar months back from a date", () => {
    expect(sixMonthsBefore(new Date("2026-11-15T10:00:00Z"))).toBe("2026-05-15");
  });

  it("flags a pin built before the six-month limit and no other", () => {
    const stale = stalePins(new Date("2027-05-10T00:00:00Z")).map((s) => s.product);
    expect(stale).toEqual(["ltd"]);
  });

  it.skipIf(process.env.PINNED_AGE_CHECK === "off")("has no pinned package built more than six months ago", () => {
    const stale = stalePins();
    const lines = stale.map((s) => `${s.product} was built ${s.built}. Run: gh workflow run refresh-pinned.yml -f product=${s.product}`);
    expect(lines, lines.join("\n")).toEqual([]);
  });
});
