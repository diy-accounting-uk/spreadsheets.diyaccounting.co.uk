---
name: board
description: Render the work board — the table in NEXT.md of every open task with its source plan, owner, precursors by id and state, plus anything finished in the current session. Invoke when the operator asks for the board, the open items, or "what's in flight".
---

# board

The board is the `## Board` table in `NEXT.md` at the repo root. It holds every open row
in full (item, source, owner, precursors, state, status), so rendering never assembles
rows from a plan: read `NEXT.md` fresh every time, refresh each row's state from
evidence, render, and write the refreshed table back. A plan (`PLAN_*.md`) is where a
row's detail lives; the board carries enough to act on without opening it.

## Columns

| # | Item | Source | Owner | Precursors | State | Status |

- `#`: a stable id. Machine tasks keep the plan's task id (`T3`). Human steps are `H1`,
  `H2`, … Rows finished in the current session are `D1`, `D2`, … Ids never renumber.
- `Item`: the task's name, short, from the plan where one exists.
- `Source`: the plan file name (`PLAN_DIYA_GL_BST_CLI_MCP_WEB.md`), `operator` for an
  instruction given in chat that no plan yet carries, or `none` for a row `NEXT.md` holds
  on its own.
- `Owner`: `human` for an activity only the operator can do (merge a PR, approve an AWS
  write, review a design on sight, decide between named alternatives, run a command on a
  host the session cannot reach); `machine` for work a session or sub-agent does.
- `Precursors`: the ids of the rows that must be done before this one can start or resume,
  comma-separated (`T3, T10`); a date or a named decision where that is the gate; `—`
  when nothing gates it. Ids only, never prose. A machine task that waits on a human
  activity names the human row here; the human activity is its own row.
- `State`: exactly one of six values, derived from the precursors and the evidence:
  - `done` — finished in the current session, and only then.
  - `in-flight` — being worked right now by an agent or the operator.
  - `ready-to-start` — never started; every precursor is done.
  - `ready-to-resume` — started earlier (a branch, worktree, PR or partial commit exists,
    or the row says so), paused, and every precursor is done.
  - `blocked-to-start` — never started; a precursor is not done.
  - `blocked-to-resume` — started, paused, and a precursor is not done or landed work
    conflicts with it.

  Started means evidence, not intent: check `git branch -a`, `git worktree list` and
  `gh pr list` for the row's branch or PR before calling it resumable. Operator-owned
  work with no open precursor is `ready-to-start`, not blocked.
- `Status`: one clause, 12 words or fewer, current as of this render. In-flight rows name
  the current step; started rows name the branch or PR; done rows name the commit; a
  tier or a rebase note fits here. The narrative lives in the plan, never here.

## Rules

- One row per discrete task. When a plan defines tasks, the board carries one row per
  task, never one per wave or bullet; grouping is visible through `Precursors`.
- Split human from machine. A machine task blocked pending a human activity is two rows:
  the human row in its own state, and the machine row naming it in `Precursors`. A batch's
  merge, and any on-sight review, is a human row that the rows after it name.
- Precursors are real dependencies (a module the task calls, a file it shares with an
  unfinished row, a decision it needs), never an ordering chosen for tidiness. If two rows
  could run on one branch at once, neither names the other.
- Only rows that are open, in flight, or finished in this session. Nothing done in an
  earlier session, decided against, or removed; `git log` holds those.
- Never annotate a row "deferred", "later", or similar. Status words describe state, not
  priority.
- If a row cites a GitHub PR or issue known to be closed, drop the ref; run
  `gh pr list`/`gh issue list --state open` only when the answer would change a row.
- After the table: one line naming the plans `NEXT.md` lists as not tracked there, if
  any; and one sentence per row the session materially changed since `NEXT.md` was last
  written. No other commentary.
- **Write the table back.** After rendering, replace the `## Board` table in `NEXT.md` with
  the rendered one minus the `D` rows (`NEXT.md` holds only what is next; the session's
  done rows live in `git log`). Run `npx prettier --write NEXT.md`, commit the
  `NEXT.md`-only change to `main` (the docs exception allows a direct push) and push.
