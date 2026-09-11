// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// check-deploy-filter-coverage.mjs — deploy.yml's push `paths:` filter decides
// whether a push deploys. scripts/build-diya-gl-bundle.mjs decides what
// actually reaches the deployed site. Nothing else keeps the two in step: a
// push that only touches a path the bundle reads but the filter doesn't list
// changes what prod serves without triggering a deploy, silently, until the
// 07:17 schedule catches it. That happened once already (app/data/** was
// missing from the filter while copyRuntimeAssets() was already copying out
// of it) and was fixed by hand. This check makes the next one loud.
//
// Method: entirely static. The bundle script's own resolve()/cpSync()/
// readFileSync()/readdirSync() call sites are parsed from its source text (no
// AST, a small balanced-paren scanner — see extractBalancedCall below), and
// the esbuild entry point's transitive import graph is walked the same way
// diya-gl/scripts/engine-closure.mjs walks the packaged engine's: following
// `import ... from "./x.js"` specifiers recursively, never executing anything.
//
// This was chosen over running the real build and recording what it opens.
// Running is exact for the copy pipeline, but esbuild's own file reads for
// the transitive JS import graph happen inside its native binary subprocess,
// invisible to a Node-level fs trace or to reading result.metafile without
// running the whole build — and the build needs Node's node-absent stubs to
// cover everything spreadsheet-runner.js imports from "fs", which is not this
// script's concern and breaks independently of any deploy-filter change (true
// on this tree right now: `node scripts/build-diya-gl-bundle.mjs` fails with
// "No matching export ... for import appendFileSync" before this check was
// written). A gate that can only run when an unrelated part of the codebase
// happens to build is a gate nobody can trust. Static parsing has no such
// dependency, and is blind only to a source path assembled from a dynamic
// expression that isn't `resolve(<known-base>, "literal", ...)` and isn't a
// static `import`/`export ... from`/`import()` specifier — extractSources()
// prints every call site it could not resolve so that blind spot is visible
// rather than silent. What would change this choice: the copy pipeline
// starting to build paths from something other than string literals and
// resolve() (a config-driven manifest, say) — at that point the static
// scanner should read the manifest instead of parsing more JS.
//
//   node scripts/check-deploy-filter-coverage.mjs
//   node scripts/check-deploy-filter-coverage.mjs --deploy-yml <path> --bundle-script <path>

import { existsSync, readFileSync } from "fs";
import { dirname, relative, resolve } from "path";
import { fileURLToPath } from "url";
import { load as loadYaml } from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ─────────────────────────────────────────────────────────── glob matching

// GitHub's `paths:` filter is not minimatch and not shell globbing. Rules
// taken from the official cheat sheet (Workflow syntax for GitHub Actions,
// "Filter pattern cheat sheet" / "Patterns to match file paths"), not from
// memory: a pattern must match the WHOLE path from the repository root; `*`
// matches zero or more characters but never `/`; `**` matches zero or more of
// ANY character, including `/`; `**/` additionally collapses to zero path
// segments (`docs/**/*.md` matches `docs/README.md`, not just
// `docs/a/b.md`), which is why `**/` is translated as a unit before the
// general `**` and `*` rules run; `?` and `+` are ordinary regex quantifiers
// on the single preceding character; `[...]` is a character class; a leading
// `!` negates. Patterns are evaluated in order — a later positive pattern
// re-includes a path a negative pattern excluded.
export function patternToRegExp(pattern) {
  let out = "";
  let i = 0;
  const n = pattern.length;
  while (i < n) {
    if (pattern.startsWith("**/", i)) {
      out += "(?:.*/)?";
      i += 3;
      continue;
    }
    if (pattern.startsWith("**", i)) {
      out += ".*";
      i += 2;
      continue;
    }
    const c = pattern[i];
    if (c === "*") {
      out += "[^/]*";
      i += 1;
      continue;
    }
    if (c === "?" || c === "+") {
      // GitHub: "matches zero or one/one or more of the preceding
      // character" — the same quantifier regex already gives the character
      // right before it, so passing it through is correct as long as the
      // preceding character was appended literally (it always is here: `*`
      // and `**` are handled above and never left directly adjacent to a
      // bare `?`/`+` in any pattern this repository uses).
      out += c;
      i += 1;
      continue;
    }
    if (c === "[") {
      const close = pattern.indexOf("]", i + 1);
      if (close !== -1) {
        out += pattern.slice(i, close + 1);
        i = close + 1;
        continue;
      }
    }
    out += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    i += 1;
  }
  return new RegExp(`^(?:${out})$`);
}

export function matchesPattern(path, pattern) {
  return patternToRegExp(pattern).test(path);
}

// Sequential fold over the ordered pattern list, honouring `!` negation and
// re-inclusion exactly as the docs describe.
export function isCovered(path, patterns) {
  let covered = false;
  for (const raw of patterns) {
    const negate = raw.startsWith("!");
    const pattern = negate ? raw.slice(1) : raw;
    if (matchesPattern(path, pattern)) covered = !negate;
  }
  return covered;
}

// ───────────────────────────────────────────────────── deploy.yml paths:

export function parseDeployPushPaths(deployYmlText) {
  const doc = loadYaml(deployYmlText);
  const paths = doc?.on?.push?.paths;
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error("deploy.yml has no on.push.paths list — nothing to check coverage against");
  }
  return paths;
}

// ────────────────────────────────────────────── static call-site scanning

// Balanced-paren extraction: text[startIdx] must be "(". Returns the text
// between it and its matching ")", string-literal-aware so a paren inside a
// quoted string is never mistaken for nesting.
function extractBalancedCall(text, startIdx) {
  let depth = 0;
  let inStr = null;
  for (let i = startIdx; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === inStr && text[i - 1] !== "\\") inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inStr = c;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return text.slice(startIdx + 1, i);
    }
  }
  throw new Error(`unbalanced parentheses starting at offset ${startIdx}`);
}

function splitTopLevelArgs(argsText) {
  const args = [];
  let depth = 0;
  let inStr = null;
  let cur = "";
  for (let i = 0; i < argsText.length; i++) {
    const c = argsText[i];
    if (inStr) {
      cur += c;
      if (c === inStr && argsText[i - 1] !== "\\") inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inStr = c;
      cur += c;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") {
      depth++;
      cur += c;
      continue;
    }
    if (c === ")" || c === "]" || c === "}") {
      depth--;
      cur += c;
      continue;
    }
    if (c === "," && depth === 0) {
      args.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim()) args.push(cur.trim());
  return args;
}

function matchStringLiteral(s) {
  const m = /^["'](.*)["']$/.exec(s.trim());
  return m ? m[1] : null;
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

// A resolved base: `segments` are the literal path components known so far
// (relative to repo root), `truncated` is true once an argument that isn't a
// string literal (a loop variable, a spread, anything computed) stopped the
// walk — from that point on the real depth under `segments` is unknown.
function resolveResolveArgs(argsText, identMap) {
  const args = splitTopLevelArgs(argsText);
  if (args.length === 0) return null;
  const base = resolveArgToBase(args[0], identMap);
  if (!base) return null;
  const segments = [...base.segments];
  let truncated = base.truncated;
  for (const raw of args.slice(1)) {
    if (truncated) break;
    const lit = matchStringLiteral(raw);
    if (lit !== null) {
      segments.push(lit);
      continue;
    }
    truncated = true; // spread, bare identifier, or anything else computed
  }
  return { segments, truncated };
}

function resolveArgToBase(argText, identMap) {
  const t = argText.trim();
  if (identMap.has(t)) return identMap.get(t);
  const m = /^resolve\(/.exec(t);
  if (m) {
    const inner = extractBalancedCall(t, m[0].length - 1);
    return resolveResolveArgs(inner, identMap);
  }
  return null;
}

// Every `const NAME = resolve(...)` this script declares, so later calls
// that resolve() against one of those names (dataIn, seDir, ltdDir, the
// PUBLIC_DIR/DIYA_GL_DIR/ASSETS_DIR/SCHEMA_DIR chain, ...) resolve fully
// instead of stopping at the identifier.
function buildIdentMap(scriptText) {
  const identMap = new Map([["ROOT", { segments: [], truncated: false }]]);
  const assign = /\b(?:const|let)\s+(\w+)\s*=\s*resolve\(/g;
  for (const m of scriptText.matchAll(assign)) {
    if (identMap.has(m[1])) continue; // ROOT's own definition, left as seeded
    const parenIdx = m.index + m[0].length - 1;
    const inner = extractBalancedCall(scriptText, parenIdx);
    const resolved = resolveResolveArgs(inner, identMap);
    if (resolved) identMap.set(m[1], resolved);
  }
  return identMap;
}

// A resolved base under node_modules/ can never itself appear in a git diff
// (node_modules isn't tracked), so checking the literal path against the
// filter is the wrong question for it. What actually changes when a vendored
// dependency's shipped file changes is its pin in package-lock.json, which
// the filter does list — this call site is genuinely covered, just not by
// matching its own path.
function isNodeModulesPath(pathStr) {
  return pathStr === "node_modules" || pathStr.startsWith("node_modules/");
}

function buildProbe(resolved, kind) {
  const base = resolved.segments.join("/");
  if (isNodeModulesPath(base)) {
    return { probe: "package-lock.json", note: `${base} is a vendored dependency file; its pin in package-lock.json is what a diff can see` };
  }
  if (!resolved.truncated) {
    if (kind === "readdir") return { probe: `${base}/__cq17_probe__.ext` };
    if (kind === "recursive-copy") return { probe: `${base}/__cq17_probe__/__cq17_nested__/file.ext` };
    return { probe: base };
  }
  // A loop variable, a spread, or anything else computed picked up beyond
  // this point: the real depth is unknown, so probe one directory level
  // deeper than the known base to require at least one level of recursive
  // coverage rather than an exact-file pattern that happens to share a
  // prefix.
  return { probe: `${base}/__cq17_probe__/file.ext` };
}

// Every readFileSync/cpSync/readdirSync call site in the bundle script whose
// source argument resolves statically, plus the esbuild entry point and its
// transitive import closure. Returns { items, unresolved } — items are
// { label, probe, line, note? }, unresolved is call sites this scanner could
// not follow (reported, never silently dropped).
export function extractSources(scriptPath, repoRoot) {
  const scriptText = readFileSync(scriptPath, "utf8");
  const scriptRel = relative(repoRoot, scriptPath).split("\\").join("/");
  const identMap = buildIdentMap(scriptText);
  const items = [];
  const unresolved = [];

  const READ_CALLS = /\b(readFileSync|cpSync|readdirSync)\(/g;
  for (const m of scriptText.matchAll(READ_CALLS)) {
    const fn = m[1];
    const parenIdx = m.index + m[0].length - 1;
    const inner = extractBalancedCall(scriptText, parenIdx);
    const args = splitTopLevelArgs(inner);
    const srcArg = args[0];
    const line = lineOf(scriptText, m.index);
    let resolved = null;
    const rm = /^resolve\(/.exec(srcArg.trim());
    if (rm) {
      resolved = resolveResolveArgs(extractBalancedCall(srcArg.trim(), rm[0].length - 1), identMap);
    } else if (identMap.has(srcArg.trim())) {
      resolved = identMap.get(srcArg.trim());
    }
    if (!resolved) {
      unresolved.push({ line, call: `${fn}(${srcArg})` });
      continue;
    }
    let kind = "exact";
    if (fn === "readdirSync") kind = "readdir";
    if (fn === "cpSync" && /recursive\s*:\s*true/.test(args[2] || "")) kind = "recursive-copy";
    const { probe, note } = buildProbe(resolved, kind);
    items.push({ label: `${scriptRel}:${line} ${fn}(${resolved.segments.join("/")}${resolved.truncated ? "/…" : ""})`, probe, line, note });
  }

  // The bundle script's own relative imports — it reads these itself to run.
  const OWN_IMPORT = /^import\s+[\s\S]*?\s+from\s*["'](\.[^"']+)["']/gm;
  for (const m of scriptText.matchAll(OWN_IMPORT)) {
    const abs = resolve(dirname(scriptPath), m[1]);
    const rel = relative(repoRoot, abs).split("\\").join("/");
    items.push({ label: `${scriptRel}:${lineOf(scriptText, m.index)} import "${m[1]}"`, probe: rel, line: lineOf(scriptText, m.index) });
  }

  // The esbuild entry point, plus everything it imports transitively — this
  // is the one call site esbuild's own native binary would read directly,
  // invisible to any Node-level trace, so it's covered by a plain static
  // import walk instead (the same technique diya-gl/scripts/engine-closure.mjs
  // uses for the packaged engine's own closure).
  const ENTRY = /entryPoints:\s*\[\s*resolve\(/;
  const em = ENTRY.exec(scriptText);
  if (em) {
    const parenIdx = em.index + em[0].length - 1;
    const inner = extractBalancedCall(scriptText, parenIdx);
    const resolved = resolveResolveArgs(inner, identMap);
    const line = lineOf(scriptText, em.index);
    if (resolved && !resolved.truncated) {
      const entryRel = resolved.segments.join("/");
      const closure = importClosure(repoRoot, [entryRel]);
      for (const file of closure) {
        items.push({ label: `${scriptRel}:${line} entryPoints (transitively imports ${file})`, probe: file, line });
      }
    } else {
      unresolved.push({ line, call: "entryPoints: [resolve(...)]" });
    }
  } else {
    unresolved.push({ line: 0, call: "entryPoints: [...] not found in the expected shape" });
  }

  return { items, unresolved };
}

// Static transitive import closure from a set of entry files, following only
// relative `import ... from "./x"` / `export ... from "./x"` / `import("./x")`
// specifiers — mirrors diya-gl/scripts/engine-closure.mjs, generalised to a
// caller-supplied entry list and with extension probing as a defensive
// fallback (this codebase's convention is always an explicit extension).
const STATIC_IMPORT = /(?:^|[^\w.])(?:import\s+[\s\S]*?\s+from\s*|import\s*|export\s+[\s\S]*?\s+from\s*)["']([^"']+)["']/g;
const DYNAMIC_IMPORT = /import\(\s*["']([^"']+)["']\s*\)/g;

function resolveImportSpecifier(fromFile, spec) {
  const abs = resolve(dirname(fromFile), spec);
  for (const candidate of [abs, `${abs}.js`, `${abs}.mjs`, `${abs}.cjs`, resolve(abs, "index.js")]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function importClosure(repoRoot, entryRelPaths) {
  const reached = new Set();
  const pending = entryRelPaths.map((p) => resolve(repoRoot, p));
  while (pending.length > 0) {
    const file = pending.pop();
    if (reached.has(file)) continue;
    if (!existsSync(file)) throw new Error(`check-deploy-filter-coverage: ${relative(repoRoot, file)} is imported but does not exist`);
    reached.add(file);
    const source = readFileSync(file, "utf8");
    const specifiers = new Set();
    for (const m of source.matchAll(STATIC_IMPORT)) specifiers.add(m[1]);
    for (const m of source.matchAll(DYNAMIC_IMPORT)) specifiers.add(m[1]);
    for (const spec of specifiers) {
      if (!spec.startsWith(".")) continue;
      const resolved = resolveImportSpecifier(file, spec);
      if (resolved) pending.push(resolved);
    }
  }
  return [...reached].map((f) => relative(repoRoot, f).split("\\").join("/")).sort();
}

// ───────────────────────────────────────────────────────────────── CLI

function parseArgs(argv) {
  const args = { deployYml: resolve(ROOT, ".github", "workflows", "deploy.yml"), bundleScript: resolve(ROOT, "scripts", "build-diya-gl-bundle.mjs") };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--deploy-yml") args.deployYml = resolve(argv[++i]);
    else if (argv[i] === "--bundle-script") args.bundleScript = resolve(argv[++i]);
  }
  return args;
}

export function checkCoverage({ deployYmlText, bundleScriptPath, repoRoot }) {
  const patterns = parseDeployPushPaths(deployYmlText);
  const { items, unresolved } = extractSources(bundleScriptPath, repoRoot);
  const gaps = items.filter((item) => !isCovered(item.probe, patterns));
  return { patterns, items, unresolved, gaps };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const deployYmlText = readFileSync(args.deployYml, "utf8");
  const { patterns, items, unresolved, gaps } = checkCoverage({ deployYmlText, bundleScriptPath: args.bundleScript, repoRoot: ROOT });

  console.log(`deploy filter coverage: ${items.length} read call site(s) checked against ${patterns.length} deploy.yml path pattern(s)`);
  if (unresolved.length > 0) {
    console.log(`  ${unresolved.length} call site(s) this static scanner could not resolve (reported, not silently skipped):`);
    for (const u of unresolved) console.log(`    ${relative(ROOT, args.bundleScript)}:${u.line} ${u.call}`);
  }

  if (gaps.length === 0) {
    console.log("  every read call site this scanner could resolve is covered by deploy.yml's push paths filter");
    return;
  }

  console.error("\nFAIL: deploy.yml's push paths filter does not cover everything build-diya-gl-bundle.mjs reads:\n");
  for (const gap of gaps) {
    console.error(`  ${gap.label}`);
    console.error(`    not matched by any pattern: ${gap.probe}${gap.note ? `  (${gap.note})` : ""}`);
  }
  console.error(
    "\nA push that only touches one of these paths would change what the bundle deploys without triggering deploy.yml. Add a pattern to on.push.paths in .github/workflows/deploy.yml that covers it.",
  );
  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
