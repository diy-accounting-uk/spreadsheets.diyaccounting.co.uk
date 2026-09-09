// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// build-books-bundle.mjs — one esbuild step that turns the engine into an ES
// module the books page can import, and copies the files that engine reads.
//
// The bundle imports app/lib/books-engine.js and the pipeline modules behind
// it exactly as they stand. There is no browser fork of any of them: one
// substitution is Node's own fs, path, url, os, crypto and child_process,
// which resolve to stubs that throw when called. Nothing the BST browser path
// runs calls them — the reads it does need go through the resource loader in
// app/lib/app-resources.js, which the page backs with fetch.
//
// The other substitution is ajv itself. app/lib/diya-gl-schema.js compiles
// the two published v2 schemas with ajv.compile(), which reaches `new
// Function` - forbidden by the production CSP's script-src (no
// unsafe-eval). Its three ajv imports resolve here to a stub built from
// generateStandaloneValidatorSource(): ajv's own standalone code generator,
// run once under Node rather than by the browser. ajv.compile() itself
// never enters the bundle; only the two functions it already generated do.
//
//   node scripts/build-books-bundle.mjs

import { build } from "esbuild";
import { createHash } from "crypto";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "fs";
import { dirname, resolve, relative, sep } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { generateStandaloneValidatorSource } from "../app/lib/diya-gl-schema.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Every file this script emits for the browser is a copy of the engine, so
// each one opens with the engine's own licence rather than the third layer's.
const ENGINE_LICENCE_COMMENT = "/*!\n * SPDX-License-Identifier: Apache-2.0\n * Copyright (C) 2006-2026 DIY Accounting Limited\n */";

const PUBLIC_DIR = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public");
const BOOKS_DIR = resolve(PUBLIC_DIR, "books");
const ENGINE_DIR = resolve(BOOKS_DIR, "engine");
const ASSETS_DIR = resolve(BOOKS_DIR, "assets");
const SCHEMA_DIR = resolve(PUBLIC_DIR, "schema");
const BUNDLE_FILE = resolve(ENGINE_DIR, "diya-gl-engine.js");

// The four books pages' own script and stylesheet tags, read off the pages
// themselves rather than restated here by hand -- see buildPrecacheManifest().
const PAGES = ["bst.html", "se.html", "taxi.html", "ltd.html"];

// Node's own modules, which a browser has none of. Each name a pipeline module
// imports gets a stub that throws with the call that reached it, so a code path
// that only runs under Node fails loudly in a browser rather than quietly
// returning nothing.
const NODE_STUBS = {
  fs: ["readFileSync", "writeFileSync", "existsSync", "readdirSync", "mkdirSync", "rmSync", "cpSync", "statSync"],
  path: ["resolve", "dirname", "basename", "join", "extname", "relative"],
  url: ["fileURLToPath", "pathToFileURL"],
  os: ["tmpdir", "platform", "homedir"],
  crypto: ["randomBytes", "createHash"],
  child_process: ["execSync", "spawnSync"],
};

function stubSource(moduleName) {
  const names = NODE_STUBS[moduleName];
  const why = `${moduleName} is not available in the books bundle`;
  const lines = names.map(
    (name) =>
      `export function ${name}() { throw new Error('${name}(): ${why}. This code path only runs under Node; the page reads its files through the resource loader instead.'); }`,
  );
  lines.push(`export default { ${names.join(", ")} };`);
  return lines.join("\n");
}

const nodeAbsent = {
  name: "node-absent",
  setup(pluginBuild) {
    const pattern = new RegExp(`^(node:)?(${Object.keys(NODE_STUBS).join("|")})$`);
    pluginBuild.onResolve({ filter: pattern }, (args) => ({
      path: args.path.replace(/^node:/, ""),
      namespace: "node-absent",
    }));
    pluginBuild.onLoad({ filter: /.*/, namespace: "node-absent" }, (args) => ({
      contents: stubSource(args.path),
      loader: "js",
    }));
  },
};

// Ajv itself, absent the same way. Its stub for "ajv/dist/2020.js" carries the
// two functions generateStandaloneValidatorSource() already generated, and
// picks between them by the $id of the schema handed to .compile() - the
// same call diya-gl-schema.js's compileSchemas() always makes, unchanged.
function ajvAbsentPlugin(generatedSource) {
  const STUBBED = new Set(["ajv/dist/2020.js", "ajv-formats", "ajv/dist/standalone/index.js"]);
  const stubSources = {
    "ajv/dist/2020.js": `${generatedSource}
class Ajv2020Stub {
  compile(schema) {
    const id = schema && schema.$id;
    if (id === "${BOOK_SCHEMA_ID}") return validateBook;
    if (id === "${LINES_SCHEMA_ID}") return validateLines;
    throw new Error(
      "Ajv2020.compile(): the books bundle only carries the two published diya-gl schemas precompiled, got $id " + id +
      ". ajv's own compiler is not in this bundle: the production CSP allows no unsafe-eval.",
    );
  }
}
export default Ajv2020Stub;`,
    "ajv-formats": `export default function addFormats() {}`,
    "ajv/dist/standalone/index.js": `export default function standaloneCode() {
  throw new Error("standaloneCode(): not available in the books bundle. It runs once at build time to generate the precompiled validators the bundle already carries.");
}`,
  };

  return {
    name: "ajv-absent",
    setup(pluginBuild) {
      pluginBuild.onResolve({ filter: /^ajv/ }, (args) => {
        if (!STUBBED.has(args.path)) return null;
        return { path: args.path, namespace: "ajv-absent" };
      });
      pluginBuild.onLoad({ filter: /.*/, namespace: "ajv-absent" }, (args) => ({
        contents: stubSources[args.path],
        loader: "js",
        resolveDir: ROOT,
      }));
    },
  };
}

// Each entry is a path under examples/, as [directory, product], read from
// scripts/example-books.json. The three BST reconciliation fixtures the books
// page offers as examples (W1): the full-ledger Precision Code subset, the
// BrickWork non-VAT subset and the no-ledger mileage-route book. Taxi (T16) and
// Ltd (T10) append their products' rows to the same file.
let EXAMPLE_BOOKS = [];

// The files the engine reads that are not the book itself: the tax year data
// the save path applies, each product's templates with their meta, and the
// generated examples.js. The two v2 schemas are left where they are — the site
// already publishes them at /schema/, which is the root the resource loader names
// them under.
function generateExamplesJs() {
  const examplesJson = JSON.parse(readFileSync(resolve(ROOT, "scripts", "example-books.json"), "utf8"));
  const examplesJs = `${ENGINE_LICENCE_COMMENT}\nwindow.DiyaGlExamples = ${JSON.stringify(examplesJson)};`;
  writeFileSync(resolve(BOOKS_DIR, "examples.js"), examplesJs);

  // Flatten the examples for copyRuntimeAssets: each product's array becomes [dir, product] pairs.
  for (const [product, examples] of Object.entries(examplesJson)) {
    for (const example of examples) {
      EXAMPLE_BOOKS.push([example.dir, example.product]);
    }
  }
}

function copyRuntimeAssets() {
  rmSync(ASSETS_DIR, { recursive: true, force: true });

  const dataOut = resolve(ASSETS_DIR, "data");
  mkdirSync(dataOut, { recursive: true });
  const dataIn = resolve(ROOT, "app", "data");
  // se's own regime file names a two-year span (se-2026-2027.toml); Ltd's
  // (LT-T7) names the single financial year its Admin sheet declares
  // (ltd-2027.toml). bst and taxi both read se's files, so no pattern of
  // their own is needed.
  const yearFiles = readdirSync(dataIn).filter((name) => /^se-\d{4}-\d{4}\.toml$/.test(name) || /^ltd-\d{4}\.toml$/.test(name));
  for (const name of yearFiles) cpSync(resolve(dataIn, name), resolve(dataOut, name));

  // The form layouts, one per product, fetched by the books page at runtime
  // rather than bundled: products/se-forms.js reads
  // books/assets/data/hmrc/form-layouts/se.json and products/taxi-forms.js
  // reads taxi.json beside it, the same path convention bundle-resources.js
  // gives every other file under app/data. The whole directory copies, so a
  // product that adds a layout needs no line of its own here.
  cpSync(resolve(ROOT, "app", "data", "hmrc", "form-layouts"), resolve(dataOut, "hmrc", "form-layouts"), { recursive: true });

  // The filing data the Ltd layout points at rather than restating: the CT600
  // box list, HMRC's prescribed computation format and the FRS 105 formats.
  // products/ltd-forms.js reads each row's label, format and sheet cell out
  // of these, so the page and the CLI's reports quote one source.
  cpSync(resolve(ROOT, "app", "data", "filing"), resolve(dataOut, "filing"), { recursive: true });

  const templatesOut = resolve(ASSETS_DIR, "templates");
  mkdirSync(resolve(templatesOut, "bst"), { recursive: true });
  cpSync(resolve(ROOT, "app", "templates", "meta.toml"), resolve(templatesOut, "meta.toml"));
  for (const name of ["meta.toml", "bst-excel.xlsx"]) {
    cpSync(resolve(ROOT, "app", "templates", "bst", name), resolve(templatesOut, "bst", name));
  }

  // The Self Employed set: nine workbooks and the meta that names them, 3.4
  // MB the page reads only when a save asks for a template, not at load.
  // The names come off meta.toml so the two cannot drift apart.
  const seDir = resolve(ROOT, "app", "templates", "se");
  const seMeta = parseTOML(readFileSync(resolve(seDir, "meta.toml"), "utf8"));
  const seFiles = ["meta.toml", ...seMeta.template.files];
  mkdirSync(resolve(templatesOut, "se"), { recursive: true });
  for (const name of seFiles) cpSync(resolve(seDir, name), resolve(templatesOut, "se", name));

  // The Taxi Driver workbook: one xlsx named by its own meta rather than a
  // files list.
  mkdirSync(resolve(templatesOut, "taxi"), { recursive: true });
  for (const name of ["meta.toml", "taxi-excel.xlsx"]) {
    cpSync(resolve(ROOT, "app", "templates", "taxi", name), resolve(templatesOut, "taxi", name));
  }

  // The Limited Company set: the fourteen workbooks and docx the meta names,
  // the same files-list convention as se.
  const ltdDir = resolve(ROOT, "app", "templates", "ltd");
  const ltdMeta = parseTOML(readFileSync(resolve(ltdDir, "meta.toml"), "utf8"));
  const ltdFiles = ["meta.toml", ...ltdMeta.template.files];
  mkdirSync(resolve(templatesOut, "ltd"), { recursive: true });
  for (const name of ltdFiles) cpSync(resolve(ltdDir, name), resolve(templatesOut, "ltd", name));

  // Example books, copied under the path the resource loader names them by:
  // examples/<dir>/<product>/{book.toml,lines.jsonl}. The probe page needs
  // one; an example the page offers is added to this list.
  for (const example of EXAMPLE_BOOKS) {
    const out = resolve(ASSETS_DIR, "examples", ...example);
    mkdirSync(out, { recursive: true });
    for (const name of ["book.toml", "lines.jsonl"]) {
      cpSync(resolve(ROOT, "examples", ...example, name), resolve(out, name));
    }
  }

  // JSZip, vendored for the books page's own upload path (W1): reading an
  // uploaded .xlsx/.zip's cached cell values for the as-read drift layer is
  // not part of the engine's exported surface (app/lib/xlsx-exporter.js's
  // cell reader is internal to it), so the page carries its own small copy
  // of JSZip to unzip the upload and read cells itself, the same library the
  // engine already depends on for the same job server-side.
  const vendorOut = resolve(ASSETS_DIR, "vendor");
  mkdirSync(vendorOut, { recursive: true });
  cpSync(resolve(ROOT, "node_modules", "jszip", "dist", "jszip.min.js"), resolve(vendorOut, "jszip.min.js"));

  return { yearFiles: yearFiles.length, seFiles: seFiles.length, ltdFiles: ltdFiles.length, examples: EXAMPLE_BOOKS.length };
}

// ── PWA precache manifest and build stamp ───────────────────────────────────
//
// sw.js needs two things it cannot know on its own: which URLs to precache,
// and a cache name that changes whenever any of them does. Both are worked
// out here, after the bundle and the copied assets exist, and written to the
// generated books/build-stamp.js that sw.js loads with importScripts() --
// keeping sw.js itself a small, static, hand-read file while the list of
// what to cache stays derived from what the pages actually load.

function cssImports(cssPath) {
  const text = readFileSync(cssPath, "utf8");
  return [...text.matchAll(/@import\s+url\(["']?([^"')]+)["']?\)/g)].map((m) => m[1]);
}

function pageReferences(htmlPath) {
  const text = readFileSync(htmlPath, "utf8");
  const scripts = [...text.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
  const styles = [...text.matchAll(/<link[^>]*\srel="stylesheet"[^>]*\shref="([^"]+)"/g)].map((m) => m[1]);
  return { scripts, styles };
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function toBooksPath(absPath) {
  return relative(BOOKS_DIR, absPath).split(sep).join("/");
}

// Every URL a books page needs to render itself, and one of its example
// books, entirely offline: the page and every script or stylesheet it
// names (following a stylesheet's own @import), the engine bundle and
// resource loader (reached only through dynamic import(), so no page's own
// tags find them), and everything the resource loader can be asked to
// read -- the tax year and filing data, the HMRC form layouts, and every
// example book a page's example buttons list. The last two are discovered
// from the copied assets tree rather than restated, so a product that adds
// a year file or an example needs no line here. The workbook templates
// (app/templates/*, several MB) are not included -- nothing on the example
// load path reads them; only "New book" and an xlsx/zip save do, and
// neither is part of what this cache promises.
function buildPrecacheManifest() {
  const relPaths = new Set();

  for (const page of PAGES) {
    relPaths.add(page);
    const { scripts, styles } = pageReferences(resolve(BOOKS_DIR, page));
    for (const src of [...scripts, ...styles]) {
      if (/^https?:|^\//.test(src)) continue; // vendor/CDN or site-absolute, not a books/ file
      relPaths.add(src);
      if (src.endsWith(".css")) {
        for (const imported of cssImports(resolve(BOOKS_DIR, src))) relPaths.add(imported);
      }
    }
  }

  relPaths.add("engine/diya-gl-engine.js");
  relPaths.add("bundle-resources.js");

  for (const absPath of walk(resolve(ASSETS_DIR, "data"))) relPaths.add(toBooksPath(absPath));
  for (const absPath of walk(resolve(ASSETS_DIR, "examples"))) relPaths.add(toBooksPath(absPath));

  const urls = [...relPaths].sort().map((p) => `/books/${p}`);
  urls.push("/schema/diya-gl-book-v2.schema.json", "/schema/diya-gl-lines-v2.schema.json");
  urls.push("/books/manifest.webmanifest", "/books/icon.svg");
  return urls;
}

function urlToPath(url) {
  if (url.startsWith("/schema/")) return resolve(SCHEMA_DIR, url.slice("/schema/".length));
  return resolve(BOOKS_DIR, url.slice("/books/".length));
}

// A hash of every precached URL's own bytes, so the cache name changes
// exactly when something a page would fetch changes -- not on every build,
// and never a stale copy of the previous version's files.
function writeBuildStamp() {
  const urls = buildPrecacheManifest();
  const hash = createHash("sha256");
  for (const url of urls) {
    hash.update(url);
    hash.update(readFileSync(urlToPath(url)));
  }
  const stamp = hash.digest("hex").slice(0, 12);
  const source = [
    ENGINE_LICENCE_COMMENT,
    "// Generated by scripts/build-books-bundle.mjs -- do not edit by hand.",
    "//",
    "// sw.js reads this with importScripts() for the cache name to use and the",
    "// list of URLs to precache, so both are derived from what the four books",
    "// pages actually load rather than a second, hand-kept copy of the list.",
    `self.DIYA_GL_BUILD_STAMP = ${JSON.stringify(stamp)};`,
    `self.DIYA_GL_PRECACHE_URLS = ${JSON.stringify(urls, null, 2)};`,
    "",
  ].join("\n");
  writeFileSync(resolve(BOOKS_DIR, "build-stamp.js"), source);
  return { stamp, count: urls.length };
}

const BOOK_SCHEMA_ID = "https://spreadsheets.diyaccounting.co.uk/schema/diya-gl-book-v2.schema.json";
const LINES_SCHEMA_ID = "https://spreadsheets.diyaccounting.co.uk/schema/diya-gl-lines-v2.schema.json";

async function main() {
  mkdirSync(ENGINE_DIR, { recursive: true });
  mkdirSync(BOOKS_DIR, { recursive: true });

  const bookSchema = JSON.parse(readFileSync(resolve(SCHEMA_DIR, "diya-gl-book-v2.schema.json"), "utf8"));
  const linesSchema = JSON.parse(readFileSync(resolve(SCHEMA_DIR, "diya-gl-lines-v2.schema.json"), "utf8"));
  if (bookSchema.$id !== BOOK_SCHEMA_ID || linesSchema.$id !== LINES_SCHEMA_ID) {
    throw new Error("the published schemas' $id fields moved; update BOOK_SCHEMA_ID/LINES_SCHEMA_ID in this script to match");
  }
  const generatedSource = generateStandaloneValidatorSource(bookSchema, linesSchema);

  const result = await build({
    entryPoints: [resolve(ROOT, "app", "lib", "books-engine.js")],
    outfile: BUNDLE_FILE,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify: true,
    sourcemap: false,
    // "eof" keeps every dependency's own notice inside this one file, appended
    // once after the code, rather than "linked", which would ship the notices
    // as a second file the page never fetches on its own.
    legalComments: "eof",
    banner: { js: ENGINE_LICENCE_COMMENT },
    plugins: [nodeAbsent, ajvAbsentPlugin(generatedSource)],
    metafile: true,
    define: { "process.env.NODE_ENV": '"production"' },
  });

  generateExamplesJs();
  const assets = copyRuntimeAssets();
  const buildStamp = writeBuildStamp();
  const bytes = statSync(BUNDLE_FILE).size;
  const inputCount = Object.keys(result.metafile.inputs).length;
  console.log(`books bundle: ${BUNDLE_FILE.replace(ROOT + "/", "")}`);
  console.log(`  ${(bytes / 1024).toFixed(1)} KiB from ${inputCount} modules`);
  console.log(
    `  assets: ${assets.yearFiles} tax year files, the BST template, ${assets.seFiles} Self Employed template files, the Taxi template, ${assets.ltdFiles} Limited Company template files, ${assets.examples} example book(s)`,
  );
  console.log(`  pwa: cache ${buildStamp.stamp}, ${buildStamp.count} URLs precached`);
}

await main();
