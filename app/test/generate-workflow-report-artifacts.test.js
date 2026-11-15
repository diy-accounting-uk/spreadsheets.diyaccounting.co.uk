// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// The generate-*.yml workflows hand the generated packages from the job that
// builds them to the jobs that test and commit them through named artifacts.
// An upload that no job downloads is dead weight, and the run stays green.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKFLOWS_DIR = resolve(__dirname, "..", "..", ".github", "workflows");

// A workflow whose jobs only call other workflows (generate-all.yml) carries
// no steps of its own; the artifacts it produces are the called workflows'.
const GENERATE_WORKFLOWS = readdirSync(WORKFLOWS_DIR)
  .filter((f) => /^generate-.*\.yml$/.test(f))
  .filter((f) => /^\s+steps:/m.test(readFileSync(resolve(WORKFLOWS_DIR, f), "utf8")))
  .sort();

// A workflow step is a "- uses:" line and the indented lines under it. The name
// or pattern an artifact step carries sits in its with: block.
function artifactSteps(yaml, action) {
  const steps = [];
  const lines = yaml.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!new RegExp(`^\\s*- uses: actions/${action}@`).test(lines[i])) continue;
    const indent = lines[i].match(/^(\s*)- /)[1].length;
    const body = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === "") continue;
      const lineIndent = line.match(/^(\s*)/)[1].length;
      if (lineIndent <= indent) break;
      body.push(line);
    }
    const name = body.find((l) => /^\s*name:\s/.test(l));
    const pattern = body.find((l) => /^\s*pattern:\s/.test(l));
    steps.push({
      name: name ? name.replace(/^\s*name:\s*/, "").trim() : null,
      pattern: pattern ? pattern.replace(/^\s*pattern:\s*/, "").trim() : null,
    });
  }
  return steps;
}

// ${{ matrix.year-end }} and friends stand for whatever the run puts there, so
// the concrete name only has to match the glob outside the expression.
function concreteName(name) {
  return name.replace(/\$\{\{[^}]*\}\}/g, "SUBSTITUTION");
}

function globMatches(glob, name) {
  const source = glob
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${source}$`).test(name);
}

describe.each(GENERATE_WORKFLOWS)("%s", (workflow) => {
  const yaml = readFileSync(resolve(WORKFLOWS_DIR, workflow), "utf8");
  const uploads = artifactSteps(yaml, "upload-artifact").filter((s) => s.name);
  const downloads = artifactSteps(yaml, "download-artifact");

  it("uploads the generated packages", () => {
    expect(uploads.filter((s) => s.name.endsWith("-packages")).length).toBeGreaterThan(0);
  });

  it("downloads every artifact it uploads", () => {
    const uploaded = uploads.map((s) => concreteName(s.name));
    const collected = uploaded.filter((name) =>
      downloads.some((d) => (d.pattern && globMatches(d.pattern, name)) || (d.name && concreteName(d.name) === name)),
    );
    expect(collected).toEqual(uploaded);
  });

  it("carries no artifact for reports, examples or pages that no step commits", () => {
    const names = [...uploads, ...downloads].map((s) => s.name || s.pattern || "");
    expect(names.filter((n) => /reports|examples|reconciliation-page/.test(n))).toEqual([]);
  });
});
