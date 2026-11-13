// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { describe, it, expect } from "vitest";
import { DOMParser } from "@xmldom/xmldom";
import { renderAtomFeed } from "../lib/atom-feed.js";
import { DIYA_GL_SITE, SPREADSHEETS_SITE, buildLlmsFiles, feedEntries, parseHtml, pageMarkdown, sitemapUrls } from "../lib/llms-txt.js";

const SITE = SPREADSHEETS_SITE.origin;

function page(title, description, body) {
  return `<!doctype html><html><head><title>${title}</title><meta name="description" content="${description}" />
<meta property="og:site_name" content="DIY Accounting" /><script>var x = "<b>not text</b>";</script><style>p{}</style></head>
<body><!-- a comment --><header><nav><a href="download.html">Download</a></nav></header><main><h1>${title}</h1>${body}</main></body></html>`;
}

const FILES = {
  "index.html": page("Home", "Free spreadsheets &amp; guides.", '<p>Welcome to <a href="download.html">the downloads</a>.</p>'),
  "download.html": page("Download", "Download a workbook.", "<form><input /><button>Go</button></form><ul><li>One</li><li>Two</li></ul>"),
  "products/self-employed.html": page(
    "Self Employed - DIY Accounting Spreadsheets",
    "For the self employed.",
    "<p>Sales &lt; purchases.</p>",
  ),
  "articles/time-to-pay.html": page("Time to Pay - DIY Accounting Spreadsheets", "Pay in instalments.", "<p>Call HMRC.</p>"),
  "articles/no-copy.html": page("No Copy - DIY Accounting Spreadsheets", "An article with no copy.", "<p>Text.</p>"),
  "articles/time-to-pay.md": "Call HMRC.",
};

function sitemap(files) {
  const locs = files.map((file) => `<url><loc>${SITE}/${file === "index.html" ? "" : file}</loc></url>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs}</urlset>`;
}

const PAGE_FILES = Object.keys(FILES).filter((file) => file.endsWith(".html"));
const readPage = (path) => FILES[path] ?? null;
const build = () =>
  buildLlmsFiles({
    site: SPREADSHEETS_SITE,
    sitemapXml: sitemap(PAGE_FILES),
    readPage,
    products: [{ name: "Self Employed" }, { name: "Company" }],
  });

describe("llms.txt", () => {
  const { llmsTxt } = build();

  it("starts with the site name, a blockquote and the first section", () => {
    expect(llmsTxt.split("\n").slice(0, 5)).toEqual([
      "# DIY Accounting Spreadsheets",
      "",
      "> Free spreadsheets & guides. Products: Self Employed, Company. The knowledge base has 2 articles.",
      "",
      "## Pages",
    ]);
  });

  it("lists every sitemap URL, an article by its markdown copy when it has one", () => {
    for (const url of sitemapUrls(sitemap(PAGE_FILES))) {
      const markdownCopy = url.replace(/\.html$/, ".md");
      expect(llmsTxt.includes(`](${url})`) || llmsTxt.includes(`](${markdownCopy})`), url).toBe(true);
    }
    expect(llmsTxt).toContain(`- [Time to Pay - DIY Accounting Spreadsheets](${SITE}/articles/time-to-pay.md): Pay in instalments.`);
    expect(llmsTxt).toContain(`](${SITE}/articles/no-copy.html): An article with no copy.`);
  });

  it("holds no markup", () => {
    for (const text of Object.values(build())) {
      expect(text).not.toMatch(/<[a-zA-Z!/]/);
      expect(text).not.toContain("<script");
      expect(text).not.toContain("<!--");
      expect(text).not.toContain("not text");
    }
  });

  it("is the same for the same input", () => {
    expect(build()).toEqual(build());
  });

  it("names the diya-gl site by its own pages", () => {
    const files = { "index.html": page("DIYA-GL", "Books in your browser.", "<p>Hello.</p>") };
    const { llmsTxt: gl } = buildLlmsFiles({
      site: DIYA_GL_SITE,
      sitemapXml: sitemap(["index.html"]).replaceAll(SITE, DIYA_GL_SITE.origin),
      readPage: (path) => files[path] ?? null,
    });
    expect(gl).toContain("# DIYA-GL\n\n> Books in your browser.");
    expect(gl).toContain("](https://diya-gl.co.uk/): Books in your browser.");
  });

  it("stops when a sitemap page is not built", () => {
    expect(() => buildLlmsFiles({ site: SPREADSHEETS_SITE, sitemapXml: sitemap(["missing.html"]), readPage })).toThrow(/not built/);
  });
});

describe("llms-full.txt", () => {
  const { llmsFullTxt } = build();

  it("holds the root pages and the product pages, and links the articles from llms.txt only", () => {
    expect(llmsFullTxt).toContain("# Home\n\nSource: https://spreadsheets.diyaccounting.co.uk/\n");
    expect(llmsFullTxt).toContain("# Self Employed - DIY Accounting Spreadsheets");
    expect(llmsFullTxt).not.toContain("Call HMRC");
  });

  it("keeps the text, the links and the list items of a page, and drops forms and scripts", () => {
    expect(llmsFullTxt).toContain(`Welcome to [the downloads](${SITE}/download.html).`);
    expect(llmsFullTxt).toContain("- One\n- Two");
    expect(llmsFullTxt).toContain("Sales < purchases.");
    expect(llmsFullTxt).not.toContain("Go");
  });
});

describe("pageMarkdown", () => {
  it("renders headings and falls back to the body when a page has no main", () => {
    const document = parseHtml("<html><head><title>T</title></head><body><h2>Head</h2><p>Line<br/>two</p></body></html>");
    expect(pageMarkdown(document, `${SITE}/x.html`)).toBe("## Head\n\nLine\ntwo");
  });

  it("keeps a link to a page, a mailbox or a phone number, and leaves only the text of any other scheme", () => {
    const links = [
      "/a.html",
      "mailto:x@example.com",
      "tel:+441234567890",
      "javascript:alert(1)",
      "data:text/html,x",
      "vbscript:x",
      "JaVaScRiPt:alert(1)",
    ];
    const body = links.map((href, index) => `<p><a href="${href}">L${index}</a></p>`).join("");
    const document = parseHtml(`<html><head><title>T</title></head><body>${body}</body></html>`);
    expect(pageMarkdown(document, `${SITE}/x.html`)).toBe(
      [`[L0](${SITE}/a.html)`, "[L1](mailto:x@example.com)", "[L2](tel:+441234567890)", "L3", "L4", "L5", "L6"].join("\n\n"),
    );
  });
});

describe("feed", () => {
  const entries = feedEntries(
    SPREADSHEETS_SITE,
    [
      { article: "no-copy", updated: "2026-02-06T02:04:00Z" },
      { article: "time-to-pay", updated: "2026-02-07T10:00:00Z" },
    ],
    (id) => FILES[`articles/${id}.html`],
  );
  const feedOptions = {
    siteUrl: `${SITE}/recently-updated.html`,
    feedUrl: `${SITE}/feed.xml`,
    title: "Recent & new",
    subtitle: "Sub",
    authorName: "DIY Accounting",
    entries,
  };
  const xml = renderAtomFeed(feedOptions);
  const document = new DOMParser({
    onError: (level, message) => {
      throw new Error(message);
    },
  }).parseFromString(xml, "text/xml");
  const text = (parent, name) => parent.getElementsByTagName(name)[0].textContent;

  it("parses as XML in the Atom namespace with a feed id, title and updated date", () => {
    expect(document.documentElement.namespaceURI).toBe("http://www.w3.org/2005/Atom");
    expect(text(document.documentElement, "id")).toBe(`${SITE}/feed.xml`);
    expect(text(document.documentElement, "title")).toBe("Recent & new");
    expect(text(document.documentElement, "updated")).toBe("2026-02-07T10:00:00Z");
  });

  it("gives every entry an id, title, link, updated date and summary, newest first", () => {
    const nodes = document.getElementsByTagName("entry");
    expect(nodes.length).toBe(2);
    for (let index = 0; index < nodes.length; index += 1) {
      for (const name of ["id", "title", "updated", "summary"]) expect(text(nodes[index], name), name).not.toBe("");
      expect(nodes[index].getElementsByTagName("link")[0].getAttribute("href")).toMatch(/^https:\/\//);
      expect(text(nodes[index], "updated")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    }
    expect(text(nodes[0], "title")).toBe("Time to Pay");
    expect(text(nodes[1], "id")).toBe(`${SITE}/articles/no-copy.html`);
  });

  it("holds no script or comment markup beyond the licence header, and is the same for the same input", () => {
    expect(xml).not.toContain("<script");
    expect(xml.match(/<!--/g)).toHaveLength(2);
    expect(renderAtomFeed(feedOptions)).toBe(xml);
  });

  it("refuses a date that is not RFC 3339", () => {
    expect(() => renderAtomFeed({ ...feedOptions, entries: [{ ...entries[0], updated: "6 Feb 2026" }] })).toThrow(/RFC 3339/);
  });
});
