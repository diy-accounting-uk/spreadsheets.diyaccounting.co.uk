// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// playwright.config.js
import { defineConfig } from "@playwright/test";

export default defineConfig({
  projects: [
    {
      name: "spreadsheetsBehaviour",
      testDir: "behaviour-tests",
      testMatch: ["**/spreadsheets.behaviour.test.js"],
      workers: 1,
      outputDir: "./target/behaviour-test-results/",
      timeout: 300_000,
    },
    {
      name: "browser-tests",
      testDir: "web/browser-tests",
      testMatch: [
        "**/spreadsheets-content.browser.test.js",
        "**/diya-gl-bst.browser.test.js",
        "**/diya-gl-bst-edits.browser.test.js",
        "**/diya-gl-warnings.browser.test.js",
        "**/diya-gl-row-editing.browser.test.js",
        "**/diya-gl-bundle-gate.browser.test.js",
        "**/diya-gl-pwa.browser.test.js",
        "**/diya-gl-runner.browser.test.js",
        "**/diya-gl-save.browser.test.js",
        "**/diya-gl-donation.browser.test.js",
        "**/diya-gl-cloud.browser.test.js",
        "**/diya-gl-measurement.browser.test.js",
        "**/diya-gl-empty-state.browser.test.js",
        "**/diya-gl-deep-links.browser.test.js",
        "**/diya-gl-render-coverage.browser.test.js",
        "**/diya-gl-equivalence.browser.test.js",
        "**/diya-gl-layouts.browser.test.js",
        "**/diya-gl-headlines.browser.test.js",
        "**/diya-gl-formats.browser.test.js",
        "**/diya-gl-shell.browser.test.js",
        "**/diya-gl-se.browser.test.js",
        "**/diya-gl-se-equivalence.browser.test.js",
        "**/diya-gl-se-formats.browser.test.js",
        "**/diya-gl-se-edits.browser.test.js",
        "**/diya-gl-se-layouts.browser.test.js",
        "**/diya-gl-ltd-page.browser.test.js",
        "**/diya-gl-ltd-forms.browser.test.js",
        "**/diya-gl-ltd-deep-links.browser.test.js",
        "**/diya-gl-ltd-equivalence.browser.test.js",
        "**/diya-gl-ltd-render-coverage.browser.test.js",
        "**/diya-gl-ltd-layouts.browser.test.js",
        "**/diya-gl-ltd-formats.browser.test.js",
        "**/diya-gl-taxi-equivalence.browser.test.js",
        "**/diya-gl-taxi-formats.browser.test.js",
        "**/diya-gl-taxi-edits.browser.test.js",
        "**/diya-gl-taxi-layouts.browser.test.js",
        "**/diya-gl-taxi-forms.browser.test.js",
        "**/diya-gl-taxi-takings.browser.test.js",
        "**/diya-gl-taxi-views.browser.test.js",
        "**/diya-gl-ltd-edits.browser.test.js",
        "**/diya-gl-ltd-warnings.browser.test.js",
      ],
      workers: 1,
      outputDir: "./target/browser-test-results/",
    },
  ],

  // Output directory for all artifacts (screenshots, videos, traces, etc.)
  outputDir: "./target/test-results/",

  // Don't delete the output directory before running tests
  preserveOutput: "always",

  use: {
    // Save a video for every test
    video: {
      mode: "on",
      size: { width: 1280, height: 1446 },
    },
    // Match viewport to video size so screenshots and recordings align
    viewport: { width: 1280, height: 1446 },
    // Screenshot options
    screenshot: "on",

    // Enable detailed logging
    trace: "on",
  },

  reporter: [
    [
      "html",
      {
        outputFolder: "target/test-reports/html-report",
        open: "never",
      },
    ],
    ["list"],
  ],

  // Default test timeout
  timeout: 120_000,
});
