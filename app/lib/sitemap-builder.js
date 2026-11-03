// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// sitemap-builder.js — Pure functions for generating sitemap.xml content.

export function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function wrapUrlset(urls) {
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push("<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->");
  lines.push("<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->");
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  for (const u of urls) {
    let entry = `  <url><loc>${u.loc}</loc>`;
    if (u.lastmod) entry += `<lastmod>${u.lastmod}</lastmod>`;
    if (u.changefreq) entry += `<changefreq>${u.changefreq}</changefreq>`;
    entry += `<priority>${u.priority}</priority></url>`;
    lines.push(entry);
  }
  lines.push("</urlset>");
  lines.push("");

  return { xml: lines.join("\n"), urlCount: urls.length };
}

// The diya-gl.co.uk site's own sitemap: one entry per page it serves at its
// root, read off the same list the callers of PAGES-style constants use
// elsewhere rather than restated by hand.
export function buildDiyaGlSitemapXml(pages) {
  const urls = pages.map((page) => ({
    loc: `https://diya-gl.co.uk/${page}`,
    changefreq: "monthly",
    priority: page === "index.html" ? "1.0" : "0.9",
  }));
  return wrapUrlset(urls);
}

// lastmodFor(path) returns the YYYY-MM-DD date for a page path relative to the
// site root (for example "articles/tax-guide.html"). Without it every URL takes
// the build date.
export function buildSitemapXml(products, articles, reconciliationPages = [], lastmodFor = () => new Date().toISOString().slice(0, 10)) {
  const urls = [];
  const site = "https://spreadsheets.diyaccounting.co.uk";
  const add = (path, loc, extra) => urls.push({ loc, lastmod: lastmodFor(path), ...extra });

  // Main pages
  add("index.html", `${site}/`, { changefreq: "monthly", priority: "1.0" });
  add("download.html", `${site}/download.html`, { changefreq: "monthly", priority: "0.9" });
  add("donate.html", `${site}/donate.html`, { changefreq: "yearly", priority: "0.5" });
  add("knowledge-base.html", `${site}/knowledge-base.html`, { changefreq: "monthly", priority: "0.9" });

  // Product download pages
  for (const prod of products) {
    add("download.html", `${site}/download.html?product=${escapeXml(prod.id)}`, { priority: "0.9" });
  }

  // Knowledge base articles, as the .html pages (the .md copies are not indexed)
  for (const art of articles) {
    add(`articles/${art.id}.html`, `${site}/articles/${escapeXml(art.id)}.html`, { priority: "0.7" });
  }

  // Reconciliation pages, rebuilt by each product's generate workflow
  if (reconciliationPages.length > 0) {
    add("reconciliation/index.html", `${site}/reconciliation/index.html`, { changefreq: "monthly", priority: "0.6" });
    for (const page of reconciliationPages) {
      add(`reconciliation/${page}.html`, `${site}/reconciliation/${escapeXml(page)}.html`, { changefreq: "monthly", priority: "0.6" });
    }
  }

  return wrapUrlset(urls);
}
