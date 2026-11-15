// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// deploy-smoke-test-user-lock.test.js — every job that mints the shared
// Cognito test user holds one concurrency group that all refs share, and
// queues instead of cancelling.

import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";

const workflowsDir = join(import.meta.dirname, "..", "..", ".github", "workflows");
const GROUP = "spreadsheets-smoke-test-user";

const minters = [];
for (const file of readdirSync(workflowsDir).filter((f) => f.endsWith(".yml"))) {
  const doc = load(readFileSync(join(workflowsDir, file), "utf8"));
  for (const [id, job] of Object.entries(doc.jobs || {})) {
    const steps = JSON.stringify(job.steps || []);
    if (steps.includes("ensure-cognito-test-user.js")) minters.push({ file, id, job });
  }
}

describe("jobs that mint the shared Cognito test user", () => {
  test("the deploy smoke test is one of them", () => {
    expect(minters.map((m) => `${m.file}:${m.id}`)).toContain("deploy.yml:test-spreadsheets");
  });

  test.each(minters.map((m) => [`${m.file}:${m.id}`, m.job]))("%s holds the shared group and queues", (_name, job) => {
    expect(job.concurrency).toEqual({ "group": GROUP, "cancel-in-progress": false });
  });

  test("the group does not depend on the ref", () => {
    for (const { job } of minters) expect(job.concurrency.group).not.toContain("${{");
  });
});
