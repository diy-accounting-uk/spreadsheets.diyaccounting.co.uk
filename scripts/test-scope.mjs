#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// test-scope.mjs — the default test command. It reads the diff against the
// merge base with origin/main, maps the changed paths through the routing
// table below, and runs the tiers that diff reaches in cost order.
//
//   npm test                    escalate on the diff
//   npm test -- --all           every tier, every product, full browser suite
//   npm test -- --base HEAD~1   a different comparison point
//   npm test -- --plan          print the selection and the estimate, run nothing
//   npm test -- --tree-hash     print the GREEN marker's key for the current tree, run nothing
//
// The one rule that outranks the routing table: when the diff cannot be
// worked out, the router runs MORE, not less. A detached HEAD, a missing
// origin/main, a shallow clone or an empty diff all escalate to --all and
// say so. Running nothing because git printed nothing is the failure this
// design exists to prevent.
//
// A GREEN verdict writes target/test-scope/green-<tree-hash>, keyed by a
// hash of the working tree's actual content (not the index) and carrying
// the merge base it diffed against. .githooks/pre-push looks this marker
// up before running anything, so a suite that just passed on this exact
// tree is not repeated for the push. PARTIAL never writes one.

import { spawn, spawnSync } from "child_process";
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync, unlinkSync, copyFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PRODUCTS = ["bst", "taxi", "se", "ltd"];

// One representative calc file per product: the cheapest file that runs a
// full generate-and-recalculate pass. Precision Code Ltd is the featured
// scenario for bst/se/ltd (see CONTEXT_*.md); taxi has no Precision Code
// extract, so SP Sixty Driving is its featured scenario instead (the
// reconciliation-bug method's "featured scenario reconciles" step).
const REPRESENTATIVE_CALC = {
  bst: "app/test/bst-precision-code.test.js",
  se: "app/test/se-precision-code.test.js",
  ltd: "app/test/ltd-precision-code.test.js",
  taxi: "app/test/taxi-sp-sixty.test.js",
};

// A product name counts only as a whole path or filename segment, so
// "salesinvoice" is not SE and "best-effort" is not BST.
const PRODUCT_TOKEN = /(^|[/_-])(bst|se|ltd|taxi)([_.-]|$)/g;

function productsIn(path) {
  const found = new Set();
  for (const m of path.matchAll(PRODUCT_TOKEN)) found.add(m[2]);
  return [...found];
}

// ---------------------------------------------------------------- routing

// Each row names the changed paths it claims and what they add. `calc` and
// `browser` take "all" or "product"; "product" narrows to the product tokens
// in the path and falls back to all four when the path names none.
const ROUTES = [
  {
    id: "shared engine",
    // The workbook writers reach every product's recalculation. They do not
    // reach the page, which renders from diya-gl's own engine.
    match: (p) => /^app\/lib\/(generator|spreadsheet-runner|workbook-set|product-workbook|xlsx-[^/]+)\.js$/.test(p),
    adds: { calc: "all" },
  },
  {
    id: "product module",
    match: (p) => /^app\/(products|lib\/anchors|lib\/calculators|lib\/tax)\/(bst|se|ltd|taxi)\b/.test(p),
    adds: { calc: "product", browser: "product" },
  },
  {
    id: "sole-trader tax data",
    match: (p) => /^app\/data\/se-\d{4}(-\d{4})?\.toml$/.test(p),
    // The SE year file carries the personal-tax rates BST and Taxi generate against too.
    adds: { calc: ["bst", "taxi", "se"] },
  },
  {
    id: "company tax data",
    match: (p) => /^app\/data\/ltd-\d{4}\.toml$/.test(p),
    adds: { calc: ["ltd"] },
  },
  {
    id: "report shape",
    match: (p) => /^app\/data\/render-unrepresentable\//.test(p),
    adds: { browser: "product" },
  },
  {
    id: "roundtrip budget",
    match: (p) => /^app\/data\/(roundtrip|volatile)[^/]*\.json$/.test(p),
    adds: { calc: "all" },
  },
  {
    id: "report and export bins",
    match: (p) => /^app\/bin\/(report|export|generate|verify-[^/]+)\.js$/.test(p),
    adds: { calc: "all" },
  },
  {
    id: "template or package",
    match: (p) => /^app\/templates\//.test(p) || /^packages\//.test(p) || /\.xlsx?$/i.test(p),
    adds: { calc: "product" },
  },
  {
    id: "fixture or example",
    match: (p) => /^examples\//.test(p) || /^app\/test\/fixtures\//.test(p),
    adds: { calc: "product" },
  },
  {
    id: "diya-gl engine",
    // The JS engine the page renders from, and the report shape it produces.
    match: (p) => /^app\/lib\/diya-gl-[^/]+\.js$/.test(p) || /^app\/bin\/report\.js$/.test(p),
    adds: { browser: "all" },
  },
  {
    id: "diya-gl package",
    match: (p) => /^diya-gl\//.test(p),
    adds: { browser: "diya-gl", extras: ["smoke:diya-gl"] },
  },
  {
    id: "browser asset",
    match: (p) => /^web\/[^/]+\/public\/.*\.(js|css)$/.test(p),
    adds: { browser: "page" },
  },
  {
    id: "page content",
    match: (p) => /^web\/.*\.html$/.test(p) || /redirects\.toml$/.test(p),
    adds: { browser: "content", extras: ["build:redirects"] },
  },
  {
    id: "infrastructure",
    match: (p) => /^cdk-spreadsheets\//.test(p) || p === "pom.xml" || /^infra\//.test(p) || /cdk\.json$/.test(p),
    adds: { infra: true },
  },
  {
    id: "workflow",
    match: (p) => /^\.github\/workflows\//.test(p),
    adds: { extras: ["lint:workflows"] },
  },
  {
    id: "test harness",
    // A dependency change or a change to how vitest/playwright themselves
    // run reaches every tier: nothing about the diff narrows what it could
    // break.
    match: (p) => p === "vitest.config.js" || p === "playwright.config.js" || p === "package.json",
    adds: { calc: "all", browser: "all", infra: true },
  },
  {
    id: "lockfile",
    // A resolved-version bump can break any test transitively with no
    // source-level trace to follow, so it forces the full unit tier. It
    // does not force calc/browser/infra: a dependency actually changing
    // behaviour under test still goes through the "test harness" row via
    // package.json, which a lockfile change never lands without.
    match: (p) => p === "package-lock.json" || p === "diya-gl/package-lock.json",
    adds: { unit: "all" },
  },
  {
    id: "router script",
    // The router only chooses what runs; it does not change what a product
    // computes. One representative calc file per product exercises the
    // chosen tiers end to end without re-running the whole calc suite.
    match: (p) => p === "scripts/test-scope.mjs",
    adds: { calc: "representative" },
  },
  {
    id: "docs and skills",
    // Prose and skill instructions never reach a tier beyond gates (which
    // always run regardless). Explicit "adds nothing" row so a future,
    // broader route can't accidentally escalate these by matching them too.
    match: (p) => /\.md$/i.test(p) || /^\.claude\//.test(p),
    adds: {},
  },
];

// ------------------------------------------------------------------- git

function git(args, { allowFail = false } = {}) {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) {
    if (allowFail) return null;
    throw new Error(`git ${args.join(" ")} failed: ${(r.stderr || "").trim()}`);
  }
  return r.stdout;
}

function lines(text) {
  return (text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

// -------------------------------------------------------- the GREEN marker

const MARKER_DIR = join(ROOT, "target", "test-scope");

// The hash of what the tests actually ran against: tracked content plus
// untracked-but-not-ignored content, exactly what `git add -A` would stage.
// Built in a throwaway index so the real index (and any partial `git add`
// the operator has staged) is never touched.
function workingTreeHash() {
  const tmpIndex = join(tmpdir(), `test-scope-index-${process.pid}-${Date.now()}`);
  const env = { ...process.env, GIT_INDEX_FILE: tmpIndex };
  try {
    // Seed the throwaway index from the real one rather than starting
    // empty. `git add -A` on a fresh empty index treats every path as new
    // and consults .gitignore, which silently drops a path that is
    // tracked but also matches .gitignore -- this repo has several
    // (reports/judge-verdict-*.json, *.svg under web/.../diya-gl/) even
    // though they are exactly as tracked as everything else. Starting
    // from a copy of the real index means `git add -A` only has to layer
    // working-tree changes on top, exactly as it would against the real
    // one, so an unchanged file keeps the real index's already-correct
    // blob hash instead of being re-hashed -- which also fixes a CRLF/LF
    // mismatch measured on mvnw.cmd: adding it as if new re-runs the
    // text-conversion filters and produces a different blob than the one
    // actually committed, where adding it as an unchanged tracked file is
    // a no-op.
    const realIndex = resolve(ROOT, git(["rev-parse", "--git-path", "index"]).trim());
    if (existsSync(realIndex)) copyFileSync(realIndex, tmpIndex);
    const add = spawnSync("git", ["add", "-A"], { cwd: ROOT, env });
    if (add.status !== 0) throw new Error(`git add -A (throwaway index) failed: ${(add.stderr || "").toString().trim()}`);
    const wt = spawnSync("git", ["write-tree"], { cwd: ROOT, env, encoding: "utf8" });
    if (wt.status !== 0) throw new Error(`git write-tree (throwaway index) failed: ${(wt.stderr || "").trim()}`);
    return wt.stdout.trim();
  } finally {
    try {
      unlinkSync(tmpIndex);
    } catch {
      // nothing to clean up
    }
  }
}

// A dirty tree hashes differently from HEAD's committed tree, and the
// marker is keyed on the working-tree hash: a run on a dirty tree
// therefore writes a marker HEAD's own tree hash can never match, so it
// can never vouch for a push (which carries HEAD's committed content, not
// the dirty tree). The hash is taken before any tier runs: the browser
// tier rebuilds the packages' LICENCE and README files and
// provenance-data.js, so a hash taken afterwards never equals HEAD's tree
// even when the run started clean.
function writeGreenMarker({ hash, mergeBase, ranTierNames }) {
  try {
    mkdirSync(MARKER_DIR, { recursive: true });
    const body = `mergeBase=${mergeBase} tiers=${ranTierNames.join(",") || "none"} at=${new Date().toISOString()}\n`;
    writeFileSync(join(MARKER_DIR, `green-${hash}`), body);
    return hash;
  } catch (err) {
    console.log(`  NOTE     could not write the GREEN marker: ${err.message}`);
    return null;
  }
}

// Returns { paths, base, mergeBase } or { escalate: "<reason>" }.
function changedPaths(baseRef) {
  if (!git(["rev-parse", "--git-dir"], { allowFail: true })) {
    return { escalate: "this is not a git working tree" };
  }
  const resolved = git(["rev-parse", "--verify", "--quiet", `${baseRef}^{commit}`], { allowFail: true });
  if (!resolved) {
    return { escalate: `the base ref ${baseRef} does not resolve here` };
  }
  if (existsSync(join(git(["rev-parse", "--git-common-dir"]).trim(), "shallow"))) {
    return { escalate: "this is a shallow clone, so the merge base is not trustworthy" };
  }
  const mergeBase = git(["merge-base", "HEAD", baseRef], { allowFail: true });
  if (!mergeBase) {
    return { escalate: `HEAD and ${baseRef} share no history` };
  }
  const mb = mergeBase.trim();
  const paths = new Set();
  for (const set of [
    git(["diff", "--name-only", mb, "HEAD"], { allowFail: true }),
    git(["diff", "--name-only", "HEAD"], { allowFail: true }),
    git(["diff", "--name-only", "--cached"], { allowFail: true }),
    git(["ls-files", "--others", "--exclude-standard"], { allowFail: true }),
  ]) {
    for (const p of lines(set)) paths.add(p);
  }
  if (paths.size === 0) {
    return { escalate: `nothing differs from ${baseRef} and the tree is clean` };
  }
  return { paths: [...paths].sort(), base: baseRef, mergeBase: mb };
}

// ------------------------------------------------------- the import graph

const SOURCE_ROOTS = ["app/", "web/", "diya-gl/", "scripts/"];
const SOURCE_EXT = /\.(js|mjs|cjs)$/;

function sourceFiles() {
  return lines(git(["ls-files"])).filter(
    (p) => SOURCE_EXT.test(p) && SOURCE_ROOTS.some((r) => p.startsWith(r)) && !p.startsWith("packages/"),
  );
}

function resolveSpecifier(fromFile, spec) {
  if (!spec.startsWith(".")) return null;
  const abs = resolve(ROOT, dirname(fromFile), spec);
  for (const candidate of [abs, `${abs}.js`, `${abs}.mjs`, `${abs}.cjs`, join(abs, "index.js")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate.slice(ROOT.length + 1);
    }
  }
  return null;
}

const SPECIFIER = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g;

// dependency path -> the set of files importing it, one hop.
function buildImporters(files) {
  const importers = new Map();
  for (const file of files) {
    let text;
    try {
      text = readFileSync(resolve(ROOT, file), "utf8");
    } catch {
      continue;
    }
    for (const m of text.matchAll(SPECIFIER)) {
      const dep = resolveSpecifier(file, m[1]);
      if (!dep) continue;
      if (!importers.has(dep)) importers.set(dep, new Set());
      importers.get(dep).add(file);
    }
  }
  return importers;
}

const TEST_FILE = /^(app\/test\/.*|web\/unit-tests\/.*)\.test\.js$/;

// Every test file that reaches a changed module, transitively.
function importClosure(changed, files) {
  const importers = buildImporters(files);
  const known = new Set(files);
  const seen = new Set();
  const queue = [];
  let unresolved = 0;
  for (const p of changed) {
    if (!SOURCE_EXT.test(p)) continue;
    if (known.has(p)) queue.push(p);
    else unresolved += 1;
  }
  while (queue.length) {
    const cur = queue.pop();
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const up of importers.get(cur) || []) queue.push(up);
  }
  const tests = [...seen].filter((p) => TEST_FILE.test(p));
  return { tests, unresolved };
}

// What the import graph cannot see: fixtures, templates and data files named
// by basename, and the classic browser scripts the web unit tests pull in with
// readFileSync on a literal repo-relative path rather than an import.
function literalMatches(changed, testFiles) {
  const names = [];
  for (const p of changed) {
    if (SOURCE_EXT.test(p)) names.push(p);
    else {
      names.push(p);
      const base = p.split("/").pop();
      if (base.length > 4) names.push(base);
    }
  }
  if (names.length === 0) return [];
  const hits = new Set();
  for (const file of testFiles) {
    let text;
    try {
      text = readFileSync(resolve(ROOT, file), "utf8");
    } catch {
      continue;
    }
    if (names.some((n) => text.includes(n))) hits.add(file);
  }
  return [...hits];
}

// ------------------------------------------------------- test file groups

const CALC_MARKER = /describeCalc|hasLibreOffice/;

function allTestFiles() {
  return lines(git(["ls-files"])).filter((p) => TEST_FILE.test(p));
}

function splitByLibreOffice(testFiles) {
  const calc = [];
  const plain = [];
  for (const file of testFiles) {
    let text = "";
    try {
      text = readFileSync(resolve(ROOT, file), "utf8");
    } catch {
      /* a deleted test file is neither */
    }
    (CALC_MARKER.test(text) ? calc : plain).push(file);
  }
  return { calc, plain };
}

function browserSpecs() {
  return lines(git(["ls-files"])).filter((p) => /^web\/browser-tests\/.*\.browser\.test\.js$/.test(p));
}

// ------------------------------------------------------------- selection

function select(changed) {
  const sel = {
    calcProducts: new Set(),
    // Products that owe only their one representative calc file, not the
    // full per-product set. A product already in calcProducts (the full
    // set) is unaffected by also appearing here.
    calcRepProducts: new Set(),
    browserProducts: new Set(),
    browserAll: false,
    browserDiyaGl: false,
    browserContent: false,
    browserPages: new Set(),
    browserPageDirs: new Set(),
    infra: false,
    extras: new Set(),
    unitAll: false,
    unitAllReasons: [],
    why: new Map(),
  };
  const note = (tier, path, route) => {
    if (!sel.why.has(tier)) sel.why.set(tier, []);
    sel.why.get(tier).push(`${path} [${route}]`);
  };

  for (const path of changed) {
    for (const route of ROUTES) {
      if (!route.match(path)) continue;
      const adds = route.adds;
      if (adds.calc === "representative") {
        for (const p of PRODUCTS) sel.calcRepProducts.add(p);
        note("calc", path, route.id);
      } else if (adds.calc) {
        const list = Array.isArray(adds.calc)
          ? adds.calc
          : adds.calc === "all"
            ? PRODUCTS
            : productsIn(path).length
              ? productsIn(path)
              : PRODUCTS;
        for (const p of list) sel.calcProducts.add(p);
        note("calc", path, route.id);
      }
      if (adds.unit === "all") {
        sel.unitAll = true;
        sel.unitAllReasons.push(route.id);
        note("unit", path, route.id);
      }
      if (adds.browser) {
        if (adds.browser === "all") sel.browserAll = true;
        else if (adds.browser === "diya-gl") sel.browserDiyaGl = true;
        else if (adds.browser === "content") sel.browserContent = true;
        else if (adds.browser === "page") {
          sel.browserPages.add(
            path
              .split("/")
              .pop()
              .replace(/\.(js|css)$/, ""),
          );
          // A script under public/<page>/ is loaded by the whole page, not
          // just by the spec that happens to share its name.
          const dir = path.match(/\/public\/([^/]+)\//);
          if (dir) sel.browserPageDirs.add(dir[1]);
        } else {
          const list = productsIn(path);
          if (list.length) for (const p of list) sel.browserProducts.add(p);
          else sel.browserAll = true;
        }
        note("browser", path, route.id);
      }
      if (adds.infra) {
        sel.infra = true;
        note("infra", path, route.id);
      }
      for (const e of adds.extras || []) sel.extras.add(e);
    }
  }
  return sel;
}

function chooseBrowserSpecs(sel, specs) {
  if (sel.browserAll) return specs;
  const chosen = new Set();
  for (const spec of specs) {
    const name = spec.split("/").pop();
    const tokens = productsIn(name);
    if (sel.browserDiyaGl && name.startsWith("diya-gl-")) chosen.add(spec);
    if (sel.browserContent && name.startsWith("spreadsheets-content")) chosen.add(spec);
    for (const p of sel.browserProducts) {
      if (tokens.includes(p)) chosen.add(spec);
    }
    for (const page of sel.browserPages) {
      if (name.includes(page)) chosen.add(spec);
    }
    // The page's own specs, the ones no product name narrows, exercise
    // whatever shared script changed under that page's directory.
    for (const dir of sel.browserPageDirs) {
      if (name.startsWith(`${dir}-`) && tokens.length === 0) chosen.add(spec);
    }
  }
  // A page asset outside any page directory still reaches the site content spec.
  if (chosen.size === 0 && sel.browserPages.size) return specs.filter((s) => s.includes("spreadsheets-content"));
  return [...chosen].sort();
}

// ----------------------------------------------------------------- tiers

const TIER_ORDER = ["gates", "unit", "calc", "browser", "infra"];

function allowedTiers() {
  const raw = process.env.TEST_SCOPE_TIERS;
  if (!raw) return null;
  const set = new Set(raw.split(/[\s,]+/).filter(Boolean));
  for (const t of set) {
    if (!TIER_ORDER.includes(t)) {
      console.error(`TEST_SCOPE_TIERS names an unknown tier: ${t}. Known tiers: ${TIER_ORDER.join(", ")}`);
      process.exit(2);
    }
  }
  return set;
}

// ------------------------------------------------------------- execution

function fmt(ms) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
}

// Each tier's child gets its own process group (detached: true), so a signal
// aimed at one router's tree never reaches a sibling agent's worktree. This
// router forwards its own SIGINT/SIGTERM to the running child's group, so a
// Ctrl-C or `kill <router pid>` still stops that tier's whole process tree —
// and only that tree. Never send a signal by matching a command name
// (`pkill -f vitest`): it cannot tell one worktree's process from another's.
let currentChild = null;

function forwardAndExit(signal) {
  if (currentChild && currentChild.pid) {
    try {
      process.kill(-currentChild.pid, signal);
    } catch {
      // the child's group is already gone
    }
  }
  process.exit(signal === "SIGINT" ? 130 : 143);
}

process.on("SIGINT", () => forwardAndExit("SIGINT"));
process.on("SIGTERM", () => forwardAndExit("SIGTERM"));

function runStep(label, command, args, env) {
  return new Promise((done) => {
    const started = Date.now();
    console.log(`\n--- ${label}: ${command} ${args.join(" ")}`);
    const child = spawn(command, args, { cwd: ROOT, stdio: "inherit", env: { ...process.env, ...env }, detached: true });
    currentChild = child;
    const beat = setInterval(() => {
      console.log(`... ${label} still running, ${fmt(Date.now() - started)} elapsed`);
    }, 30_000);
    child.on("close", (code) => {
      clearInterval(beat);
      currentChild = null;
      console.log(`--- ${label}: exit ${code} after ${fmt(Date.now() - started)}`);
      done(code ?? 1);
    });
    child.on("error", (err) => {
      clearInterval(beat);
      currentChild = null;
      console.error(`--- ${label}: could not start: ${err.message}`);
      done(1);
    });
  });
}

async function runSteps(steps, env) {
  let worst = 0;
  for (const [label, command, args] of steps) {
    const code = await runStep(label, command, args, env);
    if (code !== 0) worst = code;
  }
  return worst;
}

// Exported for app/test/test-scope-routing.test.js: the routing table is
// pure (no git, no filesystem beyond reading the module itself), so it is
// tested directly rather than through a subprocess.
export { ROUTES, PRODUCTS, REPRESENTATIVE_CALC, select, productsIn, MARKER_DIR, workingTreeHash, writeGreenMarker };

// ------------------------------------------------------------------ main

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--tree-hash")) {
    // The same hash the GREEN marker is keyed by: tracked content plus
    // untracked-but-not-ignored content. On a clean tree this equals
    // `git rev-parse HEAD^{tree}`; on a dirty one it does not, which is
    // exactly how .githooks/pre-push tells a dirty-tree pass from a real one.
    console.log(workingTreeHash());
    process.exit(0);
  }

  const wantAll = argv.includes("--all");
  const planOnly = argv.includes("--plan");
  const baseIdx = argv.indexOf("--base");
  const baseRef = baseIdx !== -1 ? argv[baseIdx + 1] : process.env.TEST_SCOPE_BASE || "origin/main";

  const started = Date.now();
  const allowed = allowedTiers();
  const skipLibreOffice = process.env.SKIP_LIBREOFFICE === "1";

  let changed = [];
  let escalated = null;
  let baseLine = "";
  // What the marker records this run diffed against: the actual merge-base
  // commit, or "ALL" for a run that covered the full set regardless of any
  // diff (--all, or an escalation). A narrower run is never marked "ALL".
  let markerBase = null;

  if (wantAll) {
    escalated = "--all was asked for";
    markerBase = "ALL";
  } else {
    const diff = changedPaths(baseRef);
    if (diff.escalate) {
      escalated = diff.escalate;
      markerBase = "ALL";
    } else {
      changed = diff.paths;
      baseLine = `base ${diff.base} (merge base ${diff.mergeBase.slice(0, 9)}), ${changed.length} changed path(s)`;
      markerBase = diff.mergeBase;
    }
  }

  const everyTest = allTestFiles();
  const { calc: calcFiles, plain: plainFiles } = splitByLibreOffice(everyTest);
  const specs = browserSpecs();

  let sel;
  let unitFiles;
  let chosenSpecs;
  let unitReason;

  if (escalated) {
    sel = {
      calcProducts: new Set(PRODUCTS),
      calcRepProducts: new Set(),
      browserAll: true,
      infra: true,
      extras: new Set(["lint:workflows"]),
      why: new Map(),
      browserProducts: new Set(),
      browserPages: new Set(),
    };
    unitFiles = plainFiles;
    chosenSpecs = specs;
    unitReason = "every unit file, because the scope escalated";
  } else {
    sel = select(changed);
    const { tests, unresolved } = importClosure(changed, sourceFiles());
    const literal = literalMatches(changed, everyTest);
    const changedTests = changed.filter((p) => TEST_FILE.test(p));
    const reached = new Set([...tests, ...literal, ...changedTests]);
    const changedSource = changed.filter((p) => SOURCE_EXT.test(p));
    const orphan = changedSource.length > 0 && reached.size === 0;
    if (unresolved > 0) {
      unitFiles = plainFiles;
      unitReason = `every unit file, because ${unresolved} changed source file(s) are outside the import graph`;
    } else if (sel.unitAll) {
      unitFiles = plainFiles;
      unitReason = `every unit file, because ${sel.unitAllReasons.join(", ")} forces the full unit tier`;
    } else if (orphan) {
      unitFiles = plainFiles;
      unitReason = "every unit file, because no test reaches the changed source at all";
    } else {
      unitFiles = plainFiles.filter((f) => reached.has(f));
      unitReason = `${unitFiles.length} file(s) reached through the import graph and fixture names`;
    }
    chosenSpecs = chooseBrowserSpecs(sel, specs);
  }

  const calcProducts = [...sel.calcProducts];
  // A LibreOffice-gated file with no product in its name belongs to whichever
  // products are running: it is the shared roundtrip, stability and payslip
  // coverage the routing table calls "roundtrip verify".
  const chosenCalcFull = calcProducts.length
    ? calcFiles.filter((f) => {
        const tokens = productsIn(f.split("/").pop());
        return tokens.length === 0 || tokens.some((t) => calcProducts.includes(t));
      })
    : [];
  // Products that owe only their one representative file, because a route
  // already covering them with the full set (above) makes this redundant.
  const calcRepProducts = [...sel.calcRepProducts].filter((p) => !sel.calcProducts.has(p));
  const chosenCalcRepresentative = calcRepProducts
    .map((p) => REPRESENTATIVE_CALC[p])
    .filter((f) => f && calcFiles.includes(f) && !chosenCalcFull.includes(f));
  const chosenCalc = [...chosenCalcFull, ...chosenCalcRepresentative];

  const plan = [];
  plan.push({ tier: "gates", run: true, what: "fixture sync, diya-gl parity, deploy filter coverage, prettier", est: "~2m" });
  plan.push({ tier: "unit", run: true, what: unitReason, est: unitFiles.length > 60 ? "~3m" : "seconds" });
  plan.push({
    tier: "calc",
    run: chosenCalc.length > 0,
    what: chosenCalc.length
      ? [
          chosenCalcFull.length ? `${chosenCalcFull.length} LibreOffice file(s) for ${calcProducts.join(", ")}` : null,
          chosenCalcRepresentative.length
            ? `${chosenCalcRepresentative.length} representative file(s) for ${calcRepProducts.join(", ")}`
            : null,
        ]
          .filter(Boolean)
          .join("; ")
      : "nothing in the diff reaches a generator, template, tax data file or fixture",
    est: `~${Math.max(1, calcProducts.length * 4 + chosenCalcRepresentative.length)}m`,
  });
  plan.push({
    tier: "browser",
    run: chosenSpecs.length > 0,
    what: chosenSpecs.length ? `${chosenSpecs.length} spec(s)` : "nothing in the diff reaches diya-gl/, a page or a browser asset",
    est: `~${Math.max(1, Math.round(chosenSpecs.length * 0.8))}m`,
  });
  plan.push({
    tier: "infra",
    run: sel.infra,
    what: sel.infra ? "mvnw verify, cdk synth" : "nothing in the diff reaches cdk-spreadsheets/, pom.xml or infra/",
    est: "~2m",
  });

  console.log("=== test scope ===");
  if (escalated) console.log(`ESCALATED to the full set: ${escalated}`);
  else console.log(baseLine);
  if (changed.length) {
    for (const p of changed.slice(0, 40)) console.log(`  ${p}`);
    if (changed.length > 40) console.log(`  ... and ${changed.length - 40} more`);
  }
  console.log("");
  for (const row of plan) {
    const delegated = allowed && !allowed.has(row.tier) && row.run;
    const mark = delegated ? "DELEGATED" : row.run ? "RUN      " : "skipped  ";
    console.log(`  ${mark} ${row.tier.padEnd(8)} ${row.what}${row.run && !delegated ? `  (${row.est})` : ""}`);
    if (delegated)
      console.log(`           ^ TEST_SCOPE_TIERS=${process.env.TEST_SCOPE_TIERS} excludes this tier; another job or run must cover it`);
    for (const line of (sel.why.get(row.tier) || []).slice(0, 6)) console.log(`           <- ${line}`);
  }
  if (sel.extras.size) {
    // The extras ride the gates tier, so TEST_SCOPE_TIERS delegates them with it.
    const extrasDelegated = allowed && !allowed.has("gates");
    console.log(`  ${extrasDelegated ? "DELEGATED" : "RUN      "} extras   ${[...sel.extras].join(", ")}`);
    if (extrasDelegated)
      console.log(`           ^ TEST_SCOPE_TIERS=${process.env.TEST_SCOPE_TIERS} excludes this tier; another job or run must cover it`);
  }
  if (skipLibreOffice && chosenCalc.length)
    console.log("  NOTE     SKIP_LIBREOFFICE=1 is set, so the calc tier will report no recalculation coverage");
  console.log("");

  if (planOnly) {
    console.log("--plan: nothing was run.");
    process.exit(0);
  }

  const treeHash = workingTreeHash();
  const results = [];
  const delegatedTiers = [];

  function willRun(tier, run) {
    if (!run) return false;
    if (allowed && !allowed.has(tier)) {
      delegatedTiers.push(tier);
      return false;
    }
    return true;
  }

  let exitCode = 0;

  if (willRun("gates", true)) {
    const steps = [
      ["fixture sync", "node", ["app/bin/extract-scenarios.js"]],
      ["fixture sync diff", "git", ["diff", "--exit-code", "app/test/fixtures/", "examples/"]],
      ["diya-gl parity", "diya-gl/parity.sh", []],
      ["deploy filter coverage", "node", ["scripts/check-deploy-filter-coverage.mjs"]],
      ["prettier", "npx", ["prettier", "--check", "."]],
    ];
    for (const extra of sel.extras) steps.push([extra, "npm", ["run", extra]]);
    const code = await runSteps(steps, {});
    results.push(["gates", code]);
    if (code) exitCode = 1;
  }

  if (willRun("unit", true)) {
    const steps = [
      ["sitemaps", "node", ["app/bin/build-sitemaps.js"]],
      ["donate page", "node", ["scripts/build-donate-page.mjs"]],
    ];
    if (unitFiles.length) {
      steps.push(["unit", "npx", ["vitest", "run", "--project", "unit-tests", "--reporter=tap-flat", ...unitFiles]]);
    } else {
      console.log("\n--- unit: no test file in the repo reaches this diff");
    }
    const code = await runSteps(steps, {});
    results.push([`unit(${unitFiles.length})`, code]);
    if (code) exitCode = 1;
  }

  if (willRun("calc", chosenCalc.length > 0)) {
    const code = await runSteps([["calc", "npx", ["vitest", "run", "--project", "unit-tests", "--reporter=tap-flat", ...chosenCalc]]], {});
    results.push([`calc(${[...new Set([...calcProducts, ...calcRepProducts])].join("+")})`, code]);
    if (code) exitCode = 1;
  }

  if (willRun("browser", chosenSpecs.length > 0)) {
    const steps = [
      ["packages", "node", ["app/bin/build-packages.js", "--years", "2"]],
      ["sitemaps", "node", ["app/bin/build-sitemaps.js"]],
      ["donate page", "node", ["scripts/build-donate-page.mjs"]],
      ["provenance data", "node", ["scripts/build-provenance-data.mjs"]],
      ["diya-gl bundle", "node", ["scripts/build-diya-gl-bundle.mjs"]],
      ["runners", "node", ["scripts/build-runner.mjs"]],
      ["browser", "npx", ["playwright", "test", "--project=browser-tests", "--reporter=line", ...chosenSpecs]],
    ];
    const code = await runSteps(steps, {});
    results.push([`browser(${chosenSpecs.length})`, code]);
    if (code) exitCode = 1;
  }

  if (willRun("infra", sel.infra)) {
    const code = await runSteps(
      [
        ["maven verify", "./mvnw", ["--errors", "clean", "verify"]],
        ["cdk synth", "npm", ["run", "cdk:synth"]],
      ],
      {},
    );
    results.push(["infra", code]);
    if (code) exitCode = 1;
  }

  const failed = results.filter(([, code]) => code !== 0).map(([name]) => name);
  const partial = [];
  if (skipLibreOffice && results.some(([name]) => name.startsWith("calc("))) partial.push("libreoffice skipped");
  if (delegatedTiers.length) partial.push(`tiers delegated: ${delegatedTiers.join(", ")}`);

  const verdict = failed.length ? "RED" : partial.length ? `PARTIAL (${partial.join("; ")})` : "GREEN";
  const summary = results.map(([name, code]) => `${name} ${code === 0 ? "ok" : "FAILED"}`).join(", ");
  if (verdict === "GREEN") {
    const ranTierNames = results.map(([name]) => name.split("(")[0]);
    const markerHash = writeGreenMarker({ hash: treeHash, mergeBase: markerBase, ranTierNames });
    if (markerHash) console.log(`  marker   target/test-scope/green-${markerHash} (base ${markerBase}, tiers ${ranTierNames.join(",")})`);
  }
  console.log(`\nVERDICT: ${verdict}  ${summary || "nothing ran"}  ${fmt(Date.now() - started)}`);
  if (failed.includes("gates")) console.log("A parity failure is fixed at source, or refreshed deliberately with npm run parity:refresh.");
  process.exit(exitCode);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
