// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// The generate-*.yml workflows hand reconciliation reports from the job that
// writes them to the job that commits them through named artifacts. The commit
// job collects them by glob, so an upload whose name falls outside that glob is
// dropped in silence: the run stays green and the committed report goes stale.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKFLOWS_DIR = resolve(__dirname, "..", "..", ".github", "workflows");

const GENERATE_WORKFLOWS = readdirSync(WORKFLOWS_DIR)
  .filter((f) => /^generate-.*\.yml$/.test(f))
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

  it("uploads at least one reports artifact", () => {
    expect(uploads.filter((s) => s.name.includes("reports")).length).toBeGreaterThan(0);
  });

  it("downloads every reports artifact it uploads", () => {
    const reportUploads = uploads.filter((s) => s.name.includes("reports")).map((s) => concreteName(s.name));
    const collected = reportUploads.filter((name) =>
      downloads.some((d) => (d.pattern && globMatches(d.pattern, name)) || (d.name && concreteName(d.name) === name)),
    );
    expect(collected).toEqual(reportUploads);
  });
});
