<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# Claude Code Memory - DIY Accounting Spreadsheets

> **Shared conventions** (git workflow, AWS accounts, code quality, confirm behavior, security, commit attribution): See the shared conventions section at the end of this file

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

Skills live at `.claude/skills/<name>/SKILL.md`.

- `.claude/skills/excel/SKILL.md` — Excel XML manipulation techniques, xls roundtrip, external link caches, multi-file recalculation, testing approaches, known pitfalls
- `.claude/skills/package-updates/SKILL.md` — Annual tax data update process, HMRC rate sources, TOML file structure, publishing workflow
- `.claude/skills/plain-prose/SKILL.md` — writing rules for plain, human prose; follow this for all human-facing text (docs, comments, chat)
- `.claude/skills/do-next/SKILL.md` — dispatch `NEXT.md`'s open items as worktree-isolated sub-agents
- `.claude/skills/board/SKILL.md` — render the work board from `NEXT.md`: in-flight and open items with their source plan; invoke as `/board`
- `.claude/skills/watch/SKILL.md` — watch GitHub CI on main and every open PR's head branch until the whole scope is green, and fix what goes red; invoke as `/watch`
- `.claude/skills/iterate/SKILL.md` — run the delivery cycle unattended until the board has no machine-only row that can start: board, a wave of sub-agent batches on one branch and one PR, watch, auto-merge, watch, board, again; invoke as `/iterate`
- `.claude/skills/archive-packages/SKILL.md` — take a cut of the generated packages into `diy-accounting-archive` as one reviewed commit
- `.claude/skills/refine/SKILL.md` — refine every open board row in the main context before a wave: references checked against origin/main, briefs made complete with the lowest model that fits, facts shared across rows, the human step split out; then write back and render `/board`; invoke as `/refine`
- `.claude/skills/session-report/SKILL.md` — write `REPORT_SESSION_<id>_<date>.md` from measured figures: result, method in prose, mechanisms that worked, losses with a board row each; invoke as `/session-report`
- `.claude/skills/clean/SKILL.md` — gather merged branches, worktrees of merged branches, logs and test artefacts, and build output; ask once; remove every agreed category in one go; then fetch, switch to main and pull when nothing is in progress; invoke as `/clean`

Note: Read the relevant skill when working on that product or technique. They contain detailed sheet maps, formula references, and CI pipeline descriptions that are essential context.

## Git Workflow

See the shared conventions section at the end of this file for full rules. Merge strategy — squash at the worktree, `--merge` to `main`, rebase only on a conflict or an
overlap, one deploy per head — is in the shared conventions section at the end of this file under Git Workflow.

Branch naming: `claude/<ns>-<n>-<topic>` for one of a series, `claude/<ns>-<topic>` otherwise.
`<ns>` is a short tag for the area (`ltd`, `itsa`, `vat`, `ops`, `cdk`, `docs`), `<n>` the series
number, `<topic>` one or two words. A board batch is `claude/<codename>-<theme>`: the next code name
from `/do-next`'s list, taken in alphabetical order, then the batch's dominant theme
(`claude/arclight-pricing`, `claude/impulse-itsa`). A narrow branch dropdown shows only the first
characters after `claude/`, so they carry the distinction: `claude/ltd-1-ch-file`,
`claude/ltd-2-ch-file`, `claude/ltd-hmrc-submit`, `claude/impulse-itsa`. Never a generic preamble
or a series number at the end (`claude/a-few-batches-1`,
`claude/consistent-preamble-hiding-specificity`).

## Commands only the operator can run

An SSO refresh with 2FA, `git branch -D`, `git push --delete`, and a Stripe test key stay the
operator's: they need a factor the session does not hold, or they spend money or delete things.

- Size a batch to fit inside one SSO window (~8-12h) and take every AWS read early in the
  session, while the token is fresh.
- Collect every classifier-blocked or operator-only command from the session into one fenced
  block, presented once at a natural pause (a wave landing, a push), each line `!`-prefixed so
  the operator can paste it into the chat.
- Never pre-authorise a command on the operator's behalf, and never describe one in place of
  showing it verbatim.

## Build Commands

```bash
npm install
npm run build:redirects  # both sites: --site spreadsheets, --site diya-gl
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

Behaviour tests use the `SPREADSHEETS_BASE_URL` and `DIYA_GL_BASE_URL` environment variables to target different environments. Output is automatically teed to `spreadsheetsBehaviour.log` in the project root.

**Behaviour cases asserting network state**: A case proving a page's behaviour asserts one of:
a network request (using `page.waitForResponse()` or `page.waitForRequest()`), or the content
of a file the page fetches. Never read a page global back through `page.evaluate()`. Objects
like `Arguments` serialise as empty over the Chrome DevTools Protocol bridge, so a case reading
`window.dataLayer` or similar can pass on nothing and become unfailable.

**Server naming for new behaviour probes**: A new case that probes a path names the server from
which that path is served at the first commit. The local `npm run test:spreadsheetsBehaviour-local`
server serves only the document root; any path added by CloudFront (e.g., `/runners/`) must target
a deployed host with `SPREADSHEETS_BASE_URL` naming ci or prod. A case probing CloudFront-only
paths on the local server goes red on the first CI run.

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
  **An empty log is therefore evidence of nothing.** `--reporter=tap-flat`, which the router already
  passes, does not rescue this on its own: measured on a 32-minute calc tier, it printed not one
  test line until the end, because every gated file spends its whole run inside `beforeAll`. The
  router's own 30-second heartbeat is the signal that works. Read the process table before
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

Two document roots, each deployed to its own S3 bucket. `web/spreadsheets.diyaccounting.co.uk/public/` is the main site: `index.html` (product catalogue), `download.html` (zip downloads), `donate.html` (Stripe + PayPal), `knowledge-base.html`, `community.html`, `references.html`, `sources.html`. `web/diya-gl.co.uk/public/` is the DIYA-GL books app: the four product pages (`bst.html`, `se.html`, `taxi.html`, `ltd.html`), served at the site root with no `/diya-gl/` prefix.

Each site has its own `redirects.toml`, compiled to that site's own `redirect-function.js` by `scripts/build-spreadsheets-redirects.cjs --site <spreadsheets|diya-gl>` (`npm run build:redirects` runs both). Both generated `redirect-function.js` files are gitignored.

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
| `DIYA_GL_CERTIFICATE_ARN`       | ACM certificate for diya-gl.co.uk CloudFront distribution |
| `SUBMIT_TEST_USER_ROLE_ARN`     | Submit's cross-account role for its prod account; the pages target Submit's released environment on every host, so this is a prod role now, not a per-environment one. When set, the ci behaviour job mints a fresh Cognito test user through it instead of relying on stored secrets and runs the cloud sign-in case on `https://ci.diya-gl.co.uk` |

## AWS CLI Access

Use SSO profiles:

```bash
aws sso login --sso-session diyaccounting
aws --profile spreadsheets cloudformation describe-stacks --region us-east-1
aws --profile spreadsheets cloudfront list-distributions
```

**Read-only AWS operations are always permitted.** Ask before any write operations.

## AWS Write Operations

See the shared conventions section at the end of this file — always ask before any mutating AWS operation.

## Confirm Means Stop and Wait

See the shared conventions section at the end of this file — present the command, STOP, wait for explicit approval before executing.

## Code Quality Rules

See the shared conventions section at the end of this file for shared rules. Spreadsheets-specific: only run `./mvnw spotless:apply` when specifically asked.

## Security Checklist

See the shared conventions section at the end of this file for shared rules. Spreadsheets-specific: OIDC trust policies scoped to this specific repository.

## Corpus search (corpus-loom MCP)

The `corpus-loom` MCP tools (`search`, `get_document`, `related_entities`) query one hybrid BM25+semantic index (~48.7k documents) spanning the whole business, not just this repo:

- **Repos**: all five diy-accounting-uk checkouts — tracked files at main plus full commit logs. This repo's source name is `spreadsheets`.
- **`drive`**: the DIY Accounting Limited Google Drive mirror — finance, minutes, personnel, product, support, technology, marketing, facilities. PDF/doc/docx content-indexed; spreadsheets metadata-only (findable by name).
- **`mail-antony` / `mail-support`**: complete Gmail backups of antony@ and support@diyaccounting.co.uk (2012→present).
- **Entities**: email addresses, seeded orgs (NatWest, HMRC, Companies House, Stripe, PayPal), Drive categories — `related_entities` links a person/org across mail, documents, and commits.

Source names for filters: `drive`, `mail-antony`, `mail-support`, `submit`, `spreadsheets`, `www`, `root`, `archive`. Drive `finance/` and `personnel/` are lexical-only (deliberately never embedded) — exact-token queries work there, paraphrase queries don't. Use this before grepping siblings or asking the operator for history.

## Shared conventions (the diy-accounting-limited estate)

This section is replicated verbatim in every repository of the diy-accounting-limited estate
(`submit.diyaccounting.co.uk`, `spreadsheets.diyaccounting.co.uk`, `www.diyaccounting.co.uk`,
`root.diyaccounting.co.uk`, `diy-accounting-archive`) so each repository stands alone. A change
to it is made in all of them in the same session.

### An approved plan is the authorisation — never stop to ask if you should continue

If the operator approved a plan, or the prompt says "complete X", **work it to the end and do not ask permission to keep going**. Report progress as you land it and carry straight on to the next item. The operator has left; a question in an empty room is just an idle session.

**A green test suite is a checkpoint, not a decision point.** Neither is a landed phase, a clean commit, or a tidy summary. Those are the middle of the work, and they feel like the end because they feel finished — that is the trap. The pull is strongest exactly when a chunk completes well.

Only three things stop the work: a hard safety rule; a genuine blocker with no next action left anywhere in the plan; or the operator saying stop. "Shall I continue?", "Want me to carry on with the rest?" — if the plan already answers it, the question is not caution, it is the session ending itself for no reason. Ask only what the plan genuinely does not decide, and ask it *before* the work, not as a way to pause in the middle.

**The companion rule: write status as you go, not at the end.** If a phase closes, mark it in its plan doc and delete its line from any live board (e.g. NEXT.md) **in the same commit as the fix**. Status written at the end is status never written. Sub-agents get the same instruction, and the right to edit their own rows.

### Working model: coordinator + background sub-agents

Run big tasks in **concurrent background sub-agents** and keep the main chat free — the main session is the COORDINATOR (plans, launches, integrates, answers the operator), not the worker.

- Decompose into workstreams with **clear file-ownership boundaries**; serialize on shared files.
- **Pick each sub-agent's model deliberately, and pick the lowest tier that meets the task's needs** — the ladder runs Fable to Opus to Sonnet to Haiku. Subtle engine/design work earns a top tier; well-specified coding earns Sonnet; mechanical sweeps earn Haiku. **Group tasks that need a similar level into the same workstream** — don't staple one hard task onto a batch of easy ones, because the hard task then prices the whole batch at the top tier.
- **Keep the chat for chat**: anything long-running (builds, test sweeps, index builds, deploys) executes as a BACKGROUND task; the main session launches it, keeps coordinating, and collects results on the completion notification.
- **Before merging a worktree, check `git status --short` inside it, not just its last commit.** A sub-agent can leave real, uncommitted work behind that vanishes when the worktree is removed — the coordinator gets exactly one look.
- **Brief every dispatch that shares a working tree**: the sub-agent may only `git add` its own files and commit — never `stash`/`reset`/`checkout --`/`clean`.
- **A sub-agent's own "completed" claim is not proof.** Check for a live process, then read its worktree's `git log`/`git status`, before accepting it as done or resuming it. Never resume a round whose worktree has already been removed — dispatch a fresh one.
- **Hand the worktree (and its branch) to the operator for removal as soon as its commit is merged**: `git worktree remove` and `git branch -D` are denied to sessions here, so print the one command with the `!` prefix at that moment and in every board render until it is gone. A stale worktree blocks nothing.
- **Publish continuously, batch what lands while checks run.** Merge each sub-agent's verified commit as soon as it's ready; don't hold everything for one end-of-session sweep.
- **Never refer to a sub-agent by its raw agent ID in prose** — hex IDs are as unreadable as UUIDs. Give each agent a short human-readable label from its task the moment it's dispatched ("the adapters agent", "the headers agent") and use that label in every status update. Raw IDs belong only in tool-call parameters.

### Test the blast radius, not the whole suite

Mid-task, run only what your change can actually reach: the file you edited and whatever imports it, plus whatever the change's own reason names. **Only one moment earns the full suite: when the change is about to become someone else's problem** — a push, a PR, anything that reaches CI or another person. Each repo's CLAUDE.md names its actual commands (`./mvnw clean verify`, `npm test`, behaviour tests). Two traps this does not excuse: a radius you cannot see is a real reason to run the suite (say so), and a shared generated artifact is wider than it looks — follow the generator, not the diff.

### Always tee to a file before filtering

Never pipe anything into `tail`, `head`, `grep` or any other filter without teeing it first:

    cmd 2>&1 | tee /tmp/some-file.log | tail -20

You still get the quick glance, and the full output stays on disk when the part you need turns out to sit somewhere else. **The trigger is the pipe, not the duration.**

Redirecting also changes what a tool prints. Vitest and Playwright both detect a non-TTY and switch reporter: per-file progress stops, and the summary arrives only at the end. So a log that is empty part-way through says nothing about whether the run is progressing, and treating its silence as a symptom sends you diagnosing a stall that is not there. The process table answers it in one call — a live child, or CPU time moving. `head` is the worst case: once it has its N lines the producer gets SIGPIPE and is killed part-way through, reporting like a clean run. And a command you have already seen run long goes to the background, full stop — waiting uses the task-wait mechanism, never a foreground sleep loop.

**A background Bash call runs under zsh, which does not split an unquoted `$VAR` into words when passed as arguments.** Put background commands that expand variable lists under `bash -c` or use quoted arrays, because the shell where the background command runs is not bash.

### Concurrent sessions — Cowork and Claude Code share this folder

This directory is mounted by Claude Desktop (chat projects and Cowork sessions) **and** worked in by Claude Code terminal sessions — started here at the workspace root or inside any repo subdirectory. Whichever kind of session you are, assume you are not the only writer:

- **Files may change under you.** Re-read a file before editing it if any time has passed; never assume your last read is current.
- **Git trees may have another session's work in flight** (branches, uncommitted changes). Check `git status` before committing; commit only changes you made; never `reset --hard`, `clean`, or `stash` a tree you didn't dirty.
- **`index/corpus.db` is SQLite (WAL)** — a busy/locked error usually means another session is updating the index; retry, don't diagnose corruption.
- **Cowork specifically**: your shell is a Linux VM. macOS binaries here (`index/.venv/*`, `rclone`, `gyb`) won't execute, and host paths outside this folder (e.g. `~/Library/...`) aren't reachable — for host-side actions, print a command for the operator to run in a host terminal or hand the task to a Claude Code session.
- The mirrors (`drive/`, `mail/`) and the index are maintained by host-side sync scripts and skills — from Cowork treat them strictly read-only.
- Sessions message each other through the inbox protocol — see "Inter-session messaging (inboxes)" below.

### Inter-session messaging (inboxes)

Claude sessions on this machine pass messages as plain Markdown, no daemon: append to the recipient's inbox, read and mark your own. Full protocol: `~/.claude/inboxes/README.md`.

**Two kinds of message, nothing else**, both about a change in the recipient's repository: a change you need them to make because you cannot, or a change you have made that their own work is blocked on. Never status, progress, "one line here when it lands", ideas, suggestions or acknowledgements, and never to track what another session is doing — commits, plan documents and the corpus index are the record. The test: does this ask them to change something, or tell them something they are blocked on has changed? If neither, do not send it.

**Message format** (append to the *recipient's* inbox; stamp with `date -u +%FT%TZ`):

```

### [unread] <ISO-8601 UTC> — from: <your-handle>
<the request, or the report>
```

On start and between tasks, read your own inbox, act on every `[unread]` block, change its marker to `[read]`, and trim old `[read]` blocks once handled. Acting on a message is the reply: write back only to say you made the change asked for, or that you will not. Cooperative cadence — no polling loops, and another session's repository state is never yours to inspect or report.

**This workspace's handle is `diyaccounting`** → host inbox `~/.claude/inboxes/diyaccounting.md`. Other active handles are listed in the inboxes README (`marginalia`, `intention`, `tmct`, …).

**Desktop/Cowork bridge**: sessions that can't reach `~/.claude/` (Cowork's VM, Desktop chats) use `INBOX.md` at this workspace root instead — same message format, addressed `from: cowork` / `from: desktop-chat` (or to them by writing under a `## [unread] … — to: cowork` header). Host Claude Code sessions working in this workspace check BOTH `~/.claude/inboxes/diyaccounting.md` and `INBOX.md` on start and between tasks, and relay anything addressed onward. `NEXT.md` stays for work items; `INBOX.md` is for messages.

### Default to contraction, not expansion

When asked to make a document shorter, forward-looking, or less historical, the default operation on a problem you find is DELETE or COMPRESS TO ONE LINE — never explain-and-caveat. Adding a clarifying paragraph or nuance is expansion, even when it feels like fixing. Before writing a fix, ask "does this belong here at all," not just "is this worded correctly" — the second question produces more words every time. A section whose label is backward-looking (e.g. "DONE") doesn't belong in a forward-looking doc regardless of how accurate its wording is.

### Workspace Structure

This is a **multi-project workspace**. Each subdirectory is its own git repository. Always `cd` into the correct subdirectory before running git commands.

All repositories live in the **`diy-accounting-uk` GitHub org** — the `antonycc/*` forks are archived pre-migration copies; never push to them.

| Directory | Repository | Status | Purpose |
|-----------|-----------|--------|---------|
| `submit.diyaccounting.co.uk/` | `diy-accounting-uk/submit.diyaccounting.co.uk` | **Active** | VAT submission app (Lambda, DynamoDB, Cognito, HMRC MTD API); primary development focus |
| `spreadsheets.diyaccounting.co.uk/` | `diy-accounting-uk/spreadsheets.diyaccounting.co.uk` | **Active** | Spreadsheets site + package pipeline (S3 + CloudFront); nightly automated package commits |
| `www.diyaccounting.co.uk/` | `diy-accounting-uk/www.diyaccounting.co.uk` | **Active** | Gateway static site (S3 + CloudFront) |
| `root.diyaccounting.co.uk/` | `diy-accounting-uk/root.diyaccounting.co.uk` | **Active** | Root AWS account — Route53 DNS, holding page |
| `diy-accounting-archive/` | `diy-accounting-uk/diy-accounting-archive` | Archived | Pre-migration spreadsheets repo, kept for history — do not develop here |
| _not checked out here_ | `diy-accounting-uk/homebrew-diya-gl` | **Active** | Homebrew tap for `diya-gl`; `Formula/diya-gl.rb` is regenerated from the npm registry. Read it with `gh api`, don't clone it into this workspace |

**Each subdirectory has a `CLAUDE.md`** with project-specific instructions — always read it before working in that project.

**Maintenance skills** (in `.claude/skills/`): `repo-sync` (fetch + fast-forward all repos), `drive-sync` (refresh the Drive mirror), `mail-sync` (gyb Gmail backup), `reindex` (rebuild lookup indexes only).

#### Search hygiene

- **Prefer the `corpus-loom` MCP tools** (`search`, `get_document`, `related_entities`) for any cross-corpus question — they cover all five repos, the Drive mirror, and both mailboxes with hybrid BM25+semantic search and entity links. Registered in the workspace root and every repo directory.
- Never search or read `node_modules/`, `target/`, or generated package output (e.g. `spreadsheets.diyaccounting.co.uk/packages/`) — build artifacts, pure noise.
- To find a document under `drive/`, look it up in `drive/MANIFEST.md` first (or `corpus-loom` search) — don't open Office/PDF binaries speculatively.

### AWS Account Structure

```
AWS Organization Root (887764105431) ── Management
├── gateway ─────────── 283165661847 ── Workloads OU
├── spreadsheets ────── 064390746177 ── Workloads OU
├── submit-ci ──────── 367191799875 ── Workloads OU
├── submit-prod ────── 972912397388 ── Workloads OU
└── submit-backup ──── 914216784828 ── Backup OU
```

| Account | ID | Repository | SSO Profile |
|---------|-----|-----------|-------------|
| Management (root) | 887764105431 | `root.diyaccounting.co.uk` | `management` |
| gateway | 283165661847 | `www.diyaccounting.co.uk` | `gateway` |
| spreadsheets | 064390746177 | `spreadsheets.diyaccounting.co.uk` | `spreadsheets` |
| submit-ci | 367191799875 | `submit.diyaccounting.co.uk` | `submit-ci` |
| submit-prod | 972912397388 | `submit.diyaccounting.co.uk` | `submit-prod` |
| submit-backup | 914216784828 | — | `submit-backup` |

### AWS CLI Access

Use SSO profiles to access any account. Login once, then use `--profile` on each command:

```bash
aws sso login --sso-session diyaccounting
aws --profile submit-ci cloudformation describe-stacks --stack-name ci-env-IdentityStack
aws --profile management route53 list-hosted-zones
aws --profile gateway cloudfront list-distributions
```

SSO credentials last ~8-12 hours. When an AWS command fails with `UnauthorizedSSOTokenError`, ask the user to run `aws sso login --sso-session diyaccounting`.

**Read-only AWS operations are always permitted** (describe, get, list, scan, logs, etc.) — no need to ask.

### AWS Write Operations (CRITICAL)

**ALWAYS ask before writing to AWS.** Any mutating operation (create, update, delete) requires explicit user approval. Present the command, explain what it does, and wait for a "yes" before executing.

- **Preferred path for infrastructure**: CDK code → git push → GitHub Actions deploy
- **Preferred path for secrets**: GitHub Actions Secrets/Variables → deploy workflow → AWS Secrets Manager
- Direct AWS writes are the exception, not the norm

### Git Workflow

#### Commit attribution: one identity, provenance beside it

Every commit carries three trailers, in this order:

```
Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Model: <the exact model id of the session that wrote the commit, e.g. claude-opus-5[1m]>
Claude-Session: <the session url>
```

**`Co-Authored-By` never varies.** It is set from `~/.claude/settings.json`'s `attribution.commit`,
so it arrives identical in every session and no per-session instruction can change it. It answers
who is credited, and the answer is always the same.

**`Claude-Model` carries the model**, because that is provenance, not authorship — the equipment
used, not a co-author. Add it yourself from the model id in your own environment; nothing generates
it. It is expected to differ between commits.

Both facts were previously crammed into `Co-Authored-By`, which is why the history holds fifteen
different forms of it. Splitting them is what lets the identity stay fixed while the provenance
stays accurate. Existing commits are not rewritten.

**You may**: create branches, commit changes, push branches, open pull requests

**Docs exception (operator, 2026-08-24)**: commits touching ONLY `.md` files may be pushed
directly to `main` in all five repos — no branch or PR needed. Anything touching code,
workflows, or config still goes through a PR.

**You may NOT**: push code/config to main, delete branches, rewrite history

**Merging a PR happens only through `/auto-merge`.** That skill is the single sanctioned path, and
it merges nothing that has not passed every gate it defines: no unresolved review thread, no
uncommitted work in the branch's worktree, the branch not ahead of origin, the PR head equal to the
branch tip, and the latest run of every workflow on that head green. A bare `gh pr merge` outside
that skill is forbidden however green the checks look, because the gates are the point and a merge
is the one action here that cannot be undone by another commit. `/auto-merge-dry-run` shows what
would merge and changes nothing.

**Merge strategy, at every layer** (operator decision, 2026-09-13):

- **Worktree to batch: squash.** Each sub-agent's branch lands on the batch branch as one commit
  per task (`git merge --squash`, then one commit naming the item), so an agent's fixing commits
  fold into the task they fix.
- **Batch to `main`: `--merge`, never squash.** The task commits stay readable on `main`; a
  squash at the PR would throw away the only per-task history there is.
- **After one PR merges, the other open PRs are not rebased by default.** A rebase restarts the
  branch's whole deploy and starts a ci set, and several at once contend for the ci apex alias
  and the shared test users. `main`'s own deploy is the integration proof, and it rolls the apex
  back when a probe fails. The next candidate merges as it stands when GitHub reports it
  mergeable and its changed files do not intersect the merged PR's.
- **Rebase only on a conflict or an overlap**, locally first: rebase in the worktree, run the
  blast radius there, and push with `--force-with-lease` only when no deploy on that branch is
  in flight. A local sync costs nothing and can happen any time; the push is what waits.
- **One deploy per head.** When a named `deploy.yml` dispatch already covers a branch's head,
  cancel the push-triggered deploy of the same head in its first minute; two deploys of one head
  are pure cost and contention.

**Branch naming**: `claude/<ns>-<n>-<topic>` for one of a series, `claude/<ns>-<topic>` otherwise.
`<ns>` is a short tag for the area (`ltd`, `itsa`, `vat`, `ops`, `cdk`, `docs`), `<n>` the series
number, `<topic>` one or two words. A board batch is `claude/<codename>-<theme>`: the next code name
from `/do-next`'s list, taken in alphabetical order, then the batch's dominant theme
(`claude/arclight-pricing`, `claude/impulse-itsa`). A narrow branch dropdown shows only the first
characters after `claude/`, so they carry the distinction: `claude/ltd-1-ch-file`,
`claude/ltd-2-ch-file`, `claude/ltd-hmrc-submit`, `claude/impulse-itsa`. Never a generic preamble
or a series number at the end (`claude/a-few-batches-1`,
`claude/consistent-preamble-hiding-specificity`).

**Important**: Each subdirectory is its own git repo. Always run git commands from within the correct subdirectory.

### Permission Handling (CRITICAL)

**Before starting any task**, review what permissions may be required and request them all upfront:

1. **Analyze the task** — What tools, commands, and access will be needed?
2. **List all permissions** — File access, git operations, shell commands, external services
3. **Request upfront** — Ask for all permissions at the start, not piecemeal during execution

**If a permission is missing mid-task:**
- Continue working on other parts that don't require the missing permission
- Run background tasks that can proceed independently
- Only block and ask when you've exhausted all parallel work options

### Confirm Means Stop and Wait (CRITICAL)

When the user says "confirm each command" or similar:

1. **Present the command** in a code block.
2. **STOP. Do not execute.** Wait for the user to explicitly approve.
3. Only after the user says "yes", "go ahead", "run it", or similar, execute that single command.
4. Then present the next command and **STOP again**.

"Confirm" NEVER means "narrate what you're doing as you do it." It means **ask permission, then wait.**

This applies to ALL external side effects: AWS, Stripe, Telegram, GitHub, or any other service that changes state outside the local filesystem.

### Code Quality Rules

- **Trace code paths** before running tests — follow both test execution and deployment paths
- **No unnecessary formatting** — don't reformat lines you're not changing
- **No import reordering** — considered unnecessary formatting
- **No fallback paths** for silent failures when fixing bugs
- **No compatibility adaptors** when refactoring — change names everywhere consistently
- **No backwards-compatible aliases** — update all callers instead of creating `export const oldName = newName`
- **No "legacy" support code** — all requests originate in these repositories, so there's no external caller needing backwards compatibility
- **No server-side fallbacks to favor tests** — if a parameter is required, the client must send it
- Only run linting/formatting fixes when specifically asked
- **Name it, don't comment it.** Prefer a self-documenting name over a comment that compensates for a vague one. When you find a vague name propped up by a comment, rename first, then drop the comment — don't just delete the comment and leave the bad name behind. A local rename is safe inline; a rename of an exported identifier is a separate change, so flag it.
- **Comment and test-name hygiene.** Comments and test descriptions must never reference a PLAN/NEXT doc, a "Gap N"/"Phase N" label, a commit hash, an operator directive, or a date. That framing belongs in the commit message; it rots the moment the doc it points to moves. Test names describe the behavior under test on its own terms. Even a comment that skips the doc-reference trap shouldn't exist unless it explains a genuinely non-obvious WHY.

### No performative diligence — no decision residue in live docs

Plan/NEXT sentences serve open items only. Settled decisions are recorded nowhere but the commit message. No "worth knowing", "for the record", or "when X starts" notes in any live doc — a note serving a hypothetical future item is performative diligence in a new costume. The test for any flag, caveat, status line, or footnote, in a reply or a committed doc: **could the operator act differently because of this sentence, on work that actually exists? If not, delete it.** Flag a decision only when real alternatives existed and the operator might plausibly want the other one — then state the alternatives, not just that a decision happened.

### Don't narrow scope on your own judgment

When investigating one reported bug turns up a second, adjacent one, fold it into the current fix by default, even if it's on a different code path. Don't quietly hive it off as a separate task on your own. Only treat something as separate work when it's genuinely a separate, large body of work, and say so explicitly so the operator can object rather than making that call silently. Getting this wrong means real bugs sit unfixed while looking handled.

### Writing style

**Output is facts, observations and theories. Fewest words. Flat and mechanical.**

No narrative, no story arc, no build-up or reveal. No emotional register: nothing is "genuinely"
anything, no celebrating a pass, no contrition over a miss, no "worth keeping" or "the point is".
No restating a result in a second, more expressive form. No summarising the significance of work to
the operator, who can assess it. Tables and lists over prose. A correction is one sentence: what was
wrong, what is right.

**Never stop, pause or defer because of the time of day or how long the session has run.** Do not
write "it's 06:00", "at this hour", "that will keep until morning". Only a hard safety rule, a
genuine blocker with no next action, or the operator saying stop ends work.


For every human-facing surface — docs, code comments, commit messages, chat replies: short sentences, active voice, everyday words. Lead with the key fact. Never document capability walls in live docs — what a system can't do today is a horizon to name, not an essence to declare ("permanently", "impossible", "out of scope forever" are purge words in forward-looking prose; decisions and safety invariants stated as such are fine).

#### Answer shape: the fact first, then the list

Every reply opens with the answer in one line (the count, the state, the blocker), then a flat
list of what follows, in order. Nothing else: no preamble before the first fact, no summary after
the list. Operator steps are numbered, one action per step, each with its URL or command verbatim,
ownership stated once at the top ("Steps 1–5 are yours; 6–8 are Claude Code's"). A status question
gets the blocker (or "nothing") on line one, then the ordered queue.

#### Stance prose: the concept, not a word list

Every pattern below is a sentence part that states no fact and performs a stance instead: I am
sincere, this matters, I am careful, I am helpful, I am working. The reader pays attention and
receives a performance. Blocking a word does not fix it: "genuinely" was asked to stop and
"actually" appeared; the function moved to a synonym. **The test is functional: delete the part.
If the sentence loses no information the reader could act on, it was stance; cut it, and cut any
synonym that would take its place.** Apply the test to every human-facing surface: chat replies,
commit messages, docs, comments, PR bodies.

| Common name | What it performs | Shape | Fix |
|---|---|---|---|
| Sincerity / assurance markers (performative assurance) | "I mean this one" | genuinely, truly, actually, really, honestly, to be clear, in fact, it's worth noting | State it. A claim asserted plainly is already asserted; the marker implies the others were not |
| Negative parallelism (negation framing) | Defines by rejecting a concept nobody raised | not X but Y; not just X, it's Y; X rather than Y; filename only, no path; no X, no Y | Say Y. If X was a real misreading someone made, name who and where |
| Significance signposting (trailing significance) | Tells the reader it matters instead of showing the cause | and that's the load-bearing part; here's why that matters; the key insight is; which is the point; this is important because; -ing tails ("…, underscoring its role") | Fact, then "because <cause>". Nothing else |
| Work narration (meta-commentary) | Shows effort | I found, I confirmed, I'll now, let me look at, I traced, having checked | The tool calls show the work. Give the result |
| Sycophantic opener | Flatters before answering | great question, you're right to ask, good catch, absolutely | Answer |
| Service closer | Offers help already implied | let me know if, would you like me to, happy to, I can also | Stop at the last fact. If a next step exists, it is a numbered step, not an offer |
| Hedging / vague attribution (soft sycophancy) | Avoids committing | it's possible that, some might argue, generally, tends to, one perspective, arguably | Commit, with the evidence. A real uncertainty gets a number or a named unknown |
| Rule of three / snappy triad | Cadence over content | fast, reliable, and secure; three parallel clauses by reflex | The true count of items, however many |
| Punctuation as glue | Drama in place of a connective | em-dashes joining clauses; the colon reveal ("the answer: X") | A full stop, a comma, or "because" |
| Restatement / summary conclusion | Says it twice | closing paragraph that repeats the list; "in short"; "to summarise" | End on the last fact |
| Unearned profundity / filler | Weight without content | something shifted; this changes things; at its core; fundamentally | Delete |
| Comparative negatives on scope | Invents a wider ask to narrow it | "no need to X", "you don't have to Y", "rather than Z" when no one proposed X, Y or Z | State what to do |

**Why this angers people and gets worse each time.** Each instance taxes the reader to receive
nothing; the "genuinely" implies the unmarked sentences were less true; the negation invents a
misunderstanding and pins it on the reader; the signpost tells an expert what matters in their own
product. After a correction, a synonym reads as the correction having been evaded, so trust falls
with every recurrence and the prose becomes the thing the reader is now watching for instead of
the answer. The cost lands on basic function: a question takes longer to get answered and a
reasoning chain is harder to follow, because the facts are interleaved with stance.

**Why the pull exists.** These forms are statistically common in the training text (LinkedIn,
marketing, essay prose) and each one makes a sentence feel finished and decisive for free. That
feeling is the trap; the functional delete test is the counter.


### Deployment & Infrastructure Workflow

All projects use GitHub Actions for deployment. No direct AWS console access needed.

#### Common Patterns

- CDK infrastructure: Java with Maven (`./mvnw clean verify`)
- OIDC authentication for GitHub Actions → AWS
- Formatting: Spotless (Java) + Prettier (JS/YAML/JSON/TOML)
- Stack naming: `{env}-{scope}-{StackName}` (e.g., `ci-env-IdentityStack`, `root-RootDnsStack`)

#### Before Making Infrastructure Changes

1. **Trace all dependencies** — read CDK construct docs to understand ALL resources created
2. **Check existing patterns** — search the codebase for similar constructs and follow conventions
3. **Propose before implementing** — describe the change and wait for approval before editing
4. **No manual interventions** — everything goes through code → git push → GitHub Actions
5. **Understand the full error** — don't just fix the immediate error; check all dependent resources
6. **Verify compilation locally** — run `./mvnw clean verify` before considering any change complete

### Infrastructure Teardown Philosophy

**Core principle**: Stacks must be cleanly destroyable. Data protection comes from backups (PITR, cross-account copies), NOT from CloudFormation `RemovalPolicy.RETAIN`.

- Use `DESTROY` for everything (except Lambda Versions with provisioned concurrency — RETAIN works around an AWS bug)
- DynamoDB: PITR enabled (35-day recovery window)
- If you need the data, back it up properly — don't rely on CloudFormation refusing to delete it

### Security Checklist

- Never commit secrets — use AWS Secrets Manager ARNs
- Check IAM for least privilege (avoid `Resource: "*"`)
- Validate all user input in Lambda functions
- OIDC trust policies scoped to specific repositories
