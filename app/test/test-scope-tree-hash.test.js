// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// test-scope-tree-hash.test.js: a GREEN marker written for a
// commit before scripts/build-provenance-data.mjs restamps its
// engineVersion field must still match the tree of the restamp commit
// pushed afterward. Proved here against a throwaway git repository (never
// this repo's own tree), built by copying the real scripts/test-scope.mjs
// so the router's own ROOT resolves to that repository, not this one.

import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync, chmodSync } from "fs";
import { tmpdir } from "os";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const dirs = [];

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true });
});

function provenanceSource(engineVersion) {
  // Shaped like the real generated file, but only engineVersion and one
  // other field matter to these tests: the pattern under test
  // (ENGINE_VERSION_PATTERN in scripts/test-scope.mjs) matches
  // `engineVersion: "..."` however the surrounding object is formatted.
  return ["export const PROVENANCE_DATA = {", `  engineVersion: "${engineVersion}",`, '  taxDataHash: "deadbeefcafe",', "};", ""].join(
    "\n",
  );
}

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "test-scope-cq45-"));
  dirs.push(dir);
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
  mkdirSync(join(dir, "scripts"), { recursive: true });
  cpSync(resolve(ROOT, "scripts", "test-scope.mjs"), join(dir, "scripts", "test-scope.mjs"));
  mkdirSync(join(dir, "app", "lib"), { recursive: true });
  // The GREEN marker written under target/test-scope/ must never itself
  // become a tracked file: `git add -A` in commitAll would otherwise sweep
  // a marker written between two commits into the later one's tree, which
  // would make that tree differ from the earlier one for a reason that has
  // nothing to do with engineVersion.
  writeFileSync(join(dir, ".gitignore"), "target/\n");
  return dir;
}

function commitAll(dir, message) {
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync("git", ["commit", "-q", "-m", message], { cwd: dir });
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
}

function treeHash(dir, rev) {
  const args = ["scripts/test-scope.mjs", "--tree-hash"];
  if (rev) args.push("--rev", rev);
  return execFileSync("node", args, { cwd: dir, encoding: "utf8" }).trim();
}

function plan(dir, baseRef) {
  return execFileSync("node", ["scripts/test-scope.mjs", "--plan", "--base", baseRef], { cwd: dir, encoding: "utf8" });
}

function codeTreeHash(dir) {
  return execFileSync("node", ["scripts/test-scope.mjs", "--code-tree-hash"], { cwd: dir, encoding: "utf8" }).trim();
}

function makeHookRepo() {
  const dir = makeRepo();
  mkdirSync(join(dir, ".githooks"), { recursive: true });
  cpSync(resolve(ROOT, ".githooks", "pre-push"), join(dir, ".githooks", "pre-push"));
  chmodSync(join(dir, ".githooks", "pre-push"), 0o755);
  return dir;
}

// Simulates a fetched origin/main without an actual remote: the hook only
// ever reads this ref with `git diff`, never pushes or fetches it.
function setOriginMain(dir, sha) {
  execFileSync("git", ["update-ref", "refs/remotes/origin/main", sha], { cwd: dir });
}

function runHook(dir, stdin) {
  try {
    return { code: 0, output: execFileSync("bash", [".githooks/pre-push"], { cwd: dir, input: stdin, encoding: "utf8" }) };
  } catch (err) {
    return { code: err.status, output: `${err.stdout || ""}${err.stderr || ""}` };
  }
}

describe("--tree-hash blanks provenance-data.js's engineVersion", () => {
  it("hashes two commits the same when only engineVersion's value differs", () => {
    const dir = makeRepo();
    writeFileSync(join(dir, "app", "lib", "provenance-data.js"), provenanceSource("1.0.0+aaaaaaaaaa"));
    writeFileSync(join(dir, "app", "lib", "feature.js"), "export const x = 1;\n");
    const before = commitAll(dir, "code");

    writeFileSync(join(dir, "app", "lib", "provenance-data.js"), provenanceSource("1.0.1+bbbbbbbbbb"));
    const after = commitAll(dir, "restamp");

    expect(treeHash(dir, before)).toBe(treeHash(dir, after));
  }, 30_000);

  it("still hashes two commits differently when something other than engineVersion changes", () => {
    const dir = makeRepo();
    writeFileSync(join(dir, "app", "lib", "provenance-data.js"), provenanceSource("1.0.0+aaaaaaaaaa"));
    writeFileSync(join(dir, "app", "lib", "feature.js"), "export const x = 1;\n");
    const before = commitAll(dir, "code");

    // engineVersion unchanged; a real source change instead.
    writeFileSync(join(dir, "app", "lib", "feature.js"), "export const x = 2;\n");
    const after = commitAll(dir, "real change");

    expect(treeHash(dir, before)).not.toBe(treeHash(dir, after));
  }, 30_000);

  it("the working-tree hash (no --rev) equals the rev-based hash of the same checked-out commit", () => {
    const dir = makeRepo();
    writeFileSync(join(dir, "app", "lib", "provenance-data.js"), provenanceSource("1.0.0+aaaaaaaaaa"));
    const head = commitAll(dir, "code");
    expect(treeHash(dir, null)).toBe(treeHash(dir, head));
  }, 30_000);
});

describe("--tree-hash ignores untracked paths that are not source", () => {
  it("hashes the same with an untracked file under packages/ present as without it", () => {
    const dir = makeRepo();
    writeFileSync(join(dir, "app", "lib", "base.js"), "export const x = 1;\n");
    commitAll(dir, "base");
    const before = treeHash(dir);

    mkdirSync(join(dir, "packages", "GB Accounts Basic Sole Trader"), { recursive: true });
    writeFileSync(join(dir, "packages", "GB Accounts Basic Sole Trader", "LICENCE.txt"), "licence\n");
    writeFileSync(join(dir, "packages", "GB Accounts Basic Sole Trader", "README.txt"), "readme\n");
    const withUntrackedPackages = treeHash(dir);

    expect(withUntrackedPackages).toBe(before);
  }, 30_000);

  it("hashes differently with an untracked source file present", () => {
    const dir = makeRepo();
    writeFileSync(join(dir, "app", "lib", "base.js"), "export const x = 1;\n");
    commitAll(dir, "base");
    const before = treeHash(dir);

    mkdirSync(join(dir, "app", "lib"), { recursive: true });
    writeFileSync(join(dir, "app", "lib", "x.js"), "export const y = 2;\n");
    const withUntrackedSource = treeHash(dir);

    expect(withUntrackedSource).not.toBe(before);
  }, 30_000);

  it("also ignores untracked test-results/ and target/ byproducts", () => {
    const dir = makeRepo();
    writeFileSync(join(dir, "app", "lib", "base.js"), "export const x = 1;\n");
    commitAll(dir, "base");
    const before = treeHash(dir);

    mkdirSync(join(dir, "test-results"), { recursive: true });
    writeFileSync(join(dir, "test-results", "report.xml"), "<xml/>\n");
    // target/ is gitignored by makeRepo's .gitignore, so it is not seen as
    // "untracked" by git at all -- proving test-results/ alone is enough to
    // show the exclusion covers a root outside target/'s own .gitignore rule.
    const withUntrackedTestResults = treeHash(dir);

    expect(withUntrackedTestResults).toBe(before);
  }, 30_000);
});

// CQ-40's --code-tree-hash strips every *.md path from the index before
// hashing, tracked or not; CQ-51's untracked-non-source exclusion (the
// describe block above) only ever touches paths git ls-files --others
// reports, so a tracked Markdown file's own content change is the one case
// that distinguishes the two mechanisms.
describe("--code-tree-hash strips a tracked Markdown file's content too", () => {
  it("holds --code-tree-hash steady across a tracked Markdown edit, but not the plain --tree-hash", () => {
    const dir = makeRepo();
    mkdirSync(join(dir, "app", "lib"), { recursive: true });
    writeFileSync(join(dir, "app", "lib", "base.js"), "export const x = 1;\n");
    writeFileSync(join(dir, "README.md"), "before\n");
    commitAll(dir, "base");

    const codeBefore = codeTreeHash(dir);
    const plainBefore = treeHash(dir);

    writeFileSync(join(dir, "README.md"), "after, a real edit to a tracked doc\n");

    expect(codeTreeHash(dir)).toBe(codeBefore);
    expect(treeHash(dir)).not.toBe(plainBefore);
  }, 30_000);
});

describe(".githooks/pre-push skips a restamp-only push against a pre-restamp GREEN marker", () => {
  function writeMarker(dir, hash, mergeBase) {
    const markerDir = join(dir, "target", "test-scope");
    mkdirSync(markerDir, { recursive: true });
    writeFileSync(join(markerDir, `green-${hash}`), `mergeBase=${mergeBase} tiers=gates,unit at=${new Date().toISOString()}\n`);
  }

  it("skips the run when a marker exists for the pre-restamp tree of the commit being pushed", () => {
    const dir = makeHookRepo();
    writeFileSync(join(dir, "app", "lib", "provenance-data.js"), provenanceSource("1.0.0+aaaaaaaaaa"));
    const base = commitAll(dir, "base"); // stands in for the remote's current tip

    writeFileSync(join(dir, "app", "lib", "feature.js"), "export const x = 1;\n");
    const preRestamp = commitAll(dir, "feature"); // the code commit the router actually ran against
    const markerHash = treeHash(dir, preRestamp);
    writeMarker(dir, markerHash, base);

    writeFileSync(join(dir, "app", "lib", "provenance-data.js"), provenanceSource("1.0.1+bbbbbbbbbb"));
    const restamp = commitAll(dir, "restamp"); // what actually gets pushed

    const result = runHook(dir, `refs/heads/feature ${restamp} refs/heads/feature ${base}\n`);
    expect(result.output).toMatch(/skipping the run/);
    expect(result.code).toBe(0);
  }, 30_000);

  // The "no marker" / "marker doesn't match" branches fall through to the
  // real router run (node scripts/test-scope.mjs --base ...), which in
  // this throwaway repo has no package.json, no npx-installed prettier and
  // no network -- not safe to invoke here. Those branches are exercised by
  // this repo's own real pushes, which either write a marker or run for
  // real; the marker-matches branch above is the one that could silently
  // start skipping runs it shouldn't, which is why it alone gets a direct
  // proof.
});

// A squash once carried the fork point's NEXT.md onto a batch branch,
// reverting two board edits, and the PR opened CONFLICTING; 72 job-minutes
// ran on the abandoned head. NEXT.md is maintained on main alone, so a
// branch that changes it against main is always a mistake.
describe(".githooks/pre-push refuses a branch push that changes NEXT.md against main", () => {
  it("refuses a branch push whose diff against main touches NEXT.md", () => {
    const dir = makeHookRepo();
    writeFileSync(join(dir, "NEXT.md"), "- item one\n");
    const mainTip = commitAll(dir, "main: board");
    setOriginMain(dir, mainTip);

    writeFileSync(join(dir, "NEXT.md"), "- item one\n- item two (reverted by a stale squash)\n");
    writeFileSync(join(dir, "app", "lib", "feature.js"), "export const x = 1;\n");
    const branchHead = commitAll(dir, "feature: also touches NEXT.md");

    const result = runHook(dir, `refs/heads/feature ${branchHead} refs/heads/feature ${mainTip}\n`);
    expect(result.code).toBe(1);
    expect(result.output).toMatch(/NEXT\.md is maintained on main/);
  }, 15_000);

  it("does not refuse the same branch when its diff against main has no NEXT.md change", () => {
    const dir = makeHookRepo();
    writeFileSync(join(dir, "NEXT.md"), "- item one\n");
    const mainTip = commitAll(dir, "main: board");
    setOriginMain(dir, mainTip);

    writeFileSync(join(dir, "README.md"), "docs\n");
    const branchHead = commitAll(dir, "feature: docs only, NEXT.md untouched");

    const result = runHook(dir, `refs/heads/feature ${branchHead} refs/heads/feature ${mainTip}\n`);
    expect(result.output).not.toMatch(/NEXT\.md is maintained on main/);
    expect(result.output).toMatch(/nothing to test/);
    expect(result.code).toBe(0);
  }, 15_000);

  it("does not refuse a push directly to refs/heads/main even with a NEXT.md change", () => {
    const dir = makeHookRepo();
    writeFileSync(join(dir, "NEXT.md"), "- item one\n");
    const mainTip = commitAll(dir, "main: board");
    setOriginMain(dir, mainTip);

    writeFileSync(join(dir, "NEXT.md"), "- item one\n- item two\n");
    const newMainTip = commitAll(dir, "main: board update");

    const result = runHook(dir, `refs/heads/main ${newMainTip} refs/heads/main ${mainTip}\n`);
    expect(result.output).not.toMatch(/NEXT\.md is maintained on main/);
    expect(result.output).toMatch(/nothing to test/);
    expect(result.code).toBe(0);
  }, 15_000);
});

// SR-5: every diya-gl publish rewrites package.json and package-lock.json
// (root and diya-gl/) with nothing but their own "version" field bumped.
// The "test harness" route treats any package.json change as one nothing in
// the diff can narrow (calc, browser and infra all), which is right for a
// real dependency edit and wrong for a version echo carried into a branch's
// diff by an unrelated publish commit. infra's run flag is asserted here
// because it comes straight from sel.infra with no test-file discovery of
// its own to fake up, unlike calc and browser -- proof enough that the
// whole route did or did not fire.
describe("test-scope.mjs drops a self-version-only package.json/lockfile change from routing", () => {
  function writePackageJson(dir, version, extra = {}) {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "throwaway", version, ...extra }, null, 2) + "\n");
  }

  it("does not run calc, browser or infra for a version-only package.json bump", () => {
    const dir = makeRepo();
    writePackageJson(dir, "1.2.34");
    writeFileSync(join(dir, "app", "lib", "feature.js"), "export const x = 1;\n");
    const base = commitAll(dir, "base");

    writePackageJson(dir, "1.2.35");
    commitAll(dir, "publish: version bump only");

    const output = plan(dir, base);
    expect(output).toMatch(/skipped {2,}infra/);
    expect(output).toMatch(/skipped {2,}browser/);
  }, 15_000);

  it("still runs calc, browser and infra when package.json's dependencies actually change", () => {
    const dir = makeRepo();
    writePackageJson(dir, "1.2.34", { dependencies: {} });
    const base = commitAll(dir, "base");

    writePackageJson(dir, "1.2.34", { dependencies: { "left-pad": "1.0.0" } });
    commitAll(dir, "add a dependency");

    const output = plan(dir, base);
    expect(output).toMatch(/RUN {2,}infra/);
  }, 15_000);

  it("still runs calc, browser and infra when a version-only package.json bump rides alongside a real code change", () => {
    const dir = makeRepo();
    writePackageJson(dir, "1.2.34");
    writeFileSync(join(dir, "pom.xml"), "<project/>\n");
    const base = commitAll(dir, "base");

    writePackageJson(dir, "1.2.35");
    writeFileSync(join(dir, "pom.xml"), "<project><real-change/></project>\n");
    commitAll(dir, "publish plus an infra edit");

    const output = plan(dir, base);
    expect(output).toMatch(/RUN {2,}infra/);
  }, 15_000);

  it("does not run the full unit tier for a version-only package-lock.json bump", () => {
    const dir = makeRepo();
    writePackageJson(dir, "1.2.34");
    writeFileSync(join(dir, "package-lock.json"), JSON.stringify({ name: "throwaway", version: "1.2.34" }, null, 2) + "\n");
    const base = commitAll(dir, "base");

    writeFileSync(join(dir, "package-lock.json"), JSON.stringify({ name: "throwaway", version: "1.2.35" }, null, 2) + "\n");
    commitAll(dir, "publish: lockfile version bump only");

    const output = plan(dir, base);
    expect(output).not.toMatch(/because .*lockfile/);
  }, 15_000);
});
