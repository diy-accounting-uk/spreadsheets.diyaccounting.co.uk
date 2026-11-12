// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { describe, it, expect } from "vitest";
import { ORGANIZATION, PRODUCT_CONTENT, buildProductPageHtml, productSlug } from "../lib/product-pages.js";

function jsonLdBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
}

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
        const data = jsonLdBlocks(html).find((b) => b["@type"] === "SoftwareApplication");
        expect(data.offers.price).toBe("0");
      });

      it("carries Open Graph tags and a card type for the page image", () => {
        const url = `https://spreadsheets.diyaccounting.co.uk/products/${productSlug(name)}.html`;
        expect(html).toContain(`<meta property="og:title" content="${PRODUCT_CONTENT[id].title} - DIY Accounting Spreadsheets" />`);
        expect(html).toContain(`<meta property="og:description" content="${PRODUCT_CONTENT[id].description}" />`);
        expect(html).toContain(`<meta property="og:url" content="${url}" />`);
        expect(html).toContain('<meta property="og:site_name" content="DIY Accounting" />');
        expect(html).toContain('<meta property="og:type" content="website" />');
        expect(html).toMatch(/<meta property="og:image" content="https:\/\/spreadsheets\.diyaccounting\.co\.uk\/images\/[^"]+\.png" \/>/);
        expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
      });

      it("carries the Organization record and a breadcrumb that ends at the page", () => {
        const blocks = jsonLdBlocks(html);
        expect(blocks.find((b) => b["@type"] === "Organization")).toEqual(ORGANIZATION);
        const crumbs = blocks.find((b) => b["@type"] === "BreadcrumbList").itemListElement;
        expect(crumbs.map((c) => c.position)).toEqual([1, 2]);
        expect(crumbs[0].item).toBe("https://spreadsheets.diyaccounting.co.uk/");
        expect(crumbs[1].item).toBe(`https://spreadsheets.diyaccounting.co.uk/products/${productSlug(name)}.html`);
      });
    });
  }

  it("keeps the Organization record in the agreed order", () => {
    expect(Object.keys(ORGANIZATION)).toEqual(["@context", "@type", "name", "legalName", "url", "address", "identifier", "sameAs"]);
    expect(ORGANIZATION.identifier.value).toBe("06846849");
    expect(ORGANIZATION.sameAs).toHaveLength(5);
  });

  it("throws for a product with no page content", () => {
    expect(() => buildProductPageHtml({ id: "Unknown", name: "Unknown" })).toThrow(/Unknown/);
  });
});
