---
name: watch
description: Watch this repository's GitHub CI until everything in scope is green, and fix what goes red. Scope is main plus every open PR's head branch, re-read each cycle. Invoke when the operator says "watch the builds", "keep it green", or hands over a branch to get through CI.
---

<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# watch

Watch every branch in scope, fix what fails, and stop only when the whole scope is green.
The loop ends on evidence, never on elapsed time or on a check summary.

## Scope

**main, plus the head branch of every open pull request.** Re-read the list every cycle:

```bash
{ echo main; gh pr list --state open --limit 50 --json headRefName --jq '.[].headRefName'; } | sort -u
```

A PR merging or opening changes the scope, and picking that up is the skill's job, not the
operator's. When a PR merges, its branch leaves scope and main's runs become the priority.

## Check the inboxes

Other Claude Code sessions and Cowork coordinate through plain-Markdown inboxes, no daemon. The
protocol is `~/.claude/inboxes/README.md`.

**Check if you have not checked in the last five minutes**, at these two moments:

- while polling or watching a deploy or CI run — the waiting is free time, and a sibling's message
  often changes what the run means before you have finished reading it;
- when a sub-agent reports back, before you merge its work.

Three files, all three every time:

- `~/.claude/inboxes/spreadsheets.md` — this repository's own inbox.
- `~/.claude/inboxes/diyaccounting.md` — the workspace handle's inbox.
- `/Users/antony/projects/diy-accounting-limited/INBOX.md` — the bridge for sessions that cannot
  reach `~/.claude/`: Cowork's Linux VM and Desktop chats.

Act on every `[unread]` block in the same turn you read it, reply by appending to the sender's
inbox, then change its marker to `[read]`. Do not poll on a tight loop — the two moments above are
the cadence, and a sibling waiting on a line from you is a reason to check, not a reason to check
constantly.

A message can change what this batch should contain: a sibling reporting a defect in what you just
pushed, a repository asking you to hold an identifier, an operator note arriving through Cowork. Read
before you merge, not after.

## The monitor

One background monitor, polling every 60-90s, emitting one line per newly finished run.

- **Report every terminal state**: success, failure, cancelled, timed out, skipped. A monitor
  that greps only for failure is silent when a run is cancelled, and silence is
  indistinguishable from still running.
- **Seed silently.** On the first pass, record what has already finished without emitting it,
  so the monitor reports changes rather than history.
- **Poll the API for state, never grep a log for a word.** `status == "completed"` with its
  `conclusion` is the fact; a log line saying "passed" is not.
- Keep the seen-set bounded, and let a failed `gh` call skip the cycle rather than kill the loop.
- **An empty result set is not a pass.** A branch that does not exist, a query whose filter matches
  nothing, and a `jq` asking for a field the `gh --json` list did not request all return nothing,
  with exit 0, which reads exactly like a clean run. Count the rows before interpreting them: ask
  for `length`, and report NO DATA rather than green when it is zero or the call failed. Every
  field a `jq` filter touches must appear in the `--json` list beside it, or it silently yields
  null for every row.

## Reading a run

Never report a run's state from memory, from a previous cycle, or from `gh pr checks`. Open it.
If something you reported turns out to be stale, say so in the same breath as the correction
rather than carrying it forward.

**Which jobs failed:**
```bash
gh run view <run-id> --json headSha,jobs --jq '{sha:.headSha[0:8],failed:[.jobs[]|select(.conclusion=="failure")|.name]}'
```

**Which step inside the job failed** — often enough on its own, and far cheaper than a log:
```bash
gh run view <run-id> --json jobs \
  --jq '.jobs[]|select(.conclusion=="failure")|.steps[]|select(.conclusion=="failure")|[.number,.name]|@tsv'
```

**The actual log.** `gh run view --log-failed` frequently returns nothing useful for a job whose
failure is buried in a step's output. Fetch the job log directly and strip the ANSI codes:
```bash
gh api "repos/<owner>/<repo>/actions/jobs/<job-id>/logs" --allow-escape-sequences \
  | sed 's/\x1b\[[0-9;]*m//g' | tee /tmp/job.log | grep -iE "error|fail|✘" | tail -20
```
Tee before filtering, always: the part you need is often not the part you grepped for.

## Five things that are not failures

Diagnose these before treating a red or a missing run as a defect.

- **A cancelled run is usually a supersession.** With a concurrency group, a newer run
  cancels or displaces an older one. Check whether a later run exists for the same group
  before calling it a failure.
- **A bot push fires nothing at all.** A job that commits with the default `GITHUB_TOKEN` pushes
  without triggering any workflow, whatever the `paths:` filter says. A release job that rolls a
  version, or a generator that commits its output, therefore leaves code on main that nothing has
  tested or deployed, and the branch looks green because the last commit anyone ran against was
  the one before it. Check whether main's HEAD has runs, not just whether the newest run passed.
- **A commit can legitimately trigger nothing.** Workflows have `paths:` filters. A docs-only
  commit that starts no run is correct behaviour, not a stuck queue. Read the filter before
  concluding a run is missing — and if a change genuinely should have triggered a workflow
  and did not, the filter is the bug (a test that cannot trigger the run that proves it is
  worse than a failing test).
- **A pending run can be dropped.** With `cancel-in-progress: false`, GitHub keeps one run
  queued per group and cancels the older pending one when a third arrives. Two active branches
  sharing one environment means the last to push owns the slot, and the other's deploy silently
  never happens. "No run for this commit" is a distinct state from "run failed".
- **A workflow cancelling itself.** When a caller workflow and its reusable callee share a
  concurrency group, the caller fires first, then GitHub cancels it when it reaches the reusable
  workflow's jobs. The tell is a cancellation with no other run in the group, followed seconds
  later by the same jobs reappearing under a different workflow name. Check the workflow names
  before calling it a failure. If the same jobs ran under another workflow, nothing failed.

## On failure

**Gather the whole run's failures before fixing anything.** One run's worth, diagnosed together,
fixed together, pushed once. A workflow costs minutes per cycle; three separate pushes to fix
three failures from the same run wastes two of them.

Fix on a branch, push, keep watching.

**Name the layer you fixed, not the symptom you saw.** If a case fails at step 7 and the fix
takes it to step 10, the fix worked and a second layer was behind it. Called "the cloud case
fix", the next failure reads as a fix that did not work; called "the panel-reopen fix", it reads
as progress. This matters most for a path that has never executed: everything after the first
blocking failure is unwritten ground, and walking it one layer per CI cycle is the slow way.
When a whole tail is unproven, read it against the code in one pass instead.

**Fix the right layer.** If a test asserts something the product genuinely does wrong, fix the
product. A test taught to work around a defect hides it from every user. Say plainly which you
chose and why.

**Check what changed underneath you.** A run can fail because something outside the repository
moved — another repository's `main` that a workflow fetches at run time, a live endpoint a gate
probes, an upstream action. Fetch the live artifact and look, rather than assuming the repository
is the only variable.

## Push discipline

**Never push to a branch while that branch's deploy run is in flight.** Gather fixes locally and
push once after it finishes. Confirm it finished by reading the run, not by assuming elapsed time:

```bash
gh run list --branch <branch> --workflow deploy.yml --limit 1 --json status,conclusion,headSha
```

A cancelled deploy mid-change can leave infrastructure part-applied, which costs far more than
the wait.

## Stop condition

All of these at once, each verified by reading:

1. Every open PR's required checks pass.
2. main's workflows are green on its latest commit **that runs them**.
3. No run is queued or in progress on any branch in scope — established by counting rows, not by
   a filter printing nothing.

Anything less is not done. A green PR whose deploy has not started is not done.

Two honest qualifications on (2), which the naive form gets wrong:

- **Enumerate this repository's actual workflows** rather than assuming a set. `gh workflow list`
  tells you. Do not report on a workflow that does not exist here, and do not miss one that does.
- **The latest commit may run nothing**, either because a `paths:` filter excludes it or because
  a bot pushed it with the default token. Those differ: the first is correct and the second leaves
  untested code on main. Diff the latest commit against the last one with runs and look at what
  actually changed. If it is only documentation, say so and judge against the earlier commit. If
  it is code, the scope is not green, and closing it means dispatching the workflow by hand.

If blocked — an expired SSO session, a permission, something only the operator can do — say so in
one line, name exactly what is needed, show the whole command if there is one, and **keep
monitoring everything else**. A block on one branch does not stop the loop.

## Reporting

One short status per cycle, and only when something changed state. Do not narrate unchanged runs.

Say the moment something goes red, naming the failing job. Push a notification for a red on main
or a scope-wide green, not for routine progress.
