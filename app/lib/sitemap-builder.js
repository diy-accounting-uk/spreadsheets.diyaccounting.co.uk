// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 DIY Accounting Ltd
//
// sitemap-builder.js — Pure functions for generating sitemap.xml content.

export function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildSitemapXml(products, articles) {
  const urls = [];

  // Main pages
  urls.push({ loc: "https://spreadsheets.diyaccounting.co.uk/", changefreq: "monthly", priority: "1.0" });
  urls.push({ loc: "https://spreadsheets.diyaccounting.co.uk/download.html", changefreq: "monthly", priority: "0.9" });
  urls.push({ loc: "https://spreadsheets.diyaccounting.co.uk/donate.html", changefreq: "yearly", priority: "0.5" });
  urls.push({ loc: "https://spreadsheets.diyaccounting.co.uk/knowledge-base.html", changefreq: "monthly", priority: "0.9" });

  // Product download pages
  for (const prod of products) {
    urls.push({ loc: `https://spreadsheets.diyaccounting.co.uk/download.html?product=${escapeXml(prod.id)}`, priority: "0.9" });
  }

  // Knowledge base articles
  for (const art of articles) {
    urls.push({ loc: `https://spreadsheets.diyaccounting.co.uk/articles/${escapeXml(art.id)}.md`, priority: "0.7" });
  }

  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  for (const u of urls) {
    let entry = `  <url><loc>${u.loc}</loc>`;
    if (u.changefreq) entry += `<changefreq>${u.changefreq}</changefreq>`;
    entry += `<priority>${u.priority}</priority></url>`;
    lines.push(entry);
  }
  lines.push("</urlset>");
  lines.push("");

  return { xml: lines.join("\n"), urlCount: urls.length };
}
