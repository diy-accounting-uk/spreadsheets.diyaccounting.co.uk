---
name: refine
description: Refine every open row on NEXT.md in the main context before a wave is dispatched — check each reference against origin/main, make each brief complete enough for its sub-agent and pick the lowest model that fits, share the facts one row's check turns up with every row they help, and split the human step out of any row that mixes one with machine work — then write the file back and render /board. Invoke when the operator asks for a readiness, feasibility or context pass over the board, or says "refine the board".
---
<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# refine

Four passes over `NEXT.md`, in the main context and with no sub-agents, then the write-back and
`/board`. A sub-agent reads only its brief; every fact it would otherwise have to rediscover costs
tokens, and every fact it gets wrong costs a redeploy. The passes move that discovery into one
place, once.

## Before the passes

```bash
git fetch -q origin && git pull -q --ff-only origin main && git log --oneline -1
```

Every check below runs against that commit. Read the inboxes (`~/.claude/inboxes/spreadsheets.md`,
`~/.claude/inboxes/diyaccounting.md`, the workspace `INBOX.md`) and act on each `[unread]` block:
a row's facts may have changed in another repository.

## Pass 1 — references

For every row, every path, symbol, line number, run id, issue number, plan section and external
fact it names:

- **Paths exist**: one loop over every backtick path in the file, `[ -e "$f" ] || echo MISS`,
  including paths in sibling repositories (`../submit.diyaccounting.co.uk/…`) and at the
  workspace root. A missing file is usually a moved one: `find . -name '<basename>'` before
  rewriting.
- **Line numbers match**: `sed -n '<n>p' <file>` for each. Line numbers drift after every merge,
  so a row names the anchor text as well as the line (`workingTreeHash` (line 285)), and this
  pass corrects the number, never the anchor.
- **Symbols exist**: `grep -n '<symbol>' <file>` for each function, constant, env var, workflow
  job and input the row names. A label another row or a plan once used (`DG-2b`) is not a
  reference; replace it with the command or file it stood for (`git log -S'<label>' -- NEXT.md`
  finds the text).
- **Counts are current**: a row that quotes a count (findings, files, alerts, resources) gets the
  count re-run (`gh api …/code-scanning/alerts`, `git diff --name-only`, the router's `--plan`
  tier list) and the number replaced.
- **External state is current**: SSM parameters, open alerts, issue timelines, a workflow run's
  jobs, Submit's entitlement and retention rules where a row asserts them. Read-only AWS and `gh` reads need no approval. A blocker that
  has cleared (a Submit row off its board, a merged PR) moves the row up a section in the
  write-back.
- **The prod line and the ci line** match the live commits
  (`/spreadsheets/<env>/last-known-good-deployment`).

Write each correction into the row as you go; do not keep a separate list.

## Pass 2 — feasibility

For every row a sub-agent will run, read the code the row points at and ask what the agent would
have to discover to finish. Then put that in the brief. The checks that paid for themselves:

- **The mechanism is the one the code uses.** A row that says "add `drive.file` to Cognito's
  Google provider" describes a token the hosted UI never hands the page; read the call site and name the mechanism that works, with the line. A test
  the row asks for has to be able to reach what it asserts: a behaviour case cannot drive a Google consent
  window, so it stops at the Connect row and says so in its name; a page label lives in `cloud.js`
  and in every browser spec that quotes it, so the row names both.
- **The diagnosis comes first when the cause is unknown.** A smoke test red, a reconciliation
  mismatch: the brief names the run id and the log line that settles the cause, and the two or
  three causes it can find (Submit's rule changed, the fixture drifted, the template moved), so the agent
  fixes the layer it finds rather than the one the row guessed.
- **The runtime the agent will find.** A fresh worktree has no `node_modules` (symlink the main
  checkout's), no built redirect functions (`npm run build:redirects`), `packages/` byproducts
  the router's build step writes (untracked, ignored by the tree hash), and a LibreOffice one
  suite at a time may own: the router refuses to start beside a live `soffice`, `playwright` or
  `vitest`, so the brief carries the wait loop. `spotless:apply` reformats files the row does not
  own (format only its own).
- **The format gate.** The router's gates tier runs `prettier --check` and fails the run on a
  line break; every brief that writes JS or Markdown carries `npx prettier --check` on its files,
  and every workflow brief carries `npm run lint:workflows` and a js-yaml parse.
- **What the change exposes.** A change that lists, links or sells an unfinished feature on prod
  (a nav link, an offer card, a Drive item without its client id) is held for the row's launch
  step; the brief says which part lands now and which waits.
- **Limits the change can hit.** A CloudFront function's size, the CSP in
  `diya-gl-security-headers.json`, a Cognito TOTP code two cases spend inside one 30-second
  period, a concurrency group two runs share: name it and the headroom, because the ci deploy is
  where it fails otherwise.
- **The model**, the lowest that fits, from the work not the label: a one-file mechanical edit or
  a dispatch-and-read is Haiku; a bounded change against an existing pattern is Sonnet; a design a
  Sonnet then builds from, or a change to a deploy's ordering and rollback, is Opus. A row over
  about 25 files is a two-agent chain. Change the row's **Model** when the check disagrees with it.
- **The brief's constants**: worktree path and branch, `cd <worktree>` in every Bash call,
  absolute paths, the evidence (run ids, log lines, file:line), "commit before a long
  verification", "a wait is a sleep loop inside one Bash call, never a Monitor", the licence header
  for new files, no NEXT/plan/label/date references in comments or test names, `git add` only its
  own files, push nothing, and the report-back contract (branch, worktree, commit hashes, files,
  proof lines, anything undone). A brief that touches a workflow carries the called-workflow
  checklist; a brief that dispatches one names the exact inputs.

## Pass 3 — context

A fact one row's check turned up usually serves another row. Add it to every row it helps, in one
sentence, and name the other row:

- rows that share a file (`cloud.js`, the behaviour test, `do-next/SKILL.md`) say so in both
  places, so the wave puts them in one agent or forks the second from the first's batch; a shared
  file alone is not a precursor when the second row can fork from the first's branch;
- rows that touch the same page or module run in sequence in one agent, or the later brief carries the earlier row's changes, so the dependencies land in one commit or the second agent sees the first agent's work.
- rows over the same data name the same facts once each (Submit's entitlement reasons and
  retention days, the product cell maps, the fixture's master data under `examples/`);
- a row whose output another row consumes names the shape it writes and the row that reads it
  (the design section is the build row's input), so the sequence is in the file, not in a coordinator's memory;
- a fact that removes a blocker or a whole sub-task (a Submit row off its board; an event
  builder that already exists) rewrites the blocked row's blocker line.

## Pass 4 — the human step, split out

A row that mixes a human step with machine work stalls at the human step while the machine work
waits, and the board reads it as one blocked lump. Split it:

- **The human row** is the smallest step a person must take: a decision between named
  alternatives, a credential created in a console, a send from the operator's address, a sign-in
  with a second factor, a file downloaded behind MFA. It names exactly what to do, where, and
  where the result lands (a GitHub environment secret by name, a date written into the machine
  row, a file under `../staging/`). It goes to `## Human-driven` when the person must navigate
  it, `## Machine-ask` when a session drives it with the person present. Label it `<row>a` beside the machine
  row's `<row>b`, or `H<n>` when it stands alone.
- **The machine row** keeps everything a session can build or verify without that step: a script
  with a recorded fixture before the credential exists, an assembly and its verification before
  the cloud save, a draft before the send, a poll-and-pin after the answer. It is `ready` unless it
  truly cannot proceed, and its blocker line names only the human row.
- A row whose every step is human stays whole (`LP-25a`). A row whose only human step is
  merging its PR is machine-only already.

## Write-back

`NEXT.md` in board order (in flight, machine-only, machine-ask, human-driven, blocked; within a
section by size, fewest files first), the prod and ci lines current, then `npx prettier --write NEXT.md`, one commit whose message carries the
corrections, the decisions and the splits, and a push straight to `main` as its own command (the
docs exception). The rows carry only what is open. Then `/board`, whose render is the proof that
the file and the table agree.

## What this pass has caught

Kept as the checklist's evidence, one line each: a precursor that was only a shared file (PU-8 on
CQ-56), cleared by forking from the first row's batch; a batch forked before the fix it needed
had merged, so its behaviour test asserted the old entitlement on ci; a new signed-in case that
spent the previous case's TOTP code inside one 30-second period; a live-process guard that matched
the word `vitest` in its own launching shell; an offer card whose copy lived in one page file and
seven browser specs; a Drive build whose design named no stylesheet, so the badge shipped
unstyled.
