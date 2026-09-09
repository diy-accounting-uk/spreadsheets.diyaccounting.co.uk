<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# Licensing

Copyright (C) 2006-2026 DIY Accounting Limited.

Source: https://github.com/diy-accounting-uk/spreadsheets.diyaccounting.co.uk

The spreadsheets are free to use, the source is available, and the diya-gl format is an open
specification. This page says which licence covers which file.

## The three layers

| Layer | What it covers | Licence |
| --- | --- | --- |
| The specification | The diya-gl format text and the two JSON Schemas | `CC-BY-4.0` for the text, `Apache-2.0` for the schemas |
| The engine | The diya-gl npm package, its CLI, its MCP server and its image, plus the code they run | `Apache-2.0` |
| The original work and the hosted product | The spreadsheets, the templates, the build scripts, the web pages and the infrastructure | `LicenseRef-PolyForm-Internal-Use-1.0.0`, plus the additional grant in `LICENSE` |

Implement the diya-gl format in anything you like, with attribution. Embed the engine anywhere.
Download the spreadsheets and use them for your own accounts, or for your clients' accounts if you
are an accountant or a bookkeeper. Do not redistribute the spreadsheets, and do not run this site
or a renamed version of it as a service.

### Running on localhost is permitted use

PolyForm Internal Use permits use for your own and your company's internal business operations. Running
the npm package, the Docker image or a local copy of this site on your own machine to keep your own
books, or your clients' books, is exactly that. What the licence does not permit is distributing the
software or the spreadsheets to other people, or hosting the product for others under any name.

## Where each layer applies

### Top-level directories

| Path | Layer |
| --- | --- |
| `app/bin/` | split, see below |
| `app/data/` | Apache-2.0 for the tax-year, filing and HMRC mapping data the engine reads at runtime |
| `app/lib/` | split, see below |
| `app/products/` | Apache-2.0 |
| `app/templates/` | PolyForm |
| `app/test/` | PolyForm |
| `behaviour-tests/` | PolyForm |
| `cdk-spreadsheets/` | PolyForm |
| `diya-gl/` | Apache-2.0 |
| `examples/` | PolyForm |
| `infra/` | PolyForm |
| `packages/` | PolyForm |
| `reports/` | PolyForm |
| `scripts/` | PolyForm |
| `web/spreadsheets.diyaccounting.co.uk/public/schema/*.schema.json` | Apache-2.0 |
| `web/spreadsheets.diyaccounting.co.uk/public/schema/diya-gl-docs.md` | CC-BY-4.0 |
| `web/spreadsheets.diyaccounting.co.uk/public/diya-gl.html` | CC-BY-4.0, written by its builder |
| `web/` (everything else) | PolyForm |
| `_developers/` | PolyForm; the HMRC material under `_developers/hmrc-references/` is Crown copyright, see below |
| `.claude/`, `.github/`, `.mvn/` | PolyForm; the Maven wrapper is Apache-2.0 third-party code |
| the root files | PolyForm |

### The engine boundary inside `app/`

The engine layer is drawn by the code, not by directory. The diya-gl package has four entry points:
`app/bin/export.js`, `app/bin/report.js`, `app/bin/write-workbook.js` and `app/bin/diya-gl-mcp.js`.
Everything those four import, directly or through another module, is Apache-2.0. That closure is
54 of the 61 modules in `app/lib`, all four modules in `app/products`, the runtime data in
`app/data` and the two published schemas.

The seven `app/lib` modules outside the closure are PolyForm:

`books-engine.js`, `compliance-report.js`, `guide.js`, `headlines.js`, `package-builder.js`,
`report-indicators.js`, `sitemap-builder.js`.

The twelve `app/bin` build scripts outside the closure are PolyForm:

`build-diya-gl-spec.js`, `build-packages.js`, `build-reconciliation-pages.js`, `build-sitemaps.js`,
`compliance-report.js`, `cross-package-reconciliation.js`, `extract-scenarios.js`, `generate.js`,
`judge-reconciliation.js`, `reconcile.js`, `verify-roundtrip.js`, `verify-stability.js`.

The workbook templates under `app/templates/` stay PolyForm and do not ship in the npm package or
the image. The package fetches the template it needs from
`https://spreadsheets.diyaccounting.co.uk/books/assets/templates/`, prints the PolyForm terms once,
and caches it. Holding a template that way is the same permitted use as downloading a package from
the site.

### Files that carry no comment

An `.xlsx`, `.docx`, `.pdf`, `.png` or `.json` file cannot carry an SPDX header. Each takes the layer
its directory takes in the table above. A generated spreadsheet package states its licence in the
`LICENCE.txt` inside the zip and in the workbook's own document properties.

## Third-party material

- **XBRL Global Ledger Taxonomy Framework 2015**, (c) XBRL International Inc., licensed for
  derivative works with attribution. The diya-gl field names use its semantics in a JSON and TOML
  surface syntax; no taxonomy XSD file is reproduced. The attribution in
  `web/spreadsheets.diyaccounting.co.uk/public/schema/diya-gl-docs.md` and in both schemas'
  descriptions is kept verbatim. Reference:
  http://www.xbrl.org/int/gl/2015-03-25/gl-framework-REC-2015-03-25.html
- **JSZip**, MIT, taken under the MIT side of its dual MIT or GPLv3 offer. A runtime dependency of
  the diya-gl package and compiled into the books bundle and the single-file runner.
- **smol-toml**, BSD-3-Clause. Same two places.
- **Ajv** and **ajv-formats**, MIT. The validator compiled into the books bundle is Ajv-generated
  code and carries the same licence.
- **Apache Maven Wrapper** (`mvnw`, `mvnw.cmd`, `.mvn/wrapper/maven-wrapper.properties`), Apache
  License 2.0, copyright the Apache Software Foundation.
- **HMRC-derived data**. The rates, thresholds, form layouts and box mappings under `app/data/`, and
  the reference material under `_developers/hmrc-references/`, come from HM Revenue & Customs
  publications. Crown copyright, used under the
  [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
- **PolicyBee logo**
  (`web/spreadsheets.diyaccounting.co.uk/public/images/policybee-logo.png`). Used under the partner
  arrangement with PolicyBee. Not licensed onward.

## SPDX identifiers

`Apache-2.0`, `CC-BY-4.0` and `LicenseRef-PolyForm-Internal-Use-1.0.0`. PolyForm Internal Use is not
on the SPDX list, and the additional grant makes the text bespoke, so the `LicenseRef` form points at
`LICENSE` as the text it names. A package manifest in the third layer reads `SEE LICENSE IN LICENSE`.
