#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// blast-radius.mjs — a view onto scripts/test-scope.mjs's own diff-to-tier
// selection, for the times an agent wants the list of test files and specs a
// change reaches without running them. It owns no logic of its own: the
// import graph, the routing table and the tier selection all live in
// test-scope.mjs, and this wrapper runs that script's --plan mode.
//
//   npm run blast-radius                  the plan for the diff against origin/main
//   npm run blast-radius -- --base <ref>  a different comparison point

import { spawnSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);

const forwardArgs = ["scripts/test-scope.mjs", "--plan"];
const baseIdx = argv.indexOf("--base");
if (baseIdx !== -1 && argv[baseIdx + 1]) {
  forwardArgs.push("--base", argv[baseIdx + 1]);
}

const result = spawnSync("node", forwardArgs, { cwd: ROOT, stdio: "inherit" });
process.exit(result.status ?? 1);
