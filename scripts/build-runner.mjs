// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// build-runner.mjs — one single-file HTML runner per product: the books
// page's own markup, styles and scripts, with every fetch and dynamic
// import() it makes at load time answered from data already inside the
// file, so the result opens with a plain double-click (file://) and needs
// no server, no origin and no network.
//
// It reads scripts/build-books-bundle.mjs's own output (the engine bundle
// and the copied runtime assets under books/assets/) rather than
// duplicating that build: run that script first.
//
//   node scripts/build-runner.mjs
//
// Two problems a plain concatenation would not solve, both worked out
// empirically against Chromium and noted here because neither is written
// down anywhere else:
//
// 1. A module fetched from a file:// document is refused by the browser's
//    CORS check ("origin 'null'") before its bytes are even read, so
//    data.js's `import("./engine/diya-gl-engine.js")` cannot resolve to a
//    file:// URL at all. A `<base href>` pinned to a fixed, fake https
//    origin makes every relative specifier in the document resolve to a
//    predictable absolute URL regardless of where the runner file itself
//    is opened from, and a <script type="importmap"> then remaps those
//    exact URLs to data: URLs holding the real source. Dynamic import() of
//    a data: URL is allowed; only the fetch of a file: URL is refused.
// 2. A module reached through the import map has its own base URL for any
//    further relative import inside it, and a data: URL cannot be a base
//    for resolving one ("cannot-be-a-base-URL") -- so save.js's own
//    `import("./engine/diya-gl-engine.js")` would fail even once save.js
//    itself loads. Its embedded copy has that one specifier rewritten to
//    the same fixed absolute URL the import map already answers; the
//    checked-in file on disk is untouched.
//
// Every other resource the page reads -- the two published schemas, the
// tax year data, the HMRC form layouts and filing data, and the product's
// own workbook templates -- goes through the ordinary fetch() the page
// already calls (either bundle-resources.js's loader or, for the form
// layouts, the product modules' own direct fetch()). Nothing about that
// path changes: a single window.fetch wrapper, installed before any other
// script runs, answers a fixed set of known URLs from an inlined resource
// map and falls through to the real fetch() for anything else.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { resolve, dirname, join, extname } from "path";
import { fileURLToPath } from "url";
import { provenanceStamps } from "../app/lib/provenance.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public");
const BOOKS_DIR = resolve(PUBLIC_DIR, "books");
const SCHEMA_DIR = resolve(PUBLIC_DIR, "schema");
const ASSETS_DIR = resolve(BOOKS_DIR, "assets");
const OUT_DIR = resolve(ROOT, "target", "runners");

// The fixed, fake origin every relative specifier and every absolute-path
// fetch in the page resolves against once <base href> names it -- see the
// file header. ".invalid" is the reserved TLD for exactly this: a name
// that must never resolve on a real network (RFC 2606).
const ORIGIN = "https://runner.diya-gl.invalid";
const BASE_PATH = "/books/";
const BASE_HREF = `${ORIGIN}${BASE_PATH}`;

const PRODUCTS = {
  bst: { title: "Basic Sole Trader" },
  se: { title: "Self Employed" },
  taxi: { title: "Taxi Driver" },
  ltd: { title: "Limited Company" },
};

// Loaded only for the shell's own head, never fetched or executed offline:
// a service worker has no origin to register against, the analytics and
// consent-banner scripts exist to talk to Google's servers, and the cloud
// sign-in pair needs a real origin for its OAuth redirect and Submit's API
// -- none of which a file opened from disk has. cloud.js's own isEnabled()
// guard (C5) would already keep the feature off on file://, but the runner
// carries neither script at all rather than relying on that guard alone.
const SKIP_SCRIPT_SRC = new Set(["../lib/analytics.js", "../lib/consent-banner.js", "pwa.js", "cloud-config.js", "cloud.js"]);

const MIME_BY_EXT = {
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".toml": "text/plain",
  ".json": "application/json",
};

function readText(path) {
  return readFileSync(path, "utf8");
}

function walkFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

// Resolves a CSS file's @import url(...) chain in place, depth-first, so
// books.css's rules land before a product sheet's own -- the same order
// the browser would apply them in if it fetched each file itself.
function inlineCss(cssPath, seen = new Set()) {
  const key = resolve(cssPath);
  if (seen.has(key)) return "";
  seen.add(key);
  const text = readText(cssPath);
  return text.replace(/@import\s+url\(["']?([^"')]+)["']?\)\s*;?/g, (_match, ref) => inlineCss(resolve(dirname(cssPath), ref), seen));
}

function toBase64(path) {
  return readFileSync(path).toString("base64");
}

// Every <script ...> tag in document order, whether it names a src or (as
// this page never does) carries its code inline, plus every stylesheet
// <link>. Regex over the static markup is enough here -- these pages are
// hand-written and never carry a script or style tag split across lines
// in a way this would misparse -- and keeps this build depending on
// nothing but the page's own bytes, the same discipline
// build-books-bundle.mjs's own pageReferences() follows.
function extractTags(html) {
  const scripts = [...html.matchAll(/<script\b([^>]*)\bsrc="([^"]+)"([^>]*)>\s*<\/script>/g)].map((m) => ({
    src: m[2],
    module: /\btype="module"/.test(m[1] + m[3]),
    whole: m[0],
  }));
  const styles = [...html.matchAll(/<link\b[^>]*\srel="stylesheet"[^>]*\shref="([^"]+)"[^>]*\/?>/g)].map((m) => ({
    href: m[1],
    whole: m[0],
  }));
  return { scripts, styles };
}

function base64ToUint8ArraySnippet() {
  // Runs in the browser, not here -- decodes one of RESOURCES' base64
  // entries back to bytes for resources.readBinary().
  return `function base64ToBytes(b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }`;
}

// The fetch() every one of the page's own scripts already calls -- through
// bundle-resources.js's loader for the schemas, tax data, templates and
// examples, and directly for the product modules' own HMRC form-layout and
// filing-data reads -- answered from RESOURCES instead of a network this
// runner does not have. Anything not in the map falls through to the real
// fetch(), which fails the way any offline network request does; nothing
// on this page's load or save path reaches such a URL.
function buildFetchShimScript(resources) {
  const entries = {};
  for (const [url, entry] of resources) entries[url] = entry;
  return `(function () {
  "use strict";
  var RESOURCES = ${JSON.stringify(entries)};
  ${base64ToUint8ArraySnippet()}
  var realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url;
    try {
      url = new URL(typeof input === "string" ? input : input.url, document.baseURI).href;
    } catch (e) {
      url = null;
    }
    var entry = url ? RESOURCES[url] : undefined;
    if (entry) {
      var body = entry.base64 !== undefined ? base64ToBytes(entry.base64) : entry.text;
      return Promise.resolve(new Response(body, { status: 200, headers: { "Content-Type": entry.type || "application/octet-stream" } }));
    }
    return realFetch(input, init);
  };

  // <base href> is what makes every other relative URL in this file
  // resolve to a fixed, predictable address (see the file header) -- but
  // history.pushState/replaceState refuse a URL whose origin differs from
  // the document's own, and the document's real origin (a file:// page) is
  // never the fixed one. The page's own deep-link URL sync
  // (shell.js's syncDeepLinkUrl) calls replaceState with exactly such a
  // URL; caught here and retried with no URL argument, which leaves the
  // address bar as it is rather than throwing. A local file has no
  // shareable address for a deep link to update anyway.
  ["pushState", "replaceState"].forEach(function (method) {
    var native = history[method].bind(history);
    history[method] = function (state, title, url) {
      try {
        return native(state, title, url);
      } catch (e) {
        return native(state, title);
      }
    };
  });
})();`;
}

// The three modules the page only ever reaches through a dynamic import()
// of a relative specifier: the engine bundle and the resource loader (both
// from data.js), and save.js (from shell.js, only once a save is asked
// for). Each becomes one entry in the <script type="importmap">, keyed by
// the absolute URL that specifier resolves to once <base href> is in
// force -- see the file header for why a fixed base URL is what makes this
// portable to wherever the runner file itself is opened from.
function buildImportMapScript(modules) {
  const imports = {};
  for (const [specifier, source] of modules) {
    imports[`${BASE_HREF}${specifier}`] = `data:text/javascript;base64,${Buffer.from(source, "utf8").toString("base64")}`;
  }
  return `{"imports": ${JSON.stringify(imports)}}`;
}

// save.js's own module-relative import of the engine bundle: its base URL
// once loaded is the data: URL the import map above resolves it to, and a
// data: URL cannot be a base for resolving a further relative specifier --
// so this one specifier is rewritten to the same fixed absolute URL the
// import map key already answers. The file on disk is never touched; this
// runs only on the copy of the text this script embeds.
function rewriteSaveJsEngineImport(source) {
  const literal = '"./engine/diya-gl-engine.js"';
  if (!source.includes(literal)) {
    throw new Error(`build-runner.mjs: save.js no longer imports ${literal} -- update the rewrite this runner build depends on.`);
  }
  return source.split(literal).join(`"${BASE_HREF}engine/diya-gl-engine.js"`);
}

// This page's own "view this product elsewhere" links point at a relative
// URL that, once <base href> takes over resolution, would try to reach the
// fake origin instead of the site the runner was cut from. Pointed at the
// live page instead, so following one from an opened-from-disk runner
// reaches a real page rather than a dead address.
function rewriteSiteLinks(bodyHtml, product) {
  return bodyHtml
    .replace(`href="${product}.html"`, `href="https://spreadsheets.diyaccounting.co.uk/books/${product}.html"`)
    .replace('href="../donate.html"', 'href="https://spreadsheets.diyaccounting.co.uk/donate.html"');
}

function collectTemplateFiles(product) {
  const dir = resolve(ASSETS_DIR, "templates", product);
  return walkFiles(dir).map((path) => ({ path, resourcePath: `templates/${product}/${path.slice(dir.length + 1)}` }));
}

function collectExampleFiles(product) {
  const examplesJson = JSON.parse(readText(resolve(ROOT, "scripts", "example-books.json")));
  const files = [];
  for (const example of examplesJson[product] || []) {
    const base = `examples/${example.dir}/${example.product}`;
    for (const name of ["book.toml", "lines.jsonl"]) {
      files.push({ path: resolve(ASSETS_DIR, base, name), resourcePath: `${base}/${name}` });
    }
  }
  return files;
}

function resourceEntry(path) {
  const ext = extname(path);
  const type = MIME_BY_EXT[ext] || "application/octet-stream";
  if (ext === ".xlsx" || ext === ".docx") return { base64: toBase64(path), type };
  return { text: readText(path), type };
}

// Every URL this product's runner answers offline: the two published
// schemas (shared), every tax year file the resource loader might be asked
// for (248 KiB total across every product -- cheaper to carry all of them
// than to work out which one a loaded book's own dates will name), this
// product's own HMRC form layout (and, for Ltd, its filing data), this
// product's own workbook templates, and this product's own example books.
function buildResourceMap(product) {
  const resources = new Map();

  for (const name of ["diya-gl-book-v2.schema.json", "diya-gl-lines-v2.schema.json"]) {
    resources.set(`${ORIGIN}/schema/${name}`, resourceEntry(resolve(SCHEMA_DIR, name)));
  }

  const dataDir = resolve(ASSETS_DIR, "data");
  const yearFiles = readdirSync(dataDir).filter((name) => extname(name) === ".toml");
  for (const name of yearFiles) {
    resources.set(`${BASE_HREF}assets/data/${name}`, resourceEntry(resolve(dataDir, name)));
  }

  resources.set(
    `${BASE_HREF}assets/data/hmrc/form-layouts/${product}.json`,
    resourceEntry(resolve(dataDir, "hmrc", "form-layouts", `${product}.json`)),
  );

  if (product === "ltd") {
    for (const path of walkFiles(resolve(dataDir, "filing"))) {
      resources.set(`${BASE_HREF}assets/data/filing/${path.slice(resolve(dataDir, "filing").length + 1)}`, resourceEntry(path));
    }
  }

  resources.set(`${BASE_HREF}assets/templates/meta.toml`, resourceEntry(resolve(ASSETS_DIR, "templates", "meta.toml")));
  for (const { path, resourcePath } of collectTemplateFiles(product)) {
    resources.set(`${BASE_HREF}assets/${resourcePath}`, resourceEntry(path));
  }

  for (const { path, resourcePath } of collectExampleFiles(product)) {
    resources.set(`${BASE_HREF}assets/${resourcePath}`, resourceEntry(path));
  }

  return resources;
}

function assertBuilt() {
  const bundle = resolve(BOOKS_DIR, "engine", "diya-gl-engine.js");
  try {
    statSync(bundle);
  } catch {
    throw new Error(`build-runner.mjs: no engine bundle at ${bundle}. Run: node scripts/build-books-bundle.mjs`);
  }
}

function buildProvenanceStamp(product) {
  const stamps = provenanceStamps(product);
  const parts = [
    `format ${stamps["diya-gl:formatVersion"]}`,
    `engine ${stamps["diya-gl:engineVersion"]}`,
    `tax data ${stamps["diya-gl:taxDataHash"]}`,
    `template ${stamps["diya-gl:templateHash"]}`,
    `scorecard ${stamps["diya-gl:templateScorecard"]}`,
  ];
  if (stamps["diya-gl:reconciledCommit"]) parts.push(`reconciled at ${stamps["diya-gl:reconciledCommit"]}`);
  return { content: parts.join("; "), stamps };
}

function buildRunner(product) {
  const meta = PRODUCTS[product];
  const pageHtml = readText(resolve(BOOKS_DIR, `${product}.html`));
  const { scripts, styles } = extractTags(pageHtml);

  const cssText = styles.map((s) => inlineCss(resolve(BOOKS_DIR, s.href))).join("\n");

  const importMapModules = [
    ["engine/diya-gl-engine.js", readText(resolve(BOOKS_DIR, "engine", "diya-gl-engine.js"))],
    ["bundle-resources.js", readText(resolve(BOOKS_DIR, "bundle-resources.js"))],
    ["save.js", rewriteSaveJsEngineImport(readText(resolve(BOOKS_DIR, "save.js")))],
  ];

  const resources = buildResourceMap(product);
  const { content: provenanceContent, stamps } = buildProvenanceStamp(product);

  const scriptTagsHtml = scripts
    .filter((s) => !SKIP_SCRIPT_SRC.has(s.src))
    .map((s) => {
      const path = s.src.startsWith("assets/") ? resolve(ASSETS_DIR, s.src.slice("assets/".length)) : resolve(BOOKS_DIR, s.src);
      const source = readText(path);
      const openTag = s.module ? '<script type="module">' : "<script>";
      return `${openTag}\n${source}\n</script>`;
    })
    .join("\n");

  let bodyHtml = pageHtml.match(/<body[^>]*>([\s\S]*)<\/body>/)[0];
  bodyHtml = bodyHtml.replace(/<script\b[^>]*\bsrc="[^"]+"[^>]*>\s*<\/script>\s*/g, "");
  bodyHtml = rewriteSiteLinks(bodyHtml, product);
  bodyHtml = bodyHtml.replace(
    "</body>",
    `<footer class="runner-provenance">DIYA-GL offline runner — ${provenanceContent}</footer>\n${scriptTagsHtml}\n</body>`,
  );

  const title = pageHtml.match(/<title>([^<]+)<\/title>/)[1] + " — offline runner";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex" />
<meta name="diya-gl-provenance" content="${provenanceContent.replace(/"/g, "&quot;")}" />
<base href="${BASE_HREF}" />
<style>
${cssText}
.runner-provenance { padding: 0.75rem 1rem; font-size: 0.75rem; color: var(--ink-faint, #667); border-top: 1px solid var(--rule-faint, #ccc); }
</style>
<script>${buildFetchShimScript(resources)}</script>
<script type="importmap">${buildImportMapScript(importMapModules)}</script>
</head>
${bodyHtml}
</html>
`;

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = resolve(OUT_DIR, `diya-gl-${product}.html`);
  writeFileSync(outPath, html);
  return { product, title: meta.title, outPath, bytes: statSync(outPath).size, stamps };
}

function main() {
  assertBuilt();
  const results = Object.keys(PRODUCTS).map(buildRunner);
  for (const r of results) {
    console.log(`runner: ${r.outPath.replace(ROOT + "/", "")} (${r.title}) — ${(r.bytes / (1024 * 1024)).toFixed(2)} MiB`);
  }
}

main();
