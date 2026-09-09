// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// vitest.config.js
import { defineConfig } from "vitest/config";

const env = process.env;

export default defineConfig({
  test: {
    env,
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
