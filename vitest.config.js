// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// vitest.config.js
import { defineConfig } from "vitest/config";

const env = process.env;

export default defineConfig({
  test: {
    env,
    // Measured on the LibreOffice-gated files: serial 272s, two workers 150s,
    // four 145s, eight 146s, all green at every setting. Four sits above CI's
    // effective three and inside the six concurrent recalculations the
    // experiment actually proved. Setting it here means nobody has to pass a
    // flag and CI and local agree instead of each inheriting its own core count.
    maxWorkers: Number(process.env.VITEST_MAX_WORKERS || 4),
    projects: [
      {
        test: {
          name: "unit-tests",
          environment: "node",
          include: ["web/unit-tests/*.test.js", "app/test/*.test.js", "app/test/**/*.test.js"],
          outputFile: "./target/test-results/vitest-results.json",
        },
      },
    ],
  },
});
