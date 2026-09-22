// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// test-scope-live-guard.test.js -- findLiveConflictingProcesses is pure (no
// ps call, no process state), so it is exercised directly against a fake ps
// listing rather than through the CLI, the way the routing table is tested
// in test-scope-routing.test.js.

import { describe, it, expect } from "vitest";
import { findLiveConflictingProcesses } from "../../scripts/test-scope.mjs";

const own = { ownPid: 900 };

describe("findLiveConflictingProcesses", () => {
  it("finds a live soffice process by its executable", () => {
    const ps = ["  PID  PPID COMMAND", "  501     1 /Applications/LibreOffice.app/Contents/MacOS/soffice.bin --headless"];
    expect(findLiveConflictingProcesses(ps, own)).toEqual([
      { pid: 501, command: "/Applications/LibreOffice.app/Contents/MacOS/soffice.bin --headless" },
    ]);
  });

  it("finds a live playwright run and the browser it launched", () => {
    const ps = [
      "  PID  PPID COMMAND",
      "  502     1 node node_modules/.bin/playwright test --project=browser-tests",
      "  503   502 /Users/x/Library/Caches/ms-playwright/chromium-1200/chrome-mac/Chromium.app/Contents/MacOS/Chromium --headless",
    ];
    expect(findLiveConflictingProcesses(ps, own).map((h) => h.pid)).toEqual([502, 503]);
  });

  it("finds a live vitest process", () => {
    const ps = ["  PID  PPID COMMAND", "  504     1 node /repo/node_modules/vitest/vitest.mjs run --project unit-tests"];
    expect(findLiveConflictingProcesses(ps, own)).toEqual([
      { pid: 504, command: "node /repo/node_modules/vitest/vitest.mjs run --project unit-tests" },
    ]);
  });

  it("ignores the router's own process and every ancestor of it", () => {
    const ps = [
      "  PID  PPID COMMAND",
      "  700     1 /bin/zsh -c cd /repo && pgrep -l 'soffice|vitest|playwright'; npm test",
      "  899   700 npm test",
      "  900   899 node scripts/test-scope.mjs",
      "  501     1 soffice.bin --headless",
    ];
    expect(findLiveConflictingProcesses(ps, own)).toEqual([{ pid: 501, command: "soffice.bin --headless" }]);
  });

  it("ignores a shell or grep whose arguments merely mention the words", () => {
    const ps = [
      "  PID  PPID COMMAND",
      "  505     1 /bin/zsh -c until pgrep -l 'soffice|playwright|vitest'; do sleep 30; done",
      "  506     1 grep -rn vitest app/test",
      "  507     1 node scripts/build-sitemaps.js",
    ];
    expect(findLiveConflictingProcesses(ps, own)).toEqual([]);
  });

  it("ignores a path segment that only contains the word", () => {
    const ps = ["  PID  PPID COMMAND", "  508     1 node myvitestrunner.js", "  509     1 node node_modules/vitest-lookalike/cli.js"];
    expect(findLiveConflictingProcesses(ps, own)).toEqual([]);
  });

  it("skips lines that are not pid/ppid/command shaped, such as the ps header", () => {
    const ps = ["  PID  PPID COMMAND", "not a process line at all"];
    expect(findLiveConflictingProcesses(ps, own)).toEqual([]);
  });

  it("reports every conflicting process when more than one is live", () => {
    const ps = ["  PID  PPID COMMAND", "  501     1 soffice.bin --headless", "  502     1 node node_modules/.bin/vitest run"];
    expect(
      findLiveConflictingProcesses(ps, own)
        .map((h) => h.pid)
        .sort(),
    ).toEqual([501, 502]);
  });
});
