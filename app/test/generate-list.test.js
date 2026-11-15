// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// generate.js --list prints the package folder names a run writes for the
// current window, and writes nothing. It decides through the same window and
// naming code as a run.

import { describe, it, expect, afterAll } from "vitest";
import { parse as parseTOML } from "smol-toml";
import { execFileSync } from "child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { listPackageFolders, payslipFolderName } from "../bin/generate.js";
import { packageNaming, monthEnd } from "../lib/generator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const ROOT = resolve(APP_DIR, "..");
const DATA_DIR = resolve(APP_DIR, "data");
const GENERATE = resolve(APP_DIR, "bin", "generate.js");

const PRODUCT_DIRS = { bst: "bst", taxi: "taxi", se: "se", ltd: "ltd" };
const TOML_FILES = readdirSync(DATA_DIR)
  .filter((f) => f.endsWith(".toml"))
  .sort()
  .map((f) => resolve(DATA_DIR, f));
const SHARED_META = parseTOML(readFileSync(resolve(APP_DIR, "templates", "meta.toml"), "utf8"));

// Last year end a run on this date builds: the cutoff the generate job applies.
function cutoff(runDate) {
  const monthsAhead = runDate.getUTCDate() >= 16 ? 15 : 14;
  return new Date(Date.UTC(runDate.getUTCFullYear(), runDate.getUTCMonth() + monthsAhead, 0));
}

// The folder names written for one product, from the tax data files and the
// naming function alone.
function expectedFolders(key, runDate) {
  const productMeta = parseTOML(readFileSync(resolve(APP_DIR, "templates", PRODUCT_DIRS[key], "meta.toml"), "utf8"));
  const regime = productMeta.product.tax_regime;
  const names = [];
  for (const file of TOML_FILES.filter((f) =>
    f
      .split("/")
      .pop()
      .startsWith(regime + "-"),
  )) {
    const data = parseTOML(readFileSync(file, "utf8"));
    const ends = [];
    if (regime === "ltd") {
      const start = new Date(data.financial_year.start);
      const end = new Date(data.financial_year.end);
      for (let m = 0; m < 12; m++) {
        const year = start.getUTCFullYear() + Math.floor((start.getUTCMonth() + m) / 12);
        const month = (start.getUTCMonth() + m) % 12;
        const monthEndDate = monthEnd(year, month + 1);
        if (monthEndDate > end) break;
        ends.push(monthEndDate);
      }
    } else {
      ends.push(new Date((data.tax_year || data.financial_year).end));
    }
    for (const endDate of ends) {
      if (endDate > cutoff(runDate)) continue;
      names.push(packageNaming(productMeta, SHARED_META, endDate).dirName);
    }
  }
  return names;
}

const scratchDirs = [];
afterAll(() => {
  for (const d of scratchDirs) rmSync(d, { recursive: true, force: true });
});

describe.each(Object.keys(PRODUCT_DIRS))("generate.js --list for %s", (key) => {
  it.each([new Date(Date.UTC(2026, 10, 15)), new Date(Date.UTC(2027, 2, 16)), new Date(Date.UTC(2024, 0, 31))])(
    "lists the folder names a run on %s writes",
    (runDate) => {
      const expected = expectedFolders(key, runDate);
      if (key === "se") expected.push(...expected.map(payslipFolderName));
      expect(expected.length).toBeGreaterThan(0);
      expect(listPackageFolders([key], TOML_FILES, null, runDate).sort()).toEqual([...new Set(expected)].sort());
    },
  );

  it("prints one folder name per line and writes nothing", () => {
    const out = join(mkdtempSync(join(tmpdir(), "generate-list-")), "out");
    scratchDirs.push(resolve(out, ".."));
    const stdout = execFileSync(process.execPath, [GENERATE, "--package", key, "--list", "--output-dir", out], {
      cwd: ROOT,
      encoding: "utf8",
    });
    const lines = stdout.split("\n").filter(Boolean);
    expect(lines.sort()).toEqual(listPackageFolders([key], TOML_FILES, null, new Date()).sort());
    expect(existsSync(out)).toBe(false);
    expect(stdout).not.toMatch(/Generating|Written|===/);
  });
});

describe("generate.js --list for se and the Payslip 05 step", () => {
  it("includes the Payslip 05 folder names the generate-se.yml step makes", () => {
    const workflow = readFileSync(resolve(ROOT, ".github", "workflows", "generate-se.yml"), "utf8");
    const sed = workflow.match(/label=\$\(basename "\$se_dir" \| sed '([^']+)'\)/)[1];
    const listed = listPackageFolders(["se"], TOML_FILES, null, new Date(Date.UTC(2026, 10, 15)));
    const selfEmployed = listed.filter((n) => n.includes("Self Employed"));
    const payslip = listed.filter((n) => n.includes("Payslip 05"));
    expect(selfEmployed.length).toBeGreaterThan(0);
    const viaSed = selfEmployed.map((n) => execFileSync("sed", [sed], { input: n, encoding: "utf8" }).trim());
    expect(payslip.sort()).toEqual(viaSed.sort());
  });
});
