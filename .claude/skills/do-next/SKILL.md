---
name: do-next
description: Work NEXT.md top to bottom as waves of concurrent worktree sub-agents, land them on one branch, push in batches, raise one PR, and hand over to /watch. Invoke when the operator says "do next", "work the backlog", "clear NEXT.md", or when a landed batch leaves items still open.
---

<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# do-next — work `NEXT.md` with the coordinator model

You are the coordinator. You plan, dispatch, merge, push and answer the operator. You do not
write the code. **Keep the main chat free for chat**: anything long-running goes to a sub-agent
or a background task.

Work `NEXT.md` top to bottom, taking the unblocked items. As an item's blocker clears, promote it
to ready and resequence the board. Then keep going, top to bottom, until the board is empty or the
operator stops you. An approved plan is the authorisation: a green suite, a landed wave and a tidy
summary are the middle of the work, not the end of it.

Plans of record are `PLAN_*.md` at this repo's root. `NEXT.md`'s own shape rules are in
`../NEXT.md` and in this repo's `CLAUDE.md`.

## If cool-down is on, wake first

The operator invoking this skill is the operator lifting cool-down in their own words. "Work the
backlog" and "stay cool" cannot both be true, and cool-down forbids exactly the dispatch this skill
exists to do.

So when `NEXT.md` carries the cool-down marker, **run `/wake` first and in full** — all seven steps
of the cool-down skill's "Waking up" section, in order. Waking ends with a board render, so that
render is this skill's `/board` step; do not render twice.

If a wake step cannot be completed — a red branch, an unaccounted worktree, a hotfix branch that is
neither merged nor open — say which and stay cool. That is the one case where this skill stops
without dispatching, and settling that step is then the work. Do not dispatch around it.

A session goes back into cool-down only when the operator says so, or when this skill's own judgement
says a batch is stacking problems faster than it lands them.

## Start with `/board`

**Invoke `/board` before dispatching anything.** It reads `NEXT.md` fresh, puts the rows in order,
and reports the things that decide what this batch should contain: the GitHub scan, the live ci and
prod deployments, and a branch audit. It also writes the sequenced board back, so the order you then
work is the order on disk rather than one you hold in your head.

Do not skip it because you rendered a board earlier in the session. Deploys finish, alerts arrive
and PRs merge between renders, and the board is how you find out.

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

Act on every `[unread]` block in the same turn you read it, then change its marker to `[read]`.
Acting on it is the reply: write back only to say you made the change it asked for, or that you
will not. Never acknowledge and never report progress. Do not poll on a tight loop.

An inbox carries exactly two things, both about a change in the recipient's repository: a change
they must make, or a change already made that they are blocked on. A message that neither asks for
a change nor reports one does not get sent, and another session's repository state is never yours
to inspect, report or wait on — its commits, its plan documents and the corpus index are the
record. What reaches you this way can change what this batch should contain: a repository asking
you to hold an identifier, a route that now exists. Read before you merge, not after.

## The shape of a batch

**One branch. One PR. Waves inside it.**

A branch deployment is expensive and slow, so everything that can share a deploy should. The batch
branch is `claude/<codename>-<theme>` (see Naming the batch), taken from `main`. Every sub-agent worktree branches from **the
batch branch**, not from `main`, so each wave builds on what the last one landed.

Give the batch branch its own worktree and leave the primary checkout on `main`. You merge into the
batch worktree; you edit `NEXT.md` on `main`.

### Naming the batch

The batch branch is `claude/<codename>-<theme>`. The code name is the one after the last batch's in
this list, wrapping from `zephyr` back to `arclight`; the theme is one or two lowercase words for the
area most of the batch's rows touch (`itsa`, `pricing`, `ch-filing`, `ops`, `cdk`, `docs`). Example:
`claude/arclight-pricing`, then `claude/blizzard-itsa`.

`arclight` `blizzard` `cyclone` `dynamo` `eclipse` `falcon` `galileo` `horizon` `impulse` `juniper`
`kraken` `lynx` `mirage` `nebula` `orion` `pulsar` `quasar` `ricochet` `sphinx` `tempest` `umbra`
`vortex` `wyvern` `xenon` `yahtzee` `zephyr`

One name per letter, so the batches sort in the order they ran until the list wraps. The names come
from https://shockwaveinnovations.com/code-names/, kept to single lowercase words: no AWS resource
name here is built from a branch name, so the only limit is the branch dropdown. Find the last batch's name with:

```bash
{ git branch -a --format='%(refname:short)'; git log origin/main --merges --format=%s -n 200; } \
  | grep -oE 'claude/[a-z]+-' | sed -e 's#claude/##' -e 's/-$//' | awk 'NR==FNR{l[$1]=1;next} ($1 in l){print; exit}' <(printf '%s\n' arclight blizzard cyclone dynamo eclipse falcon galileo horizon impulse juniper kraken lynx mirage nebula orion pulsar quasar ricochet sphinx tempest umbra vortex wyvern xenon yahtzee zephyr) -
```

No match means none has run yet: start at `arclight`. The batch's worktree is named for its code name.

**`NEXT.md` never travels on the batch branch.** The board is maintained on `main` under the docs
exception. A second copy on the branch guarantees a conflict at merge time, and two sub-agents
editing it guarantees a lost row. If a merge drags `NEXT.md` onto the batch, restore it to the
branch point in the same commit.

## Waves

A wave is a set of concurrent workstreams grouped by area of the repository, sized so that no two
agents own the same file.

**Fill the wave until file contention stops you, not until a count stops you.** There is no target
number of agents. Keep adding independent workstreams while independent work remains; stop when the
next item would have to share a file with one already dispatched.

1. **Sequence the board.** Take the unblocked items in board order. Group them by where they live:
   `app/products/*.js` (per-product cell mapping and reconciliation), `app/data/*.toml` (tax rate
   data, one file per year), `app/templates/**` (the xlsx templates),
   `web/spreadsheets.diyaccounting.co.uk/public/**` (site pages, including the DIYA-GL pages under
   `/diya-gl/`), `cdk-spreadsheets/**`, `.github/workflows/**`, and the root `PLAN_*.md` documents.
2. **Items that share a file are one workstream, so give them to one agent in one brief.** Not one
   per wave with the rest queued behind: that turns a file boundary into three round trips and the
   later items wait for nothing. Say "do A, then B, then C on these files, a commit per item", give
   the order the plan fixes, and let one owner make the whole pass. This repository has files that
   attract several rows at once — a `spreadsheet-runner.js` or a product's `CELL_MAP` can carry a
   year's rates, a new mapping and a reconciliation fix — and those belong in one brief. A
   four-line change that happens to touch a contended file rides along with the big item rather
   than waiting a wave for its own turn: name it in the brief as its own separate commit and say
   plainly that it is unrelated.

   Scoping two agents to different regions of one file is the fallback, not the default, and only
   when the regions are genuinely disjoint and both briefs say so. Where a plan already fixes an
   order — the DIYA-GL naming chain, anything paired with submit's own rows — that order is the
   specification.

   A brief this size needs one extra instruction: if the total is more than the agent can finish,
   commit what is done and report exactly where it stopped. A clean stopping point mid-sequence is
   recoverable; a rushed tail is not.

   You can extend a running agent rather than dispatching a second one. `SendMessage` to its id
   continues it with its context intact, which is cheaper than a fresh agent rebuilding the same
   understanding of the same files.

   Rows that share files and land in series are a chain. When two or more rows in a chain are
   each a real change (a row with its own `Size` of several files, its own tests and its own
   regeneration), the chain gets one agent per row, each dispatched fresh from the previous row's
   commit on the batch, with the previous agent's report-back pasted into the next brief. One
   agent carrying the b16 SE chain (SET-12, SET-8, SET-10, SET-9) cost $81.29 for the two rows it
   finished, 341 messages at 299k average context (session GcLg5i, 2026-09-14); a fresh agent per
   row is about $40 per chained batch cheaper.

3. **Run a design wave when the plan is not rich enough to execute.** A higher tier writes the
   design as a document at the repo root; cheaper, faster models then build from it. The test is
   whether a Sonnet or Haiku agent could pick up the document and build without asking a question.
   Do not put a design task and a mechanical sweep in one wave: the hard one prices the batch.
4. **Pick each workstream's tier deliberately**, lowest that fits — Fable, Opus, Sonnet, Haiku.
   Opus for a decision with architectural weight, a new reconciliation approach, or anything in a
   large and subtle pipeline file (`spreadsheet-runner.js`, `generate.js`). Sonnet for a bounded
   change against an existing pattern — a tax year's TOML, a CELL_MAP extension, a site page
   following an existing one. Haiku for renames, sweeps and one-file mechanical edits.

## Briefing a sub-agent

A fresh agent carries none of your context, so the brief stands alone. Every brief says:

- **Its worktree path and branch**, and that it works only there. It may `git add` its own files
  and commit. Never `git stash`, `git reset`, `git checkout --` or `git clean`. Never push, never
  open a PR, never edit `NEXT.md`.
- **Every Bash call starts with `cd <worktree>` or uses `git -C <worktree>`**, because a shell that
  starts in the primary checkout edits `main` and leaves work uncommitted there.
- **Every Read, Edit and Write path is absolute under the worktree**, not only the Bash `cd`. The
  file tools resolve a repository-relative path against the primary checkout, so an agent that
  only `cd`s writes its change into `main`'s tree as well as its own; the batch then carries the
  change twice and the inventory before a merge has to catch it.
- **What it owns and what it must not touch**, with the reason. Where another agent in the same
  wave is nearby, name it.
- **For a brief that touches a workflow, three facts about called workflows and one instruction.**
  A called workflow inherits its caller's `github.event_name`, so a `schedule` guard inside it fires
  during the scheduled deploy's own probes and rolls it back. A called workflow may request no
  permission its callers do not grant, or every caller fails at startup. `gh` in a job with no
  checkout needs `--repo` on every call. Then: grep the sibling workflows for the same defect before
  committing, because each of these has been fixed in one workflow and found again in the next.
- **Any new file needs the licence header.** Every comment-capable tracked file carries the SPDX
  identifier and the copyright line, and `app/test/licence-headers.test.js` fails the suite when
  one does not. A new `REPORT_*.md` written at the end of an investigation is the usual casualty,
  because the agent is writing prose by then rather than code. Say it in the brief: the two-line
  header goes on before the first commit.
- **The evidence, not just the task.** Paste the run ids, the log lines, the timestamps. An agent
  given a diagnosis it can verify beats one given a symptom to rediscover.
- **Commit before verifying, not after.** This is the instruction that matters most and the one
  that is easiest to get wrong. A long build or a full suite runs for minutes, the harness promotes
  a long command to the background, and that ends the agent's turn — so "run verification in the
  foreground, then commit" is not a thing an agent can actually do. Told that, it stops with the
  work uncommitted in a worktree, which is exactly how work is lost. Tell it instead: write the
  change, commit it, then verify, and amend or add a fixing commit if the verification fails. A
  commit that needs amending is recoverable; an uncommitted worktree is not.

  For a suite that finishes in seconds — a targeted `vitest` run, a YAML parse — verify first and
  commit after, as normal. The inversion is for the long ones: a full generate-and-compare run over
  the products, or anything that rebuilds the templates.
- **Any test run expected to take over a few minutes must be backgrounded with the nohup recipe
  and then waited on inside one Bash call**, never in the foreground. An agent that runs a long
  suite in the foreground ends its turn before the result arrives, leaving the work uncommitted
  and the result unused. Background it, commit first, then wait inside one Bash call.
- **A wait is a `sleep` loop inside one Bash call with a timeout**, never a Monitor or a
  backgrounded wait, because an agent that hands its wait to a Monitor or `run_in_background`
  ends its turn and never resumes to read the notification. The brief pastes the launch and the
  loop for each long run the agent will make, one loop per run, armed before the run starts.

  Two incidents sit behind these recipes: a `nohup setsid` launch that never started, because
  macOS has no `setsid`, and a monitor script that read a branch list as one word, because zsh
  does not split an unquoted variable.
- **An agent's own routed run is its proof.** Once the agent's commit lands on the batch branch,
  the batch's own routed `npm test` run covers it. The agent does not run a second suite after
  committing; skip the confirmation step. The coordinator stops any duplicate run that starts.

  ```bash
  # Launch a long run detached (macOS has no setsid; nohup + disown is what works here):
  nohup <cmd> > <log> 2>&1 < /dev/null & disown
  echo $! > <log>.pid
  # At the top of any zsh monitor script, so an unquoted $var of names splits into words:
  setopt shwordsplit
  # Fire on the verdict OR on the process having exited, so an empty log never waits forever:
  until grep -q '^VERDICT:' <log> || ! kill -0 "$(cat <log>.pid)" 2>/dev/null; do sleep 30; done
  ```

- **The exact clean-up for the browser tier's byproducts.** The browser tier's
  `app/bin/build-packages.js --years 2` step leaves untracked `LICENCE.txt` and `README.txt`
  files under `packages/`. Remove them with this loop, the only way:

  ```bash
  git status --short | awk '$1=="??" {print $2}' | grep -E '^packages/.*/(LICENCE|README)\.txt$' | while read -r f; do rm -- "$f"; done
  ```

  (Git clean is forbidden to agents; a brief that names the files without the command sends the
  agent to it.) After the run, a restamped `app/lib/provenance-data.js` is committed, not discarded.

- **Never stop a run by matching a command name.** `pkill -f vitest` kills every worktree's
  process, a sibling agent's included, not just yours. Stop only your own worktree's run: `scripts/
  test-scope.mjs` gives each tier its own process group, so a Ctrl-C or `kill` on that process
  stops the whole tier there and nothing outside it.
- **`npm test`, and nothing narrower.** The command routes itself: it reads the diff, derives the
  radius through the import graph and the routing table in `scripts/test-scope.mjs`, and runs the
  tiers that diff reaches. A brief that names a narrower command caps the scope at whatever its
  author imagined, which is how a product's writer reaches the parity fixtures, the `*-anchors`
  test, the roundtrip budget and the page's render-key coverage without any of them running. Say
  `npm test` in the brief and let the router pick. No behaviour tier inside a worktree: that needs
  a live environment and belongs to the deploy. Give the worktree a real branch with
  `origin/main` reachable, so the router scopes to the diff instead of escalating to the full
  set. An agent verifies its own diff only; the coordinator's one full pass is in "Pushing".
- **A screenshot for anything visual.** Drive the page with Playwright, save a PNG under
  `reports/screenshots/`, **open it with the Read tool**, and say what it shows against what the
  item asked for. An equal z-index and a lazily created overlay do not show up in a passing test.
- **Behaviour case assertions**: Assert a network request or fetched file content with
  `page.waitForResponse()`, `page.waitForRequest()`, or by reading a response body. Never read
  a page global through `page.evaluate()`: objects like `Arguments` serialise as empty over the
  CDP bridge, making the case unfailable.
- **Server naming for new behaviour probes**: A new case that probes a path names the server
  that serves it. The local test server (`localhost:3000`) serves the document root only;
  CloudFront-only paths like `/runners/` require a deployed host (`SPREADSHEETS_BASE_URL` set
  to ci or prod).
- **A report-back contract**: what it changed and why, what it deliberately did not do, any
  adjacent bug it found with file and line, the exact commands run with counts, and its commit
  SHAs.
- **Say what would change your mind.** For a design or a judgement call, ask for the rejected
  options and the reasons, not just the chosen one.

## Landing a wave

Merge each workstream as its notification arrives. Do not hold them for the end.

- **A sub-agent's "done" is not proof.** Run `git status --short` in its worktree before anything
  else. Uncommitted work is real and you get one look at it.
- `git merge --squash <agent-branch>` into the batch worktree, always against the branch's own
  fork point (`git merge-base <batch> <agent-branch>`), never against `main`. Main moves under a
  batch (board commits land there during every wave), and a squash against a moved `main` carries
  intervening changes into the squash commit. Prove the squash carried nothing extra: run
  `git diff --name-only <batch>...<agent-branch>` before the squash and verify it matches the files
  in the squash commit.

  Then one commit naming the item: one commit per task on the batch, the agent's fixing commits
  folded into the task they fix. Keep the agent's commit message body where it explains the why.

  The pre-push hook now refuses any branch push whose diff against `main` touches `NEXT.md`. If it
  fires, fix it with `git checkout origin/main -- NEXT.md && git commit`.
- Run that change's blast radius on the merged tree, not the agent's own report.
- Update `NEXT.md` on `main` in the same breath: mark the item code complete, and remove it only
  once its checks pass. A bug the agent surfaced is that item's remainder, not a new item, unless
  it is genuinely separate work — then say so explicitly rather than deciding quietly.

When a landed workstream's diff touches only Markdown files (`.md` anywhere: `.claude/**/SKILL.md`,
`CLAUDE.md`, `PLAN_*.md`, `README.md`), land it on `main` directly under the docs exception in
this repository's `CLAUDE.md`, shared conventions section ("commits touching ONLY `.md` files may be pushed directly to `main`"), from the
batch worktree or a cherry-pick onto `main`. The batch and `main` both edit those files between
batches, so a docs row on the batch is a merge conflict waiting for the PR, and the conflict costs
a rebase, a second deploy and the PR's checks (PR #112, 2026-09-14,
`.claude/skills/do-next/SKILL.md`). The diff is docs-only when
`git diff --name-only <batch>...<agent-branch> | grep -v '\.md$'` prints nothing. When the
operator has asked for a named set of rows in one PR, the operator's instruction wins and the row
rides the batch.

- Prove the content landed as the merge lands
  (`git diff <agent-branch> <batch> -- $(git diff --name-only <batch>...<agent-branch>)` is empty),
  then hand the removal to the operator: `git branch -D` is theirs (this repo's `CLAUDE.md`,
  "Commands only the operator can run"), and after a squash `git branch -d` refuses because it
  cannot see the squash, so there is no session-side alternative. Print the worktree and branch
  removal as one fenced block with the `!` prefix and carry on. The `/board` render lists every
  such worktree and branch again until it is gone. Nothing waits on the removal.

**Editing `NEXT.md` is where rows get lost.** Never replace the slice between two markers unless
you have checked they are adjacent — an edit that removes what it did not name is invisible until
someone counts the rows. Split on the row boundary, filter by row key, and rejoin.

## Pushing

**Push once per wave, not once per workstream.** Gather what has landed and push it together.

When a named `deploy.yml` dispatch already covers the branch's head, cancel the push-triggered
deploy of the same head in its first minute (before any stack job): two deploys of one head are
pure cost and contention. A local sync with `main` costs nothing and can happen any time; only the
push waits.

A push is also the natural pause for the one fenced block of commands only the operator can run;
see this repo's `CLAUDE.md`.

Before any push, check **every** deploy workflow for that branch — `deploy` and `deploy-holding`
here, and `deploy` carries both the stack and the smoke test in one run. Confirm they are finished
by reading the runs, not by assuming elapsed time.

Before the first push of a batch, the routed run (`npm test`, what `.githooks/pre-push` runs) is the
first-push proof. Run `npm test -- --all` only when the router escalates to the full set (a detached
HEAD, missing `origin/main`, shallow clone, or empty diff) or the change touches a shared generated
artifact whose radius the router cannot see; say so when that is why. Add the relevant behaviour
target when the change reaches the site or a package. The router refuses to start while a
`soffice`, `playwright` or `vitest` process is live on the machine and names it: an agent's suite
still running is the usual cause, so wait for it in a sleep loop inside one Bash call, then start
the routed run; `TEST_SCOPE_IGNORE_LIVE=1` races it on purpose.

Raise the PR as soon as the branch is testing and deploying, so its checks and its description grow
together. Keep the description honest about what each item actually turned out to be — a row's
premise is often wrong, and the PR is where that gets recorded.

**If you open it as a draft, write the reason into the PR body and own clearing it.** A draft is
only ever a note that something is not ready yet — a red check, a missing verification, a decision
the operator has to make first. Name which, so the condition is checkable by someone who is not
you. When that condition clears, `gh pr ready <n>`; the reason going stale is not the same as the
flag going away, and a draft nobody owns is a PR that never merges.

**Then invoke `/watch`.** Every push hands over to it: it holds the scope, reports every terminal
state, and drives the branch and `main` green. Do not go back to checking runs by hand.

## When something goes red

**Gather the whole run's failures before fixing anything.** One run's worth, diagnosed together,
fixed together, pushed once. A workflow costs minutes per cycle; three pushes for three failures
from one run wastes two of them.

Read the failing job's log, not the check summary. Count the distinct causes: a page of failing
cases behind one failed earlier step is one failure, not a page of them.

**Name the layer you fixed, not the symptom you saw.** If a fix moves the failure from step 7 to
step 10, the fix worked and a second layer was behind it. Called "the cloud case fix" the next
failure reads as a fix that did not take; called "the panel-reopen fix" it reads as progress. When
a whole tail has never executed, read it against the code in one pass rather than one layer per CI
cycle.

**Check what changed underneath you.** A run can fail because a registry returned 403, because the
sibling repository's `main` moved, or because a live endpoint changed. This repository is not the
only variable — and a file fetched from another repository's `main` at run time changes without any
commit here.

**Fix the right layer.** If a test asserts something the product genuinely does wrong, fix the
product. A test taught to work around a defect hides it from every user.

**Pipeline fixes ride on top of the next ready batch** rather than getting a branch of their own.

## Merging the PR

The batch merges to `main` with `--merge`, never squash, so the one-commit-per-task history the
squash step built stays readable on `main`. `/auto-merge` is the path. Before it runs, **compare
the PR's head with the branch tip**: a merge takes
the head it was opened or last updated against, and anything pushed after that is left behind.

Anything orphaned goes into the next batch immediately, with its own branch off the batch branch
and its own PR to `main`.

## What not to do

- Do not dispatch around a wake step that will not complete. Say which one and stay cool.
- Do not let a sub-agent push, merge, open a PR or edit `NEXT.md`.
- Do not run the behaviour tier inside a worktree.
- Do not give a workstream a branch of its own PR when it could ride the batch.
- Do not push while any deploy workflow for that branch is in flight.
- Do not report a run's state from memory or from `gh pr checks`. Open the run.
- Do not stop at a green suite or a landed wave to ask whether to continue. The board says what is
  next; work it.
