// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// build-provenance-data.test.js — differsOnlyByEngineVersion is the pure
// check scripts/build-provenance-data.mjs uses to decide whether a freshly
// computed provenance-data.js is worth writing: a plain local re-run whose
// only difference from the committed file is engineVersion's value (this
// checkout's own installed diya-gl version or commit, not an engine, tax
// data or template change) leaves the committed file alone rather than
// dirtying the tree for a push .githooks/pre-push then refuses.

import { describe, it, expect } from "vitest";
import { differsOnlyByEngineVersion } from "../../scripts/build-provenance-data.mjs";

function source(engineVersion, taxDataHash) {
  return ["export const PROVENANCE_DATA = {", `  engineVersion: "${engineVersion}",`, `  taxDataHash: "${taxDataHash}",`, "};", ""].join(
    "\n",
  );
}

describe("differsOnlyByEngineVersion", () => {
  it("is true when engineVersion is the only line that changed", () => {
    const before = source("1.2.34+aaaaaaaaaa", "deadbeefcafe");
    const after = source("1.2.35+bbbbbbbbbb", "deadbeefcafe");
    expect(differsOnlyByEngineVersion(before, after)).toBe(true);
  });

  it("is false when a field other than engineVersion also changed", () => {
    const before = source("1.2.34+aaaaaaaaaa", "deadbeefcafe");
    const after = source("1.2.35+bbbbbbbbbb", "0000000000000");
    expect(differsOnlyByEngineVersion(before, after)).toBe(false);
  });

  it("is false when the two texts are identical, engineVersion included", () => {
    const text = source("1.2.34+aaaaaaaaaa", "deadbeefcafe");
    expect(differsOnlyByEngineVersion(text, text)).toBe(false);
  });

  it("is false when only taxDataHash changed and engineVersion held steady", () => {
    const before = source("1.2.34+aaaaaaaaaa", "deadbeefcafe");
    const after = source("1.2.34+aaaaaaaaaa", "0000000000000");
    expect(differsOnlyByEngineVersion(before, after)).toBe(false);
  });
});
