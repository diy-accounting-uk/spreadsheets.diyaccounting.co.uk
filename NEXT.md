<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Urgency 1 of the licensing uplift has shipped: every repository's PR is merged, the four generate
runs and the prod deploy of 2026-09-09 19:15 UTC rebuilt every package with `LICENCE.txt` and the
workbook properties, and npm carries `diya-gl` 1.1.2 under Apache-2.0. Urgency 1 is closed: npm
1.0.0 to 1.0.5 are deprecated and the pre-Apache GHCR tags are deleted, so GHCR holds 1.1.0, 1.1.1
and 1.1.2 with `latest` on 1.1.2. ITSA-T8 is ready; LP-24's toggle steps are ready to resume with
the variable set. The naming sweep is written up in `../submit.diyaccounting.co.uk/PLAN_DIYA_GL_NAMING.md`; its
spreadsheets rows NM-2 to NM-5 are on the board and Submit's NM-S1 to NM-S3 on Submit's.

Both batches are green and waiting on one merge. PR #89 has 25 checks passing and PR #90, still
draft behind it, has 38. No agent is running and no worktree has uncommitted work. The cloud case
passes end to end on both branches, against prod, including the renamed page globals.

Two batches are in flight. `claude/b7-board` is PR #89, carrying the naming chain, the ITSA
derivations and the toggle; its one open defect is the cloud case's tail, LP-28, worktree `lp27`.
`claude/b8-board` is PR #90, a draft branched off b7 and held draft until #89 merges, carrying
TD-1, NM-9 and NM-6 in worktrees `td1`, `identity` and `nm6`.

One ci environment serves every branch, so only one batch branch can hold the deploy slot. The
deploy group is keyed on the environment with `cancel-in-progress: false`, so a second branch's
push displaces the first's pending deploy rather than racing it. While two batches are live,
push the one whose PR needs to go green and let the draft's deploys wait. A wave starts from
the sequenced board on a branch off the previous stable one; the earlier worktrees were:
`naming` (branch `claude/b7-naming`, the NM-3 to NM-2 chain, serial because they share
`download.html`), `itsa` (`claude/b7-itsa`, T8's design wave on Opus) and `lp24`
(`claude/b7-lp24`). Each forks from main and opens by merging the batch branch. The coordinator
merges each verified commit into `claude/b7-board` and pushes in batches, so one branch deploy
covers the wave.

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
| LP-26 | The cloud case's step 8: a book saves but never appears as a row in the account list, so either the list call or the row render is wrong | operator | machine | — | in-flight | on b7; the cloud case is green end to end |
| LP-27 | The cloud case's step 9: the donation prompt painted over the account panel at equal z-index, so every row button was a dead click | operator | machine | — | in-flight | on b7; the cloud case is green end to end |
| LP-28 | The cloud case from step 10 to the end: delete, sign out and their assertions, none of which have ever run because the case was blocked at step 7 for its whole life | operator | machine | LP-27 | in-flight | on b7; the cloud case is green end to end |
| CQ-3 | Two branch deploys of the one ci stack raced and CloudFormation refused the loser; the deploy group is now the target environment and deploys queue rather than cancel | none | machine | — | in-flight | on b7; the cloud case is green end to end |
| NM-6 | Rename the `window.DiyaGl*Books*` global family: `DiyaGlBooksPage`, `DiyaGlBooksCloud`, `DiyaGlBooksEdits`, `DiyaGlBooksLoader`, `DiyaBooksAutosave` and `DIYA_BOOKS_SNAPSHOT`, across `shell.js`, `cloud.js`, `data.js`, `edits.js`, `headlines.js`, `save.js` and about 30 browser test files | ../submit.diyaccounting.co.uk/PLAN_DIYA_GL_NAMING.md | machine | — | in-flight | on b8; PR #90 is green and draft behind #89 |
| LP-24 | The ci behaviour run switches native sign-in on for the prod DIYA-GL client before the cloud case and off after it, through Submit's `toggle-cognito-native-auth.js enable|disable prod --client books` under the prod role | operator | machine | — | in-flight | on b7; the cloud case is green end to end |
| NM-3 | Rename the `/books/*` public URL namespace to DIYA-GL: `public/books/**`, `download.html`'s hrefs, the manifest and service worker, with `redirects.toml` and CloudFront function entries for every old path | ../submit.diyaccounting.co.uk/PLAN_DIYA_GL_NAMING.md | machine | — | in-flight | on b7; the cloud case is green end to end |
| NM-4 | Rename the same-repo "books" code identifiers: `books-engine.js`, `books-interchange.js`, `build-books-bundle.mjs`, 46 test filenames, `download.html`'s DOM ids, `books-events.js`, `books.css`, and the `"diya-gl-books"` format string (decided: `diya-gl/1`, the reader keeps accepting the old stamps; needs a version bump and a back-compat reader) | ../submit.diyaccounting.co.uk/PLAN_DIYA_GL_NAMING.md | machine | NM-3 | in-flight | on b7; the cloud case is green end to end |
| NM-2 | Rename "books" to "DIYA-GL" in prose: docs, comments, page copy and 46 test files' titles | ../submit.diyaccounting.co.uk/PLAN_DIYA_GL_NAMING.md | machine | NM-4 | in-flight | on b7; the cloud case is green end to end |
| ITSA-T8 | The two self-employed derivations in the DIYA-GL package, `buildSelfEmploymentQuarterlyUpdates` and `buildSelfEmploymentAnnualSubmission` (Submit's ITSA phase 2, track T8): `app/lib/calculators/se-derivations.js` and its tests, proved cell by cell against the self-employed package's own report over every example | ../submit.diyaccounting.co.uk/PLAN_ITSA_PHASE_2.md | machine | — | in-flight | on b7; the cloud case is green end to end |
| TD-1 | The four self-employed template defects the ITSA mapping proved with hand figures: the box 44 loss on disposal, VitalTax turnover excluding sales code d, grants sent to quarterly other income instead of box 75, and the small pools write-off filed as an enhanced capital allowance | PLAN_ITSA_SE_DERIVATIONS.md | machine | — | in-flight | on b8; PR #90 is green and draft behind #89 |
| NM-9 | A pull-request check failing any commit whose author email is not on `.github/allowed-commit-identities.yml`, after 20 commits were authored `noreply@anthropic.com` by a sub-agent setting the identity inline | operator | machine | — | in-flight | on b8; PR #90 is green and draft behind #89 |
| H1 | Merge the batch pull request for `claude/b7-board` once its checks are green | none | human | LP-24, NM-3, NM-4, NM-2, ITSA-T8 | blocked-to-start | PR #89 is green: 25 checks passed, nothing failing |
| H2 | Decide how this repository consumes Submit's two scripts, which our runners fetch from their main by raw URL at run time: pin to a commit, have them publish the scripts, or record the contract in both repositories | operator | human | — | ready-to-start | binds both repositories; Submit leans to us pinning |
| NM-7 | Decide what happens to the `diya-books-*` localStorage keys and the IndexedDB database name, which carry the old branding but hold customers' saved drafts | ../submit.diyaccounting.co.uk/PLAN_DIYA_GL_NAMING.md | human | — | ready-to-start | a rename orphans saved drafts unless a migration is written |
| NM-5 | Design and rename the cross-repository "books" identifiers this side touches: `public/books/cloud.js`'s API calls, the Cognito client naming, `PLAN_DIYA_GL_CLOUD_PAGE.md`, against Submit's `BooksStack` and the shared route table | ../submit.diyaccounting.co.uk/PLAN_DIYA_GL_NAMING.md | machine | S3d | blocked-to-start | S3a's design is done; the cloud.js change waits for S3d on prod |
| LP-25 | The cloud behaviour case saves a book at roughly 20KB and one at roughly 500KB, two bands above CloudFront's 8KB inspection boundary, as end-to-end evidence for Submit's WAF body-size fix | operator | machine | LP-24 | blocked-to-start | Submit asked; runs once their WAF fix is on prod, Sonnet |
| CQ-4 | Pin the raw-URL fetches of `ensure-cognito-test-user.js` and `toggle-cognito-native-auth.js` so a merge to Submit's main stops being a release to our runners | none | machine | H2 | blocked-to-start | three call sites in `deploy.yml`; Haiku once the shape is chosen |
| NM-8 | Move the packaged engine's `DEFAULT_TEMPLATE_SOURCE` from `/books/assets/` to `/diya-gl/assets/` once the live site serves the new path, and update the fetch test's expected URL with it | ../submit.diyaccounting.co.uk/PLAN_DIYA_GL_NAMING.md | machine | H1 | blocked-to-start | the redirect keeps published versions working either way, Haiku |
| LP-17 | Sign-in and "save to my account" on the DIYA-GL pages: hosted-UI redirect, token held in session, the book list, put and get through the storage API, conflict shown not merged; the same page on mobile | PLAN_DIYA_GL_LAUNCH.md | machine | LP-24 | blocked-to-resume | steps 1 to 10 on main; the case runs against prod after LP-24 |

## Plans not tracked here

- `PLAN_LICENSING_UPLIFT.md`: the urgency 2 filings (H-LU-4, H-LU-5) and the brand repository
  (urgency 3) stay in the plan until their turn.
  Submit's share is `../submit.diyaccounting.co.uk/PLAN_LICENSING_UPLIFT_SUBMIT.md`, tracked on
  Submit's own board as B70.
- Submit's `PLAN_ITSA_PHASE_2.md` names track T8 in this repository's package; their B11.T9 waits
  on it.
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
