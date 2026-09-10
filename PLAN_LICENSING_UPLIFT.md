<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# PLAN: the licensing and copyright uplift

Status: approved, go given 2026-09-09. Urgency 1 is code complete on PR #86 and the four
sibling-repository PRs (tap #1, root #28, www #27, archive #31); LU-9 follows the merges.
The brand is `PLAN_DIYACCOUNTING_BRAND.md`: one source for the marks and tokens, the trade mark
filings, and `diyaccounting.com`. The domain registrations and the HMRC licence note went to
`PLAN_DIYA_GL_LAUNCH.md`. What is left here is the licence change itself, which shipped.
LU-20, the tap rename, is done: the repository is `diy-accounting-uk/homebrew-diya-gl`, its README
carries the new name, and no reference to the old one survives in this repository or in Submit.
The cross-repository section is filled from a read-only audit of all six repositories; the review
of 2026-09-08 (section "Review") re-checked every row against the trees with eight search agents
and corrected what it found.

## User assertions (verbatim)

- "The spreadsheets are the original work, what we have now in the generator is a templated version
  of a hand build spreadsheets package, you can tell this because the templates have all sorts of
  wierd shit in. This should be protected within the extend of AGPL and I want a general uplift on
  licensing and copywright before I increase exposure."
- "do I have to invite contibutions, I don't really want them. The source is viewable (open) but
  otherwise restricted."
- "I would like anyone to be able to download spreadsheets or use the hosted solution, but I don't
  want to someone to distribute the spreadsheets themselves or run my websites on their own brand."
- "so it's ok if the public hostname prod remains diyaccounting.co.uk so hosting unmodified would
  mean either being under my dns or violating my making a change but running localhost is fine."
- "I want people to be able to run the npm and docker locally for their own accounts, I would also
  like other people to be able to use the diya-gl specification freely."
- "My goal here is to maximse DIY Accounting Submit users, which then has paid tiers so this is
  valuable "bank exporters, agents and accountants' tools" anyone wiuth diya-gl will soon be able to
  file via DIY Accounting Submit and a forthcoming mcp extended by a bank would then have a way for
  customers to file via DIY Accounting Submit via the diy shipped bits in the foundational mcp."
- "Yes write PLAN_LICENSING_UPLIFT.md then review considering the scope of all of these
  repositories ... and feed back into this chat and PLAN_LICENSING_UPLIFT.md the full license
  uplift."

## The model

Three layers, chosen so the engine travels as far as possible (every embedded copy is a book that
files through Submit) while the original work and the hosted brand stay the company's.

| Layer | What it covers | Licence | Effect |
| --- | --- | --- | --- |
| The specification | The diya-gl format text: the built `diya-gl.html` and `public/schema/diya-gl-docs.md`; the two JSON schemas | CC BY 4.0 for the text; Apache-2.0 for the schemas | Anyone implements the format in anything, with attribution. The page builder `app/bin/build-diya-gl-spec.js` is code and takes the code layer around it; the page it emits carries the CC BY notice. |
| The engine | `diya-gl/` (npm package, CLI, MCP server, Docker image, the Homebrew tap) and the code the package runs: the import closure of its four entry points, see "The engine boundary" | Apache-2.0 | Embeddable anywhere without legal review; the patent grant and the NOTICE file keep the company's attribution in every copy. |
| The original work and the hosted product | The spreadsheets and their packages, `app/templates/`, the build scripts and every `app/lib` module outside the closure, the web pages and sites, Submit, the infrastructure | PolyForm Internal Use 1.0.0 plus one additional grant | Download and use for your own accounts, or your clients' accounts if you are an accountant. No redistribution. No hosting, and no hosting of a modified version under another name. Running on localhost is permitted use. |

The additional grant, one sentence, permits an accountant or bookkeeper to use the spreadsheets to
prepare accounts for their clients. It is bespoke; the operator publishes it on the plain text without a legal read. The recommendation that accountants are permitted users rests on each client being a
prospective Submit user; the operator confirmed it on 2026-09-09.

SPDX identifiers: `Apache-2.0`, `CC-BY-4.0`, and `LicenseRef-PolyForm-Internal-Use-1.0.0` for the
third layer. PolyForm Internal Use is not on the SPDX list and the additional grant makes the text
bespoke, so the `LicenseRef` form is the correct one and `LICENSE` is the text it refers to. Package
manifests that carry the third layer say `SEE LICENSE IN LICENSE`.

### The engine boundary

The engine layer is defined by the code, not by directory. The npm package's four entry points are
`app/bin/export.js`, `app/bin/report.js`, `app/bin/write-workbook.js` and `app/bin/diya-gl-mcp.js`
(wrapped by `diya-gl/bin/*`). Their import closure, traced on 2026-09-08, is 54 of the 61 modules
in `app/lib`, all of `app/products`, and the runtime data in `app/data` and the two schemas. The
closure includes `generator.js`, `product-workbook.js`, `xlsx-exporter.js`, `template-formula-map.js`
and `spreadsheet-runner.js`: the workbook writer is engine code. The seven `app/lib` modules
outside the closure (`compliance-report.js`, `guide.js`, `package-builder.js`, `report-indicators.js`,
`sitemap-builder.js`, `books-engine.js`, `headlines.js`) and the twelve build scripts in `app/bin`
(`build-packages.js`, `build-sitemaps.js`, `build-diya-gl-spec.js`, `build-reconciliation-pages.js`,
`compliance-report.js`, `cross-package-reconciliation.js`, `extract-scenarios.js`, `generate.js`,
`judge-reconciliation.js`, `reconcile.js`, `verify-roundtrip.js`, `verify-stability.js`) are the
third layer. LU-3's header test computes the closure and fails on a header that disagrees with it;
LU-8d's `prepack.mjs` copies the closure and nothing else, in place of today's whole-directory copy
of `app/lib`, `app/bin`, `app/products`, `app/data` and `app/templates`.

The templates are the one thing the closure needs and the model forbids. `write-workbook` and the
MCP save tool read `app/templates/<product>/*.xlsx` and `meta.toml` through `app-resources.js`, and
`prepack.mjs` ships them today, so npm 1.0.0 to 1.0.3 and the images distributed the hand-built
workbooks under the AGPL. How the Apache package writes a workbook without carrying PolyForm
content is decision 7, taken on 2026-09-09; the recommendation is that the package fetches the templates at
first use from `spreadsheets.diyaccounting.co.uk`, where the DIYA-GL pages already serve them under
`books/assets/templates/`, caches them locally and prints the PolyForm terms once. The user then
holds the templates under the same terms as a download, which is exactly the permitted use, and the
package stays pure Apache-2.0.

Copyright line everywhere: `Copyright (C) 2006-2026 DIY Accounting Limited`, the company's standard
way of writing its name. The site says "since 2006"; no individual is named in the notices. Today's
variants, all replaced: `2026 DIY Accounting Ltd` (spreadsheets 324, archive 18, submit 1),
`2025-2026 DIY Accounting Ltd` (submit 704, spreadsheets 38, www 28, root 24, archive 24), two with a
trailing full stop, and root's `SPDX-FileCopyrightText: 2025 DIY Accounting Limited` in
`deploy-holding.yml`.

The protection of the funnel is not in the engine's licence. Filing lands on Submit's servers, which
alone hold the HMRC credentials, the recognition and the billing. The engine's licence is chosen to
travel; the spreadsheets' licence is chosen to stay.

### What has already been granted, and what the change does not do

The record, from the registries and the git histories on 2026-09-08:

- npm `@diy-accounting-uk/diya-gl` 1.0.0, 1.0.1, 1.0.2 and 1.0.3, all published 2026-09-08 between
  01:48 and 20:14 UTC, `license: AGPL-3.0-only`, no deprecation. Each tarball holds `app/lib`,
  `app/bin`, `app/products`, `app/data`, the two schemas and `app/templates` (every xlsx, every
  `meta.toml`, the dividend voucher docx), so the hand-built workbooks went out under the AGPL four
  times. No other package exists under the scope.
- GHCR `ghcr.io/diy-accounting-uk/diya-gl` tags 1.0.1, 1.0.2, 1.0.3 and `latest` (pointing at 1.0.3),
  created 2026-09-08; the 1.0.0 tag is not in the registry. The Dockerfile labels the image
  `AGPL-3.0-only` and points `image.source` at the spreadsheets repository.
- The tap wrote `Formula/diya-gl.rb` for 1.0.0, 1.0.1, 1.0.2 and 1.0.3 on 2026-09-08, each with
  `license "AGPL-3.0-only"`, hardcoded in `scripts/update-formula.sh`.
- The spreadsheets repository, and the archive which shares its history to the split, carried the
  Mozilla Public License 2.0 from the first commit on 2022-12-09 until 2026-02-21 and the AGPL-3.0-only
  text from 2026-02-22 (`eec9ca6`). Every workbook committed under `packages/` (first commit
  2026-02-22, 1,575 files today) and every zip served from S3 has been AGPL by the repository's
  `LICENSE`; none carries licence text of its own. The archive's `packages-archive/` tree (6,684
  files, GB Accounts 2006-07 to 2026-27 plus IE Accounts 2007 to 2009), its `packages/` (821),
  `packages-published/` (1,575, 2020-21 to 2027-28, cut 2026-09-02) and `packages-generated/` (12)
  have been public under MPL 2.0 and then AGPL. No GitHub release exists in any repository.
- Submit has carried a twenty-line AGPL paraphrase; its images go only to private ECR. Root and www
  carry the AGPL text and publish nothing.

Copies already taken keep the terms they were taken under. The MPL and AGPL grants on the archive's
trees are the widest the operator has made and cannot be recalled; the change restricts every copy
taken after it lands. Moving the engine to Apache-2.0 relaxes; moving the spreadsheets, sites and
Submit to PolyForm restricts, from the first generate run and deploy after this plan lands.

Recommendation on the published engine versions, taken as decision 10: deprecate 1.0.0 to 1.0.3 on npm
(`npm deprecate "@diy-accounting-uk/diya-gl@<1.1.0" "Superseded by 1.1.0 under Apache-2.0; see
https://spreadsheets.diyaccounting.co.uk/diya-gl.html#licence"`) so every installer sees the
message; do not unpublish, which recalls nothing. Delete the 1.0.1 to 1.0.3 GHCR tags once the
Apache image is pushed, since GHCR has no deprecation and the images carry the templates. The tap's
formula history stays; git history is not a distribution channel.

Words: the site, the package READMEs and the launch posts say "free to use, source available, open
specification". They never say "open source" of the company's own work. "Open source" stays where
it describes someone else's thing (MCP on Submit's `mcp.html`).

## Decisions

All ten decisions are taken: 1 to 6 on 2026-09-08 and confirmed on 2026-09-09, 7 to 10 on
2026-09-09, each on the recommendation. No solicitor reads the grant or the trademark notice; the
operator publishes on the plain text. The brand work is `PLAN_DIYACCOUNTING_BRAND.md`.
The go for urgency 1 was given on 2026-09-09 for the board; the work starts in a fresh session.

1. The three layers as tabled, with the engine boundary drawn by the import closure.
2. Accountants preparing clients' accounts are permitted users of the spreadsheets.
3. No contributions are accepted; the README says so; no CLA or DCO is needed.
4. The copyright span 2006-2026 and the company as the only named holder.
5. The company name is written **DIY Accounting Limited** everywhere: headers, copyright lines,
   footers, JSON-LD, READMEs, manifests. "DIY Accounting Ltd" and bare "DIY Accounting" as the legal
   name go; bare "DIY Accounting" survives only as the brand in titles and `og:site_name`.
6. The archive stays public and is relicensed to match (decided 2026-09-08).
7. **Decided:** the package fetches the templates from the site at first use under PolyForm and caches them. How the Apache package writes a workbook without shipping the templates. (a) Recommended: the
   package fetches the templates from the site at first use under the PolyForm terms and caches
   them; `prepack.mjs` stops shipping `app/templates`. (b) The package keeps shipping the templates
   under their own `dist/app/templates/LICENSE`; `diya-gl/package.json` then reads
   `SEE LICENSE IN LICENSE`, the tap and the image carry a compound expression, and the "embeddable
   without legal review" effect is lost. (c) `write-workbook` and the MCP save tool leave the
   package and workbooks are written only on the site; bank tools then read and recalculate but
   cannot produce a workbook. The rows follow (a); (b) or (c) rewrites LU-8d and LU-4.
8. **Decided: no, one pipeline.** Whether the Docker image gets its own repository. Recommendation: not now, see "The Docker
   image" in the review section. The rows follow the recommendation; no repository is created.
9. **Decided: send the one-paragraph update.** Whether to tell HMRC. Submit's MTD approval submission and production-credentials email
   (`_developers/hmrc/HMRC_MTD_API_APPROVAL_SUBMISSION.md:134,143,666,812`,
   `HMRC_PRODUCTION_CREDENTIALS_EMAIL.md:57`) described the service as AGPL open source. If the
   operator treats those as representations HMRC relied on, H-LU-9 sends a one-paragraph update to
   the SDS team; if not, the documents are annotated and nothing is sent.
10. **Decided: yes.** Deprecate npm 1.0.0 to 1.0.3 and delete the three old GHCR tags, per the recommendation above.

Decided 2026-09-08: the tap repository is renamed `homebrew-diya-gl`, so the install line becomes
`brew install diy-accounting-uk/diya-gl/diya-gl` (LU-20, LU-17). It is still `homebrew-tap` today.

## Delivery groups, ranked by urgency

**Blocked on busy.** Every change to `submit.diyaccounting.co.uk` waits for the operator's word: group
1E (LU-8a), the Submit line of LU-18, the HMRC note (H-LU-9, which follows LU-8a), and Submit's
share of LU-15. Those rows are spelled out for a Submit session in
`../submit.diyaccounting.co.uk/PLAN_LICENSING_UPLIFT_SUBMIT.md` (rows S1 to S7, H-LU-9, LU-15),
which reports each landing back to this repository's inbox; decisions stay here. The other repositories proceed; LU-9 does not wait for Submit, since the engine
and the packages ship from this repository.

The rows keep their ids from the sections below. Each group is one wave of concurrent workstreams
by area; a group also sweeps up the less urgent rows that touch the same files, so no file is
opened twice. Urgency 1 stops the bleed before exposure grows; 2 protects the names; 3 consolidates.

### Urgency 1: the terms are right in every copy and on every page

Ships the first engine version under Apache-2.0, the first packages under PolyForm, and the words
that match, across all six repositories. Seven workstreams, no shared files between them.

| Group | Rows | Area and files | Sweeps up | Model |
| --- | --- | --- | --- | --- |
| 1A the engine and the licence files | LU-1, LU-2, LU-8d, LU-18, LU-19 | spreadsheets: `LICENSE`, `LICENSING.md`, `NOTICE`, `diya-gl/LICENSE`, `diya-gl/NOTICE`, `diya-gl/package.json`, `package.json`, `diya-gl/Dockerfile`, `diya-gl/scripts/prepack.mjs`, `app/lib/app-resources.js` (the template fetch), the schemas' `$comment`, `diya-gl/README.md`, `app/lib/mcp/server.js`, `diya-gl/bin/diya-gl.js` | the README's MPL and proprietary-history lines; the package test asserting no template ships; the `--version` line | Opus for the grant, `LICENSING.md` and the template fetch; Sonnet for the rest |
| 1B the public statement | LU-6, LU-11, LU-7, LU-17 (the install line) | spreadsheets: every `public/*.html`, `public/books/*.html`, `public/articles/*` (the two "Open Source" articles and their `.md` twins), the spec and reconciliation page builders, `README.md`, `TRADEMARKS.md`, `SECURITY.md`, `PLAN_DIYA_GL_LAUNCH.md`, `CONTEXT_LIMITED_COMPANY.md:755` | the company name in footers and JSON-LD; ™ on the marks; the no-contributions line; `download.html`'s AGPL notice block; the DIYA-GL pages' missing footer | Sonnet; Opus for the trademark text |
| 1C headers | LU-3 | spreadsheets: every comment-capable file per the coverage table; `app/test/licence-headers.test.js` | the 103 narrow-set gaps and the 474 wide-set gaps (149 html, 306 md, 15 yml, 4 xml); "Ltd" to "Limited"; the year span; the closure rule | Haiku for the sweep; Sonnet for the test and the closure |
| 1D the packages, workbooks and emitters | LU-4, LU-5 | spreadsheets: `app/bin/build-packages.js`, `app/lib/package-builder.js`, `scripts/build-books-bundle.mjs`, `scripts/build-runner.mjs`, `scripts/build-spreadsheets-redirects.cjs`, `app/bin/build-sitemaps.js`, `app/bin/build-reconciliation-pages.js` (the JSON), `app/bin/reconcile.js` (the Markdown reports), `app/lib/generator.js`, `app/lib/guide.js`, `app/templates/*/`, their tests | the five guide Markdown files' "Open Source" paragraphs, which become the shipped PDFs | Sonnet; the template line follows the reconciliation-bug method |
| 1E Submit (blocked on busy: the operator unblocks Submit at a quieter time) | LU-8a | submit: `LICENSE`, `LICENSING.md`, `NOTICE`, `package.json`, `README.md`, `web/public/terms.html`, `web/public/accessibility.html`, `web/public/lib/qrcode.min.js`, `infra/.../OpenApiGenerator.java`, `Dockerfile`, `_developers/backlog/battery-pack/`, `_developers/backlog/metric-son/`, `_developers/MARKETING_GUIDANCE.md`, `hmrc-fraud-prevention.md`, every header | the 28 `-or-later` headers, the battery-pack MIT `LICENSE` and badge, metric-son's `@license MIT`, the 88 narrow-set and 356 wide-set gaps, "Ltd" to "Limited" | Sonnet; Opus for the terms wording |
| 1F the archive, root and www | LU-8b, LU-8c | archive: `LICENSE`, `README.md`, `download.html`, `community.html`, `lib/community-page.js`, `package.json`, `package-lock.json`, `app/templates/meta.toml`, `app/templates/bst/bst-guide.md`, `infra/.../SpreadsheetsStack.java` tags, `favicon.svg`, one `LICENCE.txt` per package tree; root and www: `LICENSE`, `README.md`, `package.json`, the headers, www's two footers and a local `og:image` | the archive's `support-at-diyaccounting` scope in 17 places and `@antonycc` in its lock file, the 54 narrow-set and 323 wide-set archive gaps, root's 17 and www's 21 wide-set gaps, root's `-or-later` and `SPDX-FileCopyrightText` outlier, "Ltd" to "Limited" | Haiku |
| 1G the tap | LU-20, then LU-17 | homebrew-diya-gl: `LICENSE` (new), `README.md`, `scripts/update-formula.sh`, `.github/workflows/update-formula.yml`, `Formula/diya-gl.rb` (regenerated) | the hardcoded `license` line; the tap's own headers; the rename | Sonnet |

Then, once every group's PR is merged: LU-9, the first release under the new terms, with H-LU-3's
generate dispatches rebuilding every package.

### Urgency 2: the names

| Group | Rows | Area and files | Sweeps up | Model |
| --- | --- | --- | --- | --- |
| 2A the filing pack | LU-10 | `TRADEMARKS.md`, `_developers/trade-marks/` | the first-use evidence, the class wording, the series-rule check | Sonnet |

### Human rows across the groups

| # | Task | Gates |
| --- | --- | --- |
| H-LU-3 | Dispatch the four `generate-*` workflows after 1D merges, then the prod deploy | LU-9 |

## Task list

The rows in full. Machine rows are Sonnet unless the group table says otherwise.

| # | Task | Precursors | Model | Files |
| --- | --- | --- | --- | --- |
| LU-1 | The licence files: root `LICENSE` becomes PolyForm Internal Use 1.0.0 with the additional grant; `diya-gl/LICENSE` (Apache-2.0) and `diya-gl/NOTICE` (the company line plus the third-party lines LU-18 lists for the package); a `$comment` line in each schema naming Apache-2.0 and the XBRL attribution, since JSON Schema has that keyword and a sibling file does not travel with a fetched schema; `LICENSING.md` at the root mapping every directory to its layer by the closure rule, with the source offer, the copyright line, and the third-party section | — | Opus for the additional grant and `LICENSING.md`; Sonnet for the rest | `LICENSE`, `LICENSING.md`, `NOTICE`, `diya-gl/LICENSE`, `diya-gl/NOTICE`, `web/.../public/schema/*.schema.json` |
| LU-2 | Manifests and metadata: `license` in `diya-gl/package.json` (Apache-2.0) and the root `package.json` (`SEE LICENSE IN LICENSE`, the field is absent today); the Dockerfile's `org.opencontainers.image.licenses` to `Apache-2.0` plus `vendor`, `title`, `documentation` and `url` labels so the GHCR page reads right even though `image.source` points at a PolyForm repository; the CDK tags if any name a licence; `diya-gl/README.md`'s licence section. The tap is not automatic: `update-formula.sh` hardcodes the licence, so LU-17 owns it | LU-1 | Sonnet | `diya-gl/package.json`, `package.json`, `diya-gl/Dockerfile`, `infra/`, `diya-gl/README.md` |
| LU-3 | Headers: every comment-capable file carries `SPDX-License-Identifier` for its layer (`Apache-2.0` for `diya-gl/` and the import closure; `CC-BY-4.0` for `schema/diya-gl-docs.md`; `LicenseRef-PolyForm-Internal-Use-1.0.0` elsewhere) and `Copyright (C) 2006-2026 DIY Accounting Limited`. Extensions swept: js, mjs, cjs, java, sh, toml, yml, yaml, xml (after the declaration), html and svg (an HTML comment), md (an HTML comment on line 1, hidden when rendered), css, Dockerfile, properties. Excluded and listed in the test: the Maven wrapper (`mvnw`, `mvnw.cmd`, `maven-wrapper.properties`, Apache-2.0, third party), `LICENSE`, lock files, HMRC material under `_developers/hmrc-references/`, generated files whose emitter writes the header (`reports/*.md`, `public/reconciliation/*`, `public/diya-gl.html`, `public/sitemap.xml`). A unit test walks the tree, computes the closure from the four entry points, and fails on a missing, mismatched or old-name header | — | Haiku for the sweep; Sonnet for the test | every file in the spreadsheets coverage table marked "yes"; `app/test/licence-headers.test.js` (new) |
| LU-4 | Distributed copies carry their terms: the npm tarball ships `LICENSE` and `NOTICE` (automatic once LU-1 lands; `files` need not list them); every spreadsheet zip gains `LICENCE.txt` and `README.txt` (product, year, licence, copyright, source and download addresses) written into the package directory by `build-packages.js` before `zip -r`; `catalogue.toml` gains a header comment in `package-builder.js`; the engine bundle, `examples.js` and `build-stamp.js` start with a licence comment and `legalComments` becomes `"linked"` or the jszip and smol-toml notices are prepended by hand, since `"none"` strips them today; the single-file runner's provenance footer gains the licence and copyright line; the redirect CloudFront function's generated header names the licence; `sitemap.xml` gets a leading XML comment; the reconciliation and releases JSON files gain a `"license"` key; `reconcile.js` writes the header into each `reports/*.md`; the Docker image inherits the tarball's files | LU-1 | Sonnet | `app/bin/build-packages.js`, `app/lib/package-builder.js`, `scripts/build-books-bundle.mjs`, `scripts/build-runner.mjs`, `scripts/build-spreadsheets-redirects.cjs`, `app/bin/build-sitemaps.js`, `app/bin/build-reconciliation-pages.js`, `app/bin/reconcile.js`, their tests |
| LU-5 | The workbooks and guides state their copyright: the generator writes `dc:creator`, `dc:rights` and `cp:lastModifiedBy` into `docProps/core.xml` inside the same JSZip pass (it writes no `docProps` today; the shipped generate path skips LibreOffice, so the fields survive); the dividend voucher docx gets the same; `guide.js` passes `--metadata author="DIY Accounting Limited" --metadata rights=...` to pandoc so every guide PDF carries them; the five guide Markdown files (`bst-guide.md:384`, `se-guide.md:353`, `taxi-guide.md:337`, both `payslip-guide.md:141`) lose their "Open Source" paragraph and gain the licence line; each product's front sheet gains a licence and copyright line in the template; the reconciliation gates prove nothing else moved | LU-1 | Sonnet; the template edit follows the reconciliation-bug method | `app/lib/generator.js`, `app/lib/guide.js`, `app/templates/*/`, the fixtures' `report.json` if a cell moves |
| LU-6 | The public statement: the footer gains the licence and a source link on the eleven site pages that carry one, and a footer is added to the four `public/books/*.html` pages and the three probes, which have none; `download.html:91-99`'s AGPL notice block is rewritten; the spec page gets a licence section naming the three layers and the CC BY notice in its source comment; the JSON-LD blocks gain `license` and `copyrightHolder`; the two "Open Source" knowledge-base articles and their `.md` twins are rewritten; `README.md` lines 8-10, 17, 23 and 82 (MPL, "Open Source", "proprietary" history, AGPL) are rewritten to the new words; `PLAN_DIYA_GL_LAUNCH.md:53,61,115,535,543` and `CONTEXT_LIMITED_COMPANY.md:755` say the new words; every "open source" phrase about the company's work goes | — | Sonnet | `web/spreadsheets.diyaccounting.co.uk/public/*.html`, `public/books/*.html`, `public/articles/` (four files), `app/bin/build-diya-gl-spec.js`, `app/bin/build-reconciliation-pages.js`, `README.md`, `PLAN_DIYA_GL_LAUNCH.md`, `CONTEXT_LIMITED_COMPANY.md` |
| LU-7 | The names and the door: `TRADEMARKS.md` (DIY Accounting and DIYA-GL are not licensed; no use to market modified versions); the README's "this repository does not accept contributions" line; `SECURITY.md` with the disclosure address | — | Opus for the trademark text | `TRADEMARKS.md`, `README.md`, `SECURITY.md` |
| LU-8 | The other repositories, per the audit below | LU-1 | per row | see "Across the repositories" |
| LU-9 | The first release under the new terms (Submit's row is not a precursor): `diya-gl/package.json` and the root are bumped to 1.1.0 before the merge so "1.1.0 and later are Apache-2.0" is the statement everywhere; the next prod deploy publishes 1.1.0 and pushes the image; the tap's hourly run writes the Apache formula from LU-17's script; the generate dispatches (H-LU-3) rebuild every package with `LICENCE.txt` and the workbook properties; the releases page entry records the licence; the npm deprecations and GHCR deletions of decision 10 follow the publish | LU-2, LU-3, LU-4, LU-5, LU-6, LU-8d, LU-17, LU-19, H-LU-3 | Sonnet, verification only | none new |
| LU-17 | The tap: `LICENSE` (Apache-2.0, the engine's layer, so the formula can be copied as the engine can); `README.md`'s licence paragraph and both install lines follow the rename; `scripts/update-formula.sh` reads `license` from the registry JSON it already fetches, fails if the value is not a bare SPDX identifier, and writes it into the heredoc in place of the hardcoded line, with an SPDX comment above the class so every generated formula carries a header; headers on the script and the workflow; the formula is regenerated by hand once so the tap does not wait for the 1.1.0 tarball to change; the install line in `app/bin/build-diya-gl-spec.js:571` and the package README read `brew install diy-accounting-uk/diya-gl/diya-gl` in group 1B's PR | LU-20, LU-1 | Sonnet | homebrew-diya-gl: `LICENSE`, `README.md`, `scripts/update-formula.sh`, `.github/workflows/update-formula.yml`, `Formula/diya-gl.rb`; spreadsheets: `app/bin/build-diya-gl-spec.js`, `diya-gl/README.md` |
| LU-18 | Third-party lines in `NOTICE` and `LICENSING.md`, spreadsheets and Submit: the XBRL International GL Framework adaptation (`schema/diya-gl-docs.md:1-10`, both schemas' descriptions; CC BY layer, attribution kept verbatim); jszip (MIT, taken under MIT of its dual licence), smol-toml (BSD-3-Clause) and ajv's generated validator (MIT) compiled into the DIYA-GL bundle and the runners; one consolidated Crown copyright and Open Government Licence v3.0 line for the HMRC-derived data (`app/data/*.toml`, `app/data/filing/`, `app/data/hmrc/sa103f_mapping_v3.csv`, the 40 `ref-additions/*.toml`, Submit's `web/public/docs/hmrc-form-field-standards/README.md`); the Apache Maven Wrapper in every repository that has one; the PolicyBee logo in spreadsheets and Submit (used under the partner arrangement, `?partner=35`, not licensed onward); Submit's Google "G" logo on `auth/login.html` (Google brand guidelines); Submit's `web/public/lib/qrcode.min.js` (node-qrcode, MIT; its notice is stripped today and is restored at the top of the file); the Lighthouse (Apache-2.0), Playwright and React (Apache-2.0, MIT) and OWASP ZAP reports committed under Submit's `web/public/tests/`; the runtime dependency tables from each `package.json` | LU-1 | Sonnet | `NOTICE`, `LICENSING.md`, `diya-gl/NOTICE`; submit: `NOTICE`, `LICENSING.md`, `web/public/lib/qrcode.min.js` |
| LU-19 | The engine announces its terms: `diya-gl --version` prints the version, `Apache-2.0` and the copyright line; the MCP server's `serverInfo` version stops reading `0.1.0` and its `instructions` string names the licence and the source address, since the MCP `Implementation` object has no licence field; the templates fetched under decision 7(a) print the PolyForm terms once on first fetch | LU-1 | Sonnet | `diya-gl/bin/diya-gl.js`, `app/lib/mcp/server.js`, `app/lib/app-resources.js` |
| H-LU-3 | Dispatch the four `generate-*` workflows after LU-5 merges, then the prod deploy | LU-5 | operator | GitHub Actions |

## Trade marks

Registration is form-filling on gov.uk; a solicitor is needed only if an application is opposed.
Fees are the IPO's schedule from 1 April 2026, recorded with the sources in
`_developers/trade-marks/GOODS_AND_SERVICES.md`; check gov.uk before paying.

The marks, the operator's choice: **DIY ACCOUNTING SPREADSHEETS**, **DIY ACCOUNTING SUBMIT** and
**DIYA-GL**, with **DIY ACCOUNTING** on its own tried through Right Start. Each is a UK word mark in classes 9 (downloadable software and data files), 42
(software as a service and hosting) and 35 (accounting and bookkeeping services).

- **DIYA-GL**: a coined term, expected to register unopposed in about four months. Standard
  application, £205 plus £60 per extra class, £325.
- **DIY ACCOUNTING SUBMIT** and **DIY ACCOUNTING SPREADSHEETS**: both lean on descriptive words, the
  second most of all, so each goes through the Right Start option (£185 for the examiner's report in three
  classes, £185 more only if it looks registrable) with twenty years of trading as DIY Accounting as the
  acquired-distinctiveness argument, and the logo filed as a stylised mark beside each. The series rule
  does not hold (`_developers/trade-marks/SERIES_CHECK.md`): the two differ in the product word,
  distinctive matter under s.41(2), so each files on its own.
- **DIY ACCOUNTING** on its own: a Right Start probe, £185 for the examiner's view on whether twenty
  years of use has made the bare name distinctive. If the examiner accepts it, the second £185
  registers the strongest mark of the set and the two composite marks become defensive; if not, the
  probe has cost £185 and the composites carry the brand.
- Budget if every application proceeds to registration: about £1,435 for the four word marks in
  three classes, plus the stylised marks; £185 less if the bare name is refused at the report.
- Before filing: the IPO search and TMview, both free.
- From now: ™ after the three marks on the site footer, the spec page and the package
  README; ® only once registered. The marks are always adjectives before a noun.
- Now, while unowned: the domains `diya-gl.com`, `diya-gl.co.uk`, `diya-gl.dev`; a `diya-gl` GitHub
  organisation; a `@diya-gl` npm organisation.
- Evidence of first use kept in one place: Wayback snapshots, npm publish dates, release tags.
- EU and US filings wait for revenue abroad.

| # | Task | Precursors | Model | Files |
| --- | --- | --- | --- | --- |
| LU-10 | The filing pack: the free searches run and their results recorded; the goods and services wording for classes 9, 42 and 35 drafted from the IPO's pre-approved terms; the first-use evidence gathered with dates; `TRADEMARKS.md` extended with the ™ usage rules | — | Sonnet | `TRADEMARKS.md`, `_developers/trade-marks/` (new) |
| LU-11 | ™ on the marks across the site footer, the spec page and the package README, in the same PR as LU-6 | LU-6 | Sonnet | as LU-6 |

## Consistent branding

One brand repository, `diy-accounting-uk/brand`, is the single source for every mark and rule
(now `PLAN_DIYACCOUNTING_BRAND.md`), and
the other repositories pull from it instead of carrying their own copies. What it holds:

- The marks: the DIY Accounting logo and wordmark, the DIYA-GL wordmark and the Submit wordmark as
  SVG, with the PNG and ICO renders and the web manifest icons generated from them.
- The tokens: colours, type scale and spacing as CSS custom properties in `tokens.css` and as a JSON
  file for anything that is not CSS; the font stack and where it loads from.
- The words: the names and their casings (DIY Accounting, DIY Accounting Spreadsheets, DIY Accounting
  Submit, DIYA-GL), the ™
  rule, "free to use, source available, open specification", the copyright line, the wording never
  used ("open source").
- The canonical legal texts: the PolyForm additional grant, the Apache NOTICE, `TRADEMARKS.md`. The
  other repositories copy these verbatim from a pinned version, never by hand.
- The guidelines as a document, published as a page on www.diyaccounting.co.uk from the same source.

The brand repository is public so the guidelines page can be read, but its assets are not licensed:
its `LICENSE` says all rights reserved and points at `TRADEMARKS.md`. The package's `license` field
reads `SEE LICENSE IN LICENSE`.

How the others consume it: the repository publishes `@diy-accounting-uk/brand` to npm on every
green push to its main, the same roll-and-publish pattern as `diya-gl`. Each site pins a version in
its `package.json`, copies the assets and `tokens.css` into its public directory at build, and
imports the tokens from its stylesheet. A version bump is a one-line PR in each repository, and the
inventory of copies the audit found (section "Across the repositories") is what the first pins
replace.

| # | Task | Precursors | Model | Files |
| --- | --- | --- | --- | --- |

## Across the repositories

From the read-only audit of 2026-09-08, corrected by the review the same day. Facts first, then the
coverage tables, then the rows the uplift adds per repository.

**What is common to all six.** Five repositories carry a root `LICENSE`; four hold the canonical
AGPL-3.0 text and GitHub detects them; Submit's is a twenty-line paraphrase with an "additional
terms" clause, and GitHub returns `NOASSERTION`; the tap has none and GitHub detects nothing. No
repository has CONTRIBUTING, a code of conduct, a CLA or DCO, a trademark notice or `SECURITY.md`. No
external pull request has ever been merged in any of them. No GPL-family runtime dependency exists
anywhere; `jszip` in the engine is dual MIT or GPL and is taken under MIT. The company name appears
three ways: "DIY Accounting Ltd" in every SPDX header, "DIY Accounting Limited" in page footers and
JSON-LD, and bare "DIY Accounting" in titles and `og:site_name`. No `package.json` in root, www or
the archive has a `license` field; Submit's root says `AGPL-3.0`. The Maven wrapper (`mvnw`,
`mvnw.cmd`, `maven-wrapper.properties`) is Apache-2.0 third-party code in five repositories and is
excluded from every header sweep. All six repositories are public and none is archived on GitHub.

**spreadsheets.** 2,795 tracked files, 1,575 of them the xlsx, pdf and docx under `packages/`. Under
the plan's original extension set (js, mjs, cjs, java, sh, toml) 361 of 464 files carry a header and
103 do not: `app/templates` `meta.toml` (5), `app/data` (18), the 14 fixture and 17 example TOMLs,
`web/data/ref-additions/*.toml` (40), two web TOMLs, two `.js` and two `.cjs`, one `.sh`. Under the
full comment-capable set another 474 files have no header: all 149 html, all 306 md (119 of them
generated reports, 120 articles), all 15 yml, all 4 xml. The 361 headers all read `AGPL-3.0-only`.
The README contradicts itself: lines 8-10 say Mozilla Public License 2.0 and "Open Source", lines
17 and 23 tell the proprietary history, line 82 says AGPL. `download.html:91-99` carries an AGPL
notice block. The engine package ships no licence file; its `prepack.mjs` copies `app/lib`, `app/bin`,
`app/products`, `app/data` and `app/templates` whole, so the PolyForm-designated templates and the
twelve PolyForm build scripts are inside the package today. `schema/diya-gl-docs.md` and both
schemas' descriptions carry the XBRL International attribution, which the CC BY layer keeps. The
five guide Markdown files under `app/templates/*/` say "Open Source" and are the source of the PDFs
in every zip. The generator writes no `docProps`; the shipped generate path skips LibreOffice. The
DIYA-GL bundle compiles jszip and smol-toml with `legalComments: "none"`. Eleven pages carry a footer
by hand-copy; the four DIYA-GL pages and three probes have none.

**submit.** 1,415 tracked files. Under the original set 88 lack a header (49 js, 2 mjs, 1 cjs, 26 sh,
10 toml); under the full set about 356 more (54 html, 234 md, 31 yml, 17 xml, 6 svg, 2 css, and
one each of properties and Dockerfile). Identifiers: `AGPL-3.0-only` 694, `AGPL-3.0-or-later` 28
(16 workflows, 5 scripts, 7 battery-pack files, one plan), `MIT` 1 (`battery-pack.sh`), `Apache-2.0`
1 (inside the committed Lighthouse report). The `_developers/backlog/battery-pack/` subtree has an
MIT `LICENSE`, an MIT badge and `"license": "MIT"`; `_developers/backlog/metric-son/` carries
`@license MIT`. The public commitment is the strongest of the six: `terms.html` clause 11 (lines
272-275) says the Service is AGPL-3.0 open source, clause 21 (431-437) invites contributions, line
158 mentions "open source licenses", and `accessibility.html:349-353` repeats the claim; `README.md`
lines 14, 34, 118 and 123 say open source and AGPL; `package.json:350` says `AGPL-3.0`;
`hmrc-fraud-prevention.md:3`, `_developers/MARKETING_GUIDANCE.md:83,130,193` and the HMRC approval
documents (decision 9) say it too. `web/public-simulator/` is gitignored build output from
`scripts/build-simulator.js`, so there is nothing to edit there; the deployed copy is stale
(`accessibility.html` dated January 2026) and the deploy must run the build. The OpenAPI document
has no `info.license`, `info.contact` or `termsOfService` (`OpenApiGenerator.java:89-109`). The
`Dockerfile` has no labels; the Lambda image goes to private ECR. `web/public/lib/qrcode.min.js` is
node-qrcode with its MIT notice stripped. The three-layer model did not name this repository; it is
the hosted product, so it is PolyForm Internal Use with the same additional grant, and its terms
page is rewritten to say so.

**diy-accounting-archive.** 10,179 tracked files, 9,770 of them workbooks and documents in four
trees (`packages-archive/` 6,684, `packages-published/` 1,575, `packages/` 821, `packages-generated/`
12). Public, AGPL text at the root, and holds a full second copy of the generator pipeline. Under
the original set 54 lack a header (51 toml, 2 js, 1 sh); under the full set 323 (134 html, 130 md,
3 yml, 1 xml). Its README says Mozilla Public License 2.0 at lines 9-10, names Terry Cartwright at
line 9, says AGPL at line 131, and names the `support-at-diyaccounting` organisation at lines 24, 25,
31, 126 and 127; `download.html:96` links MPL 2.0 and lines 57 and 98 link the old organisation;
`community.html:53,70`, `lib/community-page.js:12,183`, `app/templates/meta.toml:7`,
`app/templates/bst/bst-guide.md:316,318` and `SpreadsheetsStack.java:122-125` (CDK tags) carry the
same scope; `package.json` is `@support-at-diyaccounting/...` with no `license` field;
`package-lock.json:2,8` still says `@antonycc/...`. Two knowledge-base articles say "Open Source".
134 pages reference a `favicon.svg` that does not exist. No package tree carries a licence or readme
file. The uplift cannot leave a public MPL-then-AGPL copy of the originals beside a PolyForm live
copy: the archive stays public and is relicensed to match, with one `LICENCE.txt` at the root of
each of the four trees rather than 9,770 edits.

**root.** 54 tracked files. 25 of 42 comment-capable files carry a header; 24 read `AGPL-3.0-only`
and `deploy-holding.yml` reads `AGPL-3.0-or-later` with `SPDX-FileCopyrightText: 2025 DIY Accounting
Limited`. The 17 without: `export-root-zone.sh`, `deploy.yml`, `test.yml`, `dependabot.yml`,
`actionlint.yaml`, `pom.xml`, `web/holding/index.html`, eight Markdown files, and the two wrapper
files (excluded). `README.md:233-235` says AGPL-3.0. Nothing is published; the holding page states
nothing.

**www.** 68 tracked files. 28 of 49 comment-capable files carry a header, all `AGPL-3.0-only`
`2025-2026 DIY Accounting Ltd`. The 21 without: `about.html`, `index.html`, `favicon.svg`,
`sitemap.xml`, `pom.xml`, three workflow and Dependabot files, eleven Markdown files, and the two
wrapper files (excluded). `README.md:75-77` says AGPL. Both pages carry a byte-identical hand-copied
footer `© 2025-2026 DIY Accounting Limited` with no licence line; `og:image` on both is a live
cross-site reference to `submit.diyaccounting.co.uk/images/company/diyaccounting-label-logo-white-bk.png`.
`index.html:54` says "since 2006".

**homebrew-tap** (to be `homebrew-diya-gl`). Four tracked files, none with a header, no `LICENSE`,
GitHub detects nothing. `Formula/diya-gl.rb:6` reads `license "AGPL-3.0-only"`; `README.md:31` says
"`diya-gl` is AGPL-3.0-only. This tap's own scripts and workflows are provided as-is";
`scripts/update-formula.sh:107` hardcodes `license "AGPL-3.0-only"` in the heredoc that writes the
formula, and reads only version, tarball URL, sha256 and description from the registry, so the plan's
original claim that the formula "picks the licence up from npm on its own" was wrong. The script
rewrites the formula only when the tarball URL changes, so a corrected script lands in the formula
at the next publish, or by one hand run. The workflow runs hourly with `contents: write`, and
installs and tests the formula it just pushed.

### Coverage tables

"Header" is `SPDX-License-Identifier`. "Layer" is the identifier the model assigns. Counts exclude
the wrapper files. Where a format cannot carry a comment, the last column says how the licence
attaches instead.

**spreadsheets** (non-`packages/` files; `packages/` adds 1,267 xlsx, 217 pdf, 91 docx)

| Extension | Files | Comment | Header today | Layer | Attaches otherwise |
| --- | --- | --- | --- | --- | --- |
| js | 328 | yes | 326 | by closure: Apache-2.0 or PolyForm | — |
| mjs | 7 | yes | 7 | `diya-gl/scripts` Apache-2.0; `scripts/` PolyForm | — |
| cjs | 8 | yes | 6 | PolyForm | — |
| java | 5 | yes | 5 | PolyForm | — |
| sh | 7 | yes | 6 | `diya-gl/*.sh` Apache-2.0; others PolyForm | — |
| css | 7 | yes | 7 | PolyForm | — |
| svg | 1 | yes | 1 | PolyForm | — |
| Dockerfile | 1 | yes | 1 | Apache-2.0 | — |
| toml | 99 | yes | 1 | `app/data` Apache-2.0; `app/templates/meta.toml` with the templates; fixtures, examples, web PolyForm | — |
| html | 149 | yes | 0 | PolyForm; `diya-gl.html` CC-BY-4.0, written by its builder | — |
| md | 306 | yes | 0 | PolyForm; `schema/diya-gl-docs.md` CC-BY-4.0; `diya-gl/README.md` Apache-2.0; `reports/*.md` written by `reconcile.js` | — |
| yml | 15 | yes | 0 | PolyForm | — |
| xml | 4 | yes | 0 | `pom.xml` PolyForm; the three CT600 samples are HMRC material, NOTICE line, no header | — |
| json | 47 | no | — | the two schemas Apache-2.0 via `$comment`; `package.json` via `license`; the rest PolyForm | `LICENSING.md` directory map |
| jsonl | 19 | no | — | PolyForm | the `examples/*/README.md` beside each |
| xlsx | 49 | no | — | templates PolyForm; examples PolyForm | `docProps/core.xml` `dc:rights` (LU-5); the zip's `LICENCE.txt` (LU-4) |
| docx | 9 | no | — | PolyForm | `docProps/core.xml`; the zip's `LICENCE.txt` |
| pdf | 26 | no | — | the 8 site docs PolyForm; the 18 under `_developers/hmrc-references/` are HMRC material | pandoc metadata for the guides (LU-5); NOTICE for HMRC's |
| png, jpg, ico | 115 | no | — | PolyForm | `LICENSING.md` directory map; the page footer where rendered |
| odt, ods, csv | 6 | no | — | HMRC material | NOTICE line |
| webmanifest | 1 | no | — | PolyForm | the DIYA-GL page footer |
| txt | 2 | no convention | — | PolyForm | `LICENSING.md` |

**submit**

| Extension | Files | Comment | Header today | Layer | Attaches otherwise |
| --- | --- | --- | --- | --- | --- |
| java | 119 | yes | 119 | PolyForm | — |
| js | 591 | yes | 542 | PolyForm; `qrcode.min.js` keeps its MIT notice | — |
| mjs, cjs, ts | 13 | yes | 10 | PolyForm | — |
| sh | 50 | yes | 24 | PolyForm | — |
| yml, yaml | 57 | yes | 17 | PolyForm | — |
| toml | 11 | yes | 1 | PolyForm | — |
| html | 61 | yes | 7 | PolyForm; the Lighthouse, Playwright and ZAP reports are third-party output, excluded, NOTICE line | — |
| md | 237 | yes | 3 | PolyForm | — |
| xml, xsd, plist, drawio | 26 | yes | 0 | `pom.xml`, `log4j2` PolyForm; the xsd are Companies House schemas, NOTICE; drawio is tool output, excluded | — |
| css, svg | 8 | yes | 0 | PolyForm | — |
| sql | 29 | yes (`--`) | not counted; sweep | PolyForm | — |
| properties, Dockerfile, plantuml | 3 | yes | 0 | PolyForm; the Dockerfile also gains OCI labels | — |
| json | 47 | no | — | PolyForm; `package.json` via `license` | `LICENSING.md` |
| png, jpg, ico, webm, gif | 85 | no | — | PolyForm; `g-logo.png` and `policybee-logo.png` are partner marks | `LICENSING.md`; the page footer |
| pdf, xlsx, docx | 11 | no | — | PolyForm | `LICENSING.md` |
| csv, tsv, txt, eml, mhtml | 45 | no convention | — | PolyForm; the mhtml are saved third-party pages | `LICENSING.md` |

**diy-accounting-archive**

| Extension | Files | Comment | Header today | Layer | Attaches otherwise |
| --- | --- | --- | --- | --- | --- |
| js, cjs, java, sh, css | 43 | yes | 40 | PolyForm | — |
| toml | 52 | yes | 1 | PolyForm | — |
| html | 134 | yes | 0 | PolyForm | — |
| md | 130 | yes | 0 | PolyForm | — |
| yml, xml, properties | 5 | yes | 0 | PolyForm | — |
| xlsx, xls, ods, docx, doc, pdf, zip | 9,770 | no | — | PolyForm | one `LICENCE.txt` at the root of each of the four trees; the root `LICENSE` |
| json | 6 | no | — | PolyForm; `package.json` gains `license` | — |
| png, jpg, ico, txt | 32 | no | — | PolyForm | `LICENSING.md` |

**root**

| Extension | Files | Comment | Header today | Layer | Attaches otherwise |
| --- | --- | --- | --- | --- | --- |
| java, sh, cjs | 25 | yes | 24 | PolyForm | — |
| yml, yaml | 5 | yes | 1 (`-or-later`) | PolyForm | — |
| md | 8 | yes | 0 | PolyForm | — |
| html, xml | 2 | yes | 0 | PolyForm | — |
| bind (the zone file) | 1 | yes (`;`) | 0 | PolyForm | — |
| json, npmrc, cmd | 8 | no | — | PolyForm; `package.json` gains `license` | `LICENSING.md` or the README |

**www**

| Extension | Files | Comment | Header today | Layer | Attaches otherwise |
| --- | --- | --- | --- | --- | --- |
| js, cjs, java, sh, css, toml | 28 | yes | 28 | PolyForm | — |
| yml | 3 | yes | 0 | PolyForm | — |
| md | 11 | yes | 0 | PolyForm | — |
| html, svg, xml | 5 | yes | 0 | PolyForm; `sitemap.xml` from its builder | — |
| txt (robots) | 2 | yes (`#`) | 0 | PolyForm | — |
| json, png, ico, patch | 11 | no | — | PolyForm; `package.json` gains `license` | the page footer; `LICENSING.md` |

**homebrew-diya-gl**

| Extension | Files | Comment | Header today | Layer | Attaches otherwise |
| --- | --- | --- | --- | --- | --- |
| rb | 1 | yes | 0 | Apache-2.0, written by the heredoc | — |
| sh, yml | 2 | yes | 0 | Apache-2.0 | — |
| md | 1 | yes | 0 | Apache-2.0 | — |

**Branding, across the six.** Two visual identities: a teal ledger favicon (`#158484`) on
spreadsheets and the archive, and a blue document-and-tick favicon on Submit and www, with the blue
CSS token (`#2c5aa0`) matching neither the favicon gradient (`#3366b8` to `#2b579a`) nor Submit's
manifest theme (`#2b579a`); www's stylesheet also carries the teal twice. Fonts are consistent
everywhere: system stacks, no web fonts, nothing to attribute. The product names appear as "DIY
Accounting Submit", "DIY Accounting Spreadsheets" and "DIY Accounting Limited" side by side as card
titles on www; the engine is "DIYA-GL" in headings and "diya-gl" in meta descriptions. The only
shared files are the teal favicon (spreadsheets, archive, and a buried copy in Submit) and the
PolicyBee logo. No brand guideline exists. This inventory is the baseline `PLAN_DIYACCOUNTING_BRAND.md` starts from.

| # | Task | Precursors | Model | Files |
| --- | --- | --- | --- | --- |
| LU-8a | Submit's share, spelled out as rows S1 to S7 in `../submit.diyaccounting.co.uk/PLAN_LICENSING_UPLIFT_SUBMIT.md`: the canonical PolyForm `LICENSE` with the grant, `LICENSING.md` and `NOTICE`, `package.json`; the terms and accessibility pages, footers, README, marketing and fraud-prevention docs to the new words, the HMRC approval documents annotated; every header and the header test; `info.license` in the OpenAPI generator; the Dockerfile labels; the third-party notices with `qrcode.min.js`'s MIT notice restored; the simulator build in the deploy | LU-1, LU-18, the go | Sonnet; Opus for the terms wording | `LICENSE`, `LICENSING.md`, `NOTICE`, `package.json`, `README.md`, `web/public/terms.html`, `web/public/accessibility.html`, `web/public/*.html` footers, `web/public/lib/qrcode.min.js`, `infra/.../OpenApiGenerator.java`, `Dockerfile`, `_developers/backlog/battery-pack/`, `_developers/backlog/metric-son/`, headers |
| LU-8b | Archive: `LICENSE`, README (lines 8-10, 17, 23, 24-25, 31, 126-127, 131) and `download.html` (57, 93-99) move to PolyForm with the source offer and the new organisation; `community.html`, `lib/community-page.js`, `app/templates/meta.toml`, `bst-guide.md:316,318` and the CDK tags follow; `package.json` is renamed into the `@diy-accounting-uk` scope with a `license` field and the lock file regenerated so `@antonycc` goes; the two "Open Source" articles are rewritten; the missing `favicon.svg` is restored; a `LICENCE.txt` is placed at the root of each of the four package trees; the 54 and the 323 missing headers are added | LU-1 | Haiku | `LICENSE`, `README.md`, `web/.../download.html`, `web/.../community.html`, `web/.../lib/community-page.js`, `app/templates/meta.toml`, `app/templates/bst/bst-guide.md`, `infra/.../SpreadsheetsStack.java`, `package.json`, `package-lock.json`, `public/favicon.svg`, `packages*/LICENCE.txt` |
| LU-8c | Root and www: `LICENSE` and README to PolyForm; `license` in both `package.json`; root's 17 and www's 21 missing headers, and root's `deploy-holding.yml` outlier brought to the standard pair; www's two footers gain the licence line and a local copy of the logo its `og:image` points at (from the brand package once LU-14 exists, a copy until then) | LU-1 | Haiku | `LICENSE`, `README.md`, `package.json`, the headers, `web/www.diyaccounting.co.uk/public/` |
| LU-8d | Spreadsheets, beyond LU-1 to LU-7: `prepack.mjs` copies the import closure of the four entry points plus `app/products`, `app/data` and the schemas, computed by the same module LU-3's test uses, and stops copying `app/templates` and the twelve build scripts; `app-resources.js`'s Node loader fetches a missing template from the site and caches it (decision 7a); the package test asserts no template and no build script ships and that the fetched-template path works offline once cached; the parity and smoke scripts follow | LU-1, LU-3 | Sonnet | `diya-gl/scripts/prepack.mjs`, `app/lib/app-resources.js`, `app/test/diya-gl-package.test.js`, `diya-gl/smoke.sh`, `diya-gl/parity.sh` |

## Verification

- `LU-1`, `LU-2`: `gh api /repos/diy-accounting-uk/<repo> --jq .license.spdx_id` answers `NOASSERTION`
  for every PolyForm repository, since GitHub's detector does not know PolyForm, and `Apache-2.0` is
  what `npm view @diy-accounting-uk/diya-gl@1.1.0 license` answers; `docker inspect` on the 1.1.0
  image shows the Apache label and the vendor label.
- `LU-3`'s header test is the durable gate: it runs in `npm run test:fast` and fails on any file
  outside its layer, on any file that still says "Ltd", and on a closure that drifts from `prepack`.
- `LU-4`: `npm pack --dry-run` in `diya-gl/` lists `LICENSE` and `NOTICE` and no `templates/`; a
  built zip lists `LICENCE.txt` and `README.txt`; the bundle, runner, `examples.js`, `build-stamp.js`,
  `catalogue.toml`, `redirect-function.js`, `sitemap.xml` and every `reports/*.md` begin with the
  licence comment; the reconciliation JSON carries `"license"`.
- `LU-5`: a generated workbook's `docProps/core.xml` carries the rights and creator fields; `pdfinfo`
  on a guide shows the author; the reconciliation gates on the four `generate-*` runs stay green.
- `LU-6`, `LU-11`: the browser suite's footer assertions on every page including the DIYA-GL pages; a
  grep for "open source" and "Open Source" across `public/`, `README.md`, `app/templates/` and the
  `PLAN_*`/`CONTEXT_*` files returns nothing about the company's work.
- `LU-7`: `TRADEMARKS.md` and `SECURITY.md` exist and the README has the no-contributions line.
- `LU-8a`: `terms.html` and `accessibility.html` on ci contain neither "AGPL" nor "open source";
  `openapi.json` on ci has `info.license`; the simulator's `accessibility.html` date matches the
  live one; the header test's Submit twin passes.
- `LU-8b`, `LU-8c`: a grep across each repository for "AGPL", "Mozilla", "support-at-diyaccounting"
  and "antonycc" returns only the git history; `favicon.svg` returns 200; each package tree root
  lists `LICENCE.txt`.
- `LU-8d`: the tarball contains no `dist/app/templates/` and none of the twelve build scripts;
  `diya-gl write-workbook` on a clean machine fetches the template, prints the terms once, and
  succeeds offline on the second run.
- `LU-9`: `npm view @diy-accounting-uk/diya-gl license` answers `Apache-2.0` for 1.1.0 and
  `AGPL-3.0-only` for 1.0.3, with 1.0.0 to 1.0.3 shown deprecated; the download page and the zip agree;
  `ghcr.io/diy-accounting-uk/diya-gl:latest` is 1.1.0 and the old tags are gone.
- `LU-17`: `brew install diy-accounting-uk/diya-gl/diya-gl` works; `Formula/diya-gl.rb` reads
  `license "Apache-2.0"` and carries the header; a dry run of `update-formula.sh` against 1.0.3 fails
  on nothing but writes `AGPL-3.0-only`, proving the value is read, not assumed.
- `LU-18`: `NOTICE` in each repository names every item in the LU-18 list; `qrcode.min.js` starts
  with its MIT notice.
- `LU-19`: `diya-gl --version` prints the three lines; an MCP `initialize` response carries the
  licence in `instructions`.
- `LU-10`, `LU-11`: the pack exists with dated search results; ™ appears in the footer, the spec page
  and the package README.
- the brand rows, now in `PLAN_DIYACCOUNTING_BRAND.md`: the brand package publishes; each consumer's `public/` holds no local logo or
  token copy; www's `/brand` page renders from the package.

## Review

Review of 2026-09-08 against the six trees. Judgement per group, then the open decisions.

**1A, the engine and the licence files.** Sound in aim, wrong in two facts, now corrected. The
original LU-2 said the tap follows npm automatically; it does not (`update-formula.sh:107`
hardcodes the licence), so the tap has its own row and group (LU-17, 1G). The original model put
"the generator" under PolyForm while the package's own entry points import it; the boundary is now
the import closure and the templates question is decision 7. Without decision 7 the first Apache
release would either ship the templates under Apache-2.0 or break `write-workbook`; LU-9 now waits
on LU-8d and LU-17 as well as the rows it already named.

**1B, the public statement.** Sound, under-scoped. The four DIYA-GL pages have no footer to amend, so
the row adds one. `download.html`'s AGPL notice block, the README's MPL and proprietary-history
lines, two knowledge-base articles with their `.md` twins, the launch plan and one context doc all
carry the old words and are now named. The tap rename's install line lands here.

**1C, headers.** Sound as a gate, counted too narrowly. The plan swept six extensions and missed
html, md, yml, xml, css, svg, properties and Dockerfile; the coverage table names them all and the
row lists the header form per format. The test must also compute the closure, or LU-8d and LU-3
drift apart within a month.

**1D, the packages and workbooks.** Sound for the zip and the workbook; missed every other emitter.
The guide PDFs, the catalogue, the sitemap, the redirect function, the bundle's two sidecar files,
the runner's footer, the reconciliation JSON and the Markdown reports had no row; they now sit in
LU-4 and LU-5. The five guide Markdown files say "Open Source" and become the shipped PDFs; that is
the one place where the old words reach the download directly. The `docProps` write is safe: the
shipped path never runs LibreOffice.

**1E, Submit.** Sound in direction, every number was low: 28 `-or-later` headers not eleven, 88
narrow gaps not 97 (and 356 wide), one MIT and one Apache identifier the audit missed, a vendored
library with a stripped notice, a root `package.json` saying `AGPL-3.0`, and a simulator that is
gitignored build output rather than a tracked copy. The HMRC approval documents describe the
service as AGPL open source; whether HMRC hears about the change is decision 9.

**1F, the archive, root and www.** Sound; the numbers and the file lists were incomplete. The
archive's old-organisation scope is in 17 places, not two; its trees reach 2026-27 and 2027-28;
9,770 binaries get one `LICENCE.txt` per tree. Root has a header outlier and 17 wide-set gaps, www
21, both READMEs say AGPL, and neither `package.json` has a `license` field.

**1G, the tap.** New. Apache-2.0 for the tap's own files keeps the engine's layer whole across npm,
GHCR and Homebrew. The hourly workflow already commits and tests, so the corrected script needs one
hand run and then maintains itself.

**2A, 2B.** Sound and unchanged.

**3A, 3B.** Moved to `PLAN_DIYACCOUNTING_BRAND.md`; the coverage tables and the branding inventory are its input.

**The Docker image as its own repository (decision 8).** Today the image is 28 lines: install the
just-packed tarball into `node:24-alpine`, label it, set the entrypoint. It is built and pushed from
`publish-diya-gl.yml` in the same job that publishes to npm, tagged with the package version, under
the same Apache-2.0 layer. A separate repository would gain its own `LICENSE` and README on the GHCR
package page (GitHub links a container package to the repository in `image.source`, and today that
is a repository whose root `LICENSE` will read PolyForm), a home for image-only issues, and a build
from the registry tarball rather than the local one, which is a smaller trust boundary and the same
shape as the tap. It would cost a second publish pipeline that tracks the npm version by schedule or
cross-repository trigger, a lag between npm and GHCR, one more repository to keep consistent, and a
split of `image-smoke.sh` from the smoke that runs before publish. Recommendation: not now. Fix what
the GHCR page shows with labels (`licenses`, `vendor`, `title`, `documentation`, `url`; LU-2) and keep
one pipeline while the image has no issues and no consumer of its own. Decided no on 2026-09-09;
should that change, a separate repository would follow the tap's pattern: an hourly workflow that
reads the registry, builds from `dist.tarball`, pushes the version tag and `latest`, and the Docker
steps leave `publish-diya-gl.yml`.

All decisions are taken (see Decisions).

**Not verified by this review.** Whether LibreOffice's xlsx writer preserves `docProps/core.xml` on
the recalculation path; irrelevant to the shipped packages, relevant if LU-5 ever asserts the
fields on a recalculated copy. The GHCR package page's licence display was inferred from the label
and the source link, not viewed. Submit's 29 `.sql` files were not counted for headers.
