// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// build-picker-api-key.test.js — withPickerApiKey is the writer
// scripts/build-picker-api-key.mjs uses to put the Google Picker API key into
// cloud-config.js at deploy time.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { withPickerApiKey } from "../../scripts/build-picker-api-key.mjs";

const committed = readFileSync(resolve(__dirname, "../../web/diya-gl.co.uk/public/cloud-config.js"), "utf8");

describe("withPickerApiKey", () => {
  it("writes the key into googlePickerApiKey", () => {
    expect(withPickerApiKey(committed, "AIzaTestKey123")).toContain('googlePickerApiKey: "AIzaTestKey123",');
  });

  it("leaves every other byte of the file unchanged", () => {
    const written = withPickerApiKey(committed, "AIzaTestKey123");
    expect(written.replace('googlePickerApiKey: "AIzaTestKey123",', 'googlePickerApiKey: "",')).toBe(committed);
  });

  it("refuses an empty, blank or missing key", () => {
    for (const key of ["", "   ", undefined]) {
      expect(() => withPickerApiKey(committed, key)).toThrow(/unset or empty/);
    }
  });

  it("refuses a file with no googlePickerApiKey line", () => {
    expect(() => withPickerApiKey("var config = {};\n", "AIzaTestKey123")).toThrow(/no `googlePickerApiKey/);
  });
});
