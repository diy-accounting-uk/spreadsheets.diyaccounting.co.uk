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
import { dirname } from "path";
import { existsSync, statSync } from "fs";

export async function generatePdf(markdownPath, outputPath, sourceDateEpoch) {
  if (!existsSync(markdownPath)) {
    throw new Error(`Markdown file not found: ${markdownPath}`);
  }

  const epoch = sourceDateEpoch ?? Math.floor(statSync(markdownPath).mtimeMs / 1000);

  const resourcePath = dirname(markdownPath);
  execSync(`pandoc "${markdownPath}" -o "${outputPath}" --pdf-engine=weasyprint --resource-path="${resourcePath}" --embed-resources`, {
    stdio: "pipe",
    env: { ...process.env, SOURCE_DATE_EPOCH: String(epoch) },
  });
}
