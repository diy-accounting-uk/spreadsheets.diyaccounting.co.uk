// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/unit-tests/analytics.test.js

import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const scriptContent = fs.readFileSync(path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public/lib/analytics.js"), "utf-8");

describe("web/spreadsheets.diyaccounting.co.uk/public/lib/analytics.js", () => {
  let headScripts;
  let dataLayerPushes;

  beforeEach(() => {
    headScripts = [];
    dataLayerPushes = [];

    global.localStorage = {
      getItem: vi.fn(() => null),
    };

    global.document = {
      head: {
        appendChild: vi.fn((el) => headScripts.push(el)),
      },
      createElement: vi.fn(() => ({ async: false, src: "" })),
    };

    global.window = global;
    delete global.dataLayer;
    delete global.gtag;

    global.console = { ...console, warn: vi.fn() };
  });

  it("configures the GA4 linker for the three shared-property hosts", () => {
    eval(scriptContent);
    dataLayerPushes = global.dataLayer;

    const configCall = dataLayerPushes.find((args) => args[0] === "config" && args[1] === "G-X4ZPD99X2K");
    expect(configCall[2]).toEqual({
      linker: { domains: ["diyaccounting.co.uk", "spreadsheets.diyaccounting.co.uk", "submit.diyaccounting.co.uk"] },
    });
  });

  it("defines the GA4 linker domains constant", () => {
    const match = scriptContent.match(/const GA4_LINKER_DOMAINS = \[([\s\S]*?)];/);
    expect(match).not.toBeNull();
    const inlineDomains = match[1]
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => JSON.parse(entry));

    expect(inlineDomains).toHaveLength(3);
    expect(inlineDomains).toContain("diyaccounting.co.uk");
    expect(inlineDomains).toContain("spreadsheets.diyaccounting.co.uk");
    expect(inlineDomains).toContain("submit.diyaccounting.co.uk");
  });
});
