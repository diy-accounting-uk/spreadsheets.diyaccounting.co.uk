// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

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
          include: ["web/unit-tests/*.test.js", "app/test/*.test.js"],
          outputFile: "./target/test-results/vitest-results.json",
        },
      },
    ],
  },
});
