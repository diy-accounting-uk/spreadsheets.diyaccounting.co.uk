// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// build-books-bundle.mjs — one esbuild step that turns the engine into an ES
// module the books page can import, and copies the files that engine reads.
//
// The bundle imports app/lib/books-engine.js and the pipeline modules behind
// it exactly as they stand. There is no browser fork of any of them: the only
// substitution is Node's own fs, path, url, os, crypto and child_process,
// which resolve to stubs that throw when called. Nothing the BST browser path
// runs calls them — the reads it does need go through the resource loader in
// app/lib/app-resources.js, which the page backs with fetch.
//
//   node scripts/build-books-bundle.mjs

import { build } from "esbuild";
import { cpSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public");
const BOOKS_DIR = resolve(PUBLIC_DIR, "books");
const ENGINE_DIR = resolve(BOOKS_DIR, "engine");
const ASSETS_DIR = resolve(BOOKS_DIR, "assets");
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

// The files the engine reads that are not the book itself: the tax year data
// the save path applies, and the BST template with its meta. The two v2
// schemas are left where they are — the site already publishes them at
// /schema/, which is the root the resource loader names them under.
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

  // The BST fixture the probe page loads, served as the static files a fetch
  // can reach. W1 serves the same layout for every example it offers.
  const fixtureOut = resolve(ASSETS_DIR, "examples", "sp-sixty-driving", "bst");
  mkdirSync(fixtureOut, { recursive: true });
  for (const name of ["book.toml", "lines.jsonl"]) {
    cpSync(resolve(ROOT, "examples", "sp-sixty-driving", "bst", name), resolve(fixtureOut, name));
  }

  return { yearFiles: yearFiles.length };
}

async function main() {
  mkdirSync(ENGINE_DIR, { recursive: true });

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
    plugins: [nodeAbsent],
    metafile: true,
    define: { "process.env.NODE_ENV": '"production"' },
  });

  const assets = copyRuntimeAssets();
  const bytes = statSync(BUNDLE_FILE).size;

  writeFileSync(resolve(ENGINE_DIR, "metafile.json"), JSON.stringify(result.metafile, null, 2) + "\n");

  const inputCount = Object.keys(result.metafile.inputs).length;
  console.log(`books bundle: ${BUNDLE_FILE.replace(ROOT + "/", "")}`);
  console.log(`  ${(bytes / 1024).toFixed(1)} KiB from ${inputCount} modules`);
  console.log(`  assets: ${assets.yearFiles} tax year files, the BST template, the sp-sixty BST fixture`);
}

await main();
