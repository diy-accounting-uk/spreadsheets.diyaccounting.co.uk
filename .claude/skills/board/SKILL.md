---
name: board
description: Render the open-work board — one table of every NEXT.md item that is in flight or open, plus anything finished in the current session, each with its source plan. Invoke when the operator asks for the board, the open items, or "what's in flight".
---

# board

Render the current work board from `NEXT.md` at the repo root. Read it fresh every time;
never render from memory of an earlier turn. There is no backlog file in this repo: the
plans of record (`PLAN_*.md` at the root) and `NEXT.md` are the only sources.

## Output shape

One table, then at most two closing lines.

| # | Item | Source | Owner | State | Unblocked by | Status |

- `#`: the task id from the plan (`T3`), the `NEXT.md` label where the entry carries one
  (a wave gate such as `W0-h`, a PR number); otherwise a running number in file order.
- `Item`: a short name, not the entry's full prose.
- `Source`: the plan the item comes from, as its file name (`PLAN_DIYA_GL_BST_CLI_MCP_WEB.md`),
  or `operator` for an instruction given in chat that no plan yet carries, or `none` for
  an item `NEXT.md` holds on its own. When a plan row is the direct result of an operator
  instruction, name the plan; the plan holds the assertion verbatim.
- `Owner`: `human` for an activity only the operator can do (merge a PR, approve an AWS
  write, review a design on sight, decide between named alternatives, run a command on a
  host the session cannot reach) or `machine` for work a session or sub-agent does.
- `State`: exactly one of six values, hyphenated so it stays one token:
  - `done` — finished in the current session, and only then.
  - `in-flight` — being worked right now by an agent or the operator.
  - `ready-to-start` — never started; nothing prevents starting it, whoever the owner is.
  - `ready-to-resume` — started earlier (a branch, worktree, PR or partial commit exists,
    or `NEXT.md` says so), paused, and nothing prevents picking it up.
  - `blocked-to-start` — never started; waiting on a date, a prerequisite item, or a
    decision not yet made.
  - `blocked-to-resume` — started, paused, and something now prevents resuming: a
    prerequisite, a decision, or a conflict with work that landed since.

  Started means evidence, not intent: check `git branch -a`, `git worktree list` and
  `gh pr list` for the item's branch or PR before calling it resumable. Operator-owned
  work that could start today is `ready-to-start`, not blocked. Work the plan orders after
  another wave is `blocked-to-start` on that wave, and the status names it.
- `Unblocked by`: for a blocked row, the row label(s) whose completion unblocks it, or the
  date or decision it waits on; `—` for every other state.
- `Status`: one clause, 12 words or fewer, current as of this render. Date-gated items
  name the date; blocked items name the blocker; in-flight items name the current step;
  done items name the commit. The narrative lives in `NEXT.md` and the plan, never here.

One row per discrete task. When a `NEXT.md` entry points at a plan whose task list
defines tasks (`T3`, `Track A`), read that plan and render one row per task with the
plan's own task name, never one row per wave or per bullet; the wave is visible through
`Unblocked by`. Tasks in the same wave that own disjoint files are each `ready-to-start`
once the wave's gate has passed; a rebase-on-landing note is status, not a block.

**Split human from machine.** When a machine task is blocked pending a human activity,
render two rows: the human row (labelled with an `-h` suffix, `W0-h`) in its own state,
and the machine row blocked on it with the human row in `Unblocked by`. The same split
applies the other way: a wave's PR is machine work until it is ready, then the merge and
any on-sight review is a human row that the next wave's machine row waits on. Never fold
a human step into a machine row's status.

## Rules

- Only work that is in flight, open, or finished in this session. Nothing done in an
  earlier session, decided against, or removed; `git log` holds those.
- Never annotate an item "deferred", "later", or similar. Status words describe state
  (open, in flight, blocked on X, operator-owned, date-gated), not priority.
- If a row cites a GitHub PR or issue known to be closed, drop the ref; run
  `gh pr list`/`gh issue list --state open` only when the answer would change a row.
- After the table: one line naming the plans `NEXT.md` lists as not tracked there, if
  any; and one sentence per item the session materially changed since `NEXT.md` was last
  written. No other commentary.
- **Write the statuses back.** After rendering, update any `NEXT.md` entry whose prose no
  longer matches the status just printed (same facts, fitted to the entry). A `done` row
  is removed from `NEXT.md`, not annotated. Commit the `NEXT.md`-only change to `main` (the
  docs exception allows a direct push) and push. Never add rendered status for items that
  are not on `NEXT.md`.
