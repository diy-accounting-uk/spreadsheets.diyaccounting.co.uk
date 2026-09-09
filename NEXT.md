<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

The licensing uplift runs on the batch branch `claude/lu-1-terms`, draft PR #86, one worktree per
group under `../.worktrees/`. Landed on the batch: LU-1, LU-2, LU-4, LU-7, LU-8d, LU-18, LU-19 and
CQ-1. Sibling-repository PRs open: the tap's #1 (LU-17), root's #28 and www's #27 (LU-8c); each
merges on the operator's word, the tap's after the rename.

| Group | Rows | Worktree | Branch | Model |
| --- | --- | --- | --- | --- |
| 1B pages | LU-6, LU-11, README lines | `spreadsheets/lu-1b` | `claude/lu-1b-pages` | Sonnet |
| 1D workbooks | LU-5 | `spreadsheets/lu-5` | `claude/lu-5-workbooks` | Opus |
| 1F archive | LU-8b | `archive/lu-8b` | `claude/lu-8b-terms` | Haiku |

Wave 2 follows: LU-3's header sweep once the pages and workbooks rows merge, so the sweep touches
nothing in flight. LU-20's rename on GitHub is the operator's command:
`gh repo rename homebrew-diya-gl -R diy-accounting-uk/homebrew-tap --yes`.

Publishing is automatic: every green prod deploy from a push to main publishes the next `diya-gl`
version, pushes the image and rolls the version; the tap tracks npm hourly. Sub-agents run no
LibreOffice and prove JS calculations against the committed packages' extraction
(`report.js --source-dir`). A fresh worktree needs `node scripts/build-books-bundle.mjs` before
any DIYA-GL browser spec, and a rebuild after merging engine changes. The generate workflows cancel
their own in-progress run on a push to their ref, so a session pushes nothing to a branch while a
generate run is in progress on it. `PLAN_DIYA_GL_LAUNCH.md` is the launch and revenue plan of
record and carries its own open items.

## Context for the open rows

The `LP` rows are `PLAN_DIYA_GL_LAUNCH.md`'s task list, same ids; each row's
brief lives there under "Briefs". LP-12 to LP-14 (the Rust port) and LP-19, LP-20 (Filing) stay
in the plan until their phase opens. They pack into four workstreams by area of change, each a batch
branch `claude/b<n>-<topic>` with one worktree per row:

- **Workstream A, the DIYA-GL engine and the package** (LP-1 to LP-4): `app/lib` and `app/bin`,
  `package.json`, `scripts/build-books-bundle.mjs`, the workflows. Sonnet throughout; LP-1 first,
  the rest in series on its output.
- **Workstream B, the web pages** (LP-5 to LP-9): `web/spreadsheets.diyaccounting.co.uk/public/`
  and `scripts/`. LP-6, LP-7 and LP-8 share no file and run at once; LP-5 waits on LP-1; LP-9 waits
  on G1. Sonnet, except the spec page on Opus.
- **Workstream C, distribution** (LP-10, LP-11): after the package. Haiku for the mechanical
  half; the launch posts are the operator's.
- **Workstream D, the cloud** (LP-15 to LP-18): the Submit repo's CDK and Lambdas
  (`../submit.diyaccounting.co.uk/infra/main/java/co/uk/diyaccounting/submit/stacks/`,
  `IdentityStack.java`, `ApiStack.java`, `BillingWebhookStack.java`) plus this repo's DIYA-GL
  pages. Two design waves on Opus (LP-16, LP-17), then Sonnet. Every AWS change goes through a
  Submit PR and its deploy workflow (H9), never a console write.


## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| CQ-1 | Bump `joi` to 18.2.5 in `package-lock.json` (transitive through `wait-on`); Dependabot alerts 84 and 85 | none | machine | — | done | on the batch, 651508dd |
| LU-1 | Licence files: root `LICENSE` to PolyForm Internal Use 1.0.0 with the accountants' grant; `diya-gl/LICENSE` (Apache-2.0) and `diya-gl/NOTICE`; the schemas' licence file; `LICENSING.md` mapping every directory to its layer with the source offer and the copyright line | PLAN_LICENSING_UPLIFT.md | machine | — | done | on the batch, 40638b4b |
| LU-8d | The engine package stops shipping the templates: `prepack.mjs` excludes `app/templates`, the writer fetches them from the site at first use under PolyForm and caches them; the package test asserts no template ships; the README's MPL line goes | PLAN_LICENSING_UPLIFT.md | machine | — | done | on the batch, 40638b4b |
| LU-19 | The engine announces its terms: `diya-gl --version` prints the version, Apache-2.0 and the copyright line; the MCP server's `instructions` carry them | PLAN_LICENSING_UPLIFT.md | machine | — | done | on the batch, 40638b4b |
| LU-6 | The public statement: the footer gains the licence and a source link on the eleven site pages and a footer on the four DIYA-GL pages; the download page paragraph rewritten; the spec page's licence section naming the three layers; every "open source" phrase goes | PLAN_LICENSING_UPLIFT.md | machine | — | in-flight | `lu-1b`; the browser run then the commit |
| LU-7 | The names and the door: `TRADEMARKS.md`, the README's no-contributions line, `SECURITY.md` | PLAN_LICENSING_UPLIFT.md | machine | — | done | on the batch, c755e1c8 |
| LU-3 | Headers: every comment-capable file carries the SPDX identifier for its layer and `Copyright (C) 2006-2026 DIY Accounting Limited`; a unit test walks the tree and fails on a missing or mismatched header; the 103 missing headers | PLAN_LICENSING_UPLIFT.md | machine | LU-6, LU-5 | blocked-to-start | group 1C; waits for LU-6 and LU-5 to merge |
| LU-4 | Distributed copies carry their terms: `LICENCE.txt` and `README.txt` in every spreadsheet zip; licence comments at the head of the engine bundle and the single-file runner; the bundle build keeps jszip's and smol-toml's legal comments | PLAN_LICENSING_UPLIFT.md | machine | — | done | on the batch, dbf53917 |
| LU-5 | The workbooks and guides state their copyright: the generator writes creator and rights into every workbook's core properties; a licence line on each product's front sheet through the reconciliation gates; the guide PDFs get author and rights metadata | PLAN_LICENSING_UPLIFT.md | machine | — | in-flight | `lu-5`; front-sheet line and docProps |
| LU-8b | Archive: `LICENSE`, README and download page to PolyForm with the source offer; the 17 pre-migration organisation links and the package scope corrected; the missing `favicon.svg`; the 53 missing headers; one `LICENCE.txt` per package tree | PLAN_LICENSING_UPLIFT.md | machine | — | in-flight | `archive/lu-8b` |
| LU-8c | Root and www: `LICENSE` and README to PolyForm; the missing headers; www's footer gains the licence line, a local copy of its `og:image` logo, and one spelling of the company name | PLAN_LICENSING_UPLIFT.md | machine | — | done | root PR #28, www PR #27 |
| LU-20 | Rename the tap repository to `homebrew-diya-gl` on GitHub (GitHub redirects the old name); the follow-through edits ride LU-17, the spec builder's line rides LU-6 and the package README rides LU-8d | PLAN_LICENSING_UPLIFT.md | human | — | ready-to-start | `gh repo rename homebrew-diya-gl -R diy-accounting-uk/homebrew-tap --yes`; the classifier blocked the session |
| LU-10 | The filing pack: the IPO and TMView searches recorded; goods and services wording for classes 9, 42 and 35 from the IPO's pre-approved terms; the series-rule check for the two composite marks; the first-use evidence; the ™ usage rules in `TRADEMARKS.md` | PLAN_LICENSING_UPLIFT.md | machine | — | done | on the batch; the searches are the operator's to run by hand |
| H1 | Merge Submit PR #159 (batch 14, carrying B63: the ci behaviour role may read prod's Identity stack) | operator | human | — | ready-to-start | checks running on the 01:22 UTC push; merge on green |
| LU-2 | Manifests and metadata: `license` in `diya-gl/package.json` and the root `package.json`; the Dockerfile's OCI licence label; README badges; CDK tags if any name a licence | PLAN_LICENSING_UPLIFT.md | machine | LU-1 | done | on the batch, 34dc1282 |
| LU-18 | Third-party lines in `NOTICE` and `LICENSING.md`: the XBRL International GL adaptation, the PolicyBee logo, jszip and smol-toml, the vendored `qrcode.min.js` in Submit | PLAN_LICENSING_UPLIFT.md | machine | LU-1 | done | on the batch, 34dc1282 |
| LU-11 | ™ on DIY Accounting Spreadsheets, DIY Accounting Submit and DIYA-GL across the footer, the spec page and the package README, in LU-6's PR | PLAN_LICENSING_UPLIFT.md | machine | LU-6 | in-flight | rides LU-6 in `lu-1b` |
| LU-17 | The tap: its own Apache `LICENSE`; `update-formula.sh` reads the licence from the registry instead of hardcoding AGPL; headers; README and both install lines follow the rename | PLAN_LICENSING_UPLIFT.md | machine | LU-20 | done | tap PR #1, merges after the rename |
| LP-24 | The ci pages target Submit's released environment: one cloud config for every host (prod API, prod hosted UI, prod DIYA-GL client), the ci behaviour run mints its user in the prod pool through the prod role, the sign-in case probes the prod API | operator | machine | H1 | blocked-to-resume | PR #84 open; smoke mint denied until H1; toggle steps follow |
| H2 | Merge PR #84 (`claude/lp-24-prod-target`) | operator | human | LP-24 | blocked-to-start | waits for a green smoke test after H1 |
| LP-17 | Sign-in and "save to my account" on the DIYA-GL pages: hosted-UI redirect, token held in session, the book list, put and get through the storage API, conflict shown not merged; the same page on mobile | PLAN_DIYA_GL_LAUNCH.md | machine | LP-24 | blocked-to-resume | steps 1 to 10 on main; the case's first green run needs LP-24 |
| LU-9 | The first release under the new terms: the package and root at 1.1.0; the prod deploy publishes it under Apache-2.0 with the image; the generate dispatches rebuild every package with `LICENCE.txt` and the workbook properties; then deprecate npm 1.0.0 to 1.0.3 and delete the old GHCR tags | PLAN_LICENSING_UPLIFT.md | machine | LU-2, LU-3, LU-4, LU-5, LU-6, LU-8d, LU-17, LU-19, H-LU-3 | blocked-to-start | Sonnet, verification and the deprecations by PR and CLI on the operator's merge |
| LU-8a | Submit: canonical PolyForm `LICENSE` with the grant; `terms.html` and `accessibility.html` say free to use, source available; the 28 `-or-later` headers and the battery-pack mix; `info.license` in the OpenAPI generator; the missing headers; the stale simulator copy | PLAN_LICENSING_UPLIFT.md | machine | operator | blocked-on-busy | group 1E; Sonnet, Opus for the terms wording; the Submit repository is paused |

## Plans not tracked here

- `PLAN_LICENSING_UPLIFT.md`: the urgency 1 rows, the filing pack and the two unblocking human rows are
  on the board; the urgency 2 filings (H-LU-4, H-LU-5), the HMRC note (H-LU-9), the generate dispatch
  (H-LU-3) and the brand repository (urgency 3) stay in the plan until their turn. Everything that
  touches `submit.diyaccounting.co.uk` is blocked on busy until the operator's word.
- `PLAN_DIYA_GL_LAUNCH.md` carries its own open items (the launch posts LP-10, the Rust port plan
  and the operator's research); Submit's `NEXT.md` carries B50 (the DIYA-GL app client in the native-auth toggle), B54 (the `resident-diya-gl` bundle, LP-21 there, done) and B55 (checkout and the portal for DIYA-GL tokens). Its phase rows are not yet on the board.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first). A generate workflow's commit job pushes with the default
  `GITHUB_TOKEN`, which fires no workflow, so a package commit deploys only through
  `gh workflow run deploy.yml -f environment-name=prod` or the 07:17 UTC schedule.
