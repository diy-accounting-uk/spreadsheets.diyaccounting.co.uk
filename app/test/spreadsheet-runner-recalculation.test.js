// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// spreadsheet-runner-recalculation.test.js — Proves the xls roundtrip refuses
// to hand back a workbook it did not recalculate.
//
// LibreOffice exits 0 and writes nothing when it declines to convert, which it
// does when another instance holds the profile or the document fails to load.
// The input file then sits where the output belongs, and reading it back
// returns the shipped cached values: Profit Forecast C40 comes back as the
// full personal allowance and the tax rows below it as nil, which reads as a
// tax-data defect rather than the failed recalculation it is.
//
// The stubs here stand in for soffice, so the test needs no LibreOffice.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { xslRoundtrip } from "../lib/spreadsheet-runner.js";

// A shell stub that reads the same arguments soffice is given and writes
// whichever legs of the roundtrip it has been told to write.
const ARG_SCAN = `fmt=""
outdir=""
src=""
while [ $# -gt 0 ]; do
  case "$1" in
    --convert-to) fmt="$2"; shift 2 ;;
    --outdir) outdir="$2"; shift 2 ;;
    -*) shift ;;
    *) src="$1"; shift ;;
  esac
done`;

const WRITE_XLS = `if [ "$fmt" = "xls" ]; then printf recalculated > "$outdir/$(basename "$src" .xlsx).xls"; fi`;
const WRITE_XLSX = `if [ "$fmt" = "xlsx" ]; then printf recalculated > "$outdir/$(basename "$src" .xls).xlsx"; fi`;

describe("the xls roundtrip insists on the workbook it was asked to recalculate", () => {
  let workDir;
  let xlsxPath;
  const profile = "file:///tmp/unused-profile";

  function stub(name, body) {
    const path = join(workDir, name);
    writeFileSync(path, `#!/bin/sh\n${ARG_SCAN}\n${body}\nexit 0\n`, { mode: 0o755 });
    return path;
  }

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "xls-roundtrip-"));
    xlsxPath = join(workDir, "input.xlsx");
    writeFileSync(xlsxPath, "as shipped");
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it("throws when the converter writes nothing", () => {
    const soffice = stub("silent.sh", "");
    expect(() => xslRoundtrip(soffice, profile, workDir, xlsxPath)).toThrow(/wrote no input\.xls:/);
  });

  it("throws when the converter writes the xls but no xlsx back", () => {
    const soffice = stub("xls-only.sh", WRITE_XLS);
    expect(() => xslRoundtrip(soffice, profile, workDir, xlsxPath)).toThrow(/wrote no input\.xlsx back from input\.xls/);
  });

  it("replaces the input with the recalculated workbook", () => {
    const soffice = stub("both.sh", `${WRITE_XLS}\n${WRITE_XLSX}`);
    xslRoundtrip(soffice, profile, workDir, xlsxPath);
    expect(readFileSync(xlsxPath, "utf8")).toBe("recalculated");
  });

  it("throws when a previous round's xls is the only one on disk", () => {
    xslRoundtrip(stub("both.sh", `${WRITE_XLS}\n${WRITE_XLSX}`), profile, workDir, xlsxPath);
    expect(existsSync(join(workDir, "input.xls"))).toBe(true);

    const soffice = stub("silent.sh", "");
    expect(() => xslRoundtrip(soffice, profile, workDir, xlsxPath)).toThrow(/wrote no input\.xls:/);
  });
});
