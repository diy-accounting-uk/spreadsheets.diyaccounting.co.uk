// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// guide.js — Generate PDF user guide from markdown template.
// Uses pandoc (pre-installed on GitHub Actions runners, `brew install pandoc` on macOS).

import { execSync } from "child_process";
import { existsSync } from "fs";

export async function generatePdf(markdownPath, outputPath) {
  if (!existsSync(markdownPath)) {
    throw new Error(`Markdown file not found: ${markdownPath}`);
  }

  execSync(
    `pandoc "${markdownPath}" -o "${outputPath}" -V geometry:margin=20mm --pdf-engine=pdflatex`,
    { stdio: "pipe" },
  );
}
