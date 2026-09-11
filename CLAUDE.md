<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# Claude Code Memory - DIY Accounting Spreadsheets

> **Shared conventions** (git workflow, AWS accounts, code quality, confirm behavior, security): See `../CLAUDE.md`

## Context Survival (CRITICAL — read this first after every compaction)

**After compaction or at session start:**

1. Read all `PLAN_*.md` files in the project root — these are the active goals
2. Run `TaskList` to see tracked tasks with status
3. Do NOT start new work without checking these first

**During work:**

- When the user gives a new requirement, add it to the relevant `PLAN_*.md` or create a new one
- Track all user goals as Tasks with status (pending -> in_progress -> completed)
- Update `PLAN_*.md` with progress before context gets large

**PLAN file pattern:**

- Active plans live at project root: `PLAN_<DESCRIPTION>.md`
- Each plan has user assertions verbatim at the top (non-negotiable requirements)
- Plans track problems, fixes applied, and verification criteria
- If no plan file exists for the current work, create one before starting
- Never nest plans in subdirectories — always project root

## Quick Reference

This repository manages the **spreadsheets AWS account** (064390746177) for spreadsheets.diyaccounting.co.uk:

- **S3 + CloudFront static site** for `spreadsheets.diyaccounting.co.uk`
- **SpreadsheetsStack**: S3 bucket, CloudFront distribution with OAC, CloudFront Function for URL redirects
- **Redirect engine**: CloudFront Function generated from `web/spreadsheets.diyaccounting.co.uk/redirects.toml`
- **Package pipeline**: Excel workbooks in `packages/` -> zips in `target/zips/` -> S3 sync
- **Donations**: Stripe Payment Links (buy.stripe.com) and PayPal donate form

**What this repo does NOT have**: Lambda, DynamoDB, Cognito, API Gateway, Docker, ngrok, HMRC. DNS records are managed by the root repo.

## Product Context and Skills Documentation

### Product Context Documents

- `CONTEXT_BASIC_SOLE_TRADER.md` — Basic Sole Trader (BST) product: single-file, sheet map, data flow, scenarios, CI pipeline
- `CONTEXT_TAXI.md` — Taxi Driver product: single-file, mileage comparison, date pre-filling, scenarios, CI pipeline
- `CONTEXT_SELF_EMPLOYED.md` — Self Employed (SE) product: multi-file, external links, recalculation pipeline, scenarios, CI pipeline
- `CONTEXT_LIMITED_COMPANY.md` — Limited Company (Ltd) product: multi-file, 15 xlsx, non-March transforms, all year-end months, scenarios, CI pipeline

### Skills

Skills live at `.claude/skills/<name>/SKILL.md`, each with a root symlink (`SKILL_<NAME>.md`) for
convenience — gitignored, recreate with `ln -s` if missing.

- `.claude/skills/excel/SKILL.md` — Excel XML manipulation techniques, xls roundtrip, external link caches, multi-file recalculation, testing approaches, known pitfalls
- `.claude/skills/package-updates/SKILL.md` — Annual tax data update process, HMRC rate sources, TOML file structure, publishing workflow
- `.claude/skills/plain-prose/SKILL.md` — writing rules for plain, human prose; follow this for all human-facing text (docs, comments, chat)
- `.claude/skills/do-next/SKILL.md` — dispatch `NEXT.md`'s open items as worktree-isolated sub-agents
- `.claude/skills/board/SKILL.md` — render the work board from `NEXT.md`: in-flight and open items with their source plan; invoke as `/board`
- `.claude/skills/watch/SKILL.md` — watch GitHub CI on main and every open PR's head branch until the whole scope is green, and fix what goes red; invoke as `/watch`
- `.claude/skills/archive-packages/SKILL.md` — take a cut of the generated packages into `diy-accounting-archive` as one reviewed commit

Note: Read the relevant skill when working on that product or technique. They contain detailed sheet maps, formula references, and CI pipeline descriptions that are essential context.

## Git Workflow

See `../CLAUDE.md` for full rules.

Branch naming: `claude/<ns>-<n>-<topic>` for one of a series, `claude/<ns>-<topic>` otherwise.
`<ns>` is a short tag for the area (`ltd`, `itsa`, `vat`, `ops`, `cdk`, `docs`; `b` for a board
batch), `<n>` the series number, `<topic>` one or two words. A narrow branch dropdown shows only
the first characters after `claude/`, so they carry the distinction: `claude/ltd-1-ch-file`,
`claude/ltd-2-ch-file`, `claude/ltd-hmrc-submit`, `claude/b7-board`. Never a generic preamble
or a series number at the end (`claude/a-few-batches-1`,
`claude/consistent-preamble-hiding-specificity`).

## Build Commands

```bash
npm install
node scripts/build-spreadsheets-redirects.cjs
node app/bin/build-sitemaps.js
./mvnw clean verify
node app/bin/build-packages.js
npm run cdk:synth
```

## Testing

```bash
npm test                                    # The router: it reads the diff and runs the tiers that diff reaches
npm test -- --plan                          # Print the tier selection and the estimate, run nothing
npm test -- --all                           # Every tier, every product, the full browser suite
npm test -- --base HEAD~1                   # Route against a different comparison point
npm run test:browser                        # The whole Playwright browser suite
npm run test:spreadsheetsBehaviour-local    # Behaviour tests against local server (localhost:3000)
npm run test:spreadsheetsBehaviour-ci       # Behaviour tests against CI environment
npm run test:spreadsheetsBehaviour-prod     # Behaviour tests against production
```

`npm test` is `scripts/test-scope.mjs`. It diffs against the merge base with `origin/main`, maps
the changed paths through the routing table in that file, and runs five tiers in cost order:
gates (fixture sync, diya-gl parity, prettier) and unit always, then calc (the LibreOffice
recalculations), browser and infra only when the diff reaches them. It prints the tiers it picked
and the paths that picked them before it runs anything, and ends on one `VERDICT:` line built from
exit codes. **Name `npm test` in a brief and nothing else** — a brief that names a narrower command
caps the scope at whatever its author imagined, which is the mistake the router exists to remove.

When the router cannot work out what changed, it runs more, not less: a detached HEAD, a missing
`origin/main`, a shallow clone or an empty diff all escalate to the full set and say so.

`SKIP_LIBREOFFICE=1` still works for a debug loop and can no longer lie: the verdict comes back
`PARTIAL (libreoffice skipped)`, and `.githooks/pre-push` clears the variable so it cannot reach the
push gate. `TEST_SCOPE_TIERS` narrows the router to the tiers one environment owns, for CI jobs that
split the tiers between them; anything it excludes prints as `DELEGATED` and the verdict is
`PARTIAL`.

A tracked `.githooks/pre-push` routes the tests over everything the push adds to the remote.
`npm install` points `core.hooksPath` at `.githooks` through `.githooks/install.mjs`, so a fresh
clone and every new worktree inherit it. In a real hurry, `SKIP_PUSH_TESTS=1 git push` runs the
gates tier alone and prints what it did not run, which beats `--no-verify` running nothing silently.

Behaviour tests use the `SPREADSHEETS_BASE_URL` environment variable to target different environments. Output is automatically teed to `spreadsheetsBehaviour.log` in the project root.

## Reconciliation-bug method

The working method behind the reconciliation coverage waves. Follow it for any change to
checks, fixtures, or the judge.

- **Discover from the XML, never from docs or assumption.** A cell's meaning comes from the
  template's own labels and formulas (JSZip) cross-checked against the generator's write map
  in `app/lib/generator.js`. The `CONTEXT_*.md` cell maps have been wrong before. Products
  reuse layouts with rows shifted (Taxi's tax bands sat at BST's positions; SE's sit one row
  above BST's) — verify per product.
- **Assert what the sheet actually computes, anchored to the fixture.** A check comparing a
  value to itself, or to a figure derived the same way, can never fail. Anchor one side in
  the scenario data so self-consistent-but-wrong cannot pass. Where the sheet's behaviour is
  a shipped-template limitation, assert the behaviour as it is and add a warning carrying
  the true figure — never a check that hardcodes failure or asserts the defect as correct.
- **Prove every check breakable.** Corrupt one cached `<v>` via JSZip in a copy of the
  recalculated package and assert the exact failure set — the intended checks flip, nothing
  else. A check without this proof does not exist.
- **Fixture changes are source-derived.** Edit the master data (`examples/precision-code-ltd/`)
  or the extractor build sections, then `node app/bin/extract-scenarios.js`; the CI sync gate
  reverts hand-edited generated TOMLs. Every new transaction carries its counter-leg so
  `TrialBalance!EJ91` stays 0. The brickwork TOMLs are source-derived too
  (`app/bin/extract-scenarios.js` writes them), so nothing here is safe to hand-edit.
- **Runner conventions.** `additionalReads` results are keyed `<filename>!<sheetName>`.
  Month-keyed expectations follow the period-frame shift in `ltd.js` (dates shift by the gap
  between the book's declared period and the package's, with end-of-month clamping).
- **Run LibreOffice tests in parallel, and put a progress signal on it.** `vitest.config.js` caps
  vitest at four workers, so pass no concurrency flag at all. The profile-lock hazard that the old
  serial rule was written for is fixed in `app/lib/spreadsheet-runner.js`: every soffice call gets
  a random work directory and its own `-env:UserInstallation`, so concurrent instances share
  nothing. Measured on the gated files, all 92 tests green at every setting: serial 272s, two
  workers 150s, four 145s, eight 146s. Long runs still need a liveness signal armed before you
  start, not after you begin to doubt it. A fresh `soffice` in `ps` is the honest one; the log is
  not, because vitest's reporter buffers its per-file lines to the end once it is piped to a file.
  **An empty log is therefore evidence of nothing.** Use `--reporter=tap-flat`, which the router
  already passes, for a log that grows while the run is alive. Read the process table before
  concluding a long run is stuck: parents at 0% CPU in state `S` with a child soffice seconds old
  is what healthy looks like here.
- **Judge triage discipline.** When the LLM judge fails a run, classify each concern: a real
  defect is fixed at source with a new deterministic check (so its class stops needing the
  judge); a context gap gets a new indicator in `app/lib/report-indicators.js` or a per-product
  note in `app/bin/judge-reconciliation.js`. The rubric's standards are never softened. Template
  defects the fixtures cannot fix become NEXT.md items with the hand-computed evidence.
- **Verification ladder per change**: `npm test` on the change → the featured scenario
  reconciles RECONCILES → the pre-push hook's routed run → the four `generate-*` workflows
  dispatched with skip-commit on the branch (deterministic gates plus the live judge under
  OIDC) → merge → generate-commit refresh runs so the committed reports match.

## CDK Architecture

**Single CDK application** (`cdk-spreadsheets/`):

- Entry point: `SpreadsheetsEnvironment.java` -> `spreadsheets.jar`
- Stack: `{env}-spreadsheets-SpreadsheetsStack` (S3 + CloudFront + OAC + redirects)

**Java packages** (`co.uk.diyaccounting.spreadsheets`):

- `spreadsheets` — `SpreadsheetsEnvironment.java` (CDK app entry point)
- `spreadsheets.stacks` — `SpreadsheetsStack.java` (S3 + CloudFront + OAC + CloudFront Function)
- `spreadsheets.utils` — `Kind.java` (logging), `KindCdk.java` (CDK utilities)

## Web Content

Static site files live in `web/spreadsheets.diyaccounting.co.uk/public/`. This is the document root deployed to S3.

Key pages: `index.html` (product catalogue), `download.html` (zip downloads), `donate.html` (Stripe + PayPal), `knowledge-base.html`, `community.html`, `references.html`, `sources.html`.

Redirects are configured in `web/spreadsheets.diyaccounting.co.uk/redirects.toml` and compiled to a CloudFront Function by `scripts/build-spreadsheets-redirects.cjs`. The generated `redirect-function.js` is gitignored.

## Package Pipeline

Excel workbook source files live in `packages/` organised by product and tax year. The `app/bin/build-packages.js` script:

1. Scans `packages/` directories for Excel workbooks
2. Creates zip archives in `target/zips/`
3. Generates `web/spreadsheets.diyaccounting.co.uk/public/catalogue.toml`

During deployment, zips are uploaded to S3 separately from the BucketDeployment (`prune(false)` prevents BucketDeployment from deleting them).

## Compliance

```bash
npm run compliance:ci-report-md    # Run all compliance checks and generate report (CI)
npm run compliance:prod-report-md  # Run all compliance checks and generate report (prod)
```

## Deployment

Deployments are triggered via GitHub Actions workflows:

| Workflow     | Purpose                                          | Trigger                       |
| ------------ | ------------------------------------------------ | ----------------------------- |
| `test.yml`   | Lint, format check, Maven verify, CDK synth      | Push, PRs, daily schedule     |
| `deploy.yml` | Deploy SpreadsheetsStack, upload zips, smoke test; after a green prod deploy from a push, publish `diya-gl` | Push to main, manual dispatch |
| `publish-diya-gl.yml` | Publish `diya-gl/package.json`'s version to npm if it is not there yet, record the release, roll the patch version on main | Called by `deploy.yml`; manual dispatch |

GitHub repository variables:

| Variable                       | Purpose                            |
| ------------------------------ | ---------------------------------- |
| `SPREADSHEETS_ACTIONS_ROLE_ARN` | OIDC auth for spreadsheets account |
| `SPREADSHEETS_DEPLOY_ROLE_ARN`  | CDK deploy in spreadsheets account |
| `SPREADSHEETS_CERTIFICATE_ARN`  | ACM certificate for CloudFront     |
| `SUBMIT_TEST_USER_ROLE_ARN`     | Submit's cross-account role for its prod account; the pages target Submit's released environment on every host, so this is a prod role now, not a per-environment one. When set, the ci behaviour job mints a fresh Cognito test user through it instead of relying on stored secrets |

## AWS CLI Access

Use SSO profiles:

```bash
aws sso login --sso-session diyaccounting
aws --profile spreadsheets cloudformation describe-stacks --region us-east-1
aws --profile spreadsheets cloudfront list-distributions
```

**Read-only AWS operations are always permitted.** Ask before any write operations.

## AWS Write Operations

See `../CLAUDE.md` — always ask before any mutating AWS operation.

## Confirm Means Stop and Wait

See `../CLAUDE.md` — present the command, STOP, wait for explicit approval before executing.

## Code Quality Rules

See `../CLAUDE.md` for shared rules. Spreadsheets-specific: only run `./mvnw spotless:apply` when specifically asked.

## Security Checklist

See `../CLAUDE.md` for shared rules. Spreadsheets-specific: OIDC trust policies scoped to this specific repository.

## Corpus search (corpus-loom MCP)

The `corpus-loom` MCP tools (`search`, `get_document`, `related_entities`) query one hybrid BM25+semantic index (~48.7k documents) spanning the whole business, not just this repo:

- **Repos**: all five diy-accounting-uk checkouts — tracked files at main plus full commit logs. This repo's source name is `spreadsheets`.
- **`drive`**: the DIY Accounting Limited Google Drive mirror — finance, minutes, personnel, product, support, technology, marketing, facilities. PDF/doc/docx content-indexed; spreadsheets metadata-only (findable by name).
- **`mail-antony` / `mail-support`**: complete Gmail backups of antony@ and support@diyaccounting.co.uk (2012→present).
- **Entities**: email addresses, seeded orgs (NatWest, HMRC, Companies House, Stripe, PayPal), Drive categories — `related_entities` links a person/org across mail, documents, and commits.

Source names for filters: `drive`, `mail-antony`, `mail-support`, `submit`, `spreadsheets`, `www`, `root`, `archive`. Drive `finance/` and `personnel/` are lexical-only (deliberately never embedded) — exact-token queries work there, paraphrase queries don't. Use this before grepping siblings or asking the operator for history.
