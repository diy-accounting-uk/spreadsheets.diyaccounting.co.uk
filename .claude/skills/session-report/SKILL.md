---
name: session-report
description: Write the session's report as REPORT_SESSION_<id>_<date>.md at the repo root — what the session landed, the mechanisms that made it efficient, where it lost time or money, and the improvements it suggests, each with its value, ranked most impactful first — from measured figures (git, GitHub Actions job minutes, agent token counts, the transcript), never from memory. Invoke when the operator asks for a session report, an account of the session, or "how did this session do".
---
<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# session-report

One file per session, at the repo root: `REPORT_SESSION_<id>_<YYYY-MM-DD>.md`. It leads with the
result and the mechanisms that produced it, then the losses, each loss tied to a suggested
improvement and its value. Every figure in it is measured in this session; nothing is recalled.

## The file name

`<id>` is the first six characters of the base64 SHA-256 of the session id (the
`Claude-Session:` URL's last path segment), so the same session always names the same file:

```bash
printf '%s' "$SESSION_ID" | shasum -a 256 | cut -d' ' -f1 | xxd -r -p | base64 | cut -c1-6
```

`<date>` is today's UTC date. Re-running the skill in the same session overwrites the file.

## Gather, do not recall

Run these before writing a line. Tee each to a file under the scratchpad before filtering.

**Output.** Session commits, PRs, and the diff, with generated output separated from
hand-written change:

```bash
git log --since="<session start ISO>" --format='%h' --grep="<session id>" --no-merges | wc -l
gh pr list --state merged --search "<session id>" --json number,title,mergedAt
git diff --shortstat <main at session start>..<main now> -- . ':!packages' ':!examples/*-latest' ':!reports'
git diff --shortstat <main at session start>..<main now>
```

Board rows closed: the `D` rows of the last `/board` render this session.

**Elapsed.** Session start is the first tool call's timestamp; batch dispatch to prod is the first
agent dispatch to the prod deploy's completion. Both from timestamps, not estimates.

**LLM.** Every sub-agent's completion notification carries `subagent_tokens`; sum them and list
them per agent. The main session's usage is not exposed to the session: estimate it from turn
count and context size, say it is an estimate, and price at the current list rates (input, output,
cache read) with the subscription's marginal cost stated beside it.

**GitHub Actions.** Billable job-minutes, not wall-clock run minutes; jobs run in parallel inside
a run:

```bash
for id in $(gh run list --limit 200 --created ">=<session start ISO>" --json databaseId --jq '.[].databaseId'); do
  gh api "repos/<slug>/actions/runs/$id/jobs?per_page=100" \
    --jq '[.jobs[] | select(.completed_at!=null) | ((.completed_at|fromdate)-(.started_at|fromdate))] | add // 0'
done | paste -sd+ | bc
```

Also count runs per workflow and note which were duplicates (push and pull_request on one
commit), supersessions, or docs-only triggers. A public repository bills nothing; say so and give
the private-rate figure beside it.

**AWS.** What deployed and how often (`gh run list --workflow deploy.yml`), what the stacks are
(static, per-branch, ephemeral), and any metered call the workflows made (an LLM judge, a Bedrock
call). Cost from the account's structure; name the source.

**Operator.** Count the operator's messages in the transcript and class each: a decision between
named alternatives, a paste of a command the session could not run, a question, a correction of
the session's behaviour. The pastes and corrections are the ones that carry a lesson.

## The report's shape

In this order. Lead with the result; the operator reads the first line and decides whether to
read on.

1. **Result line**: PRs merged, rows closed, commits, hand-written lines, generated files, what
   prod serves, the board's state.
2. **Method, in prose.** First person, the operator's voice, four to six sentences, so it can be
   sent as it stands. State what the operator does, what the sessions do, what the operator
   decides, what this session landed and for what, and what the operator's next area to develop
   is. The shape:

   > I use Claude Code as a coordinator. I write the plan and the rules into the repo, it
   > dispatches several agents in parallel on separate branches, merges what passes the tests,
   > and I make the decisions it can't (which design, what gets merged, anything that spends
   > money or deletes things). In this session that landed six features across two accounting
   > products in one working day for roughly $100 of tokens. I spend my time reviewing evidence
   > and fixing the process when it wastes cycles, not writing code or even looking at it. Today
   > the auto-merge skill just became reliable and my next areas to develop are to tune the
   > session's wasteful test runs and local machine contention.

   Every figure in it is this session's; the last sentence names what became reliable this
   session and the one or two areas the losses table points at.
3. **What worked**: one table, a row per efficiency (elapsed time, LLM cost, AWS cost, GitHub
   Actions minutes, operator input, quality), the measured figure, and the mechanism that produced
   it. Mechanisms are named things the next session can repeat: a skill, a rule, a brief shape, a
   file boundary.
4. **Room for improvement**: one table, a row per loss, the measured size of the loss, the cause,
   and the improvement that would remove it. A loss with no suggested improvement is not finished
   being reported.
5. **Placement**: where the session sits on each efficiency against published anchors, with the
   anchors cited and the scales labelled as constructed. Do a web search for anchors dated within
   the last three months; do not reuse last report's numbers.
6. **Suggested improvements**: one line each, ranked most impactful first: what to change, its
   value (the measured loss it removes, in the losses table's unit), and the board row that already
   covers it, if one does.

## The suggested improvements

The report suggests; it opens no board row. Every loss in the "Room for improvement" table
gets one suggestion: what to change, in one line, and its value as the measured loss it would
remove (minutes, dollars, job-minutes, operator messages), in the unit the losses table used.
Rank the list by value, most impactful first; where two values are in different units, say which
ranks higher and why. Name any board row that already covers a suggestion. A loss whose remedy is
an action the operator has kept for themselves (a command that spends money, deletes, files, or
refreshes a credential) gets a suggestion about handling the block efficiently, never one that
pre-authorises the command. The operator picks which suggestions become rows.

## Write-back

Prettier the report and `NEXT.md`, run `app/test/licence-headers.test.js` (the report needs the
header comment), commit the report alone as a docs-only commit to `main`, and push. Then say, in the
reply: the file name and the result line, and end the reply with the ranked suggestions and their
values as its last block, so the operator's choice sits where they stop reading.

## What the report is not

Not a transcript, not a log of tool calls, not a place for the session to grade itself in prose.
Figures, mechanisms, losses, suggestions. Where a figure could not be measured, the report says
"estimated" beside it and how; it never fills the gap with a confident number.
