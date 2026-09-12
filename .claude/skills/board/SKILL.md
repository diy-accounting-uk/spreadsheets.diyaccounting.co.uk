---
name: board
description: Render the work board — whether cool-down is on and whether a watch monitor is running, then the table in NEXT.md of every open task with its source plan, owner, precursors by id and state, plus anything finished in the current session; then the GitHub scan (open issues, PRs, Dependabot and code-scanning alerts with a recommended action each), the live ci and prod deployments, and a branch audit. Invoke when the operator asks for the board, the open items, or "what's in flight".
---
<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# board

The board is the `## Board` table in `NEXT.md` at the repo root. It holds every open row
in full (item, source, owner, precursors, state, status), so rendering never assembles
rows from a plan: read `NEXT.md` fresh every time, refresh each row's state from
evidence, render, and write the refreshed table back. A plan (`PLAN_*.md`) is where a
row's detail lives; the board carries enough to act on without opening it.

## Output shape

A one-line mode header, then exactly four parts in this order: the board table, the GitHub
scan, the deployments, the branch audit.

## The mode header

One line, before the table, saying two things. Both are read, never assumed.

**Is cool-down on?** It writes a marker into `NEXT.md`'s `## In flight` section, so the file
you are already reading answers it:

```bash
grep -c "COOL-DOWN is on since" NEXT.md
```

Report it as on with its timestamp, or off. **If it is on, it changes this skill's own
behaviour**: the rule below that every `fix`, `bump` or `investigate` finding gets a board row
does not apply, because cool-down's first rule closes the board to everything but a
degradation. A finding that is not a degradation goes to `PARKED.md` with its evidence, and the
GitHub scan's `Board row` column says `parked` rather than `new`. Say so in the header, so the
operator can see why a finding did not become a row.

**Is a watch monitor running?** A `/watch` monitor is a background task of this session, not a
mark on disk, so the session's own task state is the only honest source. Report it as running
with what it watches, stopped, or **unknown** — and never infer it from a quiet chat. A monitor
that has been killed and one that has simply had nothing to report look identical from the
outside, which is the whole reason to say which.

Where the session cannot tell, `unknown` is the right answer and the operator can restart one
with `/watch`. Do not claim a monitor is running because you started one earlier in the session;
a task can be stopped, and a completed one stops notifying.

## Part 1 — the board table

| # | Item | Source | Needs | Precursors | State | Status |

- `#`: a stable id. Machine tasks keep the plan's task id (`T3`). Human steps are `H1`,
  `H2`, … Rows finished in the current session are `D1`, `D2`, … Rows the GitHub scan
  opens are `CQ-1`, `CQ-2`, … Ids never renumber.
- `Item`: the task's name, short, from the plan where one exists.
- `Source`: the plan file name (`PLAN_DIYA_GL_LAUNCH.md`), `operator` for an
  instruction given in chat that no plan yet carries, or `none` for a row `NEXT.md` holds
  on its own.
- `Needs`: exactly one of `machine-only`, `human and machine`, `human-only` — what it
  takes to carry the row to completion, not who happens to own it now. `human-only` is
  work no session can do: an external registration, a console action with no API, a
  decision between named alternatives, a command on a host the session cannot reach.
  `human and machine` needs both, and `Status` says which half is whose — a row waiting
  on a credential the operator holds and then executing is this, not `human-only`.
  Everything else is `machine-only`, including a row whose only human step is merging its
  PR: that is the standing workflow, not an action the row needs.

  Judge it from the work, not from whoever the row names today. Say so in the render when
  a classification contradicts the row's own wording.
- `Precursors`: the ids of the rows that must be done before this one can start or resume,
  comma-separated (`T3, T10`); a date or a named decision where that is the gate; `—`
  when nothing gates it. Ids only, never prose. A machine task that waits on a human
  activity names the human row here; the human activity is its own row.
- `State`: exactly one of seven values, derived from the precursors and the evidence:
  - `done` — finished in the current session, and only then.
  - `in-flight` — being worked right now by an agent or the operator.
  - `ready-to-start` — never started; every precursor is done.
  - `ready-to-resume` — started earlier (a branch, worktree, PR or partial commit exists,
    or the row says so), paused, and every precursor is done.
  - `blocked-to-start` — never started; a precursor is not done.
  - `blocked-to-resume` — started, paused, and a precursor is not done or landed work
    conflicts with it.
  - `blocked-on-busy` — the row's files live in a repository the operator has paused work in
    (the operator's standing order, 2026-09-09, for `submit.diyaccounting.co.uk`); it waits for
    the operator's word, whatever its precursors say. `Precursors` names `operator`.

  Started means evidence, not intent: check `git branch -a`, `git worktree list` and
  `gh pr list` for the row's branch or PR before calling it resumable. Operator-owned
  work with no open precursor is `ready-to-start`, not blocked.
- `Status`: one clause, 12 words or fewer, current as of this render. In-flight rows name
  the current step; started rows name the branch or PR; done rows name the commit; a
  tier or a rebase note fits here. The narrative lives in the plan, never here.

### Rules

- **Row order (the operator's standing order, 2026-09-09, revised 2026-09-12).** Five bands,
  in this order, by `Needs` first and state second:
  1. `machine-only` rows that can be worked now: `in-flight`, `ready-to-start`, `ready-to-resume`;
  2. `human and machine` rows that can be worked now;
  3. `human-only` rows that can be done now: `ready-to-start`, `ready-to-resume`;
  4. blocked rows of any class: `blocked-to-start`, `blocked-to-resume`, then `blocked-on-busy`;
  5. rows gated by a date, whatever their class.
  Within a band, precursors come before their dependants, then `CQ-n` rows, then product order
  BST, SE, Taxi, Ltd. `D` rows follow the four bands in the render and are never written back.
- One row per discrete task. When a plan defines tasks, the board carries one row per
  task, never one per wave or bullet; grouping is visible through `Precursors`.
- Verification is never a human row. Confirming a deploy, checking a page loads, looking
  at a render: each is a pipeline check (a behaviour probe, a screenshot artefact, an axe
  gate) inside the machine row that produces it. A human row exists only for an action
  the session may not take: merge a PR, write to AWS, decide between named alternatives.
- Split human from machine where splitting is honest. A machine task blocked pending a
  human activity is two rows: the human row in its own state, and the machine row naming it
  in `Precursors`. A batch's merge, and any on-sight review, is a human row that the rows
  after it name.

  That is why band 2 is usually empty. `human and machine` is for the row that cannot be
  split without lying about it — one indivisible action needing both halves, such as a
  command the session runs with a credential only the operator can supply. Prefer two rows;
  use the class when two rows would misrepresent one action.
- Precursors are real dependencies (a module the task calls, a file it shares with an
  unfinished row, a decision it needs), never an ordering chosen for tidiness. If two rows
  could run on one branch at once, neither names the other.
- Only rows that are open, in flight, or finished in this session. Nothing done in an
  earlier session, decided against, or removed; `git log` holds those.
- Never annotate a row "deferred", "later", or similar. Status words describe state, not
  priority.
- If a row cites a GitHub PR or issue known to be closed, drop the ref.
- A command the session could not run (the permission classifier refused it, or it needs a
  host or an account the session cannot reach) is shown in full wherever the row is reported:
  the exact command in a fenced block, `!`-prefixed, so the operator can paste it into this chat
  or a terminal. Never a description in place of the command.
- After the table: one line naming the plans `NEXT.md` lists as not tracked there, if
  any; and one sentence per row the session materially changed since `NEXT.md` was last
  written. No other commentary.

## Part 2 — the GitHub scan

Run, with the repo slug `diy-accounting-uk/spreadsheets.diyaccounting.co.uk`:

- `gh issue list --state open --limit 200 --json number,title,labels,updatedAt`
- `gh pr list --state open --json number,title,headRefName,isDraft,updatedAt`
- `gh api "repos/<slug>/dependabot/alerts?state=open"` — package, manifest, severity,
  first patched version.
- `gh api "repos/<slug>/code-scanning/alerts?state=open&per_page=100"` — rule id,
  severity, file, line.

Quote the URLs: zsh expands a bare `?`. Render one table, one row per issue, per PR, per
Dependabot alert, and per code-scanning rule family (one row per rule id, files listed):

| Kind | Ref | What | Recommended action | Board row |

- `Recommended action`: exactly one of `close as stale` (the finding's file or path is
  gone, or landed work already addressed it; name the commit), `fix` (name the file),
  `bump` (a dependency; name the version), `merge` (an open PR; who merges), `keep open
  and watch` (real signal, action pending elsewhere), `investigate` (say what is needed).
- `Board row`: the id of the row that carries the action, or `new` when this render
  creates one.
- **Every finding has a home on the board, unless cool-down is on.** Under cool-down the board
  is closed to everything but a degradation: the finding goes to `PARKED.md` instead and its
  `Board row` reads `parked`. Otherwise, a finding whose action is `fix`, `bump` or
  `investigate` belongs to an existing row (a row whose worktree already touches that
  file, or a plan task that covers it) or gets a new `CQ-n` row (`Source` `none`,
  `Needs` `machine-only`, the model tier in `Status`). `keep open and watch` and `close as
  stale` need no row; `close as stale` findings are listed for the operator in the
  render. Never close, label or comment on an issue or alert from this skill; the
  operator does.

## Part 3 — deployments

Read-only AWS; needs an SSO session (`aws sso login --sso-session diyaccounting`),
otherwise render the part as "unverified: no SSO session" and move on. This repo deploys
in place: one `SpreadsheetsStack` and one `HoldingStack` per environment in the
`spreadsheets` account, region `us-east-1`; nothing self-destructs and there are no
per-deployment sets. `deploy.yml` deploys `prod` on every push to `main` and daily at
07:17 UTC, and `ci` on every push to another branch; `deploy-holding.yml` swaps the
domains between the site and the holding page. Run:

- `aws --profile spreadsheets --region us-east-1 cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE UPDATE_ROLLBACK_COMPLETE ROLLBACK_COMPLETE CREATE_FAILED UPDATE_FAILED --query "StackSummaries[].[StackName,StackStatus,LastUpdatedTime]" --output text`
- `aws --profile spreadsheets --region us-east-1 ssm get-parameter --name /spreadsheets/<env>/last-known-good-deployment --query Parameter.Value --output text` for `ci` and `prod`: the commit the last green deploy wrote.
- `aws --profile spreadsheets cloudfront list-distributions --query "DistributionList.Items[].[Id,Aliases.Items|join(',',@)]" --output text`: which distribution carries the apex says whether the site or the holding page is live.
- `gh run list --workflow deploy.yml --limit 5 --json status,conclusion,headBranch,createdAt`: the last deploy runs.

| Env | Stack | Status | Updated (UTC) | Live commit | Serving | Follow-up |

- `Live commit`: the SSM value, and whether `main` contains it (`git branch --contains`).
- `Serving`: `site` when the environment's `SpreadsheetsStack` distribution carries its
  domain, `holding` when the holding distribution does.
- `Follow-up`: none for a green stack serving the site. A stack in a failed or rollback
  state, a `prod` live commit that `main` does not contain, a failed latest deploy run,
  or a `holding` page serving prod, is a follow-up: say what, and the dispatch that fixes
  it (`gh workflow run deploy.yml -f environment-name=<env>`, or `deploy-holding.yml` with
  `-f target=restore`), which the operator runs.

## Part 4 — branch audit

`git fetch --prune origin`, then for every local branch and every `origin/*` branch
except `main`, compute: commits ahead of `main` (`git rev-list --count main..<ref>`); the
last commit's date and subject; and for branches with commits ahead, whether their content
already exists on `main`: `git diff main <ref> -- ${=files}` over
`files=$(git diff --name-only main...<ref>)` empty means it does (the `${=files}` is
zsh's word split; a bare `$files` passes one argument and reads every branch as merged).

| Branch | Where | Ahead of main | Last commit | Class | Action |

- `open`: content not on `main`, carried by a board row (name it; `claude/wt-<row>`
  branches live in `../.worktrees/spreadsheets/<row>` and are open while the row is), an
  open PR, or the current batch branch.
- `unique, desirable`: content not on `main`, on no open PR and no board row, but
  belonging to an open plan task (name it): needs a PR or folding into the batch.
- `stale`: every commit on `main`, or content identical to `main`, or an abandoned design
  superseded by a plan doc on `main`. Action: delete.
- Worktrees without a board row (`git worktree list`: a detached verify tree, a tree whose
  row landed) get one line each with the same classes.

Local stale branches are pruned with `git branch -d` (never `-D`) and stale worktrees
with `git worktree remove` as part of the render. Origin stale branches are deleted
(`git push origin --delete <branch>`) only when the operator has asked for the clean-up in
the session; otherwise the row lists them for the operator. The `antonycc` remote is the
archived fork: its refs are never pushed to or deleted.

Branch names follow `CLAUDE.md`: `claude/<ns>-<n>-<topic>` for one of a series,
`claude/<ns>-<topic>` otherwise, the distinctive part right after `claude/`. A branch named
the old way (a generic preamble such as `claude/wt-<row>`, or a series number at the end) gets
a note in `Action`: rename before its next push.

## Write-back

Replace the `## Board` table in `NEXT.md` with the rendered one minus the `D` rows
(`NEXT.md` holds only what is next; the session's done rows live in `git log`), including
any `CQ-n` rows Part 2 opened. Parts 3 and 4 are rendered, never written to `NEXT.md`.
Run `npx prettier --write NEXT.md`, commit the `NEXT.md`-only change to `main` (the docs
exception allows a direct push) and push.
