// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
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
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { generateStandaloneValidatorSource } from "../app/lib/diya-gl-schema.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public");
const BOOKS_DIR = resolve(PUBLIC_DIR, "books");
const ENGINE_DIR = resolve(BOOKS_DIR, "engine");
const ASSETS_DIR = resolve(BOOKS_DIR, "assets");
const SCHEMA_DIR = resolve(PUBLIC_DIR, "schema");
const BUNDLE_FILE = resolve(ENGINE_DIR, "diya-gl-engine.js");

// Node's own modules, which a browser has none of. Each name a pipeline module
// imports gets a stub that throws with the call that reached it, so a code path
// that only runs under Node fails loudly in a browser rather than quietly
// returning nothing.
const NODE_STUBS = {
  fs: ["readFileSync", "writeFileSync", "existsSync", "readdirSync", "mkdirSync", "rmSync", "cpSync", "statSync"],
  path: ["resolve", "dirname", "basename", "join", "extname", "relative"],
  url: ["fileURLToPath", "pathToFileURL"],
  os: ["tmpdir", "platform"],
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
  const examplesJs = `window.DiyaGlExamples = ${JSON.stringify(examplesJson)};`;
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
  const yearFiles = readdirSync(dataIn).filter((name) => /^se-\d{4}-\d{4}\.toml$/.test(name));
  for (const name of yearFiles) cpSync(resolve(dataIn, name), resolve(dataOut, name));

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

  return { yearFiles: yearFiles.length, seFiles: seFiles.length, examples: EXAMPLE_BOOKS.length };
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
    legalComments: "none",
    plugins: [nodeAbsent, ajvAbsentPlugin(generatedSource)],
    metafile: true,
    define: { "process.env.NODE_ENV": '"production"' },
  });

  generateExamplesJs();
  const assets = copyRuntimeAssets();
  const bytes = statSync(BUNDLE_FILE).size;
  const inputCount = Object.keys(result.metafile.inputs).length;
  console.log(`books bundle: ${BUNDLE_FILE.replace(ROOT + "/", "")}`);
  console.log(`  ${(bytes / 1024).toFixed(1)} KiB from ${inputCount} modules`);
  console.log(
    `  assets: ${assets.yearFiles} tax year files, the BST template, ${assets.seFiles} Self Employed template files, ${assets.examples} example book(s)`,
  );
}

await main();
