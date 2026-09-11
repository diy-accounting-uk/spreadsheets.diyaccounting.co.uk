// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// recalculation-cache.test.js — Proves the cache that lets one recalculation
// serve every test file asking for the same package: it runs the work once for
// callers that agree on their inputs, runs it again the moment one input
// moves, and never answers a caller with nothing.
//
// The work itself is a stub here, so this test needs no LibreOffice.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { withRecalculatedFiles } from "../lib/spreadsheet-runner.js";

describe("the recalculation cache", () => {
  let cacheDir;
  let previous;

  // A stand-in for the recalculation: counts its runs and writes one file.
  function counter(contents = "recalculated") {
    const work = async (destination) => {
      work.runs += 1;
      writeFileSync(join(destination, "package.txt"), contents);
    };
    work.runs = 0;
    return work;
  }

  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), "recalculation-cache-"));
    previous = { flag: process.env.CALC_CACHE, dir: process.env.CALC_CACHE_DIR };
    process.env.CALC_CACHE = "on";
    process.env.CALC_CACHE_DIR = cacheDir;
  });

  afterEach(() => {
    if (previous.flag === undefined) delete process.env.CALC_CACHE;
    else process.env.CALC_CACHE = previous.flag;
    if (previous.dir === undefined) delete process.env.CALC_CACHE_DIR;
    else process.env.CALC_CACHE_DIR = previous.dir;
    rmSync(cacheDir, { recursive: true, force: true });
  });

  it("runs the work once for two callers that agree on their inputs", async () => {
    const work = counter();
    const first = await withRecalculatedFiles({ fixture: "advanced" }, "package.txt", work);
    const second = await withRecalculatedFiles({ fixture: "advanced" }, "package.txt", work);

    expect(work.runs).toBe(1);
    expect(second.fromCache).toBe(true);
    expect(readFileSync(join(first.dir, "package.txt"), "utf8")).toBe("recalculated");
    expect(readFileSync(join(second.dir, "package.txt"), "utf8")).toBe("recalculated");
  });

  it("reaches the same entry when the same inputs are written in a different order", async () => {
    const work = counter();
    await withRecalculatedFiles({ fixture: "advanced", year: 2025 }, "package.txt", work);
    const second = await withRecalculatedFiles({ year: 2025, fixture: "advanced" }, "package.txt", work);

    expect(work.runs).toBe(1);
    expect(second.fromCache).toBe(true);
  });

  it("runs the work again when one input moves", async () => {
    const work = counter();
    await withRecalculatedFiles({ fixture: "advanced", cell: 45748 }, "package.txt", work);
    const moved = await withRecalculatedFiles({ fixture: "advanced", cell: 45749 }, "package.txt", work);

    expect(work.runs).toBe(2);
    expect(moved.fromCache).toBe(false);
  });

  it("runs the work once when two callers race for the same entry", async () => {
    const work = counter();
    const [first, second] = await Promise.all([
      withRecalculatedFiles({ fixture: "raced" }, "package.txt", work),
      withRecalculatedFiles({ fixture: "raced" }, "package.txt", work),
    ]);

    expect(work.runs).toBe(1);
    expect([first.fromCache, second.fromCache].filter(Boolean)).toHaveLength(1);
    expect(readFileSync(join(second.dir, "package.txt"), "utf8")).toBe("recalculated");
  });

  it("leaves nothing behind when the work throws, and lets the next caller try again", async () => {
    const broken = async () => {
      throw new Error("LibreOffice wrote no package.xlsx");
    };
    await expect(withRecalculatedFiles({ fixture: "broken" }, "package.txt", broken)).rejects.toThrow(/wrote no package/);

    const work = counter();
    const retried = await withRecalculatedFiles({ fixture: "broken" }, "package.txt", work);
    expect(work.runs).toBe(1);
    expect(retried.fromCache).toBe(false);
  });

  it("runs the work for every caller with the cache off, and clears up after each", async () => {
    process.env.CALC_CACHE = "off";
    const work = counter();
    const first = await withRecalculatedFiles({ fixture: "advanced" }, "package.txt", work);
    const second = await withRecalculatedFiles({ fixture: "advanced" }, "package.txt", work);

    expect(work.runs).toBe(2);
    expect(first.dir).not.toBe(second.dir);
    first.release();
    expect(existsSync(first.dir)).toBe(false);
    second.release();
  });
});
