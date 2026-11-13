// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Site configuration for each of the two sites this repository publishes.
const sites = [
  {
    name: "spreadsheets",
    dir: path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public"),
    domain: "https://spreadsheets.diyaccounting.co.uk",
    landing: "index.html",
    landingHasJsonLd: true,
  },
  {
    name: "diya-gl",
    dir: path.join(process.cwd(), "web/diya-gl.co.uk/public"),
    domain: "https://diya-gl.co.uk",
    landing: "index.html",
    landingHasJsonLd: true,
  },
];

// Helper: read file content
function readFile(filePath) {
  return fs.readFileSync(filePath, "utf-8");
}

// Helper: escape all regex metacharacters, not just ".", so a literal
// string can be embedded in a RegExp without matching more than itself
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Helper: extract URLs from sitemap XML
function extractSitemapUrls(xml) {
  const urls = [];
  const locRegex = /<loc>(.*?)<\/loc>/g;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

// Helper: parse robots.txt directives
function parseRobotsTxt(content) {
  const lines = content.split("\n").map((l) => l.trim());
  const directives = { userAgents: [], allows: [], disallows: [], sitemaps: [] };
  for (const line of lines) {
    if (line.startsWith("#") || line === "") continue;
    const [key, ...valueParts] = line.split(":");
    const value = valueParts.join(":").trim();
    const keyLower = key.toLowerCase().trim();
    if (keyLower === "user-agent") directives.userAgents.push(value);
    else if (keyLower === "allow") directives.allows.push(value);
    else if (keyLower === "disallow") directives.disallows.push(value);
    else if (keyLower === "sitemap") directives.sitemaps.push(value);
  }
  return directives;
}

// Helper: split robots.txt into groups. Consecutive User-agent lines share one rule set.
function parseRobotsGroups(content) {
  const groups = [];
  let current;
  let collectingAgents = false;
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("#") || line === "") continue;
    const [key, ...valueParts] = line.split(":");
    const keyLower = key.toLowerCase().trim();
    const value = valueParts.join(":").trim();
    if (keyLower === "user-agent") {
      if (!collectingAgents) {
        current = { agents: [], allows: [], disallows: [], signals: [] };
        groups.push(current);
      }
      current.agents.push(value);
      collectingAgents = true;
      continue;
    }
    collectingAgents = false;
    if (!current) continue;
    if (keyLower === "allow") current.allows.push(value);
    else if (keyLower === "disallow") current.disallows.push(value);
    else if (keyLower === "content-signal") current.signals.push(value);
  }
  return groups;
}

// Helper: check if a path is disallowed by robots.txt rules
function isDisallowed(urlPath, disallows) {
  return disallows.some((rule) => urlPath.startsWith(rule));
}

// Helper: extract JSON-LD from HTML
function extractJsonLd(html) {
  const blocks = [];
  const regex = /<script\s+type\s*=\s*"application\/ld\+json"\s*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(match[1]));
    } catch {
      // skip invalid JSON
    }
  }
  return blocks;
}

// The company record every home page publishes, in this property order.
const ORGANIZATION_CORE = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "DIY Accounting Limited",
  "legalName": "DIY Accounting Limited",
  "url": "https://diyaccounting.co.uk",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "37 Sutherland Avenue",
    "addressLocality": "Leeds",
    "postalCode": "LS8 1BY",
    "addressCountry": "GB",
  },
  "identifier": { "@type": "PropertyValue", "propertyID": "Companies House company number", "value": "06846849" },
  "sameAs": [
    "https://find-and-update.company-information.service.gov.uk/company/06846849",
    "https://www.youtube.com/@DIYAccountingSubmit",
    "https://github.com/diy-accounting-uk",
    "https://www.npmjs.com/package/@diy-accounting-uk/diya-submit",
    "https://www.npmjs.com/package/@diy-accounting-uk/diya-gl",
  ],
};

// The file that serves a sitemap URL. donate.html is built from its template, which carries the same head.
function fileForSitemapUrl(site, url) {
  const urlPath = new URL(url).pathname;
  if (urlPath === "/") return path.join(site.dir, "index.html");
  if (site.name === "spreadsheets" && urlPath === "/donate.html") {
    return path.join(site.dir, "..", "donate.template.html");
  }
  return path.join(site.dir, urlPath);
}

function metaContent(html, attribute, name) {
  const match = html.match(new RegExp(`<meta\\s+${attribute}="${escapeRegExp(name)}"\\s+content="([^"]*)"`));
  return match ? match[1] : undefined;
}

for (const site of sites) {
  describe(`Sitemap validation (${site.name})`, () => {
    const sitemapPath = path.join(site.dir, "sitemap.xml");

    it("sitemap.xml exists and is valid XML", () => {
      expect(fs.existsSync(sitemapPath), `${sitemapPath} should exist`).toBe(true);
      const xml = readFile(sitemapPath);
      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain("<urlset");
      expect(xml).toContain("</urlset>");
    });

    it("all sitemap URLs use the correct domain", () => {
      const xml = readFile(sitemapPath);
      const urls = extractSitemapUrls(xml);
      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) {
        expect(url, `URL ${url} should start with ${site.domain}`).toMatch(new RegExp(`^${escapeRegExp(site.domain)}`));
      }
    });

    it("no duplicate URLs in sitemap", () => {
      const xml = readFile(sitemapPath);
      const urls = extractSitemapUrls(xml);
      const unique = new Set(urls);
      expect(unique.size, `Found ${urls.length - unique.size} duplicate URLs`).toBe(urls.length);
    });

    it("no sitemap URLs are blocked by robots.txt", () => {
      const robotsPath = path.join(site.dir, "robots.txt");
      if (!fs.existsSync(robotsPath)) return;
      const robots = parseRobotsTxt(readFile(robotsPath));
      const xml = readFile(sitemapPath);
      const urls = extractSitemapUrls(xml);
      for (const url of urls) {
        const urlPath = new URL(url).pathname;
        expect(isDisallowed(urlPath, robots.disallows), `Sitemap URL ${url} is blocked by robots.txt Disallow rule`).toBe(false);
      }
    });
  });

  describe(`robots.txt validation (${site.name})`, () => {
    const robotsPath = path.join(site.dir, "robots.txt");

    it("names the search and user-fetch agents and the training agents, each allowed", () => {
      const named = parseRobotsGroups(readFile(robotsPath)).filter((g) => !g.agents.includes("*"));
      const searchGroup = named.find((g) => g.agents.includes("OAI-SearchBot"));
      const trainingGroup = named.find((g) => g.agents.includes("GPTBot"));
      expect(searchGroup?.agents).toEqual([
        "OAI-SearchBot",
        "ChatGPT-User",
        "Claude-SearchBot",
        "Claude-User",
        "PerplexityBot",
        "Perplexity-User",
        "Bingbot",
        "Googlebot",
        "Applebot",
      ]);
      expect(trainingGroup?.agents).toEqual(["GPTBot", "ClaudeBot", "Google-Extended", "CCBot", "Applebot-Extended"]);
      for (const group of [searchGroup, trainingGroup]) {
        expect(group.allows).toEqual(["/"]);
      }
    });

    it("states one Content-Signal line", () => {
      const signals = parseRobotsGroups(readFile(robotsPath)).flatMap((g) => g.signals);
      expect(signals).toEqual(["search=yes, ai-input=yes, ai-train=yes"]);
    });

    it("disallows no named agent from any sitemap URL", () => {
      const named = parseRobotsGroups(readFile(robotsPath)).filter((g) => !g.agents.includes("*"));
      const urls = extractSitemapUrls(readFile(path.join(site.dir, "sitemap.xml")));
      expect(named.length).toBeGreaterThan(0);
      for (const group of named) {
        for (const url of urls) {
          expect(isDisallowed(new URL(url).pathname, group.disallows), `${group.agents.join(", ")} is blocked from ${url}`).toBe(false);
        }
      }
    });

    it("robots.txt exists", () => {
      expect(fs.existsSync(robotsPath), `${robotsPath} should exist`).toBe(true);
    });

    it("has User-agent: * directive", () => {
      const robots = parseRobotsTxt(readFile(robotsPath));
      expect(robots.userAgents).toContain("*");
    });

    it("has Sitemap directive pointing to correct URL", () => {
      const robots = parseRobotsTxt(readFile(robotsPath));
      const expectedSitemap = `${site.domain}/sitemap.xml`;
      expect(robots.sitemaps, `Should contain ${expectedSitemap}`).toContain(expectedSitemap);
    });
  });

  describe(`Head tags and structured data on every sitemap URL (${site.name})`, () => {
    const sitemapPath = path.join(site.dir, "sitemap.xml");
    // The spreadsheets product pages are built at deploy and not committed; app/test/product-pages.test.js asserts them.
    const urls = fs.existsSync(sitemapPath)
      ? extractSitemapUrls(readFile(sitemapPath)).filter((u) => !new URL(u).pathname.startsWith("/products/"))
      : [];

    it("lists pages to check", () => {
      expect(urls.length).toBeGreaterThan(0);
    });

    for (const url of urls) {
      it(`${url} has og:title, twitter:card, a canonical and, below the home page, a BreadcrumbList`, () => {
        const html = readFile(fileForSitemapUrl(site, url));
        expect(metaContent(html, "property", "og:title"), "og:title").toBeTruthy();
        expect(metaContent(html, "name", "twitter:card"), "twitter:card").toMatch(/^summary(_large_image)?$/);
        expect(canonicalHref(html), "canonical").toBe(url);
        const blocks = extractJsonLd(html);
        const breadcrumbs = blocks.find((b) => b["@type"] === "BreadcrumbList");
        if (new URL(url).pathname === "/") {
          expect(breadcrumbs, "the home page has no BreadcrumbList").toBeUndefined();
          return;
        }
        expect(breadcrumbs, "BreadcrumbList").toBeTruthy();
        const items = breadcrumbs.itemListElement;
        expect(items.length).toBeGreaterThanOrEqual(2);
        expect(items.map((i) => i.position)).toEqual(items.map((_, n) => n + 1));
        expect(items[0].item).toBe(`${site.domain}/`);
        expect(items[items.length - 1].item).toBe(url);
      });
    }

    it(`${site.landing} carries the Organization record`, () => {
      const org = extractJsonLd(readFile(path.join(site.dir, site.landing))).find((b) => b["@type"] === "Organization");
      expect(org, "Organization block").toBeTruthy();
      const core = Object.keys(ORGANIZATION_CORE);
      expect(Object.keys(org).slice(0, core.length)).toEqual(core);
      expect(org).toMatchObject(ORGANIZATION_CORE);
    });
  });

  describe(`Meta tag validation (${site.name})`, () => {
    const landingPath = path.join(site.dir, site.landing);

    it(`${site.landing} has <title>`, () => {
      const html = readFile(landingPath);
      expect(html).toMatch(/<title>.+<\/title>/);
    });

    it(`${site.landing} has <meta name="description">`, () => {
      const html = readFile(landingPath);
      expect(html).toMatch(/name\s*=\s*"description"/);
    });

    // Check all HTML pages in the site have <title>
    const htmlFiles = fs.readdirSync(site.dir).filter((f) => f.endsWith(".html"));
    for (const file of htmlFiles) {
      it(`${file} has <title>`, () => {
        const html = readFile(path.join(site.dir, file));
        expect(html, `${file} should have a <title> tag`).toMatch(/<title>.+<\/title>/);
      });
    }
  });

  describe.runIf(site.landingHasJsonLd)(`Structured data validation (${site.name})`, () => {
    it(`${site.landing} has JSON-LD with @type "SoftwareApplication"`, () => {
      const html = readFile(path.join(site.dir, site.landing));
      const jsonLdBlocks = extractJsonLd(html);
      expect(jsonLdBlocks.length).toBeGreaterThan(0);
      const app = jsonLdBlocks.find((b) => b["@type"] === "SoftwareApplication");
      expect(app, "Should have a SoftwareApplication JSON-LD block").toBeTruthy();
      expect(app["@context"]).toBe("https://schema.org");
      expect(app.name).toContain("DIY Accounting");
    });
  });
}

// A page is indexed once, at its own URL. The canonical link says which URL that is.
function canonicalHref(html) {
  const match = html.match(/<link\s+rel\s*=\s*"canonical"\s+href\s*=\s*"([^"]+)"/);
  return match ? match[1] : undefined;
}

describe("Canonical links (spreadsheets)", () => {
  const siteDir = path.join(process.cwd(), "web/spreadsheets.diyaccounting.co.uk");
  const publicDir = path.join(siteDir, "public");
  const domain = "https://spreadsheets.diyaccounting.co.uk";
  const pages = [
    ...fs
      .readdirSync(publicDir)
      .filter((f) => f.endsWith(".html"))
      .map((f) => ({ file: path.join(publicDir, f), urlPath: f })),
    ...fs
      .readdirSync(path.join(publicDir, "articles"))
      .filter((f) => f.endsWith(".html"))
      .map((f) => ({ file: path.join(publicDir, "articles", f), urlPath: `articles/${f}` })),
    { file: path.join(siteDir, "donate.template.html"), urlPath: "donate.html" },
  ];

  it("covers the main pages, the donate template and every article", () => {
    expect(pages.length).toBeGreaterThanOrEqual(121 + 9 + 1);
  });

  it("every page has a self-referencing absolute https canonical", () => {
    for (const { file, urlPath } of pages) {
      const expected = urlPath === "index.html" ? `${domain}/` : `${domain}/${urlPath}`;
      expect(canonicalHref(readFile(file)), `${urlPath} canonical`).toBe(expected);
    }
  });
});

describe("Markdown copies of the articles (spreadsheets)", () => {
  it("the CDK stack sends noindex for /articles/*.md", () => {
    const stack = readFile(path.join(process.cwd(), "infra/main/java/co/uk/diyaccounting/spreadsheets/stacks/SpreadsheetsStack.java"));
    expect(stack).toContain('"/articles/*.md"');
    expect(stack).toContain('.header("X-Robots-Tag")');
  });
});

describe("Canonical links and headings (diya-gl)", () => {
  const dir = path.join(process.cwd(), "web/diya-gl.co.uk/public");
  const pages = {
    "index.html": "https://diya-gl.co.uk/",
    "bst.html": "https://diya-gl.co.uk/bst.html",
    "se.html": "https://diya-gl.co.uk/se.html",
    "taxi.html": "https://diya-gl.co.uk/taxi.html",
    "ltd.html": "https://diya-gl.co.uk/ltd.html",
    "spec.html": "https://diya-gl.co.uk/spec.html",
  };

  for (const [file, expected] of Object.entries(pages)) {
    it(`${file} has the canonical ${expected} and exactly one h1`, () => {
      const html = readFile(path.join(dir, file));
      expect(canonicalHref(html)).toBe(expected);
      expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    });
  }

  it("the sitemap lists / and never /index.html", () => {
    const urls = extractSitemapUrls(readFile(path.join(dir, "sitemap.xml")));
    expect(urls).toContain("https://diya-gl.co.uk/");
    expect(urls.some((u) => u.endsWith("index.html"))).toBe(false);
  });

  it("the stylesheet keeps the tab strip's height before the book loads", () => {
    const css = readFile(path.join(dir, "diya-gl.css"));
    expect(css).toMatch(/body\[data-default-example\] \.sheet-tabs\.hidden\s*{[^}]*visibility:\s*hidden/);
    expect(css).toMatch(/\.runner-meta:empty::after/);
  });
});
