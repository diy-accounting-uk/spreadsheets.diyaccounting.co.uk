// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// guide.js — Generate PDF user guide from markdown template using md-to-pdf.

import { mdToPdf } from "md-to-pdf";

export async function generatePdf(markdownPath, outputPath) {
  const pdf = await mdToPdf(
    { path: markdownPath },
    {
      dest: outputPath,
      pdf_options: {
        format: "A4",
        margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
        printBackground: true,
      },
      css: `
        body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.4; }
        h1 { color: #2c3e50; border-bottom: 2px solid #008080; padding-bottom: 6px; }
        h2 { color: #008080; margin-top: 1.5em; }
        h3 { color: #34495e; }
        table { border-collapse: collapse; width: 100%; margin: 1em 0; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 10pt; }
        th { background-color: #f5f5f5; }
      `,
    },
  );

  if (!pdf) {
    throw new Error(`PDF generation returned empty result for ${markdownPath}`);
  }
}
