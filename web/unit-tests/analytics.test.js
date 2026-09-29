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
      setItem: vi.fn(),
    };

    global.sessionStorage = {
      getItem: vi.fn(() => null),
    };

    // Node defines a getter-only global.navigator; vi.stubGlobal replaces it safely for the test.
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15" });

    global.document = {
      head: {
        appendChild: vi.fn((el) => headScripts.push(el)),
      },
      createElement: vi.fn(() => ({ async: false, src: "" })),
      readyState: "complete",
      addEventListener: vi.fn(),
      querySelectorAll: vi.fn(() => []),
    };

    global.window = global;
    global.window.location = {
      search: "",
      hostname: "spreadsheets.diyaccounting.co.uk",
      href: "https://spreadsheets.diyaccounting.co.uk/",
    };
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

  it("tags a plain visit as human", () => {
    eval(scriptContent);
    dataLayerPushes = global.dataLayer;

    expect(dataLayerPushes.some((args) => args[0] === "set" && args[1] === "user_properties" && args[2].visitor_kind === "human")).toBe(
      true,
    );
  });

  it("tags a behaviour-test visit as synthetic", () => {
    global.sessionStorage.getItem = vi.fn((key) => (key === "requestIdPrefix" ? "test_" : null));

    eval(scriptContent);
    dataLayerPushes = global.dataLayer;

    expect(dataLayerPushes.some((args) => args[0] === "set" && args[1] === "user_properties" && args[2].visitor_kind === "synthetic")).toBe(
      true,
    );
  });

  it("tags a canary visit as bot", () => {
    global.navigator.userAgent = "DIYAccounting-Probe-Monitor/1.0";

    eval(scriptContent);
    dataLayerPushes = global.dataLayer;

    expect(dataLayerPushes.some((args) => args[0] === "set" && args[1] === "user_properties" && args[2].visitor_kind === "bot")).toBe(true);
  });

  function fakeAnchor(href) {
    let currentHref = href;
    return {
      getAttribute: vi.fn(() => currentHref),
      setAttribute: vi.fn((name, value) => {
        if (name === "href") currentHref = value;
      }),
    };
  }

  describe("acquisition source capture", () => {
    it("captures utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid and ref at landing", () => {
      global.window.location.search =
        "?utm_source=newsletter&utm_medium=email&utm_campaign=launch&utm_content=cta&utm_term=vat&gclid=abc123&ref=partner1";

      eval(scriptContent);

      expect(global.localStorage.setItem).toHaveBeenCalledTimes(1);
      const [key, value] = global.localStorage.setItem.mock.calls[0];
      expect(key).toBe("acquisition.source");
      const stored = JSON.parse(value);
      expect(stored).toMatchObject({
        utm_source: "newsletter",
        utm_medium: "email",
        utm_campaign: "launch",
        utm_content: "cta",
        utm_term: "vat",
        gclid: "abc123",
        ref: "partner1",
      });
      expect(typeof stored.landedAt).toBe("number");
    });

    it("leaves the stored source alone on an untagged landing", () => {
      global.window.location.search = "";

      eval(scriptContent);

      expect(global.localStorage.setItem).not.toHaveBeenCalled();
    });

    it("replaces the stored source when a new tagged landing arrives", () => {
      global.localStorage.getItem = vi.fn(() => JSON.stringify({ utm_source: "old", utm_medium: "email", landedAt: Date.now() }));
      global.window.location.search = "?utm_source=ads&utm_medium=cpc";

      eval(scriptContent);

      expect(global.localStorage.setItem).toHaveBeenCalledTimes(1);
      const stored = JSON.parse(global.localStorage.setItem.mock.calls[0][1]);
      expect(stored.utm_source).toBe("ads");
      expect(stored.utm_medium).toBe("cpc");
    });
  });

  describe("Submit link decoration", () => {
    it("decorates a link into Submit with the stored source", () => {
      global.localStorage.getItem = vi.fn(() => JSON.stringify({ utm_source: "diya-gl", utm_medium: "referral", landedAt: Date.now() }));
      const anchor = fakeAnchor("https://submit.diyaccounting.co.uk/");
      global.document.querySelectorAll = vi.fn(() => [anchor]);

      eval(scriptContent);

      expect(anchor.setAttribute).toHaveBeenCalledWith(
        "href",
        "https://submit.diyaccounting.co.uk/?utm_source=diya-gl&utm_medium=referral",
      );
    });

    it("does not decorate a link into another host", () => {
      global.localStorage.getItem = vi.fn(() => JSON.stringify({ utm_source: "diya-gl", utm_medium: "referral", landedAt: Date.now() }));
      const anchor = fakeAnchor("https://diyaccounting.co.uk/");
      global.document.querySelectorAll = vi.fn(() => [anchor]);

      eval(scriptContent);

      expect(anchor.setAttribute).not.toHaveBeenCalled();
    });

    it("falls back to this site's own source and referral medium when nothing is stored", () => {
      global.window.location.hostname = "spreadsheets.diyaccounting.co.uk";
      const anchor = fakeAnchor("https://submit.diyaccounting.co.uk/");
      global.document.querySelectorAll = vi.fn(() => [anchor]);

      eval(scriptContent);

      expect(anchor.setAttribute).toHaveBeenCalledWith(
        "href",
        "https://submit.diyaccounting.co.uk/?utm_source=spreadsheets&utm_medium=referral",
      );
    });

    it("falls back to diya-gl as the source on the diya-gl.co.uk copy of this file", () => {
      global.window.location.hostname = "diya-gl.co.uk";
      const anchor = fakeAnchor("https://submit.diyaccounting.co.uk/");
      global.document.querySelectorAll = vi.fn(() => [anchor]);

      eval(scriptContent);

      expect(anchor.setAttribute).toHaveBeenCalledWith(
        "href",
        "https://submit.diyaccounting.co.uk/?utm_source=diya-gl&utm_medium=referral",
      );
    });

    it("never overwrites a parameter the link already carries", () => {
      global.localStorage.getItem = vi.fn(() => JSON.stringify({ utm_source: "diya-gl", utm_medium: "referral", landedAt: Date.now() }));
      const anchor = fakeAnchor("https://submit.diyaccounting.co.uk/?utm_source=manual");
      global.document.querySelectorAll = vi.fn(() => [anchor]);

      eval(scriptContent);

      expect(anchor.setAttribute).toHaveBeenCalledWith("href", "https://submit.diyaccounting.co.uk/?utm_source=manual&utm_medium=referral");
    });

    it("ignores a stored source older than 90 days", () => {
      const staleLandedAt = Date.now() - 91 * 24 * 60 * 60 * 1000;
      global.localStorage.getItem = vi.fn(() => JSON.stringify({ utm_source: "old-campaign", landedAt: staleLandedAt }));
      const anchor = fakeAnchor("https://submit.diyaccounting.co.uk/");
      global.document.querySelectorAll = vi.fn(() => [anchor]);

      eval(scriptContent);

      expect(anchor.setAttribute).toHaveBeenCalledWith(
        "href",
        "https://submit.diyaccounting.co.uk/?utm_source=spreadsheets&utm_medium=referral",
      );
    });

    it("waits for DOMContentLoaded before decorating when the document is still loading", () => {
      global.document.readyState = "loading";
      const anchor = fakeAnchor("https://submit.diyaccounting.co.uk/");
      global.document.querySelectorAll = vi.fn(() => [anchor]);

      eval(scriptContent);

      expect(global.document.querySelectorAll).not.toHaveBeenCalled();
      expect(global.document.addEventListener).toHaveBeenCalledWith("DOMContentLoaded", expect.any(Function));
    });
  });
});
