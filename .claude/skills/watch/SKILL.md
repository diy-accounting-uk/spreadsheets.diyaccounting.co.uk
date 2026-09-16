---
name: watch
description: Arm a background Monitor over this repository's GitHub CI, then act on what it reports until the whole scope is green. Invoke when the operator says "watch the builds", "keep it green", or hands over a branch to get through CI.
---

<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# watch

This skill is a brief for one background monitor. Arm it, keep working, and act on the events it
sends. The watch ends on evidence, never on elapsed time and never on a check summary.

**Use the `Monitor` tool, `persistent: true`.** It runs the poll loop detached and turns each
stdout line into a notification, so the session stays free while CI runs. Do not write a foreground
poll loop: it occupies the session for the length of a build, which is the thing this skill exists
to avoid. Do not write a `sleep N; check` task that has to be re-armed by hand either. The monitor
re-arms itself and exits when the run is terminal.

For a single "tell me when it finishes", `Bash` with `run_in_background: true` and a command that
exits on the condition is lighter: one notification, no filter to get wrong.

## Scope

**main, plus the head branch of every open pull request**, re-read each cycle:

```bash
{ echo main; gh pr list --state open --limit 50 --json headRefName --jq '.[].headRefName'; } | sort -u
```

A PR merging or opening changes the scope, and picking that up is this skill's job.

## The monitor's brief

Arm `scripts/watch-ci.sh <state-dir>` under the `Monitor` tool (`persistent: true`). It polls
every 75 seconds, seeds silently on its first pass (one `SEEDED` line with the counts), emits one
`RED <branch> <workflow> run <id> (<conclusion>)` per newly failed latest run, one
`MERGEABLE #<n> <branch> (<sha>)` per PR per head once its latest runs are all terminal and none
failed, and exits 0 with one `TALLY` line when nothing in scope is still running. It gives up with
`NO DATA` after three empty cycles. Re-arm it after each push, because a new head means new runs.

What it covers, so the brief need not be rewritten per session:

- **Every terminal state**: `failure`, `timed_out`, `action_required` and `startup_failure` are
  red; `success`, `skipped`, `cancelled` and `neutral` are not.
- **Low volume**: reds once each, readiness once per head, one tally.
- **State from the API**: `gh run list --json` with `jq`, never a log grep.
- **Empty result sets counted**, not read as green.
- **A failed `gh` call skips the cycle** instead of ending the loop.
- **Probe merge-readiness every cycle, from push and pull_request events only.** A watch that only reports reds leaves a PR sitting green
  for however long nobody looks. Each poll, for every open PR that is not a draft, take the **latest
  run of each distinct workflow on its branch from push or pull_request events** and call the PR ready when **none of those latest
  runs is still incomplete, and none of them failed**:

      gh run list --branch <headRef> --limit 60 --json workflowName,status,conclusion,databaseId,event \
        | jq '[.[] | select(.event == "push" or .event == "pull_request")] | group_by(.workflowName) | map(max_by(.databaseId))'

  Only push and pull_request events gate the merge readiness check. Workflow dispatch runs
  (manual or scheduled package generation), scheduled runs, and other non-gating events do not
  affect merge readiness, preventing a hand-dispatched generate/publish run from blocking a ready
  PR.

  Incomplete is `queued` or `in_progress`. Failed is `failure`, `timed_out` or `action_required`.
  Anything else — `success`, and also `skipped`, `cancelled` or `neutral` — does not hold the PR
  back, because a workflow can legitimately skip under a `paths:` filter and a cancelled run is
  usually a supersession. Requiring a literal `success` from every workflow that has ever touched
  the branch would leave a PR never ready for reasons that are not defects.

  A shell loop cannot invoke a skill, so the probe's job is only to notice and say so: emit
  `MERGEABLE #<n> <branch>` and let the agent decide. Emit it once per PR per readiness, not every
  cycle, or a ready PR floods the channel until someone merges it.

## When a mergeable PR appears

**Run `/auto-merge`.** Do not merge by hand: that skill is the only sanctioned path and it re-checks
every gate properly, including the ones a shell probe cannot see — uncommitted work in the branch's
worktree, a branch ahead of origin, a PR head that no longer equals the branch tip.

The probe is a hint, not a verdict. It can be wrong in both directions: green checks on a stale head
look ready and are not, and a PR whose runs have not registered yet looks unready and merely is
early. `/auto-merge` is what settles it.

If `/auto-merge` merges anything, the scope changes — the PR's branch leaves it and `main` gains a
deploy. Re-read the scope on the next cycle rather than carrying the old one.

## When a red arrives

**Gather the whole run's failures before fixing anything.** One run's worth, diagnosed together,
fixed together, pushed once. A workflow costs minutes per cycle; three separate pushes to fix
three failures from the same run wastes two of them. A run that delegates to another inherits its
failure, so check whether two red runs are one cause.

Open the run; never report its state from memory or from `gh pr checks`.

```bash
gh run view <run-id> --json jobs \
  --jq '.jobs[]|select(.conclusion=="failure")|.steps[]|select(.conclusion=="failure")|[.number,.name]|@tsv'
```

`gh run view --log-failed` often returns nothing useful when the failure is buried in a step's
output. Fetch the job log directly, strip the ANSI codes, and tee before filtering:

```bash
gh api "repos/diy-accounting-uk/spreadsheets.diyaccounting.co.uk/actions/jobs/<job-id>/logs" --allow-escape-sequences \
  | sed 's/\x1b\[[0-9;]*m//g' | tee /tmp/job.log | grep -iE "error|fail|✘" | tail -20
```

**Five reds that are not defects.**

- A cancelled run is usually a supersession, so check for a later run in the same group.
- A commit can legitimately trigger nothing under a `paths:` filter, and "no run for this commit"
  is a distinct state from "run failed" — though a change that should have triggered a workflow
  and did not means the filter is the bug.
- With `cancel-in-progress: false` GitHub keeps one run queued per group and drops the older
  pending one when a third arrives, so a deploy can silently never happen.
- **A bot push fires nothing at all.** A job that commits with the default `GITHUB_TOKEN` — the
  nightly package generation, a version roll — pushes without triggering any workflow, whatever
  the `paths:` filter says. The branch then looks green because the last commit anyone ran
  against was the one before the bot's. Check whether main's HEAD has runs, not just whether the
  newest run passed.
- **A workflow cancelling itself.** When a caller workflow and its reusable callee share a
  concurrency group, the caller fires first, then GitHub cancels it when it reaches the reusable
  workflow's jobs. The tell is a cancellation with no other run in the group, followed seconds
  later by the same jobs reappearing under a different workflow name. Check the workflow names
  before calling it a failure.

**Fix the right layer.** If a test asserts something the product genuinely does wrong, fix the
product. Name the layer you fixed, not the symptom you saw: a fix that moves the failure from step
7 to step 10 worked, and a second layer was behind it.

**Check what changed underneath you.** Another repository's `main`, a live endpoint, an upstream
action. The repository is not the only variable.

## Push discipline

**Never push to a branch while any of that branch's deploy runs are in flight.** This repository
has two, `deploy.yml` and `deploy-holding.yml`, so check each. Gather fixes locally and push once
after they finish. Confirm by reading the runs, not by assuming elapsed time:

```bash
for wf in deploy.yml deploy-holding.yml; do
  gh run list --branch <branch> --workflow "$wf" --limit 1 --json status,conclusion,headSha
done
```

A cancelled deploy mid-change can leave infrastructure part-applied, which costs far more than
the wait.

**A workflow change has no CI gate here, so verify it by hand.** This repository has
`./scripts/validate-workflows.sh` (`npm run lint:workflows`) and no workflow that calls it, so
nothing catches a bad workflow before GitHub does. Run it before pushing, and strict-parse the
YAML as well: prettier and actionlint both accept a duplicate key that GitHub rejects outright,
and a rejected file means every trigger in it silently stops firing.

## Stop condition

All at once, each verified by reading:

1. Every open PR's required checks pass.
2. main's workflows are green on its latest commit **that runs them** — enumerate the real
   workflows with `gh workflow list` rather than assuming a set, and say which commit you judged
   against when the latest one triggers nothing.
3. No run queued or in progress on any branch in scope, established by counting rows.

A green PR whose deploy has not started is not done.

**Take a draft PR out of draft once its branch's workflows are settled and passing.** A draft
strands the PR: `/auto-merge` treats it as a deliberate stop and will not route around it, which is
correct, so nothing merges and nothing says why. The condition is mechanical, not a judgement about
why the draft was set. Group the branch's runs by workflow, keep the latest of each, and mark the PR
ready when **none of those latest runs is still incomplete and none of them failed**:

```bash
for n in $(gh pr list --state open --json number,isDraft --jq '.[]|select(.isDraft)|.number'); do
  ref=$(gh pr view "$n" --json headRefName --jq .headRefName)
  latest=$(gh run list --branch "$ref" --limit 60 \
    --json workflowName,status,conclusion,databaseId \
    --jq '[group_by(.workflowName)[] | max_by(.databaseId)]')
  rows=$(echo "$latest" | jq 'length')
  busy=$(echo "$latest" | jq '[.[]|select(.status!="completed")]|length')
  bad=$(echo "$latest" | jq '[.[]|select(.conclusion=="failure" or .conclusion=="timed_out")]|length')
  if [ "$rows" -gt 0 ] && [ "$busy" = "0" ] && [ "$bad" = "0" ]; then gh pr ready "$n"; fi
done
```

`rows` is checked first because an empty set is not a pass: a branch with no runs at all has proved
nothing, and marking it ready on that basis is the same mistake as reading a silent monitor as
green. Say which PRs you readied and on what evidence.

If blocked by something only the operator can do, say so in one line, name it, show the whole
command, and keep the monitor running. A block on one branch does not stop the watch.
