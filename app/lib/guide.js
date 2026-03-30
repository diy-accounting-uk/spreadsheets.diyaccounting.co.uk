// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// guide.js — Generate PDF user guide from markdown template.
// Uses pandoc + weasyprint. Install: `brew install pandoc` and `pip install weasyprint`.
//
// SOURCE_DATE_EPOCH is set for reproducible PDF output:
//   - Default: mtime of the markdown source file
//   - Override: pass sourceDateEpoch parameter (e.g. git commit timestamp)

import { execSync } from "child_process";
import { dirname, resolve } from "path";
import { existsSync, statSync } from "fs";

export async function generatePdf(markdownPath, outputPath, sourceDateEpoch) {
  if (!existsSync(markdownPath)) {
    throw new Error(`Markdown file not found: ${markdownPath}`);
  }

  const epoch = sourceDateEpoch ?? Math.floor(statSync(markdownPath).mtimeMs / 1000);

  // Resolve to absolute paths so they work regardless of cwd
  const absMd = resolve(markdownPath);
  const absOut = resolve(outputPath);
  const mdDir = dirname(absMd);

  // Run pandoc from the markdown's directory so relative image paths (e.g. screenshots/home.png) resolve naturally
  execSync(`pandoc "${absMd}" -o "${absOut}" --pdf-engine=weasyprint`, {
    cwd: mdDir,
    stdio: "pipe",
    env: { ...process.env, SOURCE_DATE_EPOCH: String(epoch) },
  });
}
