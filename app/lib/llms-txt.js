// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// llms-txt.js — Pure functions that render llms.txt and llms-full.txt (https://llmstxt.org)
// from the built pages of a site. Pages are read with an HTML parser, not with
// regular expressions, so the output holds the text of a page and never its markup.

import { DOMParser } from "@xmldom/xmldom";

const ELEMENT = 1;
const TEXT = 3;
const LINE_BREAK = " ";

// Elements that hold no text a reader reads: code, markup helpers and controls.
const SKIPPED_TAGS = new Set(["script", "style", "noscript", "template", "svg", "head", "form", "input", "select", "textarea", "button"]);
const BLOCK_TAGS = new Set([
  "p",
  "div",
  "address",
  "details",
  "summary",
  "nav",
  "ul",
  "ol",
  "section",
  "aside",
  "article",
  "header",
  "footer",
  "main",
  "blockquote",
  "figure",
  "figcaption",
  "table",
  "tbody",
  "thead",
  "tr",
  "dl",
  "dt",
  "dd",
]);

function squash(text) {
  return text.replace(/\s+/g, " ").trim();
}

function parse(source, mimeType) {
  return new DOMParser({
    onError: (level, message) => {
      if (level === "fatalError") throw new Error(`llms-txt.js: ${message}`);
    },
  }).parseFromString(source, mimeType);
}

export function parseHtml(html) {
  return parse(html, "text/html");
}

function firstElement(document, name) {
  return document.getElementsByTagName(name)[0];
}

function childNodes(node) {
  return Array.from({ length: node.childNodes.length }, (unused, index) => node.childNodes[index]);
}

export function sitemapUrls(xml) {
  const document = parse(xml, "text/xml");
  const locs = document.getElementsByTagName("loc");
  return Array.from({ length: locs.length }, (unused, index) => squash(locs[index].textContent));
}

export function pageTitle(document) {
  return squash(firstElement(document, "title").textContent);
}

export function metaContent(document, attribute, value) {
  const metas = document.getElementsByTagName("meta");
  for (let index = 0; index < metas.length; index += 1) {
    if (metas[index].getAttribute(attribute) === value) return squash(metas[index].getAttribute("content") || "");
  }
  return "";
}

export function pageDescription(document) {
  return metaContent(document, "name", "description");
}

function inlineMarkdown(node, pageUrl) {
  if (node.nodeType === TEXT) return node.data;
  if (node.nodeType !== ELEMENT || SKIPPED_TAGS.has(node.localName)) return "";
  if (node.localName === "br") return LINE_BREAK;
  const inner = childNodes(node)
    .map((child) => inlineMarkdown(child, pageUrl))
    .join("");
  if (node.localName === "a") {
    const label = squash(inner);
    const href = node.getAttribute("href") || "";
    if (label === "" || href === "" || href.startsWith("#") || href.startsWith("javascript:")) return label;
    return `[${label}](${new URL(href, pageUrl).href})`;
  }
  if (node.localName === "strong" || node.localName === "b") return `**${squash(inner)}**`;
  return inner;
}

function tidyLines(text) {
  return text
    .split(LINE_BREAK)
    .map(squash)
    .filter((line) => line !== "")
    .join("\n");
}

// The text of the page's <main> (or its <body>) as Markdown blocks.
export function pageMarkdown(document, pageUrl) {
  const root = firstElement(document, "main") || firstElement(document, "body");
  const blocks = [];
  let inline = "";
  const flush = () => {
    const text = tidyLines(inline);
    if (text !== "") blocks.push(text);
    inline = "";
  };
  const push = (text) => {
    flush();
    if (squash(text.replace(/^[-#]+/, "")) !== "") blocks.push(text);
  };
  const walk = (node) => {
    if (node.nodeType === TEXT) {
      inline += node.data;
      return;
    }
    if (node.nodeType !== ELEMENT || SKIPPED_TAGS.has(node.localName)) return;
    const heading = node.localName.match(/^h([1-6])$/);
    if (heading) {
      push(`${"#".repeat(Number(heading[1]))} ${squash(inlineMarkdown(node, pageUrl))}`);
    } else if (node.localName === "li") {
      push(`- ${squash(inlineMarkdown(node, pageUrl))}`);
    } else if (BLOCK_TAGS.has(node.localName)) {
      flush();
      childNodes(node).forEach(walk);
      flush();
    } else {
      inline += inlineMarkdown(node, pageUrl);
    }
  };
  childNodes(root).forEach(walk);
  flush();
  return blocks
    .map((block, index) => (index > 0 && block.startsWith("- ") && blocks[index - 1].startsWith("- ") ? `\n${block}` : `\n\n${block}`))
    .join("")
    .trim();
}

// url is a sitemap <loc> of a site at origin; the result is its file path under the public directory.
export function pageFile(url, origin) {
  if (!url.startsWith(`${origin}/`)) throw new Error(`llms-txt.js: ${url} is not under ${origin}`);
  const path = url.slice(origin.length + 1);
  return path === "" ? "index.html" : path;
}

// readPage(path) returns the text of a file under the public directory, or null when it is absent.
export function loadPages({ origin, sitemapXml, readPage }) {
  return sitemapUrls(sitemapXml).map((url) => {
    const file = pageFile(url, origin);
    const html = readPage(file);
    if (html === null) throw new Error(`llms-txt.js: ${file} is in the sitemap and is not built`);
    const document = parseHtml(html);
    const description = pageDescription(document);
    if (description === "") throw new Error(`llms-txt.js: ${file} has no meta description`);
    return {
      url,
      file,
      title: pageTitle(document),
      description,
      markdown: pageMarkdown(document, url),
      siteName: metaContent(document, "property", "og:site_name"),
    };
  });
}

function section(page) {
  const [first] = page.file.split("/");
  return page.file.includes("/") ? first : "";
}

const SECTION_HEADINGS = { "": "Pages", "products": "Products", "articles": "Articles", "reconciliation": "Reconciliation" };

// markdownCopy(page) returns the URL of the .md copy of a page, or null.
export function renderLlmsTxt({ siteName, summary, pages, markdownCopy = () => null }) {
  const lines = [`# ${siteName}`, "", `> ${summary}`];
  const bySection = new Map();
  for (const page of pages) {
    const key = section(page);
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key).push(page);
  }
  const order = Object.keys(SECTION_HEADINGS).filter((key) => bySection.has(key));
  for (const key of [...bySection.keys()].filter((name) => !order.includes(name)).sort()) order.push(key);
  for (const key of order) {
    lines.push("", `## ${SECTION_HEADINGS[key] || key}`, "");
    for (const page of bySection.get(key)) {
      lines.push(`- [${page.title}](${markdownCopy(page) || page.url}): ${page.description}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

// The root pages and the product pages in full; every other page is linked from llms.txt.
export function renderLlmsFullTxt(pages) {
  const inFull = pages.filter((page) => ["", "products"].includes(section(page)));
  return inFull.map((page) => `# ${page.title}\n\nSource: ${page.url}\n\n${page.markdown}\n`).join("\n");
}

export const SPREADSHEETS_SITE = { name: "DIY Accounting Spreadsheets", origin: "https://spreadsheets.diyaccounting.co.uk" };
export const DIYA_GL_SITE = { name: "DIYA-GL", origin: "https://diya-gl.co.uk" };

function spreadsheetsSummary(pages, products) {
  const home = pages.find((page) => page.file === "index.html");
  const articles = pages.filter((page) => section(page) === "articles").length;
  const names = products.map((product) => product.name).join(", ");
  return `${home.description} Products: ${names}. The knowledge base has ${articles} articles.`;
}

// site is SPREADSHEETS_SITE or DIYA_GL_SITE. readPage(path) returns a file's text or null.
// products is the catalogue's product list; only the spreadsheets site uses it.
export function buildLlmsFiles({ site, sitemapXml, readPage, products = [] }) {
  const pages = loadPages({ origin: site.origin, sitemapXml, readPage });
  const home = pages.find((page) => page.file === "index.html");
  const summary = site === SPREADSHEETS_SITE ? spreadsheetsSummary(pages, products) : home.description;
  const markdownCopy = (page) => {
    if (section(page) !== "articles") return null;
    const copy = page.file.slice(0, -".html".length) + ".md";
    return readPage(copy) === null ? null : `${site.origin}/${copy}`;
  };
  return {
    llmsTxt: renderLlmsTxt({ siteName: site.name, summary, pages, markdownCopy }),
    llmsFullTxt: renderLlmsFullTxt(pages),
  };
}

// Atom feed entries for the articles in recently-updated.toml: [{ article, updated }].
// readArticle(id) returns the text of articles/<id>.html.
export function feedEntries(site, updated, readArticle) {
  const suffix = ` - ${site.name}`;
  return updated.map(({ article, updated: when }) => {
    const document = parseHtml(readArticle(article));
    const title = pageTitle(document);
    return {
      url: `${site.origin}/articles/${article}.html`,
      title: title.endsWith(suffix) ? title.slice(0, -suffix.length) : title,
      summary: pageDescription(document),
      updated: when,
    };
  });
}
