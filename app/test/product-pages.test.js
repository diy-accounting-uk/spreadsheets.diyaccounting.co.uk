// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { describe, it, expect } from "vitest";
import { PRODUCT_CONTENT, buildProductPageHtml, productSlug } from "../lib/product-pages.js";

const NAMES = {
  BasicSoleTrader: "Basic Sole Trader",
  SelfEmployed: "Self Employed",
  Company: "Company",
  TaxiDriver: "Taxi Driver",
  Payslip05: "Payslip 05",
};

describe("productSlug", () => {
  it("lowercases the name and joins its words with hyphens", () => {
    expect(productSlug("Basic Sole Trader")).toBe("basic-sole-trader");
    expect(productSlug("Payslip 05")).toBe("payslip-05");
  });
});

describe("buildProductPageHtml", () => {
  for (const [id, name] of Object.entries(NAMES)) {
    describe(id, () => {
      const html = buildProductPageHtml({ id, name, description: "unused" });

      it("has a self canonical and a description under 155 characters", () => {
        expect(html).toContain(
          `<link rel="canonical" href="https://spreadsheets.diyaccounting.co.uk/products/${productSlug(name)}.html" />`,
        );
        expect(PRODUCT_CONTENT[id].description.length).toBeLessThan(155);
      });

      it("has a title under 60 characters before the site suffix", () => {
        expect(html).toContain(`<title>${PRODUCT_CONTENT[id].title} - DIY Accounting Spreadsheets</title>`);
        expect(PRODUCT_CONTENT[id].title.length).toBeLessThan(60);
      });

      it("links the download form with the product id", () => {
        expect(html).toContain(`href="../download.html?product=${id}"`);
      });

      it("links Submit with the tagged source and medium", () => {
        expect(html).toMatch(/href="https:\/\/submit\.diyaccounting\.co\.uk\/\?utm_source=spreadsheets&amp;utm_medium=product-page/);
      });

      it("carries SoftwareApplication JSON-LD with a zero-price offer", () => {
        const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
        const data = JSON.parse(block);
        expect(data["@type"]).toBe("SoftwareApplication");
        expect(data.offers.price).toBe("0");
      });
    });
  }

  it("throws for a product with no page content", () => {
    expect(() => buildProductPageHtml({ id: "Unknown", name: "Unknown" })).toThrow(/Unknown/);
  });
});
