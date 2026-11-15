// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// The generate-*.yml workflows run on a push to main that changes what the
// packages are built from, and commit what the run changed. A schedule commits
// only the package folders main does not hold yet. The generate job rebuilds
// only the year-ends in the current window, so no staging command may stage
// the deletion of an older committed folder.

import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { load } from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKFLOWS_DIR = resolve(__dirname, "..", "..", ".github", "workflows");

const PRODUCTS = readdirSync(WORKFLOWS_DIR)
  .map((f) => f.match(/^generate-(.+)\.yml$/))
  .filter((m) => m && m[1] !== "all")
  .map((m) => m[1])
  .sort();

const scratchDirs = [];
afterAll(() => {
  for (const d of scratchDirs) rmSync(d, { recursive: true, force: true });
});

function scratch() {
  const d = mkdtempSync(join(tmpdir(), "generate-commit-scope-"));
  scratchDirs.push(d);
  return d;
}

function runSteps(workflow) {
  return Object.values(workflow.jobs).flatMap((job) => (job.steps || []).filter((s) => typeof s.run === "string"));
}

// Runs the Normalise Params script with the given inputs and event, the way
// Actions would: each ${{ inputs.x }} becomes the input's value, or empty.
function normalise(step, inputs, eventName) {
  const script = step.run.replace(/\$\{\{\s*inputs\.([a-z-]+)\s*\}\}/g, (_, name) => inputs[name] ?? "");
  const dir = scratch();
  const output = join(dir, "output");
  writeFileSync(output, "");
  execFileSync("bash", ["-e", "-c", script], {
    env: {
      PATH: process.env.PATH,
      GITHUB_OUTPUT: output,
      COMMIT_SCOPE_INPUT: inputs["commit-scope"] ?? "",
      EVENT_NAME: eventName,
    },
    stdio: "pipe",
  });
  return Object.fromEntries(
    readFileSync(output, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => l.split("=")),
  );
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

// A repository holding an old folder outside the window and one inside it,
// then the commit job's view after the artifact lands: the window folder
// rebuilt with one changed file, a new year-end folder, the old folder gone
// from the tree as the generate job's rm -rf leaves it, and a stray change
// outside packages/.
function commitJobTree() {
  const dir = scratch();
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "user.name", "test");
  mkdirSync(join(dir, "packages", "GB Accounts 2024-03-31"), { recursive: true });
  mkdirSync(join(dir, "packages", "GB Accounts 2025-03-31"), { recursive: true });
  writeFileSync(join(dir, "packages", "GB Accounts 2024-03-31", "Accounts.xlsx"), "old");
  writeFileSync(join(dir, "packages", "GB Accounts 2025-03-31", "Accounts.xlsx"), "before");
  writeFileSync(join(dir, "packages", "GB Accounts 2025-03-31", "Guide.pdf"), "same");
  writeFileSync(join(dir, "README.md"), "readme");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "committed packages");
  rmSync(join(dir, "packages"), { recursive: true });
  mkdirSync(join(dir, "packages", "GB Accounts 2025-03-31"), { recursive: true });
  mkdirSync(join(dir, "packages", "GB Accounts 2026-03-31"), { recursive: true });
  writeFileSync(join(dir, "packages", "GB Accounts 2025-03-31", "Accounts.xlsx"), "after");
  writeFileSync(join(dir, "packages", "GB Accounts 2025-03-31", "Guide.pdf"), "same");
  writeFileSync(join(dir, "packages", "GB Accounts 2026-03-31", "Accounts.xlsx"), "new");
  writeFileSync(join(dir, "README.md"), "edited by the run");
  return dir;
}

// The staging part of the commit step, from its reset to its restore.
function stagingScript(step) {
  const start = step.run.indexOf("git reset -q");
  const endMarker = "git restore --worktree -- .";
  const end = step.run.indexOf(endMarker);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return step.run.slice(start, end + endMarker.length);
}

function stage(step, scope) {
  const dir = commitJobTree();
  execFileSync("bash", ["-e", "-c", stagingScript(step)], {
    cwd: dir,
    env: { PATH: process.env.PATH, COMMIT_SCOPE: scope },
    stdio: "pipe",
  });
  return git(dir, "diff", "--staged", "--name-status").trim().split("\n").filter(Boolean).sort();
}

describe.each(PRODUCTS)("generate-%s.yml", (product) => {
  const file = `generate-${product}.yml`;
  const workflow = load(readFileSync(resolve(WORKFLOWS_DIR, file), "utf8"));
  const params = workflow.jobs.params;
  const normaliseStep = params.steps.find((s) => s.id === "normalise");
  const commitStep = workflow.jobs.commit.steps.find((s) => s.id === "push");

  it("runs on a push to main that changes a template, data, product, library or the generator", () => {
    expect(workflow.on.push).toEqual({
      branches: ["main"],
      paths: [
        "app/templates/**",
        "app/data/**",
        "app/products/**",
        "app/lib/**",
        "!app/lib/provenance-data.js",
        "app/bin/generate.js",
        `.github/workflows/${file}`,
      ],
    });
  });

  it("offers commit-scope on a dispatch and a call, defaulting to changed-packages", () => {
    expect(workflow.on.workflow_dispatch.inputs["commit-scope"]).toMatchObject({
      type: "choice",
      options: ["changed-packages", "new-folders"],
      default: "changed-packages",
    });
    expect(workflow.on.workflow_call.inputs["commit-scope"]).toMatchObject({
      type: "string",
      default: "changed-packages",
    });
  });

  it("outputs commit-scope from the params job", () => {
    expect(params.outputs["commit-scope"]).toBe("${{ steps.normalise.outputs.commit-scope }}");
    expect(normaliseStep.env).toEqual({
      COMMIT_SCOPE_INPUT: "${{ inputs.commit-scope }}",
      EVENT_NAME: "${{ github.event_name }}",
    });
  });

  it.each([
    ["schedule", {}, "new-folders"],
    ["push", {}, "changed-packages"],
    ["workflow_dispatch", { "commit-scope": "changed-packages" }, "changed-packages"],
    ["workflow_dispatch", { "commit-scope": "new-folders" }, "new-folders"],
    ["workflow_call from a dispatched generate-all", { "commit-scope": "changed-packages" }, "changed-packages"],
  ])("resolves commit-scope on %s with %j to %s", (eventName, inputs, expected) => {
    const event = eventName.startsWith("workflow_call") ? "workflow_dispatch" : eventName;
    const outputs = normalise(normaliseStep, inputs, event);
    expect(outputs["commit-scope"]).toBe(expected);
  });

  it("gives a push run every skip-* output as false", () => {
    const outputs = normalise(normaliseStep, {}, "push");
    for (const [name, value] of Object.entries(outputs)) {
      if (name.startsWith("skip-")) expect(value, name).toBe("false");
    }
    expect(Object.keys(outputs).filter((n) => n.startsWith("skip-")).length).toBeGreaterThan(0);
  });

  it("refuses an unknown commit-scope", () => {
    expect(() => normalise(normaliseStep, { "commit-scope": "everything" }, "workflow_dispatch")).toThrow();
  });

  it("queues push runs in their own group and cancels only the other events", () => {
    expect(workflow.concurrency).toEqual({
      "group": `\${{ github.event_name == 'push' && format('${product}-packages-push-{0}', github.ref) || format('${product}-packages-{0}', github.ref) }}`,
      "cancel-in-progress": "${{ github.event_name != 'push' }}",
    });
  });

  it("lets no job condition depend on the event, so a push run generates, tests, reconciles and commits", () => {
    for (const [name, job] of Object.entries(workflow.jobs)) {
      expect(String(job.if ?? ""), name).not.toMatch(/github\.event_name|github\.event\./);
    }
  });

  it("hands the commit step the params job's commit-scope", () => {
    expect(workflow.jobs.commit.needs).toContain("params");
    expect(commitStep.env).toEqual({ COMMIT_SCOPE: "${{ needs.params.outputs.commit-scope }}" });
  });

  it("stages new and changed package files for changed-packages, and no deletion", () => {
    expect(stage(commitStep, "changed-packages")).toEqual([
      "A\tpackages/GB Accounts 2026-03-31/Accounts.xlsx",
      "M\tpackages/GB Accounts 2025-03-31/Accounts.xlsx",
    ]);
  });

  it("stages only the folders main does not hold for new-folders", () => {
    expect(stage(commitStep, "new-folders")).toEqual(["A\tpackages/GB Accounts 2026-03-31/Accounts.xlsx"]);
  });

  it("carries no staging command that can stage a deletion under packages/", () => {
    const allowed = new Set(["git add --ignore-removal -- packages/", 'git add -- "$dir"']);
    for (const step of runSteps(workflow)) {
      const lines = step.run.split("\n").map((l) => l.trim());
      for (const line of lines.filter((l) => /\bgit\s+(add|rm|mv)\b/.test(l))) {
        expect(allowed.has(line), line).toBe(true);
      }
      for (const line of lines.filter((l) => /\bgit\s+commit\b/.test(l))) {
        expect(line, line).not.toMatch(/\s(-a|--all)\b|\s-[a-zA-Z]*a[a-zA-Z]*\s/);
      }
    }
    // The per-folder add only ever sees a folder with no tracked file in it.
    expect(commitStep.run).toMatch(
      /for dir in packages\/\*\/; do\n\s+if \[\[ -z "\$\(git ls-files -- "\$dir" \| head -1\)" \]\]; then\n\s+git add -- "\$dir"/,
    );
  });
});
