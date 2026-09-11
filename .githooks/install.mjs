// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// install.mjs — point git at the tracked hooks in .githooks, and say what it did.
//
// Run from npm postinstall, so a fresh clone and every new worktree gets the
// pre-push gate without anyone configuring it. The value written is relative,
// because git resolves a relative core.hooksPath from the top of the working
// tree: one setting covers the main checkout and every worktree sharing the
// repository config. An absolute path is what stranded the hooks here before,
// pointing at a checkout that had been renamed away.
//
// It never fails an install. A tarball, a CI image without .git, a git that is
// not on PATH: each prints a line and exits 0.

import { spawnSync } from "child_process";

const WANT = ".githooks";

function git(args) {
  const r = spawnSync("git", args, { encoding: "utf8" });
  return r.status === 0 ? (r.stdout || "").trim() : null;
}

function main() {
  if (git(["--version"]) === null) {
    console.log("hooks: git is not available, leaving core.hooksPath alone");
    return;
  }
  if (git(["rev-parse", "--git-dir"]) === null) {
    console.log("hooks: not a git working tree, leaving core.hooksPath alone");
    return;
  }
  const current = git(["config", "--get", "core.hooksPath"]);
  if (current === WANT) {
    console.log(`hooks: core.hooksPath is already ${WANT}`);
    return;
  }
  const set = git(["config", "core.hooksPath", WANT]);
  if (set === null) {
    console.log(`hooks: could not set core.hooksPath, git hooks will not run. Set it by hand: git config core.hooksPath ${WANT}`);
    return;
  }
  if (current) console.log(`hooks: core.hooksPath moved from ${current} to ${WANT}`);
  else console.log(`hooks: core.hooksPath set to ${WANT}`);
}

try {
  main();
} catch (err) {
  console.log(`hooks: skipped, ${err.message}`);
}
