<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Batch b9 is merged (PR #91), prod's last green deploy is `a5085125`, and `diya-gl` 1.2.1 is on
npm. No worktree is open, no branch but main exists locally, no agent is running, and main carries
nothing after its last push. The merged `origin/claude/b9-board` is still on the remote; deleting a
branch is the operator's.

One ci environment serves every branch, so only one batch branch can hold the deploy slot. The
deploy group is keyed on the environment with `cancel-in-progress: false`, so a second branch's
push displaces the first's pending deploy rather than racing it. While two batches are live,
push the one whose PR needs to go green and let the draft's deploys wait.

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
| CQ-7 | `init.yml`'s `trigger-test-and-deploy` job is guarded by a bare `if: ${{ !cancelled() }}`, so it dispatches `deploy.yml` — prod when the ref is `main` — after a failed or skipped regeneration. Every other job in that graph pairs `!cancelled()` with `needs.<job>.result == 'success' || 'skipped'`; this one does not, and the workflow accepts `delete-packages` and `delete-tax-data` inputs, so a wipe whose regeneration failed is followed by an automatic prod deploy of the wiped tree | none | machine | — | in-flight | code on `claude/b10-board`, awaiting the branch deploy |
| CQ-8 | `/watch`'s not-a-failure list needs a fourth case: a cancelled run can be a workflow cancelling itself, when a caller and its reusable callee share a concurrency group. The tell is a cancellation with no findable replacement, then the same jobs reappearing seconds later under a different workflow name. Goes into this repository's copy and Submit's | none | machine | — | in-flight | code on `claude/b10-board`; Submit's copy still outstanding |
| CQ-9 | `#account-btn`'s accessible name and its visible label disagree: the label reads "Account" while the `title` carries the signed-in email. Setting `aria-label` to the email was proposed and is the wrong fix — it replaces the name a person sees with one they do not. Decide which the accessible name should be and make the two agree | none | machine | — | in-flight | code on `claude/b10-board`, awaiting the branch deploy |
| CQ-10 | `deploy.yml`'s Cognito toggle still passes `--client books` in both the enable and disable steps. Submit's script now takes `app|diya-gl|both` and normalises `books` as an alias, so both spellings work today; moving to `--client diya-gl` removes a future cut-over | none | machine | — | in-flight | code on `claude/b10-board`, awaiting the branch deploy |
| CQ-11 | No workflow in this repository runs `scripts/validate-workflows.sh`, so a broken workflow file reaches GitHub before anything catches it. Submit gates the same script in CI. `npm run lint:workflows` exists and nothing calls it. Add the job, and have it strict-parse the YAML too: prettier and actionlint both accept a duplicate key that GitHub rejects outright, and a rejected file stops every trigger in it firing | none | machine | — | ready-to-start | the gate submit has and this repository does not; Haiku |
| H-LU-5 | Register `diya-gl.co.uk` and `diya-gl.com` in the management account, beside `diyaccounting.co.uk`. Both were available in Route 53 on 2026-09-10 at USD 9 and USD 16 a year. Copy the contact block from the existing registration; delete the hosted zone Route 53 creates within twelve hours and it costs nothing; neither name has to resolve | PLAN_DIYA_GL_LAUNCH.md | human | — | ready-to-start | the permission classifier refuses the register call |
| H-SB-1a | Fill `donate-links.toml`'s `[ci]` section with real test-mode Payment Links: `STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-spreadsheets-setup.js`, which mints them and writes the section. Until then ci's donate page carries placeholder URLs that 404 rather than live links that take a real payment | PLAN_DIYA_GL_LAUNCH.md | human | SB-1 | blocked-to-start | needs a test-mode Stripe key the session does not hold |
| SB-3 | `web/spreadsheets.diyaccounting.co.uk/public/diya-gl/shell.js:3065` hardcodes the same live `buy.stripe.com` Payment Link that SB-1 just removed from `donate.html`, so the DIYA-GL pages' donation prompts still point at a real payment on ci. Point it at SB-1's `donate-links.toml` mechanism rather than a second hardcoded constant. `web/browser-tests/diya-gl-donation.browser.test.js:17` and `diya-gl-measurement.browser.test.js:19` hardcode the same URL as an expectation and move with it | PLAN_DIYA_GL_LAUNCH.md | machine | SB-1 | in-flight | code on `claude/b10-board`, full suite running |
| SED-10 | The self-employed ITSA field set changes by tax year and the derivation ignores it: `sa103-mtd-mapping.json`'s `api.years` records two allowances gone from 2025-26, an adjustment gone from 2026-27 and two fields added, and `se-derivations.js` reads none of it, so a 2025-26 book can carry a field HMRC no longer accepts | PLAN_ITSA_SE_DERIVATIONS.md | machine | — | in-flight | code on `claude/b10-board`; the five moving fields have no source cell |
| SET-1 | `SE Full!O122` is box 46, captioned "Total disallowable expenses (total of boxes 32 to 45)", and it reads `'Profit & Loss Account'!B34` instead of summing those boxes. It feeds box 61 (`D174`), box 64 and the tax computation. Value-neutral today because every other O-cell in that block is empty, which is what makes it provable against the committed reports before anything else moves | PLAN_SE_TEMPLATE_GAPS.md | machine | — | ready-to-start | a caption and a formula that disagree; its own commit, Sonnet |
| SET-2 | Purchases needs an entertainment column so box 20 stops being lumped with advertising: column AC is free and contiguous, the A1 check extends to `SUM(P1:AC1)`, and P&L row 27's twelve month formulas, VitalTax rows 18/25/29 and `SE Short!O60` follow it. `SE Short!O60`'s caption already says entertaining is not allowable while the cell reads the combined row | PLAN_SE_TEMPLATE_GAPS.md | machine | SET-1 | blocked-to-start | shares the P&L block with SET-3; Sonnet |
| SET-3 | Boxes 32 to 45 have empty cells in `SE Full` already, so the missing input is a disallowable percentage per category, in `VitalTax!I36:I50` where the "Not captured in DIY Accounting" note sits now. `C36 = C7*$I$36` per row, the `SE Full` O-cells read `VitalTax!G`, and `SE Short` boxes 11 to 20 go net of their share. This is the step that moves the tax computation | PLAN_SE_TEMPLATE_GAPS.md | machine | SET-1 | blocked-to-start | can share a commit with SET-2; Sonnet |
| SET-4 | Boxes 51, 53.1 and 73.3 are the three that genuinely have no cell. Box 51 needs a second pool on `Fixedassets.xlsx!Schedule` plus a rate cell at the free `Admin!G6`; box 53.1 cannot be dropped in, because `O160` is box 59 today and the rows below need laying out afresh. The other seven of SED-7 and SED-8's twelve already print a cell the engine reads as blank, so they need a book field and a writer, not a template change | PLAN_SE_TEMPLATE_GAPS.md | machine | SET-3 | blocked-to-start | the leftover after the percentages land; Sonnet |
| MR-1 | Associated companies: the marginal relief limits are divided by one plus the count, and nothing carries the count. Add an `Admin!P14` input beside the existing `P8`, `P9`, `P12`, `P13` rates (written by `app/products/ltd.js:1450-1453` from `app/data/ltd-*.toml`), divide both apportioned limits on `CorporationTax` rows 33 and 34 by `(1+Admin!$P$14)`, and fill the two CT600 boxes that already exist in `app/data/filing/ct600-v3.toml` with no formula behind them. `calculateCorporationTax` in `app/lib/tax/corporation-tax.js` takes the limits, so it takes the divisor too | PLAN_LTD_MARGINAL_RELIEF.md | machine | — | in-flight | code on `claude/b10-board`, full suite running |
| MR-4 | A DIYA-GL book has no field for the number of associated companies, so the count only reaches the engine from a scenario's business block and a real book still gets the full limits on the export path. `app/lib/xlsx-exporter.js:1994` records that the schema declares `tax.corporationTax.associatedCompanies` and no `app/data/*.toml` carries it. Decide whether the count belongs on `entityInformation` beside `diya-gl:companyNumber` (a company fact, which is what it is) or under `tax.corporationTax` (where the schema already names it), then carry it through `diyaGlToScenario` | PLAN_LTD_MARGINAL_RELIEF.md | machine | — | ready-to-start | one of two existing conventions has to win; Opus to decide, Sonnet to build |
| SB-1 | `donate.html` hardcodes four live `buy.stripe.com` Payment Links, so ci and prod both point at real payments and no donation flow can be exercised without taking one. Generate the page at build time from a template with per-environment links, using the existing `scripts/stripe-spreadsheets-setup.js` to mint the test-mode ones | PLAN_DIYA_GL_LAUNCH.md | machine | — | in-flight | code on `claude/b10-board`; ci links are placeholders |
| MR-2 | Franked investment income: relief is `(U - A) x N/A x F`, where A is augmented profits and N taxable total profits. With no input for franked investment income A equals N, the ratio is 1, and the formula silently degenerates. Needs an input cell, the ratio in the relief formula, and a scenario that exercises it | PLAN_LTD_MARGINAL_RELIEF.md | machine | — | ready-to-start | MR-1 landed the Admin block and the relief formula it shares; Sonnet |
| MR-3 | A period straddling a rate change: one `ltd-<FY>.toml` feeds both tax rows and the run asserts both carry the same small profits rate. Dormant while every financial year from 2020 carries the rates of the one after it, and live the moment one does not | PLAN_LTD_MARGINAL_RELIEF.md | machine | — | ready-to-start | MR-1 landed the divisor it builds on; Sonnet, with a two-rate fixture |
| SB-2 | Confirm the GA4 e-commerce events `ecommerce-events.js` and `download-page.js` fire on a download and a donation, and that nothing was lost when the pages moved to `/diya-gl/`. Verification, with code changes only if it finds something | PLAN_DIYA_GL_LAUNCH.md | machine | H-SB-1a | blocked-to-start | needs real test-mode links before a donation can be driven |

## Plans not tracked here

- `PLAN_DIYACCOUNTING_BRAND.md`: the brand in three parts — one source for the marks and tokens,
  the trade mark filings, and what recovering `diyaccounting.com` would take.
- `PLAN_DIYA_GL_LAUNCH.md`: carries the launch posts, the Rust port, the operator's research, and
  now the two rows the uplift handed over — the domain registrations (H-LU-5, on the board) and the
  HMRC licence note (H-LU-9) — plus the donation sandbox and events, `SB-1` and `SB-2`.
- `PLAN_LTD_MARGINAL_RELIEF.md`: the three gaps in the Corporation Tax relief, on the board as
  `MR-1` to `MR-3`. MR-1 is the one a customer feels.
- `PLAN_ITSA_SE_DERIVATIONS.md`: its section 8 findings carry `SED-n` ids, the same ids the board
  uses. SED-1, 4, 5, 6 and 9 are closed there; SED-2, 3, 7, 8 and 10 are the open ones.
- `BRIEF_OPERATOR_TASKS_2026-09-10.md`: the two that need drafting rather than doing, written out
  with the addresses and the facts.
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
