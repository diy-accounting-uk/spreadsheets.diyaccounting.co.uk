# PLAN: the licensing and copyright uplift

Status: draft for the operator's approval. Nothing here is dispatched until the operator says go.
The cross-repository section is filled from a read-only audit of all five repositories.

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
| The specification | The diya-gl format text (`diya-gl.html` and its builder), the two JSON schemas | CC BY 4.0 for the text; Apache-2.0 for the schemas | Anyone implements the format in anything, with attribution. |
| The engine | `diya-gl/` (npm package, CLI, MCP server, Docker image) and the engine modules under `app/lib` that the package bundles | Apache-2.0 | Embeddable anywhere without legal review; the patent grant and the NOTICE file keep the company's attribution in every copy. |
| The original work and the hosted product | The spreadsheets and their packages, `app/templates/`, the generator and build scripts, the web pages and site, the infrastructure | PolyForm Internal Use 1.0.0 plus one additional grant | Download and use for your own accounts, or your clients' accounts if you are an accountant. No redistribution. No hosting, and no hosting of a modified version under another name. Running on localhost is permitted use. |

The additional grant, one sentence, permits an accountant or bookkeeper to use the spreadsheets to
prepare accounts for their clients. It is bespoke and a solicitor reads it before it publishes
(H-LU-2). The recommendation that accountants are permitted users rests on each client being a
prospective Submit user; the operator confirms it at H-LU-1.

Copyright line everywhere: `Copyright (C) 2006-2026 DIY Accounting Limited`, the company's standard
way of writing its name. The site says "since 2006"; no individual is named in the notices.

The protection of the funnel is not in the engine's licence. Filing lands on Submit's servers, which
alone hold the HMRC credentials, the recognition and the billing. The engine's licence is chosen to
travel; the spreadsheets' licence is chosen to stay.

What the change does not do: versions of the npm package, the images and the packages already
distributed under the AGPL (npm 1.0.0 to 1.0.3, the images pushed with them, every zip downloaded
before the next generate run) keep the AGPL for those copies. New versions carry the new terms.
Moving the engine from AGPL to Apache-2.0 relaxes; moving the spreadsheets to PolyForm restricts,
and takes effect from the first generate run and deploy after this plan lands.

Words: the site, the package READMEs and the launch posts say "free to use, source available, open
specification". They never say "open source".

## Decisions the operator confirms at H-LU-1

1. The three layers as tabled.
2. Accountants preparing clients' accounts are permitted users of the spreadsheets.
3. No contributions are accepted; the README says so; no CLA or DCO is needed.
4. The copyright span 2006-2026 and the company as the only named holder.
5. The company name is written **DIY Accounting Limited** everywhere: headers, copyright lines,
   footers, JSON-LD, READMEs, manifests. "DIY Accounting Ltd" and bare "DIY Accounting" as the legal
   name go; bare "DIY Accounting" survives only as the brand in titles and `og:site_name`.
6. The archive stays public and is relicensed to match (decided 2026-09-08).

## Delivery groups, ranked by urgency

The rows keep their ids from the sections below. Each group is one wave of concurrent workstreams
by area; a group also sweeps up the less urgent rows that touch the same files, so no file is
opened twice. Urgency 1 stops the bleed before exposure grows; 2 protects the names; 3 consolidates.

### Urgency 1: the terms are right in every copy and on every page

Ships the first engine version under Apache-2.0, the first packages under PolyForm, and the words
that match, across all five repositories. Six workstreams, no shared files between them.

| Group | Rows | Area and files | Sweeps up | Model |
| --- | --- | --- | --- | --- |
| 1A the engine and the licence files | LU-1, LU-2, LU-8d (prepack) | spreadsheets: `LICENSE`, `LICENSING.md`, `diya-gl/LICENSE`, `diya-gl/NOTICE`, `diya-gl/package.json`, `package.json`, `diya-gl/Dockerfile`, `diya-gl/scripts/prepack.mjs`, the schemas' licence file | the README's MPL line; the package test asserting no template ships | Opus for the grant and `LICENSING.md`; Sonnet for the rest |
| 1B the public statement | LU-6, LU-11, LU-7 | spreadsheets: every `public/*.html`, `public/books/*.html`, the spec and reconciliation page builders, `README.md`, `TRADEMARKS.md`, `SECURITY.md` | the company name in footers and JSON-LD; ™ on the marks; the no-contributions line | Sonnet; Opus for the trademark text |
| 1C headers | LU-3, LU-8d (headers) | spreadsheets: every source file; `app/test/licence-headers.test.js` | the 103 missing headers; "Ltd" to "Limited"; the year span | Haiku for the sweep; Sonnet for the test |
| 1D the packages and workbooks | LU-4, LU-5 | spreadsheets: `app/bin/build-packages.js`, `scripts/build-books-bundle.mjs`, `scripts/build-runner.mjs`, `app/lib/generator.js`, `app/templates/*/`, their tests | nothing else touches these | Sonnet; the template line follows the reconciliation-bug method |
| 1E Submit | LU-8a | submit: `LICENSE`, `web/public/terms.html`, `web/public/accessibility.html`, the simulator copies, `infra/.../OpenApiGenerator.java`, every header | the eleven `-or-later` headers, the battery-pack MIT and AGPL mix, the 97 missing headers, "Ltd" to "Limited" | Sonnet; Opus for the terms wording |
| 1F the archive, root and www | LU-8b, LU-8c | archive: `LICENSE`, `README.md`, `download.html`, `package.json`, `favicon.svg`; root and www: `LICENSE`, `README.md`, the one header, www's footer and a local `og:image` | the archive's pre-migration organisation scope and link, the 53 missing archive headers, www's three name spellings on its cards, "Ltd" to "Limited" | Haiku |

Then, once every group's PR is merged: LU-9, the first release under the new terms, with H-LU-3's
generate dispatches rebuilding every package.

### Urgency 2: the names

| Group | Rows | Area and files | Sweeps up | Model |
| --- | --- | --- | --- | --- |
| 2A the filing pack | LU-10 | `TRADEMARKS.md`, `_developers/trade-marks/` | the first-use evidence, the class wording, the series-rule check | Sonnet |
| 2B the filings and registrations | H-LU-4, H-LU-5 | gov.uk, registrars, github.com, npmjs.com | — | operator |

### Urgency 3: one brand source

| Group | Rows | Area and files | Sweeps up | Model |
| --- | --- | --- | --- | --- |
| 3A the baseline and the repository | LU-12, LU-13, LU-14, H-LU-6, H-LU-7 | the new `diy-accounting-uk/brand` repository | the two favicon identities resolved to one; the blue token matched to its mark; the teal leftovers in www | Opus for the guidelines and words; Sonnet for tokens and the package |
| 3B consumption | LU-15, LU-16 | spreadsheets, submit, www: `package.json`, build scripts, stylesheets, `public/`; www's `/brand` page | every local logo, favicon and token copy deleted | Sonnet, one agent per repository |

### Human rows across the groups

| # | Task | Gates |
| --- | --- | --- |
| H-LU-1 | Approve this plan and confirm the six decisions | every group |
| H-LU-2 | A solicitor reads the additional grant and the trademark notice | LU-9, at the operator's discretion |
| H-LU-3 | Dispatch the four `generate-*` workflows after 1D merges, then the prod deploy | LU-9 |

## Task list

The rows in full. Machine rows are Sonnet unless the group table says otherwise.

| # | Task | Precursors | Model | Files |
| --- | --- | --- | --- | --- |
| LU-1 | The licence files: root `LICENSE` becomes PolyForm Internal Use 1.0.0 with the additional grant; `diya-gl/LICENSE` (Apache-2.0) and `diya-gl/NOTICE`; a licence file beside the schemas; `LICENSING.md` at the root mapping every directory to its layer, with the source offer and the copyright line | H-LU-1 | Opus for the additional grant and `LICENSING.md`; Sonnet for the rest | `LICENSE`, `LICENSING.md`, `diya-gl/LICENSE`, `diya-gl/NOTICE`, the schemas' directory |
| LU-2 | Manifests and metadata: `license` in `diya-gl/package.json` (Apache-2.0) and the root `package.json` (`SEE LICENSE IN LICENSE`); the Dockerfile's licence label; the CDK tags if any name a licence; README badges; the tap's formula picks the licence up from npm on its own | LU-1 | Sonnet | `diya-gl/package.json`, `package.json`, `diya-gl/Dockerfile`, `infra/`, READMEs |
| LU-3 | Headers: every source file's `SPDX-License-Identifier` matches its layer (`Apache-2.0` under `diya-gl/` and the bundled engine modules; `LicenseRef-PolyForm-Internal-Use-1.0.0` elsewhere) and the copyright line reads `Copyright (C) 2006-2026 DIY Accounting Limited`, the company's standard name, replacing every "DIY Accounting Ltd"; a unit test walks the tree and fails on a missing or mismatched header | H-LU-1 | Haiku for the sweep; Sonnet for the test | every `.js`, `.mjs`, `.cjs`, `.java`, `.sh`, `.toml` source file; `app/test/licence-headers.test.js` (new) |
| LU-4 | Distributed copies carry their terms: the npm tarball ships `LICENSE` and `NOTICE` (automatic once LU-1 lands); every spreadsheet zip gains `LICENCE.txt` and `README.txt` (product, year, licence, copyright, source and download addresses); the Docker image inherits the tarball's files; the engine bundle and the single-file runner start with a licence comment | LU-1 | Sonnet | `app/bin/build-packages.js`, `scripts/build-books-bundle.mjs`, `scripts/build-runner.mjs`, their tests |
| LU-5 | The workbooks state their copyright: the generator writes `dc:creator`, `dc:rights` and the company name into every workbook's core properties; each product's front sheet gains a licence and copyright line in the template; the reconciliation gates prove nothing else moved | LU-1 | Sonnet; the template edit follows the reconciliation-bug method | `app/lib/generator.js`, `app/templates/*/`, the fixtures' `report.json` if a cell moves |
| LU-6 | The public statement: the shared footer gains the licence and a source link on all site pages and the four DIYA-GL pages; the download page paragraph is rewritten; the spec page gets a licence section naming the three layers; every "open source" phrase goes | H-LU-1 | Sonnet | `web/spreadsheets.diyaccounting.co.uk/public/*.html`, `public/books/*.html`, `app/bin/build-diya-gl-spec.js`, `app/bin/build-reconciliation-pages.js` |
| LU-7 | The names and the door: `TRADEMARKS.md` (DIY Accounting and DIYA-GL are not licensed; no use to market modified versions); the README's "this repository does not accept contributions" line; `SECURITY.md` with the disclosure address | H-LU-1 | Opus for the trademark text | `TRADEMARKS.md`, `README.md`, `SECURITY.md` |
| LU-8 | The other repositories, per the audit below | LU-1 | per row | see "Across the repositories" |
| LU-9 | The first release under the new terms: the next prod deploy publishes the engine at its rolled version under Apache-2.0 and pushes the image; the generate dispatches (H-LU-3) rebuild every package with `LICENCE.txt` and the workbook properties; the releases page entry records the licence | LU-2, LU-4, LU-5, LU-6, H-LU-3 | Sonnet, verification only | none new |
| H-LU-1 | Approve this plan and confirm the four decisions | — | operator | this file |
| H-LU-2 | A solicitor reads the additional grant and the trademark notice before LU-9 | LU-1, LU-7 | operator | `LICENSE`, `TRADEMARKS.md` |
| H-LU-3 | Dispatch the four `generate-*` workflows after LU-5 merges, then the prod deploy | LU-5 | operator | GitHub Actions |

## Trade marks

Registration is form-filling on gov.uk; a solicitor is needed only if an application is opposed.
Fees are as of September 2026 and are checked on gov.uk before paying.

The marks, the operator's choice: **DIY ACCOUNTING SPREADSHEETS**, **DIY ACCOUNTING SUBMIT** and
**DIYA-GL**, with **DIY ACCOUNTING** on its own tried through Right Start. Each is a UK word mark in classes 9 (downloadable software and data files), 42
(software as a service and hosting) and 35 (accounting and bookkeeping services).

- **DIYA-GL**: a coined term, expected to register unopposed in about four months. Standard
  application, £170 plus £50 per extra class, £270.
- **DIY ACCOUNTING SUBMIT** and **DIY ACCOUNTING SPREADSHEETS**: both lean on descriptive words, the
  second most of all, so each goes through the Right Start option (£100 for the examiner's report,
  £100 more only if it looks registrable) with twenty years of trading as DIY Accounting as the
  acquired-distinctiveness argument, and the logo filed as a stylised mark beside each. The two may
  qualify as one series application, since they differ only in a descriptive word; the pack (LU-10)
  checks the IPO's series rule and files them as a series if it holds, which saves one fee.
- **DIY ACCOUNTING** on its own: a Right Start probe, £100 for the examiner's view on whether twenty
  years of use has made the bare name distinctive. If the examiner accepts it, the second £100
  registers the strongest mark of the set and the two composite marks become defensive; if not, the
  probe has cost £100 and the composites carry the brand.
- Budget if every application proceeds to registration: about £1,010 for the four word marks in
  three classes, plus the stylised marks; £100 less if the bare name is refused at the report.
- Before filing: the IPO search and TMview, both free.
- From now: ™ after the three marks on the site footer, the spec page and the package
  README; ® only once registered. The marks are always adjectives before a noun.
- Now, while unowned: the domains `diya-gl.com`, `diya-gl.co.uk`, `diya-gl.dev`; a `diya-gl` GitHub
  organisation; a `@diya-gl` npm organisation.
- Evidence of first use kept in one place: Wayback snapshots, npm publish dates, release tags.
- EU and US filings wait for revenue abroad.

| # | Task | Precursors | Model | Files |
| --- | --- | --- | --- | --- |
| LU-10 | The filing pack: the free searches run and their results recorded; the goods and services wording for classes 9, 42 and 35 drafted from the IPO's pre-approved terms; the first-use evidence gathered with dates; `TRADEMARKS.md` extended with the ™ usage rules | H-LU-1 | Sonnet | `TRADEMARKS.md`, `_developers/trade-marks/` (new) |
| LU-11 | ™ on the marks across the site footer, the spec page and the package README, in the same PR as LU-6 | LU-6 | Sonnet | as LU-6 |
| H-LU-4 | File the UK applications on gov.uk from the pack: DIYA-GL as a standard application; DIY ACCOUNTING SUBMIT and DIY ACCOUNTING SPREADSHEETS via Right Start, as a series if the rule holds, with the stylised marks beside them; DIY ACCOUNTING on its own via Right Start as the probe | LU-10 | operator | gov.uk |
| H-LU-5 | Register the `diya-gl` domains and the GitHub and npm organisations | — | operator | registrars, github.com, npmjs.com |

## Consistent branding

One brand repository, `diy-accounting-uk/brand`, is the single source for every mark and rule, and
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
| LU-12 | The baseline: from the audit's branding inventory, the one palette, type stack, logo set and naming table the brand repository starts from; every inconsistency listed with its resolution | audit | Opus | `_developers/brand-baseline.md` (new, this repo, moves to the brand repository at LU-13) |
| LU-13 | The brand repository: structure, the SVG marks and generated renders, `tokens.css` and `tokens.json`, the words, the canonical legal texts, `LICENSE` and `TRADEMARKS.md`, the guidelines document | LU-12, H-LU-6 | Opus for the guidelines and words; Sonnet for tokens, renders and structure | the new repository |
| LU-14 | The brand package: `package.json`, the render build, a publish workflow that publishes to npm and rolls the patch version on every green push to main, with a test that every asset the guidelines name exists | LU-13 | Sonnet | the new repository's `.github/workflows/`, `scripts/` |
| LU-15 | Consumption: each of `spreadsheets`, `submit` and `www` pins the package, copies assets and tokens at build, imports the tokens, and deletes its local copies; one PR per repository; the footer, favicon and title conventions read from the words file | LU-14 | Sonnet, one agent per repository | each repository's `package.json`, build scripts, stylesheets, `public/` |
| LU-16 | The guidelines page: www builds `/brand` from the package's guidelines document and publishes the SVG marks for download under the trademark rules | LU-14 | Sonnet | `www.diyaccounting.co.uk` |
| H-LU-6 | Create the `diy-accounting-uk/brand` repository (public, empty) | H-LU-1 | operator, or the session on the operator's word | github.com |
| H-LU-7 | Review the guidelines and the marks on sight before LU-15 pins them | LU-13 | operator | the brand repository |

## Across the repositories

From the read-only audit of 2026-09-08. Facts first, then the rows the uplift adds per repository.

**What is common to all five.** Every repository carries a root `LICENSE`; four hold the canonical
AGPL-3.0 text and GitHub detects them; Submit's is a twenty-line paraphrase with an "additional
terms" clause, and GitHub returns no detection for it. No repository has CONTRIBUTING, a code of
conduct, a CLA or DCO, a trademark notice or `SECURITY.md`. No external pull request has ever been
merged in any of them. No GPL-family runtime dependency exists anywhere; `jszip` in the engine is
dual MIT or GPL and is taken under MIT. The company name appears three ways: "DIY Accounting Ltd" in
every SPDX header, "DIY Accounting Limited" in page footers and JSON-LD, and bare "DIY Accounting" in
titles and `og:site_name`.

**spreadsheets.** 351 of 454 source files carry an SPDX header; the gaps are `app/templates` (0 of
5), `app/data` (0 of 18), `web/data/ref-additions/*.toml` and four loose root files. The README
contradicts itself: line 8 says Mozilla Public License 2.0, line 80 says AGPL. The engine package
ships no licence file and its `prepack.mjs` copies `app/templates`, the hand-built workbooks, into the
public npm and Docker artefact: the PolyForm-designated content is inside the Apache-designated
package today, and LU-1 to LU-4 must split it out. `web/.../schema/diya-gl-docs.md` carries the XBRL
International attribution, which the CC BY layer keeps. The seven user-guide PDFs and 343 tracked
PDF and docx files carry no licence text.

**submit.** 646 of 743 source files carry a header; eleven use `AGPL-3.0-or-later` against the
`-only` norm, and the `_developers/backlog/battery-pack/` subtree mixes an MIT `LICENSE` with AGPL
headers. The public commitment is the strongest of the five: `terms.html` clause 11 says the Service
is AGPL-3.0 open source with the copyleft obligation spelt out, clause 21 invites contributions, and
`accessibility.html` repeats the open source claim; the simulator's copy matches byte for byte. The
OpenAPI document has no `info.license`. The Lambda image goes to a private ECR, nothing is
published. The three-layer model did not name this repository; it is the hosted product, so it is
PolyForm Internal Use with the same additional grant, and its terms page is rewritten to say so.

**diy-accounting-archive.** Public, AGPL text at the root, and holds a full second copy of the
generator pipeline plus four package trees (2006-07 to 2025-26) of the same hand-built workbooks the
operator wants under PolyForm. Its README says Mozilla Public License 2.0 and names Terry Cartwright
as the creator of the originals in the early 2000s; its download page says MPL 2.0 and links the
pre-migration GitHub organisation; its `package.json` still carries that organisation's scope. 134
pages reference a `favicon.svg` that does not exist in the repository. The uplift cannot leave a
public AGPL copy of the originals beside a PolyForm live copy: the archive stays public and is
relicensed to match.

**root.** 24 of 25 files carry a header; the one gap is `scripts/aws-accounts/export-root-zone.sh`.
Nothing is published; the holding page states nothing. No product code, so infrastructure only.

**www.** 27 of 27 files carry a header, the only repository at full coverage. Nothing states a
licence on its two pages. Its `og:image` is a live cross-site reference to a logo hosted by Submit.

**Branding, across the five.** Two visual identities: a teal ledger favicon (`#158484`) on
spreadsheets and the archive, and a blue document-and-tick favicon on Submit and www, with the blue
CSS token (`#2c5aa0`) matching neither the favicon gradient (`#3366b8` to `#2b579a`) nor Submit's
manifest theme (`#2b579a`); www's stylesheet also carries the teal twice. Fonts are consistent
everywhere: system stacks, no web fonts. The product names appear as "DIY Accounting Submit",
"DIY Accounting Spreadsheets" and "DIY Accounting Limited" side by side as card titles on www; the
engine is "DIYA-GL" in headings and "diya-gl" in meta descriptions. The only shared files are the
teal favicon (spreadsheets, archive, and a buried copy in Submit) and a partner's logo. No brand
guideline exists. This inventory is LU-12's baseline.

| # | Task | Precursors | Model | Files |
| --- | --- | --- | --- | --- |
| LU-8a | Submit: canonical PolyForm text with the additional grant replaces the paraphrased `LICENSE`; the eleven `-or-later` headers and the battery-pack subtree's MIT and AGPL mix become the PolyForm identifier; `terms.html` clauses 10, 11 and 21 and `accessibility.html` are rewritten to "free to use, source available", with the contribution invitation removed, and the simulator copy regenerated; `info.license` added to the OpenAPI generator; the 97 missing headers added | LU-1, H-LU-1 | Sonnet; Opus for the terms wording | `LICENSE`, `web/public/terms.html`, `web/public/accessibility.html`, `web/public-simulator/`, `infra/.../OpenApiGenerator.java`, headers |
| LU-8b | Archive: `LICENSE`, README and download page move to PolyForm with the source offer, the pre-migration organisation scope and link are corrected, the missing `favicon.svg` is restored, and the 53 missing headers are added | LU-1 | Haiku | `LICENSE`, `README.md`, `web/.../download.html`, `package.json`, `public/favicon.svg` |
| LU-8c | Root and www: `LICENSE` and README to PolyForm; the one missing header; www's footer gains the licence line and a local copy of the logo its `og:image` points at (from the brand package once LU-14 exists, a copy until then) | LU-1 | Haiku | `LICENSE`, `README.md`, the header, `web/www.diyaccounting.co.uk/public/` |
| LU-8d | Spreadsheets, beyond LU-1 to LU-7: the 103 missing headers; the README's MPL line removed; `prepack.mjs` stops copying `app/templates` into the engine package and the package test asserts no template ships | LU-1 | Haiku for headers; Sonnet for prepack and its test | headers, `README.md`, `diya-gl/scripts/prepack.mjs`, `app/test/diya-gl-package.test.js` |

## Verification

- `LU-3`'s header test is the durable gate: it runs in `npm run test:fast` and fails on any file
  outside its layer.
- `LU-4`: `npm pack --dry-run` in `diya-gl/` lists `LICENSE` and `NOTICE`; a built zip lists
  `LICENCE.txt` and `README.txt`; the bundle and runner begin with the licence comment.
- `LU-5`: a generated workbook's `docProps/core.xml` carries the rights and creator fields; the
  reconciliation gates on the four `generate-*` runs stay green.
- `LU-6`: the browser suite's footer assertions; a grep for "open source" across `public/` returns
  nothing.
- `LU-9`: `npm view @diy-accounting-uk/diya-gl license` answers `Apache-2.0` for the new version and
  `AGPL-3.0-only` for 1.0.3; the download page and the zip agree.
