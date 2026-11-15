// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// The pure parts of scripts/refresh-pinned.mjs and the pinned.json writer in
// app/lib/pinned.js, run against a temporary directory.

import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { latestTarget, newestYearEnd, parseArgs, replacedReports, scenariosOf } from "../../scripts/refresh-pinned.mjs";
import { formatPinned, packageDirName, readPinned, reportFileName, withPin, writePinned } from "../lib/pinned.js";

const PACKAGE_DIRS = [
  "GB Accounts Basic Sole Trader 2026-04-05 (Apr26) Excel 2007",
  "GB Accounts Basic Sole Trader 2027-04-05 (Apr27) Excel 2007",
  "GB Accounts Company 2024-2025 (Any) Excel 2007",
  "GB Accounts Company 2027-10-31 (Oct27) Excel 2007",
  "GB Accounts Company 2027-12-31 (Dec27) Excel 2007",
  "GB Accounts Company 2028-02-29 (Feb28) Excel 2007",
  "GB Accounts Payslip 05 2028-04-05 (Apr28) Excel 2007",
  "GB Accounts Self Employed 2027-04-05 (Apr27) Excel 2007",
  "GB Accounts Taxi Driver 2025-04-05 (Apr25) Excel 2007",
  "README.md",
];

const PINNED = {
  ltd: { yearEnd: "2027-10-31", built: "2026-10-05" },
  bst: { yearEnd: "2027-04-05", built: "2026-11-14" },
  se: { yearEnd: "2027-04-05", built: "2026-11-14" },
  taxi: { yearEnd: "2027-04-05", built: "2026-11-13" },
};

describe("newestYearEnd", () => {
  it("takes the latest year-end of the product's own folders", () => {
    expect(newestYearEnd("ltd", PACKAGE_DIRS)).toBe("2028-02-29");
    expect(newestYearEnd("bst", PACKAGE_DIRS)).toBe("2027-04-05");
    expect(newestYearEnd("se", PACKAGE_DIRS)).toBe("2027-04-05");
    expect(newestYearEnd("taxi", PACKAGE_DIRS)).toBe("2025-04-05");
  });

  it("throws when the product has no folder", () => {
    expect(() => newestYearEnd("taxi", ["GB Accounts Company 2027-10-31 (Oct27) Excel 2007"])).toThrow(/No Taxi Driver package/);
  });
});

describe("package and report names", () => {
  it("names the package folder the generator writes for a year-end", () => {
    expect(packageDirName("ltd", "2027-10-31")).toBe("GB Accounts Company 2027-10-31 (Oct27) Excel 2007");
    expect(packageDirName("ltd", "2028-02-29")).toBe("GB Accounts Company 2028-02-29 (Feb28) Excel 2007");
    expect(packageDirName("bst", "2028-04-05")).toBe("GB Accounts Basic Sole Trader 2028-04-05 (Apr28) Excel 2007");
    expect(packageDirName("se", "2027-04-05")).toBe("GB Accounts Self Employed 2027-04-05 (Apr27) Excel 2007");
    expect(packageDirName("taxi", "2025-04-05")).toBe("GB Accounts Taxi Driver 2025-04-05 (Apr25) Excel 2007");
  });

  it("names the report reconcile.js writes for a scenario run", () => {
    expect(reportFileName("ltd", "2027-10-31", "ltd-brickwork-pro-vat")).toBe(
      "GB_Accounts_Company_2027_10_31__Oct27__Excel_2007_ltd-brickwork-pro-vat.md",
    );
    expect(reportFileName("se", "2028-04-05", "se-scenario-advanced")).toBe(
      "GB_Accounts_Self_Employed_2028_04_05__Apr28__Excel_2007_se-scenario-advanced.md",
    );
  });
});

describe("scenariosOf", () => {
  it("reconciles the featured scenario first, then every scenario the pinned checks read", () => {
    expect(scenariosOf("ltd")).toEqual(["ltd-scenario-full", "ltd-brickwork-pro-nonvat", "ltd-brickwork-pro-vat"]);
    expect(scenariosOf("bst")).toEqual(["bst-scenario-basic", "bst-brickwork-pro-nonvat", "bst-sp-sixty"]);
    expect(scenariosOf("se")).toEqual(["se-scenario-advanced", "se-brickwork-pro-nonvat", "se-brickwork-pro-vat"]);
    expect(scenariosOf("taxi")).toEqual(["taxi-scenario-basic", "taxi-scenario-sp-sixty"]);
  });
});

describe("latestTarget", () => {
  const root = "/repo";

  it("copies the populated folder of a multi-file product to its example folder", () => {
    expect(latestTarget("ltd", "2027-12-31", root)).toEqual({
      populated: "/repo/reports/populated/GB_Accounts_Company_2027_12_31__Dec27__Excel_2007_ltd-scenario-full",
      exampleDir: "/repo/examples/ltd-latest",
      dest: "/repo/examples/ltd-latest",
    });
    expect(latestTarget("se", "2028-04-05", root)).toEqual({
      populated: "/repo/reports/populated/GB_Accounts_Self_Employed_2028_04_05__Apr28__Excel_2007_se-scenario-advanced",
      exampleDir: "/repo/examples/se-latest",
      dest: "/repo/examples/se-latest",
    });
  });

  it("copies the populated workbook of a single-file product under its fixed name", () => {
    expect(latestTarget("bst", "2028-04-05", root)).toEqual({
      populated: "/repo/reports/populated/GB_Accounts_Basic_Sole_Trader_2028_04_05__Apr28__Excel_2007_bst-scenario-basic.xlsx",
      exampleDir: "/repo/examples/bst-latest",
      dest: "/repo/examples/bst-latest/GB_Accounts_Basic_Sole_Trader.xlsx",
    });
    expect(latestTarget("taxi", "2028-04-05", root)).toEqual({
      populated: "/repo/reports/populated/GB_Accounts_Taxi_Driver_2028_04_05__Apr28__Excel_2007_taxi-scenario-basic.xlsx",
      exampleDir: "/repo/examples/taxi-latest",
      dest: "/repo/examples/taxi-latest/GB_Accounts_Taxi_Driver.xlsx",
    });
  });
});

describe("replacedReports", () => {
  it("removes the extra scenarios' reports at the old year-end and keeps the featured history", () => {
    expect(replacedReports("ltd", "2027-10-31", "2027-12-31")).toEqual([
      "GB_Accounts_Company_2027_10_31__Oct27__Excel_2007_ltd-brickwork-pro-nonvat.md",
      "GB_Accounts_Company_2027_10_31__Oct27__Excel_2007_ltd-brickwork-pro-vat.md",
    ]);
  });

  it("removes nothing when the year-end has not moved", () => {
    expect(replacedReports("taxi", "2027-04-05", "2027-04-05")).toEqual([]);
  });
});

describe("parseArgs", () => {
  it("reads the product", () => {
    expect(parseArgs(["--product", "se"])).toEqual({ product: "se" });
  });

  it("refuses a missing or unknown product", () => {
    expect(() => parseArgs([])).toThrow(/Usage/);
    expect(() => parseArgs(["--product", "payslip"])).toThrow(/Unknown product "payslip"/);
  });
});

describe("pinned.json writer", () => {
  it("sets one product's year-end and build date and leaves the others", () => {
    const dir = mkdtempSync(join(tmpdir(), "refresh-pinned-"));
    const path = join(dir, "pinned.json");
    writeFileSync(path, formatPinned(PINNED));

    writePinned(withPin(readPinned(path), "ltd", "2027-12-31", "2026-11-15"), path);

    expect(readPinned(path)).toEqual({ ...PINNED, ltd: { yearEnd: "2027-12-31", built: "2026-11-15" } });
    expect(readFileSync(path, "utf8")).toBe(
      [
        "{",
        '  "ltd": { "yearEnd": "2027-12-31", "built": "2026-11-15" },',
        '  "bst": { "yearEnd": "2027-04-05", "built": "2026-11-14" },',
        '  "se": { "yearEnd": "2027-04-05", "built": "2026-11-14" },',
        '  "taxi": { "yearEnd": "2027-04-05", "built": "2026-11-13" }',
        "}",
        "",
      ].join("\n"),
    );
  });

  it("refuses a product the file does not pin", () => {
    expect(() => withPin(PINNED, "payslip", "2028-04-05", "2026-11-15")).toThrow(/no pinned entry/);
  });
});
